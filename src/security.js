// بازار هوشمند — لایهٔ امنیت وب: هدرهای امنیتی، محافظت CSRF، بررسی Origin و محدودیت ورود با رمز
// همهٔ کنترل‌ها سمت سرور اجرا می‌شوند و هیچ راز یا کلیدی در این فایل ذخیره نمی‌شود.
import crypto from 'node:crypto';
import { getDb, saveDbSoon } from './store.js';
import { normalizeSeverity, trimSecurityEvents } from './monitor.js';

export const CSRF_COOKIE = 'sb_csrf';
export const CSRF_HEADER = 'x-csrf-token';
const SESSION_COOKIE = 'sb_session';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;
const MAX_EVENTS = 500;
const CSRF_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/* ------------------------------ کمکی ------------------------------ */

function requestIsHttps(req) {
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return proto === 'https';
}

function timingEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

function cookieValue(req, name) {
  const cookies = req.cookies || {};
  return String(cookies[name] || '');
}

/* --------------------------- رویداد امنیتی --------------------------- */

export function recordSecurityEvent({
  type,
  severity = 'info',
  ip = '',
  identity = '',
  path = '',
  detail = '',
} = {}) {
  const db = getDb();
  const events = Array.isArray(db.securityEvents) ? db.securityEvents : [];
  const event = {
    id: `sec_${crypto.randomBytes(8).toString('hex')}`,
    type: String(type || 'unknown').slice(0, 60),
    severity: normalizeSeverity(severity),
    ip: String(ip || '').slice(0, 60),
    identity: String(identity || '').slice(0, 120),
    path: String(path || '').slice(0, 160),
    detail: String(detail || '').slice(0, 240),
    at: new Date().toISOString(),
  };
  events.push(event);
  db.securityEvents = events.slice(-MAX_EVENTS);
  trimSecurityEvents(db);
  saveDbSoon();
  return event;
}

export function securityEvents(db = getDb(), limit = 50) {
  const events = Array.isArray(db.securityEvents) ? db.securityEvents : [];
  return events.slice(-Math.max(1, Math.min(limit, MAX_EVENTS))).reverse();
}

/* --------------------------- هدرهای امنیتی --------------------------- */

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

export function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-XSS-Protection', '0');
  if (requestIsHttps(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (String(req.path || '').startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  return next();
}

/* ------------------------- بررسی Origin/Referer ------------------------- */

function allowedHosts(req) {
  const hosts = new Set();
  const add = (value) => {
    const host = String(value || '').split(',')[0].trim().toLowerCase();
    if (host) hosts.add(host);
  };
  add(req.headers.host);
  add(req.headers['x-forwarded-host']);
  for (const item of String(process.env.ALLOWED_ORIGINS || '').split(',')) {
    const raw = item.trim();
    if (!raw) continue;
    try {
      const url = new URL(raw);
      add(url.host);
    } catch {
      add(raw);
    }
  }
  return hosts;
}

function originAllowed(req, origin) {
  if (!origin || origin === 'null') return false;
  try {
    const url = new URL(origin);
    if (!['https:', 'http:'].includes(url.protocol)) return false;
    return allowedHosts(req).has(url.host.toLowerCase());
  } catch {
    return false;
  }
}

export function originGuard(req, res, next) {
  if (!STATE_CHANGING.has(req.method)) return next();

  const origin = req.headers.origin;
  if (origin) {
    if (originAllowed(req, origin)) return next();
    recordSecurityEvent({
      type: 'origin_rejected',
      severity: 'warning',
      ip: req.ip,
      path: req.originalUrl,
      detail: `origin=${String(origin).slice(0, 120)}`,
    });
    return res.status(403).json({ error: 'origin_not_allowed' });
  }

  const referer = req.headers.referer;
  if (referer) {
    try {
      const url = new URL(referer);
      if (allowedHosts(req).has(url.host.toLowerCase())) return next();
    } catch {
      /* آدرس مرجع نامعتبر → رد می‌شود */
    }
    recordSecurityEvent({
      type: 'origin_rejected',
      severity: 'warning',
      ip: req.ip,
      path: req.originalUrl,
      detail: `referer=${String(referer).slice(0, 120)}`,
    });
    return res.status(403).json({ error: 'origin_not_allowed' });
  }

  // کلاینت غیرمرورگری (بدون Origin و Referer) در معرض CSRF نیست
  return next();
}

/* ----------------------------- محافظت CSRF ----------------------------- */

export function csrfIssue(req, res, next) {
  if (!req.cookies) req.cookies = {};
  let token = cookieValue(req, CSRF_COOKIE);
  // کوکی توکن فقط برای ناوبری صفحهٔ HTML یا درخواست صریح /api/csrf صادر می‌شود
  // تا کلاینت‌های JSON و آزمون‌های موجود کوکی نشست خود را از دست ندهند.
  const wantsHtml = String(req.headers.accept || '').includes('text/html');
  const explicit = String(req.path || '') === '/api/csrf';
  if ((!token || token.length < 20) && SAFE_METHODS.has(req.method) && (wantsHtml || explicit)) {
    token = crypto.randomBytes(32).toString('base64url');
    req.cookies[CSRF_COOKIE] = token;
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: requestIsHttps(req),
      path: '/',
      maxAge: CSRF_MAX_AGE_MS,
    });
  }
  req.csrfToken = token || '';
  return next();
}

export function csrfGuard(req, res, next) {
  if (!STATE_CHANGING.has(req.method)) return next();

  const browserRequest = Boolean(req.headers.origin || req.headers['sec-fetch-site']);
  const hasSession = Boolean(cookieValue(req, SESSION_COOKIE));
  if (!browserRequest || !hasSession) return next();

  const expected = cookieValue(req, CSRF_COOKIE);
  const sent = String(req.headers[CSRF_HEADER] || '');
  if (expected && sent && timingEqual(expected, sent)) return next();

  recordSecurityEvent({
    type: 'csrf_rejected',
    severity: 'warning',
    ip: req.ip,
    path: req.originalUrl,
    detail: expected ? 'token_mismatch' : 'token_missing',
  });
  return res.status(403).json({ error: 'csrf_token_invalid' });
}

/* ----------------------- محدودیت تلاش ورود با رمز ----------------------- */

const loginFailures = new Map();

function loginKey(req, identity) {
  const ip = String(req.ip || 'unknown');
  const who = String(identity || '').trim().toLowerCase();
  return `${ip}|${who}`;
}

export function loginStatus(req, identity) {
  const key = loginKey(req, identity);
  const entry = loginFailures.get(key);
  if (!entry) return { blocked: false, failures: 0, retryAfterMs: 0 };
  const elapsed = Date.now() - entry.first;
  if (elapsed > LOGIN_WINDOW_MS) {
    loginFailures.delete(key);
    return { blocked: false, failures: 0, retryAfterMs: 0 };
  }
  return {
    blocked: entry.count >= LOGIN_MAX_FAILURES,
    failures: entry.count,
    retryAfterMs: Math.max(0, LOGIN_WINDOW_MS - elapsed),
  };
}

export function registerLoginFailure(req, identity) {
  const key = loginKey(req, identity);
  const at = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || at - entry.first > LOGIN_WINDOW_MS) {
    loginFailures.set(key, { count: 1, first: at, last: at });
  } else {
    entry.count += 1;
    entry.last = at;
  }
  if (loginFailures.size > 5000) loginFailures.clear();
  return loginFailures.get(key).count;
}

export function clearLoginFailures(req, identity) {
  loginFailures.delete(loginKey(req, identity));
}

/** فقط برای آزمون‌ها: پاک‌کردن وضعیت درون‌حافظه */
export function resetSecurityState() {
  loginFailures.clear();
}

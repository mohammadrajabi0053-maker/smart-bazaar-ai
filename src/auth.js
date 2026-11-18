// احراز هویت: هش رمز با scrypt و کوکی امضاشده بدون وابستگی خارجی
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, getDb, saveDbSoon } from './store.js';

const COOKIE_NAME = 'sb_session';
const SESSION_DAYS = 30;

let cachedSecret = null;

export function sessionSecret() {
  if (cachedSecret) return cachedSecret;
  if (process.env.SESSION_SECRET) {
    cachedSecret = process.env.SESSION_SECRET;
    return cachedSecret;
  }
  const file = path.join(DATA_DIR, '.session-secret');
  try {
    cachedSecret = fs.readFileSync(file, 'utf8').trim();
    if (cachedSecret.length >= 32) return cachedSecret;
  } catch {
    /* فایل وجود ندارد */
  }
  cachedSecret = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, cachedSecret, { mode: 0o600 });
  return cachedSecret;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== candidate.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function sign(value) {
  return crypto.createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

export function createSessionToken(user) {
  const payload = Buffer.from(
    JSON.stringify({ uid: user.id, role: user.role, iat: Date.now() }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.uid) return null;
    if (Date.now() - Number(data.iat || 0) > SESSION_DAYS * 864e5) return null;
    return data;
  } catch {
    return null;
  }
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function setSessionCookie(res, user) {
  const token = createSessionToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: SESSION_DAYS * 864e5,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function currentUser(req) {
  const token = req.cookies?.[COOKIE_NAME];
  const session = readSessionToken(token);
  if (!session) return null;
  const user = getDb().users.find((u) => u.id === session.uid);
  if (!user || user.status === 'blocked') return null;
  return user;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    storeName: user.storeName || null,
    storeSlug: user.storeSlug || null,
    phone: user.phone || null,
    status: user.status,
    createdAt: user.createdAt,
  };
}

export function attachUser(req, _res, next) {
  req.user = currentUser(req);
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'auth_required' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

export function touchUser(user, patch) {
  Object.assign(user, patch, { updatedAt: new Date().toISOString() });
  saveDbSoon();
}

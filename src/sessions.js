// بازار هوشمند — دفتر نشست‌ها و کدهای بازیابی
// نشست‌ها در سمت سرور ثبت می‌شوند تا ابطال انتخابی/گروهی واقعاً اعمال شود.
import crypto from 'node:crypto';
import { saveDbSoon } from './store.js';

const MAX_SESSIONS_PER_USER = 20;
const MAX_RECOVERY_CODES = 10;
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// انقضای نشست: سقف مطلق و سقف بیکاری (بدون فعالیت)
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;

export function sessionId() {
  return `ses_${crypto.randomBytes(9).toString('hex')}`;
}

function sessionsOf(db) {
  if (!Array.isArray(db.sessions)) db.sessions = [];
  return db.sessions;
}

export function registerSession(db, user, { sid, ip = '', ua = '' } = {}) {
  const list = sessionsOf(db);
  const nowIso = new Date().toISOString();
  const row = {
    id: sid || sessionId(),
    userId: user.id,
    ip: String(ip || '').slice(0, 60),
    ua: String(ua || '').slice(0, 180),
    createdAt: nowIso,
    lastSeenAt: nowIso,
    expiresAt: new Date(Date.parse(nowIso) + SESSION_ABSOLUTE_MS).toISOString(),
    revokedAt: null,
  };
  list.push(row);
  const mine = list.filter((item) => item.userId === user.id && !item.revokedAt);
  if (mine.length > MAX_SESSIONS_PER_USER) {
    for (const old of mine.slice(0, mine.length - MAX_SESSIONS_PER_USER)) {
      old.revokedAt = nowIso;
      old.revokedReason = 'limit';
    }
  }
  if (list.length > 2000) {
    db.sessions = list.filter((item) => !item.revokedAt).slice(-1000);
  }
  saveDbSoon();
  return row;
}

export function findSession(db, sid) {
  if (!sid || !Array.isArray(db.sessions)) return null;
  return db.sessions.find((row) => row.id === sid) || null;
}

export function sessionExpiry(row) {
  const created = Date.parse(row?.createdAt || '') || Date.now();
  const seen = Date.parse(row?.lastSeenAt || '') || created;
  const stored = Date.parse(row?.expiresAt || '') || created + SESSION_ABSOLUTE_MS;
  // سقف مطلق قابل تمدید نیست: کمینهٔ مقدار ثبت‌شده و createdAt + ۳۰ روز
  const absolute = Math.min(stored, created + SESSION_ABSOLUTE_MS);
  return { absolute, idle: seen + SESSION_IDLE_MS };
}

export function sessionExpired(row, now = Date.now()) {
  if (!row) return true;
  const { absolute, idle } = sessionExpiry(row);
  return now >= absolute || now >= idle;
}

// چرخش شناسهٔ نشست پس از عملیات حساس (جلوگیری از Session Fixation و استفادهٔ مجدد)
export function rotateSession(db, user, oldSid, { ip = '', ua = '' } = {}) {
  if (oldSid) revokeSession(db, user.id, oldSid, 'rotated');
  return registerSession(db, user, { ip, ua });
}

let lastTouch = 0;

export function touchSession(db, sid, { ip = '', ua = '' } = {}) {
  const row = findSession(db, sid);
  if (!row || row.revokedAt) return row;
  const nowMs = Date.now();
  if (sessionExpired(row, nowMs)) {
    row.revokedAt = new Date(nowMs).toISOString();
    row.revokedReason = 'expired';
    saveDbSoon();
    return row;
  }
  if (nowMs - lastTouch < 60000) return row;
  lastTouch = nowMs;
  row.lastSeenAt = new Date(nowMs).toISOString();
  if (ip) row.ip = String(ip).slice(0, 60);
  if (ua) row.ua = String(ua).slice(0, 180);
  saveDbSoon();
  return row;
}

export function listSessions(db, userId) {
  return (Array.isArray(db.sessions) ? db.sessions : [])
    .filter((row) => row.userId === userId)
    .sort((a, b) => String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
}

function deviceLabel(ua = '') {
  const text = String(ua);
  const os = /Windows/i.test(text) ? 'Windows'
    : /Android/i.test(text) ? 'Android'
      : /iPhone|iPad|iOS/i.test(text) ? 'iOS'
        : /Mac OS X/i.test(text) ? 'macOS'
          : /Linux/i.test(text) ? 'Linux' : '—';
  const browser = /Edg\//i.test(text) ? 'Edge'
    : /OPR\//i.test(text) ? 'Opera'
      : /Chrome\//i.test(text) ? 'Chrome'
        : /Firefox\//i.test(text) ? 'Firefox'
          : /Safari\//i.test(text) ? 'Safari' : '—';
  return { os, browser };
}

export function sessionView(row, currentSid = null) {
  const { os, browser } = deviceLabel(row.ua);
  return {
    id: row.id,
    current: row.id === currentSid,
    ip: row.ip || '',
    os,
    browser,
    userAgent: row.ua || '',
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    revokedAt: row.revokedAt || null,
    revokedReason: row.revokedReason || null,
    expiresAt: new Date(sessionExpiry(row).absolute).toISOString(),
    idleExpiresAt: new Date(sessionExpiry(row).idle).toISOString(),
    expired: sessionExpired(row),
    active: !row.revokedAt,
  };
}

export function revokeSession(db, userId, sid, reason = 'user') {
  const row = findSession(db, sid);
  if (!row || row.userId !== userId) return null;
  if (!row.revokedAt) {
    row.revokedAt = new Date().toISOString();
    row.revokedReason = reason;
    saveDbSoon();
  }
  return row;
}

export function revokeOtherSessions(db, userId, keepSid) {
  const nowIso = new Date().toISOString();
  let count = 0;
  for (const row of sessionsOf(db)) {
    if (row.userId !== userId || row.revokedAt || row.id === keepSid) continue;
    row.revokedAt = nowIso;
    row.revokedReason = 'revoke_others';
    count += 1;
  }
  if (count) saveDbSoon();
  return count;
}

export function revokeAllSessions(db, userId) {
  const nowIso = new Date().toISOString();
  let count = 0;
  for (const row of sessionsOf(db)) {
    if (row.userId !== userId || row.revokedAt) continue;
    row.revokedAt = nowIso;
    row.revokedReason = 'revoke_all';
    count += 1;
  }
  if (count) saveDbSoon();
  return count;
}

export function activeSessionCount(db, userId) {
  return listSessions(db, userId).filter((row) => !row.revokedAt).length;
}

/* ----------------------------- کدهای بازیابی ----------------------------- */

export function normalizeRecoveryCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function recoveryHash(code) {
  return crypto.createHash('sha256').update(`sb-recovery:${normalizeRecoveryCode(code)}`).digest('hex');
}

function randomCode() {
  const bytes = crypto.randomBytes(10);
  let out = '';
  for (const byte of bytes) out += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
  return `SB-${out.slice(0, 5)}-${out.slice(5, 10)}`;
}

export function generateRecoveryCodes(db, user, count = MAX_RECOVERY_CODES) {
  const total = Math.max(1, Math.min(MAX_RECOVERY_CODES, Number(count) || MAX_RECOVERY_CODES));
  const codes = [];
  const records = [];
  const createdAt = new Date().toISOString();
  for (let index = 0; index < total; index += 1) {
    const code = randomCode();
    codes.push(code);
    records.push({ hash: recoveryHash(code), createdAt, usedAt: null });
  }
  user.recoveryCodes = records;
  user.recoveryCodesCreatedAt = createdAt;
  saveDbSoon();
  return codes;
}

export function recoveryCodeCount(user) {
  const list = Array.isArray(user?.recoveryCodes) ? user.recoveryCodes : [];
  return {
    total: list.length,
    remaining: list.filter((row) => !row.usedAt).length,
    createdAt: user?.recoveryCodesCreatedAt || null,
  };
}

export function verifyRecoveryCode(db, user, code) {
  const normalized = normalizeRecoveryCode(code);
  if (normalized.length < 8) return false;
  const list = Array.isArray(user?.recoveryCodes) ? user.recoveryCodes : [];
  const hash = recoveryHash(normalized);
  const row = list.find((item) => item.hash === hash && !item.usedAt);
  if (!row) return false;
  row.usedAt = new Date().toISOString();
  saveDbSoon();
  return true;
}

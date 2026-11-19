// بازار هوشمند — پشتیبان‌گیری رمزگذاری‌شده (AES-256-GCM) با کلید مستقل از SESSION_SECRET
// هیچ کلید یا رمزی در کد قرار نمی‌گیرد؛ کلید از متغیر محیطی BACKUP_KEY یا فایل محلی 0600 خوانده می‌شود.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { DATA_DIR, UPLOAD_DIR, getDb, id, saveDbSoon } from './store.js';
import { audit, verifyChain } from './finance.js';

export const BACKUP_FORMAT = 'sb-backup-v1';
export const BACKUP_MAGIC = 'SBBAK1';
export const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const MAX_BYTES = 50 * 1024 * 1024;
const KEY_FILE = path.join(DATA_DIR, '.backup-key');
const KDF = { name: 'scrypt', N: 16384, r: 8, p: 1, keylen: 32 };

export class BackupError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'BackupError';
    this.code = code;
    this.status = status;
  }
}

let cachedKey = null;

export function backupKeySource() {
  return String(process.env.BACKUP_KEY || '').trim() ? 'env' : 'file';
}

export function backupKey() {
  if (cachedKey) return cachedKey;
  const fromEnv = String(process.env.BACKUP_KEY || '').trim();
  if (fromEnv) {
    const buf = /^[0-9a-fA-F]{64}$/.test(fromEnv) ? Buffer.from(fromEnv, 'hex') : Buffer.from(fromEnv, 'utf8');
    if (buf.length < 32) throw new BackupError('backup_key_invalid', 500);
    cachedKey = buf.subarray(0, 32);
    return cachedKey;
  }
  try {
    const raw = fs.readFileSync(KEY_FILE, 'utf8').trim();
    const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (buf.length >= 32) {
      cachedKey = buf.subarray(0, 32);
      return cachedKey;
    }
  } catch {
    /* فایل کلید وجود ندارد → ساخته می‌شود */
  }
  const generated = crypto.randomBytes(32);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(KEY_FILE, generated.toString('hex'), { mode: 0o600 });
  cachedKey = generated;
  return cachedKey;
}

/** فقط برای آزمون‌ها: پاک‌کردن کلید کش‌شده */
export function resetBackupKeyCache() {
  cachedKey = null;
}

export function backupFingerprint() {
  const hex = backupKey().toString('hex');
  return crypto.createHash('sha256').update(`sb-fingerprint:${hex}`).digest('hex').slice(0, 8);
}

function keyCheckToken() {
  const hex = backupKey().toString('hex');
  return crypto.createHash('sha256').update(`sb-keycheck:${hex}`).digest('hex').slice(0, 16);
}

function deriveKey(salt) {
  return crypto.scryptSync(backupKey(), salt, KDF.keylen, {
    N: KDF.N, r: KDF.r, p: KDF.p, maxmem: 64 * 1024 * 1024,
  });
}

export function collectionCounts(db) {
  const counts = {};
  for (const [key, value] of Object.entries(db || {})) {
    if (Array.isArray(value)) counts[key] = value.length;
  }
  return counts;
}

function uploadManifest() {
  try {
    const names = fs.readdirSync(UPLOAD_DIR).filter((name) => !name.startsWith('.')).slice(0, 500);
    return names.map((name) => {
      const file = path.join(UPLOAD_DIR, name);
      const data = fs.readFileSync(file);
      return {
        name,
        bytes: data.length,
        sha256: crypto.createHash('sha256').update(data).digest('hex'),
      };
    });
  } catch {
    return [];
  }
}

export function createBackup(db, { reason = 'manual', includeSecrets = false, now = new Date() } = {}) {
  const createdAt = now.toISOString();
  const chain = verifyChain(db);
  const payload = {
    format: BACKUP_FORMAT,
    schema: 1,
    createdAt,
    reason: String(reason).slice(0, 60),
    environment: db?.settings?.environment === 'live' ? 'live' : 'demo',
    counts: collectionCounts(db),
    chain: { valid: chain.valid === true, entries: chain.entries || 0, head: chain.head || null },
    uploads: uploadManifest(),
    data: db,
  };
  if (includeSecrets) payload.secrets = { sessionSecret: true };
  const plain = zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const header = {
    format: BACKUP_FORMAT,
    alg: 'aes-256-gcm',
    kdf: { ...KDF, salt: salt.toString('hex') },
    iv: iv.toString('hex'),
    createdAt,
    reason: payload.reason,
    environment: payload.environment,
    counts: payload.counts,
    chain: payload.chain,
    fingerprint: backupFingerprint(),
    keyCheck: keyCheckToken(),
    includeSecrets,
    bytes: plain.length,
  };
  const headerJson = JSON.stringify(header);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(salt), iv);
  cipher.setAAD(Buffer.from(headerJson, 'utf8'));
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const buffer = Buffer.from(
    [BACKUP_MAGIC, headerJson, body.toString('base64'), tag.toString('base64')].join('\n'),
    'utf8',
  );
  return {
    buffer,
    header,
    payload,
    filename: `smart-bazaar-${createdAt.replace(/[:.]/g, '-')}.sbbak`,
    size: buffer.length,
  };
}

function readEnvelope(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input || ''), 'utf8');
  if (buffer.length === 0) throw new BackupError('backup_corrupt');
  if (buffer.length > MAX_BYTES) throw new BackupError('backup_too_large', 413);
  const parts = buffer.toString('utf8').split('\n');
  if (parts.length !== 4 || parts[0] !== BACKUP_MAGIC) throw new BackupError('backup_format_unknown');
  let header;
  try {
    header = JSON.parse(parts[1]);
  } catch {
    throw new BackupError('backup_corrupt');
  }
  if (header?.format !== BACKUP_FORMAT || header?.alg !== 'aes-256-gcm' || !header?.iv || !header?.kdf?.salt) {
    throw new BackupError('backup_format_unknown');
  }
  return {
    header,
    headerJson: parts[1],
    body: Buffer.from(parts[2], 'base64'),
    tag: Buffer.from(parts[3], 'base64'),
  };
}

/** خواندن هدر بدون کلید (برای نمایش فهرست) */
export function backupHeader(input) {
  return readEnvelope(input).header;
}

export function decryptBackup(input) {
  const { header, headerJson, body, tag } = readEnvelope(input);
  if (header.keyCheck && header.keyCheck !== keyCheckToken()) throw new BackupError('backup_key_mismatch', 400);
  let plain;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      deriveKey(Buffer.from(header.kdf.salt, 'hex')),
      Buffer.from(header.iv, 'hex'),
    );
    decipher.setAAD(Buffer.from(headerJson, 'utf8'));
    decipher.setAuthTag(tag);
    plain = Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    // کلید درست است اما احراز اصالت شکست خورده → فایل دست‌کاری شده
    throw new BackupError('backup_tampered', 400);
  }
  let payload;
  try {
    payload = JSON.parse(zlib.gunzipSync(plain).toString('utf8'));
  } catch {
    throw new BackupError('backup_corrupt');
  }
  if (payload?.format !== BACKUP_FORMAT || !payload.data || typeof payload.data !== 'object') {
    throw new BackupError('backup_corrupt');
  }
  return { header, payload };
}

export function verifyBackup(input) {
  const { header, payload } = decryptBackup(input);
  const counts = collectionCounts(payload.data);
  for (const [key, value] of Object.entries(header.counts || {})) {
    if (counts[key] !== value) throw new BackupError('backup_mismatch');
  }
  const chain = verifyChain(payload.data);
  return {
    ok: true,
    header,
    counts,
    chain,
    createdAt: header.createdAt,
    environment: header.environment,
    uploads: Array.isArray(payload.uploads) ? payload.uploads.length : 0,
  };
}

export function readBackupForRestore(input) {
  const { header, payload } = decryptBackup(input);
  const counts = collectionCounts(payload.data);
  for (const [key, value] of Object.entries(header.counts || {})) {
    if (counts[key] !== value) throw new BackupError('backup_mismatch');
  }
  const chain = verifyChain(payload.data);
  return { header, counts, chain, data: payload.data, environment: header.environment };
}

export function saveBackupFile(buffer, filename) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const safe = String(filename || `backup-${Date.now()}.sbbak`).replace(/[^\w.-]/g, '_').slice(0, 90);
  const file = path.join(BACKUP_DIR, safe);
  fs.writeFileSync(file, buffer, { mode: 0o600 });
  return { file, name: safe, size: buffer.length };
}

export function readBackupFile(name) {
  const safe = String(name || '').replace(/[^\w.-]/g, '_');
  const file = path.join(BACKUP_DIR, safe);
  if (!safe || !fs.existsSync(file)) throw new BackupError('backup_not_found', 404);
  return fs.readFileSync(file);
}

/** اجرای یک پشتیبان‌گیری زمان‌بندی‌شده با حفظ سقف نگهداری */
export function runScheduledBackup(db = getDb(), { force = false } = {}) {
  const cfg = db.settings?.backup;
  if (!cfg?.enabled && !force) return null;
  const made = createBackup(db, { reason: 'scheduled' });
  const saved = saveBackupFile(made.buffer, made.filename);
  const row = {
    id: id(),
    createdAt: made.header.createdAt,
    reason: 'scheduled',
    size: saved.size,
    fingerprint: made.header.fingerprint,
    chain: made.header.chain,
    environment: made.header.environment,
    counts: made.header.counts,
    file: saved.name,
    verifiedAt: made.header.createdAt,
    createdBy: 'system',
  };
  const history = Array.isArray(db.backupHistory) ? db.backupHistory : (db.backupHistory = []);
  history.push(row);
  const keep = Math.max(1, Math.min(30, Number(cfg?.retention) || 7));
  const scheduled = history.filter((item) => item.reason === 'scheduled');
  const excess = scheduled.slice(0, Math.max(0, scheduled.length - keep));
  for (const old of excess) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, old.file));
    } catch {
      /* فایل قبلاً حذف شده */
    }
  }
  db.backupHistory = history.filter((item) => !excess.includes(item)).slice(-50);
  audit(db, {
    actorId: null, actorRole: 'system', action: 'backup_scheduled', target: row.id,
    meta: { size: row.size }, ip: '',
  });
  saveDbSoon();
  return row;
}

let timer = null;

export function startBackupScheduler({ tickMs = 60000 } = {}) {
  if (timer) return { running: true, tickMs };
  const every = Math.max(5000, Number(tickMs) || 60000);
  timer = setInterval(() => {
    try {
      const db = getDb();
      const cfg = db.settings?.backup;
      if (!cfg?.enabled) return;
      const last = (db.backupHistory || []).filter((row) => row.reason === 'scheduled').slice(-1)[0];
      const interval = Math.max(1, Number(cfg.intervalHours) || 24) * 3600000;
      const due = !last || Date.now() - Date.parse(last.createdAt) >= interval;
      if (due) runScheduledBackup(db);
    } catch (err) {
      console.error('scheduled backup failed', err.message);
    }
  }, every);
  if (typeof timer.unref === 'function') timer.unref();
  return { running: true, tickMs: every };
}

export function stopBackupScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function schedulerRunning() {
  return Boolean(timer);
}

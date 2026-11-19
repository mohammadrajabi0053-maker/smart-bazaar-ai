// بازار هوشمند — پشتیبان‌گیری رمزگذاری‌شده (AES-256-GCM) با کلید مستقل از SESSION_SECRET
// هیچ کلید یا رمزی در کد قرار نمی‌گیرد؛ کلید از متغیر محیطی BACKUP_KEY یا فایل محلی 0600 خوانده می‌شود.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { DATA_DIR, UPLOAD_DIR, getDb, id, saveDbSoon } from './store.js';
import { audit, chainKey, installChainKey, verifyChain } from './finance.js';

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

const UPLOAD_LIMITS = { maxFiles: 500, maxFileBytes: 2 * 1024 * 1024, maxTotalBytes: 20 * 1024 * 1024 };
const UPLOAD_NAME = /^[\w.-]{1,80}$/;

export function uploadLimits() {
  return { ...UPLOAD_LIMITS };
}

/** جمع‌آوری بایت‌های تصاویر برای پشتیبان (با سقف حجم تا بستهٔ پشتیبان از حد مجاز نگذرد) */
function collectUploads() {
  const files = [];
  let totalBytes = 0;
  let truncated = false;
  let skipped = 0;
  let names = [];
  try {
    names = fs.readdirSync(UPLOAD_DIR).filter((name) => !name.startsWith('.')).sort();
  } catch {
    return { files, totalBytes, truncated, skipped, limits: uploadLimits() };
  }
  for (const name of names) {
    if (!UPLOAD_NAME.test(name)) {
      skipped += 1;
      continue;
    }
    if (files.length >= UPLOAD_LIMITS.maxFiles) {
      truncated = true;
      break;
    }
    let data;
    try {
      const stat = fs.statSync(path.join(UPLOAD_DIR, name));
      if (!stat.isFile() || stat.size > UPLOAD_LIMITS.maxFileBytes) {
        skipped += 1;
        continue;
      }
      if (totalBytes + stat.size > UPLOAD_LIMITS.maxTotalBytes) {
        truncated = true;
        continue;
      }
      data = fs.readFileSync(path.join(UPLOAD_DIR, name));
    } catch {
      skipped += 1;
      continue;
    }
    totalBytes += data.length;
    files.push({
      name,
      bytes: data.length,
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      data: data.toString('base64'),
    });
  }
  return { files, totalBytes, truncated, skipped, limits: uploadLimits() };
}

/** اعتبارسنجی فهرست تصاویر داخل پشتیبان (هش هر فایل بررسی می‌شود) */
function validateUploads(list) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list) || list.length > UPLOAD_LIMITS.maxFiles) throw new BackupError('backup_corrupt');
  const out = [];
  for (const item of list) {
    const name = String(item?.name || '');
    if (!UPLOAD_NAME.test(name)) throw new BackupError('backup_corrupt');
    if (item?.data === undefined) {
      out.push({ name, bytes: Number(item?.bytes) || 0, sha256: String(item?.sha256 || ''), buffer: null });
      continue;
    }
    const buffer = Buffer.from(String(item.data || ''), 'base64');
    if (buffer.length !== Number(item?.bytes || -1)) throw new BackupError('backup_corrupt');
    if (crypto.createHash('sha256').update(buffer).digest('hex') !== String(item?.sha256 || '')) {
      throw new BackupError('backup_corrupt');
    }
    out.push({ name, bytes: buffer.length, sha256: item.sha256, buffer });
  }
  return out;
}

/** نوشتن تصاویر بازیابی‌شده روی دیسک؛ فایل‌های یکسان دوباره نوشته نمی‌شوند */
export function restoreUploads(files = []) {
  const result = { written: 0, skipped: 0, bytes: 0 };
  fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o755 });
  for (const file of files) {
    if (!file?.buffer) {
      result.skipped += 1;
      continue;
    }
    const target = path.join(UPLOAD_DIR, file.name);
    try {
      if (fs.existsSync(target)) {
        const existing = fs.readFileSync(target);
        if (crypto.createHash('sha256').update(existing).digest('hex') === file.sha256) {
          result.skipped += 1;
          continue;
        }
      }
      fs.writeFileSync(target, file.buffer, { mode: 0o644 });
      result.written += 1;
      result.bytes += file.buffer.length;
    } catch {
      result.skipped += 1;
    }
  }
  return result;
}

export function createBackup(db, { reason = 'manual', includeSecrets = false, now = new Date() } = {}) {
  const createdAt = now.toISOString();
  const chain = verifyChain(db);
  const uploads = collectUploads();
  const payload = {
    format: BACKUP_FORMAT,
    schema: 2,
    createdAt,
    reason: String(reason).slice(0, 60),
    environment: db?.settings?.environment === 'live' ? 'live' : 'demo',
    counts: collectionCounts(db),
    chain: {
      valid: chain.valid === true,
      entries: chain.entries || 0,
      head: chain.head || null,
      signed: chain.signed || 0,
      legacy: chain.legacy || 0,
      hmac: chain.hmac || 'unsigned',
    },
    uploads: uploads.files,
    uploadsMeta: {
      count: uploads.files.length,
      totalBytes: uploads.totalBytes,
      truncated: uploads.truncated,
      skipped: uploads.skipped,
      limits: uploads.limits,
    },
    data: db,
  };
  // کلید زنجیره در بستهٔ رمزگذاری‌شده می‌رود تا پس از Redeploy قابل بازگردانی باشد
  payload.secrets = { chainKeyHex: chainKey().toString('hex'), sessionSecret: includeSecrets === true };
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
    uploads: payload.uploadsMeta,
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
  const chainKeyHex = kitChainKey(payload);
  const chain = verifyChain(payload.data, { keyHex: chainKeyHex });
  const uploads = validateUploads(payload.uploads);
  return {
    ok: true,
    header,
    counts,
    chain,
    createdAt: header.createdAt,
    environment: header.environment,
    uploads: uploads.length,
    uploadsMeta: {
      count: uploads.length,
      totalBytes: uploads.reduce((sum, file) => sum + file.bytes, 0),
      truncated: Boolean(payload.uploadsMeta?.truncated),
      legacy: uploads.some((file) => !file.buffer),
    },
  };
}

export function readBackupForRestore(input) {
  const { header, payload } = decryptBackup(input);
  const counts = collectionCounts(payload.data);
  for (const [key, value] of Object.entries(header.counts || {})) {
    if (counts[key] !== value) throw new BackupError('backup_mismatch');
  }
  const chainKeyHex = kitChainKey(payload);
  const chain = verifyChain(payload.data, { keyHex: chainKeyHex });
  const uploads = validateUploads(payload.uploads);
  return {
    header,
    counts,
    chain,
    data: payload.data,
    environment: header.environment,
    uploads,
    chainKeyHex,
    uploadsMeta: {
      count: uploads.length,
      totalBytes: uploads.reduce((sum, file) => sum + file.bytes, 0),
      truncated: Boolean(payload.uploadsMeta?.truncated),
    },
  };
}

/** کلید زنجیرهٔ داخل بستهٔ پشتیبان (برای بررسی درست حتی با کلید محلی متفاوت) */
function kitChainKey(payload) {
  const hex = String(payload?.secrets?.chainKeyHex || '').trim();
  return /^[0-9a-f]{64}$/i.test(hex) ? hex : null;
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

/* ---------- کیت بازیابی کلیدها (برای بازگرداندن پس از Redeploy) ---------- */

const KIT_MAGIC = 'SBKEY1';
const KIT_FORMAT = 'sb-key-kit-v1';

/** ساخت کیت رمزگذاری‌شدهٔ کلیدها با گذرواژهٔ خود مالک (حداقل ۱۲ نویسه) */
export function createRecoveryKit(passphrase, { now = new Date() } = {}) {
  const pass = String(passphrase || '');
  if (pass.length < 12) throw new BackupError('passphrase_weak', 400);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const header = {
    format: KIT_FORMAT,
    alg: 'aes-256-gcm',
    kdf: { ...KDF, salt: salt.toString('hex') },
    iv: iv.toString('hex'),
    createdAt: now.toISOString(),
    fingerprint: backupFingerprint(),
  };
  const headerJson = JSON.stringify(header);
  const body = JSON.stringify({
    backupKeyHex: backupKey().toString('hex'),
    chainKeyHex: chainKey().toString('hex'),
    createdAt: header.createdAt,
  });
  const key = crypto.scryptSync(pass, salt, KDF.keylen, {
    N: KDF.N, r: KDF.r, p: KDF.p, maxmem: 64 * 1024 * 1024,
  });
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(headerJson, 'utf8'));
  const enc = Buffer.concat([cipher.update(Buffer.from(body, 'utf8')), cipher.final()]);
  const buffer = Buffer.from(
    [KIT_MAGIC, headerJson, enc.toString('base64'), cipher.getAuthTag().toString('base64')].join('\n'),
    'utf8',
  );
  return {
    buffer,
    header,
    filename: `smart-bazaar-keys-${header.createdAt.slice(0, 10)}.sbkey`,
    size: buffer.length,
  };
}

/** خواندن کیت با گذرواژه؛ گذرواژهٔ اشتباه → kit_passphrase_invalid */
export function readRecoveryKit(input, passphrase) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input || ''), 'utf8');
  if (!buffer.length || buffer.length > 64 * 1024) throw new BackupError('kit_corrupt', 400);
  const parts = buffer.toString('utf8').split('\n');
  if (parts.length !== 4 || parts[0] !== KIT_MAGIC) throw new BackupError('kit_format_unknown', 400);
  let header;
  try {
    header = JSON.parse(parts[1]);
  } catch {
    throw new BackupError('kit_corrupt', 400);
  }
  if (header?.format !== KIT_FORMAT || !header?.iv || !header?.kdf?.salt) throw new BackupError('kit_format_unknown', 400);
  let plain;
  try {
    const key = crypto.scryptSync(String(passphrase || ''), Buffer.from(header.kdf.salt, 'hex'), KDF.keylen, {
      N: header.kdf.N || KDF.N, r: header.kdf.r || KDF.r, p: header.kdf.p || KDF.p, maxmem: 64 * 1024 * 1024,
    });
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(header.iv, 'hex'));
    decipher.setAAD(Buffer.from(parts[1], 'utf8'));
    decipher.setAuthTag(Buffer.from(parts[3], 'base64'));
    plain = Buffer.concat([decipher.update(Buffer.from(parts[2], 'base64')), decipher.final()]);
  } catch {
    throw new BackupError('kit_passphrase_invalid', 400);
  }
  let kit;
  try {
    kit = JSON.parse(plain.toString('utf8'));
  } catch {
    throw new BackupError('kit_corrupt', 400);
  }
  if (!/^[0-9a-f]{64}$/i.test(String(kit?.backupKeyHex)) || !/^[0-9a-f]{64}$/i.test(String(kit?.chainKeyHex))) {
    throw new BackupError('kit_corrupt', 400);
  }
  return { backupKeyHex: kit.backupKeyHex, chainKeyHex: kit.chainKeyHex, createdAt: kit.createdAt, header };
}

/** نصب کلیدهای بازیابی‌شده روی این نمونه (پس از Redeploy) */
export function installKeys({ backupKeyHex, chainKeyHex } = {}) {
  const out = { backupKey: false, chainKey: false, fingerprint: null };
  if (/^[0-9a-f]{64}$/i.test(String(backupKeyHex || ''))) {
    const clean = String(backupKeyHex).toLowerCase();
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    fs.writeFileSync(KEY_FILE, clean, { mode: 0o600 });
    cachedKey = Buffer.from(clean, 'hex');
    out.backupKey = true;
  }
  if (/^[0-9a-f]{64}$/i.test(String(chainKeyHex || ''))) {
    installChainKey(String(chainKeyHex).toLowerCase());
    out.chainKey = true;
  }
  out.fingerprint = backupFingerprint();
  return out;
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

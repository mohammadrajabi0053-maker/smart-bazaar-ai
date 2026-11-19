// بازار هوشمند — لایهٔ امنیت مالی: AES-256-GCM، TOTP (RFC 6238)، هش و شناسهٔ رهگیری
import crypto from 'node:crypto';
import { sessionSecret } from './auth.js';

const KEY_CONTEXT = 'smart-bazaar-finance-key-v1';
let cachedKey = null;

function key() {
  if (cachedKey) return cachedKey;
  cachedKey = crypto.scryptSync(sessionSecret(), KEY_CONTEXT, 32);
  return cachedKey;
}

/* --------------------------- رمزگذاری AES-256-GCM --------------------------- */

export function encryptJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value ?? null), 'utf8'), cipher.final()]);
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
}

export function decryptJson(payload) {
  if (!payload || payload.v !== 1 || !payload.iv || !payload.data || !payload.tag) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(payload.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const plain = Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]);
    return JSON.parse(plain.toString('utf8'));
  } catch {
    return null;
  }
}

export function isEncrypted(value) {
  return Boolean(value && value.v === 1 && value.iv && value.tag && value.data);
}

/* ------------------------------- هش و توکن ------------------------------- */

export function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

export function trackingId(prefix = 'RPT') {
  return `${prefix}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/* --------------------------------- TOTP --------------------------------- */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input) {
  const clean = String(input || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    const idx = B32.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function newTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function totpCode(secret, at = Date.now(), step = 30) {
  const secretBuf = base32Decode(secret);
  if (!secretBuf.length) return '';
  const counter = Math.floor(at / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24)
    | (hmac[offset + 1] << 16)
    | (hmac[offset + 2] << 8)
    | hmac[offset + 3];
  return String(binary % 1e6).padStart(6, '0');
}

export function verifyTotp(secret, code, { window = 1, step = 30, at = Date.now() } = {}) {
  const candidate = String(code || '').replace(/\D/g, '');
  if (candidate.length !== 6 || !secret) return false;
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = totpCode(secret, at + offset * step * 1000, step);
    if (expected && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(candidate))) return true;
  }
  return false;
}

export function otpauthUrl(secret, account = 'owner@bazaar', issuer = 'Smart Bazaar') {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

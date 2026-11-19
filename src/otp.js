// بازار هوشمند — احراز هویت تلفنی: نرمال‌سازی شماره، کد یک‌بارمصرف و محدودیت تلاش
import crypto from 'node:crypto';
import { id } from './store.js';
import { sha256 } from './secure.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_WINDOW_MS = 10 * 60 * 1000;
const RESEND_MAX = 5;
const HOUR_WINDOW_MS = 60 * 60 * 1000;
const HOUR_MAX = 20;

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toLatinDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

/**
 * شماره را به شکل متعارف +<digits> برمی‌گرداند یا null.
 * شمارهٔ محلی ایران (09xxxxxxxxx) به +989xxxxxxxxx تبدیل می‌شود.
 */
export function normalizePhone(raw) {
  let digits = toLatinDigits(raw).replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  const plus = digits.startsWith('+');
  let body = digits.replace(/\+/g, '');
  if (!/^\d{8,15}$/.test(body)) return null;
  if (!plus && body.startsWith('09') && body.length === 11) body = `98${body.slice(1)}`;
  if (!plus && body.startsWith('9') && body.length === 10) body = `98${body}`;
  return `+${body}`;
}

/** کلید مقایسه برای جلوگیری از ثبت تکراری (۱۰ رقم آخر) */
export function phoneKey(raw) {
  const normalized = normalizePhone(raw);
  if (!normalized) return '';
  return normalized.replace(/\D/g, '').slice(-10);
}

export function maskPhone(raw) {
  const normalized = normalizePhone(raw);
  if (!normalized) return '';
  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 6) return '••••';
  return `${normalized.slice(0, normalized.length - 6)}••••${digits.slice(-2)}`;
}

function randomCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function codeHash(phone, code) {
  return sha256(`${phone}:${code}:${process.env.SESSION_SECRET || 'otp'}`);
}

function recent(db, phone, sinceMs) {
  const from = Date.now() - sinceMs;
  return (db.otpChallenges || []).filter((c) => c.phone === phone && Date.parse(c.createdAt) >= from);
}

export function cleanupOtps(db, maxAgeMs = 24 * 60 * 60 * 1000) {
  const from = Date.now() - maxAgeMs;
  const list = db.otpChallenges || [];
  db.otpChallenges = list.filter((c) => Date.parse(c.createdAt) >= from);
  return db.otpChallenges.length;
}

/**
 * ساخت کد تأیید. در نبود درگاه پیامک، کد در پاسخ به‌صورت «حالت پیش‌نمایش» برگردانده می‌شود.
 * delivery: 'sms' فقط وقتی درگاه تنظیم شده باشد (SMS_PROVIDER) — فعلاً پیاده نشده است.
 */
export function requestOtp(db, { phone, purpose = 'login', payload = {}, ip = '' }) {
  const normalized = normalizePhone(phone);
  if (!normalized) return { ok: false, status: 400, error: 'phone_invalid' };

  const lastTen = recent(db, normalized, RESEND_WINDOW_MS);
  if (lastTen.length >= RESEND_MAX) return { ok: false, status: 429, error: 'otp_too_many_requests' };
  if (recent(db, normalized, HOUR_WINDOW_MS).length >= HOUR_MAX) {
    return { ok: false, status: 429, error: 'otp_hourly_limit' };
  }

  const code = randomCode();
  const challenge = {
    id: id(),
    phone: normalized,
    purpose: purpose === 'register' ? 'register' : 'login',
    payload,
    codeHash: codeHash(normalized, code),
    attempts: 0,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    consumedAt: null,
    ip: String(ip || '').slice(0, 60),
  };
  db.otpChallenges = [...(db.otpChallenges || []), challenge];
  cleanupOtps(db);

  const smsConfigured = Boolean(process.env.SMS_PROVIDER);
  return {
    ok: true,
    challengeId: challenge.id,
    phone: normalized,
    expiresAt: challenge.expiresAt,
    delivery: smsConfigured ? 'sms' : 'preview',
    // درگاه پیامک تنظیم نشده است؛ کد فقط برای بررسی در پیش‌نمایش برگردانده می‌شود
    previewCode: smsConfigured ? undefined : code,
    note: smsConfigured ? undefined : 'sms_provider_not_configured',
  };
}

export function verifyOtp(db, { phone, code, purpose = 'login' }) {
  const normalized = normalizePhone(phone);
  if (!normalized) return { ok: false, status: 400, error: 'phone_invalid' };
  const wanted = String(code ?? '').replace(/\D/g, '');
  if (wanted.length !== 6) return { ok: false, status: 400, error: 'otp_invalid' };

  const purposeWanted = purpose === 'register' ? 'register' : 'login';
  const challenge = [...(db.otpChallenges || [])]
    .filter((c) => c.phone === normalized && c.purpose === purposeWanted && !c.consumedAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  if (!challenge) return { ok: false, status: 400, error: 'otp_not_requested' };
  if (Date.parse(challenge.expiresAt) < Date.now()) {
    return { ok: false, status: 410, error: 'otp_expired' };
  }
  if (Number(challenge.attempts) >= MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: 'otp_too_many_attempts' };
  }

  const expected = Buffer.from(challenge.codeHash, 'hex');
  const candidate = Buffer.from(codeHash(normalized, wanted), 'hex');
  const matches = expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate);
  if (!matches) {
    challenge.attempts = Number(challenge.attempts || 0) + 1;
    return { ok: false, status: 403, error: 'otp_invalid', attemptsLeft: MAX_ATTEMPTS - challenge.attempts };
  }

  challenge.consumedAt = new Date().toISOString();
  return { ok: true, challenge };
}

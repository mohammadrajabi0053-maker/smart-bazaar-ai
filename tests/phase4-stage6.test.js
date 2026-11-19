// آزمون‌های مرحله ششم فاز چهارم — WebAuthn / Passkey و ورود با کد بازیابی
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-bazaar-s6-'));
process.env.DATA_DIR = tmpDir;
process.env.SESSION_SECRET = 'test-stage6-secret-value-1234567890';
process.env.NODE_ENV = 'test';

const { getDb } = await import('../src/store.js');
const { issueChallenge, consumeChallenge, verifyAssertion, WebAuthnError } = await import('../src/webauthn.js');
const { createApp } = await import('../server.js');
const { seedIfEmpty } = await import('../src/seed.js');

seedIfEmpty();

const app = createApp();
const server = await new Promise((resolve) => {
  const instance = app.listen(0, '0.0.0.0', () => resolve(instance));
});
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function owner() {
  const user = getDb().users.find((item) => item.role === 'admin');
  assert.ok(user, 'حساب مالک موجود است');
  return user;
}

async function post(pathname, body) {
  return fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify(body),
  });
}

test('مدیریت Passkey فقط برای مالک احراز‌شده در دسترس است', async () => {
  const list = await fetch(`${base}/api/finance/webauthn/credentials`);
  assert.equal(list.status, 401, 'فهرست دستگاه‌ها برای ناشناس ۴۰۱ است');
  const options = await post('/api/finance/webauthn/register/options', {});
  assert.equal(options.status, 401, 'ثبت دستگاه برای ناشناس ۴۰۱ است');
  const removed = await fetch(`${base}/api/finance/webauthn/credentials/any-id`, { method: 'DELETE' });
  assert.equal(removed.status, 401, 'حذف دستگاه برای ناشناس ۴۰۱ است');
});

test('ورود با Passkey برای حسابی بدون دستگاه ثبت‌شده مجاز نیست', async () => {
  const response = await post('/api/auth/webauthn/login/options', { email: 'no-passkey@example.com' });
  assert.equal(response.status, 404);
  const data = await response.json();
  assert.equal(data.error, 'passkey_not_available');
  assert.equal(data.challenge, undefined, 'برای حساب بدون دستگاه چالشی صادر نمی‌شود');
});

test('پاسخ جعلی Passkey در سمت سرور رد می‌شود', async () => {
  const email = owner().email;
  const forged = await post('/api/auth/webauthn/login/verify', {
    email,
    challenge: 'forged-challenge',
    credential: { id: 'forged-credential', response: { clientDataJSON: 'AAAA', authenticatorData: 'AAAA', signature: 'AAAA' } },
  });
  assert.equal(forged.status, 401, 'دستگاه ناشناخته پذیرفته نمی‌شود');
  const body = await forged.json();
  assert.equal(body.error, 'passkey_invalid');
  assert.equal(body.user, undefined, 'هیچ نشستی برای پاسخ جعلی صادر نمی‌شود');
});

test('چالش WebAuthn یک‌بارمصرف است و تکرار آن (Replay) رد می‌شود', () => {
  const challenge = issueChallenge('login');
  assert.equal(consumeChallenge(challenge, 'login'), true, 'اولین استفاده پذیرفته می‌شود');
  assert.equal(consumeChallenge(challenge, 'login'), false, 'استفادهٔ مجدد همان چالش رد می‌شود');
});

test('اعتبارسنجی امضا دادهٔ ناقص را رد می‌کند', () => {
  assert.throws(
    () => verifyAssertion({
      clientDataJSON: Buffer.from('not-json').toString('base64url'),
      authenticatorData: Buffer.alloc(4).toString('base64url'),
      signature: Buffer.alloc(8).toString('base64url'),
      expectedChallenge: 'abc',
      expectedOrigin: 'https://example.com',
      rpId: 'example.com',
      publicKeyJwk: { kty: 'EC', crv: 'P-256', x: 'AA', y: 'AA' },
      storedSignCount: 0,
    }),
    (err) => err instanceof WebAuthnError && typeof err.code === 'string',
    'دادهٔ نامعتبر باید خطای WebAuthn بدهد',
  );
});

test('ورود با کد بازیابی نادرست رد و کد در رویدادها ذخیره نمی‌شود', async () => {
  const email = owner().email;
  const raw = 'ZZZZ-YYYY';
  const response = await post('/api/auth/recovery/login', { email, code: raw });
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error, 'invalid_recovery_code');
  const serialized = JSON.stringify(getDb().securityEvents || []);
  assert.ok(!serialized.includes(raw), 'مقدار خام کد بازیابی در رویدادهای امنیتی ثبت نمی‌شود');
  assert.ok(!serialized.includes('sb_session'), 'توکن نشست در رویدادها ثبت نمی‌شود');
});

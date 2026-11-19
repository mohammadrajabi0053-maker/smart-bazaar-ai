// آزمون‌های مرحله پنجم فاز چهارم — مدیریت نشست‌ها و کدهای بازیابی
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-bazaar-s5-'));
process.env.DATA_DIR = tmpDir;
process.env.SESSION_SECRET = 'test-stage5-secret-value-1234567890';
process.env.NODE_ENV = 'test';

const { getDb } = await import('../src/store.js');
const sessions = await import('../src/sessions.js');
const { currentUser, createSessionToken } = await import('../src/auth.js');
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

function ownerUser() {
  const user = getDb().users.find((item) => item.role === 'admin');
  assert.ok(user, 'حساب مالک در دادهٔ اولیه موجود است');
  return user;
}

function reqFor(token) {
  return { cookies: { sb_session: token }, ip: '127.0.0.1', headers: { 'user-agent': 'node-test' } };
}

test('نشست تازه دارای زمان انقضای مطلق و بیکاری است', () => {
  const db = getDb();
  const user = ownerUser();
  const row = sessions.registerSession(db, user, {
    ip: '127.0.0.1',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36',
  });
  const view = sessions.sessionView(row, row.id);
  assert.equal(view.current, true);
  assert.equal(view.active, true);
  assert.equal(view.expired, false);
  assert.equal(view.os, 'Windows');
  assert.equal(view.browser, 'Chrome');
  assert.ok(Date.parse(view.expiresAt) > Date.now() + 20 * 864e5, 'انقضای مطلق حدود ۳۰ روز است');
  assert.ok(Date.parse(view.idleExpiresAt) > Date.now(), 'انقضای بیکاری در آینده است');
  assert.equal(sessions.sessionExpired(row), false);
});

test('نشست بی‌فعالیت منقضی و در سمت سرور باطل می‌شود', () => {
  const db = getDb();
  const user = ownerUser();
  const row = sessions.registerSession(db, user, { ip: '127.0.0.1', ua: 'node-test' });
  row.lastSeenAt = new Date(Date.now() - 8 * 864e5).toISOString();
  assert.equal(sessions.sessionExpired(row), true);
  assert.equal(currentUser(reqFor(createSessionToken(user, row.id))), null);
  assert.equal(row.revokedReason, 'expired');
  assert.ok(row.revokedAt, 'نشست منقضی واقعاً باطل شده است');
});

test('نشست از سقف مطلق ۳۰ روزه عبور نمی‌کند', () => {
  const db = getDb();
  const user = ownerUser();
  const row = sessions.registerSession(db, user, { ip: '127.0.0.1', ua: 'node-test' });
  row.createdAt = new Date(Date.now() - 31 * 864e5).toISOString();
  row.lastSeenAt = new Date().toISOString();
  assert.equal(sessions.sessionExpired(row), true);
  assert.equal(currentUser(reqFor(createSessionToken(user, row.id))), null);
});

test('چرخش شناسهٔ نشست، نشست قبلی را بی‌اعتبار می‌کند', () => {
  const db = getDb();
  const user = ownerUser();
  const first = sessions.registerSession(db, user, { ip: '127.0.0.1', ua: 'node-test' });
  const firstToken = createSessionToken(user, first.id);
  assert.ok(currentUser(reqFor(firstToken)), 'نشست اول معتبر است');
  const second = sessions.rotateSession(db, user, first.id, { ip: '127.0.0.1', ua: 'node-test' });
  assert.notEqual(second.id, first.id);
  assert.equal(first.revokedReason, 'rotated');
  assert.equal(currentUser(reqFor(firstToken)), null, 'شناسهٔ قدیمی پذیرفته نمی‌شود');
  assert.ok(currentUser(reqFor(createSessionToken(user, second.id))), 'شناسهٔ تازه معتبر است');
});

test('ابطال یک نشست مشخص فوراً در سمت سرور اعمال می‌شود', () => {
  const db = getDb();
  const user = ownerUser();
  const row = sessions.registerSession(db, user, { ip: '10.0.0.9', ua: 'node-test' });
  const token = createSessionToken(user, row.id);
  assert.ok(currentUser(reqFor(token)));
  const revoked = sessions.revokeSession(db, user.id, row.id, 'suspicious');
  assert.equal(revoked.revokedReason, 'suspicious');
  assert.equal(currentUser(reqFor(token)), null);
});

test('خروج از سایر نشست‌ها نشست جاری را حفظ می‌کند', () => {
  const db = getDb();
  const user = ownerUser();
  const keep = sessions.registerSession(db, user, { ua: 'keep-device' });
  const first = sessions.registerSession(db, user, { ua: 'other-a' });
  const second = sessions.registerSession(db, user, { ua: 'other-b' });
  const revoked = sessions.revokeOtherSessions(db, user.id, keep.id);
  assert.ok(revoked >= 2);
  assert.equal(keep.revokedAt, null, 'نشست جاری فعال می‌ماند');
  assert.equal(first.revokedReason, 'revoke_others');
  assert.equal(second.revokedReason, 'revoke_others');
  assert.equal(currentUser(reqFor(createSessionToken(user, first.id))), null);
  assert.ok(currentUser(reqFor(createSessionToken(user, keep.id))));
});

test('کد بازیابی فقط به‌صورت هش ذخیره و یک‌بار مصرف می‌شود', () => {
  const db = getDb();
  const user = ownerUser();
  const codes = sessions.generateRecoveryCodes(db, user, 5);
  assert.equal(codes.length, 5);
  assert.equal(user.recoveryCodes.length, 5);
  for (const row of user.recoveryCodes) {
    assert.equal(typeof row.hash, 'string');
    assert.ok(row.hash.length >= 32, 'هش کد ذخیره شده است');
    assert.ok(!codes.includes(row.hash), 'مقدار خام کد ذخیره نشده است');
    assert.equal(row.usedAt, null);
  }
  assert.equal(sessions.verifyRecoveryCode(db, user, codes[0]), true);
  assert.equal(sessions.verifyRecoveryCode(db, user, codes[0]), false, 'استفادهٔ مجدد رد می‌شود');
  assert.equal(sessions.recoveryCodeCount(user).remaining, 4);
});

test('تولید مجموعهٔ جدید کدهای قبلی را باطل می‌کند', () => {
  const db = getDb();
  const user = ownerUser();
  const old = sessions.generateRecoveryCodes(db, user, 3);
  const fresh = sessions.generateRecoveryCodes(db, user, 4);
  assert.equal(sessions.recoveryCodeCount(user).total, 4);
  assert.equal(sessions.verifyRecoveryCode(db, user, old[0]), false);
  assert.equal(sessions.verifyRecoveryCode(db, user, fresh[0]), true);
});

test('APIهای نشست و کد بازیابی برای کاربر ناشناس رد می‌شوند', async () => {
  const calls = [
    ['/api/finance/sessions', 'GET'],
    ['/api/finance/sessions/ses_deadbeef', 'DELETE'],
    ['/api/finance/sessions/revoke-others', 'POST'],
    ['/api/finance/recovery/status', 'GET'],
    ['/api/finance/recovery/generate', 'POST'],
    ['/api/finance/monitor/alerts', 'GET'],
  ];
  for (const [target, method] of calls) {
    const res = await fetch(base + target, {
      method,
      headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
      body: method === 'GET' ? undefined : '{}',
    });
    assert.ok([401, 403].includes(res.status), `${method} ${target} باید رد شود (دریافت: ${res.status})`);
    const text = await res.text();
    assert.ok(!/sessionId|codes|recoveryCodes/.test(text), `${target} دادهٔ حساس برنمی‌گرداند`);
  }
});

// آزمون‌های مرحله هفتم فاز چهارم — چهار سطح شدت، تأیید هشدار و محدودیت نگهداری لاگ
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-bazaar-s7-'));
process.env.DATA_DIR = tmpDir;
process.env.SESSION_SECRET = 'test-stage7-secret-value-1234567890';
process.env.NODE_ENV = 'test';

const { getDb } = await import('../src/store.js');
const { createApp } = await import('../server.js');
const { seedIfEmpty } = await import('../src/seed.js');
const { recordSecurityEvent } = await import('../src/security.js');
const {
  monitorOverview, ackSecurityEvent, ackAlert, trimSecurityEvents,
  normalizeSeverity, SEVERITIES, MAX_EVENTS, EVENT_RETENTION_DAYS, dispatchAlert,
} = await import('../src/monitor.js');

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

test('چهار سطح شدت پشتیبانی می‌شود و رویداد قدیمی warning به «متوسط» نگاشت می‌شود', () => {
  assert.deepEqual(SEVERITIES, ['info', 'medium', 'high', 'critical']);
  assert.equal(normalizeSeverity('warning'), 'medium');
  assert.equal(normalizeSeverity('high'), 'high');
  assert.equal(normalizeSeverity('نامعتبر'), 'info');

  const event = recordSecurityEvent({ type: 'login_failed', severity: 'warning', identity: 'a@b.c', ip: '10.0.0.1' });
  assert.equal(event.severity, 'medium', 'شدت رویداد جدید با نگاشت ذخیره می‌شود');

  const overview = monitorOverview(getDb());
  assert.deepEqual(Object.keys(overview.totals.bySeverity).sort(), ['critical', 'high', 'info', 'medium']);
  assert.ok(overview.totals.bySeverity.medium >= 1);

  const filtered = monitorOverview(getDb(), { severity: 'medium' });
  assert.ok(filtered.events.length >= 1);
  assert.ok(filtered.events.every((row) => row.severity === 'medium'), 'فیلتر شدت با نگاشت کار می‌کند');
});

test('هشدار و رویداد با تأیید مالک «بررسی‌شده» می‌شوند', async () => {
  const db = getDb();
  const event = recordSecurityEvent({ type: 'passkey_removed', severity: 'high', identity: 'owner@x', ip: '10.0.0.2' });
  const before = monitorOverview(db).unacknowledged;

  const acked = ackSecurityEvent(db, event.id, 'owner@x');
  assert.ok(acked.ackAt, 'زمان بررسی ثبت می‌شود');
  assert.equal(acked.ackBy, 'owner@x');
  assert.equal(monitorOverview(db).unacknowledged, before - 1, 'شمارش بررسی‌نشده کاهش می‌یابد');
  assert.equal(ackSecurityEvent(db, 'missing-id', 'owner@x'), null, 'شناسه ناشناس پذیرفته نمی‌شود');

  const alert = await dispatchAlert(db, { type: 'test', severity: 'high', title: 'آزمون', detail: 'بدون ارسال خارجی' });
  assert.equal(alert.delivered, false, 'بدون webhook ارسال خارجی انجام نمی‌شود');
  assert.equal(alert.severity, 'high');
  const ackedAlert = ackAlert(db, alert.id, 'owner@x');
  assert.ok(ackedAlert.ackAt);
  assert.equal(ackAlert(db, 'missing', 'owner@x'), null);
});

test('محدودیت نگهداری: حجم لاگ و رویدادهای قدیمی حذف می‌شوند', () => {
  const db = getDb();
  db.securityEvents = [];
  const old = new Date(Date.now() - (EVENT_RETENTION_DAYS + 2) * 86400000).toISOString();
  db.securityEvents.push({ id: 'old-1', type: 'login_failed', severity: 'info', at: old });
  for (let i = 0; i < MAX_EVENTS + 5; i += 1) {
    db.securityEvents.push({ id: `bulk-${i}`, type: 'login_failed', severity: 'info', at: new Date().toISOString() });
  }

  const removed = trimSecurityEvents(db);
  assert.ok(removed >= 6, 'رویداد قدیمی و اضافه‌ها حذف می‌شوند');
  assert.equal(db.securityEvents.length, MAX_EVENTS);
  assert.equal(db.securityEvents.some((row) => row.id === 'old-1'), false);
  assert.equal(db.securityEvents.at(-1).id, `bulk-${MAX_EVENTS + 4}`, 'جدیدترین رویداد حفظ می‌شود');
});

test('مسیرهای تأیید هشدار و گزارش امنیتی برای کاربر ناشناس مسدود است', async () => {
  const headers = { 'content-type': 'application/json', origin: base };
  const alertRes = await fetch(`${base}/api/finance/monitor/alerts/any-id/ack`, { method: 'POST', headers, body: '{}' });
  assert.equal(alertRes.status, 401);
  const eventRes = await fetch(`${base}/api/finance/monitor/events/any-id/ack`, { method: 'POST', headers, body: '{}' });
  assert.equal(eventRes.status, 401);
  const overviewRes = await fetch(`${base}/api/finance/monitor/overview`);
  assert.equal(overviewRes.status, 401);
});

test('رویدادهای ثبت‌شده رمز، توکن یا کد بازیابی ذخیره نمی‌کنند', () => {
  const serialized = JSON.stringify(getDb().securityEvents || []);
  for (const needle of ['password', 'sb_session', 'recoveryCode', 'token=']) {
    assert.equal(serialized.includes(needle), false, `الگوی حساس «${needle}» در رویدادها ذخیره نشده است`);
  }
});

// تست‌های مرکز بررسی سه فاز: API، مسیرها، جداسازی داده و صداقت وضعیت‌ها
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-bazaar-phases-'));
process.env.DATA_DIR = tmpDir;
process.env.SESSION_SECRET = 'test-session-secret-value-1234567890';
process.env.NODE_ENV = 'test';

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

const getJson = async (pathname) => {
  const res = await fetch(base + pathname);
  const body = await res.json();
  return { res, body };
};

test('مرکز بررسی: سه فاز با وضعیت‌های مجاز و گزارش آزمایش', async () => {
  const { res, body } = await getJson('/api/phases');
  assert.equal(res.status, 200);
  assert.equal(body.phases.length, 3);
  assert.deepEqual(body.featureStatuses, ['done', 'partial', 'connect']);

  for (const phase of body.phases) {
    assert.ok([1, 2, 3].includes(phase.id));
    assert.ok(phase.features.length > 0, 'هر فاز باید فهرست امکانات داشته باشد');
    assert.ok(phase.tests.length > 0, 'هر فاز باید گزارش آزمایش داشته باشد');

    for (const feature of phase.features) {
      assert.ok(['done', 'partial', 'connect'].includes(feature.status), `وضعیت نامعتبر: ${feature.status}`);
      assert.ok(feature.title.fa && feature.title.en);
    }
    for (const check of phase.tests) {
      assert.ok(['passed', 'partial', 'blocked'].includes(check.status));
    }

    const counted = phase.features.reduce((acc, f) => acc + 1, 0);
    const sums = phase.counts.done + phase.counts.partial + phase.counts.connect;
    assert.equal(sums, counted, 'شمارش وضعیت‌ها باید با فهرست امکانات بخواند');
  }
});

test('مرکز بررسی: وضعیت‌های نادرست به‌عنوان تکمیل‌شده گزارش نمی‌شوند', async () => {
  const { body } = await getJson('/api/phases');
  const byKey = (id, key) => body.phases.find((p) => p.id === id).features.find((f) => f.key === key);

  assert.notEqual(byKey(1, 'social_publish').status, 'done', 'انتشار شبکه‌های اجتماعی نباید تکمیل‌شده باشد');
  assert.notEqual(byKey(1, 'real_payment').status, 'done', 'پرداخت واقعی نباید تکمیل‌شده باشد');
  assert.notEqual(byKey(2, 'real_payout').status, 'done', 'برداشت واقعی نباید تکمیل‌شده باشد');
  assert.notEqual(byKey(2, 'export_pdf').status, 'done', 'خروجی PDF نباید تکمیل‌شده باشد');
  assert.notEqual(byKey(3, 'bulk_messaging').status, 'done', 'ارسال انبوه نباید تکمیل‌شده باشد');
  assert.equal(byKey(2, 'owner_panel').status, 'done');
});

test('مرکز بررسی: هیچ مبلغ، موجودی یا اطلاعات تماس در API عمومی نیست', async () => {
  const res = await fetch(base + '/api/phases');
  const text = await res.text();

  for (const forbidden of ['amountUsd', 'amountLocal', 'balance', 'iban', 'cardNumber', 'totalUsd', 'totalLocal']) {
    assert.equal(text.includes(forbidden), false, `فیلد حساس نباید افشا شود: ${forbidden}`);
  }
  assert.equal(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text), false, 'ایمیل نباید افشا شود');

  const body = JSON.parse(text);
  assert.equal(typeof body.dataMode.demo, 'number');
  assert.equal(typeof body.dataMode.live, 'number');
  assert.equal(body.dataMode.isolated, true);
});

test('مرکز بررسی: فاز ناموجود ۴۰۴ می‌دهد', async () => {
  const { res } = await getJson('/api/phases/9');
  assert.equal(res.status, 404);

  const page = await fetch(base + '/phases/4', { redirect: 'manual' });
  assert.equal(page.status, 404);
});

test('مرکز بررسی: صفحهٔ مرکز و صفحهٔ هر فاز سرو می‌شوند', async () => {
  const hub = await fetch(base + '/review');
  assert.equal(hub.status, 200);
  const hubHtml = await hub.text();
  assert.match(hubHtml, /مرکز بررسی/);
  assert.match(hubHtml, /\/js\/review\.js/);

  for (const id of [1, 2, 3]) {
    const page = await fetch(base + `/phases/${id}`);
    assert.equal(page.status, 200, `صفحهٔ فاز ${id} باید سرو شود`);
    const html = await page.text();
    assert.match(html, /\/js\/phase\.js/);
    assert.match(html, /href="\/review"/);
  }
});

test('مرکز بررسی: گاردهای مالی و اطلاعات تماس دست‌نخورده‌اند', async () => {
  const finance = await fetch(base + '/api/finance/overview');
  assert.equal(finance.status, 401);

  const entries = await fetch(base + '/api/finance/entries');
  assert.equal(entries.status, 401);

  const directory = await fetch(base + '/api/directory/businesses');
  assert.equal(directory.status, 401);

  const account = await fetch(base + '/api/account/summary');
  assert.equal(account.status, 401);
});

test('مرکز بررسی: صفحهٔ فاز برای هر فاز داده‌های همان فاز را برمی‌گرداند', async () => {
  for (const id of [1, 2, 3]) {
    const { res, body } = await getJson(`/api/phases/${id}`);
    assert.equal(res.status, 200);
    assert.equal(body.id, id);
    assert.ok(body.links.length > 0);
    assert.ok(body.metrics && typeof body.metrics === 'object');
  }

  const phase2 = (await getJson('/api/phases/2')).body;
  assert.equal(phase2.metrics.ownerOnly, true);
  assert.equal(phase2.metrics.twoFactor, 'totp');
});

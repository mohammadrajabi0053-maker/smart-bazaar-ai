// تست‌های فاز دوم — سیستم مالی، کیف پول، گزارش محرمانه و کنترل دسترسی مالک
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-bazaar-finance-'));
process.env.DATA_DIR = tmpDir;
process.env.SESSION_SECRET = 'test-finance-secret-value-1234567890';
process.env.NODE_ENV = 'test';

const { createApp } = await import('../server.js');
const { seedIfEmpty } = await import('../src/seed.js');
const { totpCode } = await import('../src/secure.js');

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

function client() {
  let cookie = '';
  return async (pathname, { method = 'GET', body, redirect = 'follow' } = {}) => {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (cookie) headers.cookie = cookie;
    const res = await fetch(base + pathname, {
      method,
      headers,
      redirect,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.getSetCookie?.() || [];
    for (const raw of setCookie) {
      const [pair] = raw.split(';');
      if (pair.startsWith('sb_session=')) cookie = pair;
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* غیر JSON */ }
    return { status: res.status, json, text, headers: res.headers };
  };
}

const anon = client();

async function ownerSession() {
  const meta = (await anon('/api/meta')).json;
  const adminAccount = meta.demoAccounts.find((a) => a.role === 'admin');
  const owner = client();
  const login = await owner('/api/auth/login', {
    method: 'POST',
    body: { email: adminAccount.email, password: adminAccount.password },
  });
  assert.equal(login.status, 200);
  return { owner, adminAccount };
}

async function ensureTotp(owner) {
  const setup = await owner('/api/finance/security/2fa/setup', { method: 'POST', body: {} });
  assert.equal(setup.status, 200);
  const enabled = await owner('/api/finance/security/2fa/enable', {
    method: 'POST', body: { code: totpCode(setup.json.secret) },
  });
  assert.equal(enabled.status, 200);
  return setup.json.secret;
}

test('دسترسی مالی فقط برای مدیر اصلی: ۴۰۱ بی‌نشست و ۴۰۳ سایر نقش‌ها', async () => {
  const anonRes = await anon('/api/finance/overview');
  assert.equal(anonRes.status, 401);
  assert.equal(anonRes.json.error, 'auth_required');

  const meta = (await anon('/api/meta')).json;
  const customerAccount = meta.demoAccounts.find((a) => a.role === 'customer');
  const shopper = client();
  await shopper('/api/auth/login', {
    method: 'POST',
    body: { email: customerAccount.email, password: customerAccount.password },
  });
  for (const route of ['/api/finance/overview', '/api/finance/entries', '/api/finance/wallet', '/api/finance/reports', '/api/finance/audit']) {
    const res = await shopper(route);
    assert.equal(res.status, 403, route);
    assert.equal(res.json.error, 'owner_only');
  }

  // صفحهٔ مالی برای بی‌نشست ریدایرکت و برای غیرمالک مسدود می‌شود
  const pageAnon = await anon('/finance', { redirect: 'manual' });
  assert.equal(pageAnon.status, 302);
  assert.match(pageAnon.headers.get('location') || '', /next=\/finance/);
  const htmlAnon = await anon('/finance.html', { redirect: 'manual' });
  assert.equal(htmlAnon.status, 302);
  const pageShopper = await shopper('/finance');
  assert.equal(pageShopper.status, 403);
  assert.match(pageShopper.text, /فقط برای مدیر اصلی/);
});

test('ثبت درآمد و هزینه، زنجیرهٔ هش معتبر و جلوگیری از تراکنش تکراری', async () => {
  const { owner } = await ownerSession();

  const before = (await owner('/api/finance/wallet')).json.wallet;

  const income = await owner('/api/finance/entries', {
    method: 'POST',
    body: {
      kind: 'income', source: 'ads', amountUsd: 500, currency: 'USD', country: 'IR',
      account: 'main', idempotencyKey: 'ads-income-1',
    },
  });
  assert.equal(income.status, 201);
  assert.equal(income.json.entry.amountUsd, 500);
  assert.ok(income.json.entry.hash);
  assert.equal(income.json.chain.valid, true);

  const duplicate = await owner('/api/finance/entries', {
    method: 'POST',
    body: {
      kind: 'income', source: 'ads', amountUsd: 500, currency: 'USD', country: 'IR',
      account: 'main', idempotencyKey: 'ads-income-1',
    },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.json.error, 'duplicate_entry');

  const expense = await owner('/api/finance/entries', {
    method: 'POST',
    body: { kind: 'expense', source: 'operating', amountUsd: 120, currency: 'USD', account: 'main' },
  });
  assert.equal(expense.status, 201);

  const wallet = (await owner('/api/finance/wallet')).json.wallet;
  assert.equal(wallet.balanceUsd, Math.round((before.balanceUsd + 380) * 100) / 100);
  assert.equal(wallet.incomeUsd, Math.round((before.incomeUsd + 500) * 100) / 100);
  assert.equal(wallet.expenseUsd, Math.round((before.expenseUsd + 120) * 100) / 100);
  assert.equal(wallet.payoutEnabled, false);

  const overview = (await owner('/api/finance/overview?includeDemo=1')).json;
  assert.equal(overview.chain.valid, true);
  assert.equal(overview.summary.bySource.ads.incomeUsd >= 500, true);
  assert.equal(overview.paymentsEnabled, false);
  assert.equal(overview.payoutEnabled, false);
});

test('ورود به حساب‌های آزمایشی و تأیید دومرحله‌ای TOTP فعال می‌شود', async () => {
  const { owner, adminAccount } = await ownerSession();
  const setup = await owner('/api/finance/security/2fa/setup', { method: 'POST', body: {} });
  assert.equal(setup.status, 200);
  assert.match(setup.json.otpauth, /^otpauth:\/\/totp\//);

  const enable = await owner('/api/finance/security/2fa/enable', {
    method: 'POST', body: { code: totpCode(setup.json.secret) },
  });
  assert.equal(enable.status, 200);
  assert.equal(enable.json.twoFactor.enabled, true);

  const security = (await owner('/api/finance/security')).json;
  assert.equal(security.twoFactor.enabled, true);
  assert.equal(security.encryption.algorithm, 'aes-256-gcm');
  assert.equal(security.payoutEnabled, false);

  // کد نامعتبر رد می‌شود
  const wrong = await owner('/api/finance/security/2fa/disable', {
    method: 'POST', body: { password: adminAccount.password, code: '000000' },
  });
  assert.equal(wrong.status, 403);
  assert.equal(wrong.json.error, 'totp_invalid');
});

test('برداشت وجه بدون تأیید دومرحله‌ای انجام نمی‌شود و پرداخت واقعی غیرفعال است', async () => {
  const { owner, adminAccount } = await ownerSession();

  const created = await owner('/api/finance/withdrawals', {
    method: 'POST', body: { amountUsd: 50, method: 'bank', note: 'تست برداشت' },
  });
  assert.equal(created.status, 201);
  const withdrawalId = created.json.withdrawal.id;
  assert.equal(created.json.withdrawal.status, 'requested');
  assert.equal(created.json.payoutEnabled, false);

  const review = await owner(`/api/finance/withdrawals/${withdrawalId}/review`, { method: 'POST', body: {} });
  assert.equal(review.status, 200);
  assert.equal(review.json.withdrawal.status, 'reviewed');

  // بدون رمز/کد، تأیید نهایی ممکن نیست
  const blocked = await owner(`/api/finance/withdrawals/${withdrawalId}/approve`, {
    method: 'POST', body: { password: adminAccount.password },
  });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.json.error, 'totp_invalid');

  // مرحلهٔ اول: رمز، مرحلهٔ دوم: کد Authenticator
  const setup = await owner('/api/finance/security/2fa/setup', { method: 'POST', body: {} });
  await owner('/api/finance/security/2fa/enable', {
    method: 'POST', body: { code: totpCode(setup.json.secret) },
  });
  const approved = await owner(`/api/finance/withdrawals/${withdrawalId}/approve`, {
    method: 'POST', body: { password: adminAccount.password, code: totpCode(setup.json.secret) },
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.json.withdrawal.status, 'approved');
  assert.equal(approved.json.withdrawal.payoutStatus, 'disabled');
  assert.equal(approved.json.payoutEnabled, false);
});

test('گزارش اختصاصی مدیر اصلی با تأیید دومرحله‌ای صادر و با مجوز محدود قابل مشاهده است', async () => {
  const { owner, adminAccount } = await ownerSession();

  const created = await owner('/api/finance/reports', {
    method: 'POST',
    body: {
      recipientName: 'مدیر فنی نمونه',
      recipientRole: 'tech_admin',
      mode: 'percent',
      percent: 10,
      countries: ['IR'],
      sources: ['ads'],
      fields: ['totals', 'byCountry'],
      permissions: { view: true, copy: false, print: false, pdf: false, excel: false },
      expiresInDays: 7,
    },
  });
  assert.equal(created.status, 201);
  const grantId = created.json.grant.id;
  assert.ok(created.json.grant.trackingId);

  // بدون مرحلهٔ اول تأیید، ارسال ممنوع است
  const noAuth = await owner(`/api/finance/reports/${grantId}/send`, {
    method: 'POST', body: { confirm: true },
  });
  assert.equal(noAuth.status, 403);
  assert.equal(noAuth.json.error, 'authorization_required');

  const secret = await ensureTotp(owner);
  const authorize = await owner(`/api/finance/reports/${grantId}/authorize`, {
    method: 'POST', body: { password: adminAccount.password, code: totpCode(secret) },
  });
  assert.equal(authorize.status, 200);
  assert.ok(authorize.json.authorization.id);
  assert.equal(authorize.json.confirmation.reportType, 'internal_management_report');

  const send = await owner(`/api/finance/reports/${grantId}/send`, {
    method: 'POST', body: { authorizationId: authorize.json.authorization.id, confirm: true },
  });
  assert.equal(send.status, 201);
  assert.ok(send.json.token);
  assert.equal(send.json.link, `/report/${send.json.token}`);

  // استفادهٔ دوباره از همان مجوز رد می‌شود
  const reused = await owner(`/api/finance/reports/${grantId}/send`, {
    method: 'POST', body: { authorizationId: authorize.json.authorization.id, confirm: true },
  });
  assert.equal(reused.status, 409);
  assert.equal(reused.json.error, 'authorization_used');

  // دریافت‌کننده فقط با توکن و در محدودهٔ مجوز
  const view = await anon(`/api/finance/grants/${send.json.token}`);
  assert.equal(view.status, 200);
  assert.equal(view.json.report.type, 'internal_management_report');
  assert.equal(view.json.report.basis.percent, 10);
  assert.ok(view.json.report.amountUsd >= 0);
  assert.match(view.json.report.disclaimer.fa, /مدیریتی داخلی/);

  const copy = await anon(`/api/finance/grants/${send.json.token}/events`, {
    method: 'POST', body: { event: 'copy' },
  });
  assert.equal(copy.status, 403);
  assert.equal(copy.json.error, 'copy_not_permitted');

  const csv = await anon(`/api/finance/grants/${send.json.token}/export?format=csv`);
  assert.equal(csv.status, 403);
  assert.equal(csv.json.error, 'download_not_permitted');

  // لغو فوری مجوز
  const revoke = await owner(`/api/finance/reports/${grantId}/revoke`, { method: 'POST', body: {} });
  assert.equal(revoke.status, 200);
  assert.equal(revoke.json.grant.status, 'revoked');
  const afterRevoke = await anon(`/api/finance/grants/${send.json.token}`);
  assert.equal(afterRevoke.status, 403);
  assert.equal(afterRevoke.json.error, 'grant_revoked');

  // حسابرسی رویدادها ثبت شده است
  const audit = (await owner('/api/finance/audit')).json.events;
  const actions = audit.map((event) => event.action);
  for (const action of ['report_authorized_step1', 'report_sent', 'grant_viewed', 'grant_revoked']) {
    assert.ok(actions.includes(action), action);
  }
});

test('مدیر فنی بدون مجوز مالی هیچ دسترسی ندارد و سطح دسترسی خود را تغییر نمی‌دهد', async () => {
  const { owner } = await ownerSession();

  const email = `tech-${Date.now()}@bazaar.ir`;
  const created = await owner('/api/finance/team', {
    method: 'POST',
    body: { name: 'مدیر فنی', email, password: 'TechPass!2345', role: 'admin' },
  });
  assert.equal(created.status, 201);

  const tech = client();
  const login = await tech('/api/auth/login', {
    method: 'POST', body: { email, password: 'TechPass!2345' },
  });
  assert.equal(login.status, 200);

  const denied = await tech('/api/finance/overview');
  assert.equal(denied.status, 403);
  assert.equal(denied.json.error, 'owner_only');

  const escalate = await tech('/api/finance/team', {
    method: 'POST', body: { name: 'x', email: 'x@bazaar.ir', password: 'Another!2345', role: 'admin' },
  });
  assert.equal(escalate.status, 403);

  const page = await tech('/finance');
  assert.equal(page.status, 403);
});

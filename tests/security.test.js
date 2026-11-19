// آزمون‌های امنیتی بخش اول فاز چهارم: هدرهای امنیتی، CSRF/Origin و محدودیت تلاش ورود
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-bazaar-sec-'));
process.env.DATA_DIR = tmpDir;
process.env.SESSION_SECRET = 'test-session-secret-value-1234567890';
process.env.NODE_ENV = 'test';

const { createApp } = await import('../server.js');
const { seedIfEmpty } = await import('../src/seed.js');
const { getDb } = await import('../src/store.js');

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

/** کلاینت با کیسهٔ کوکی (نشست + توکن CSRF) */
function client() {
  const jar = new Map();
  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  const capture = (res) => {
    const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const raw of list) {
      const pair = String(raw).split(';')[0];
      const idx = pair.indexOf('=');
      if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  };
  return async (pathname, { method = 'GET', body, headers = {} } = {}) => {
    const outHeaders = { ...headers };
    if (body !== undefined) outHeaders['content-type'] = 'application/json';
    const cookies = cookieHeader();
    if (cookies) outHeaders.cookie = cookies;
    const res = await fetch(base + pathname, {
      method,
      headers: outHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    capture(res);
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { status: res.status, json, text, headers: res.headers };
  };
}

const anon = client();
const browserHeaders = { origin: base, 'sec-fetch-site': 'same-origin' };

test('هدرهای امنیتی روی پاسخ API و صفحهٔ HTML اعمال می‌شوند', async () => {
  for (const target of ['/api/products', '/']) {
    const res = await anon(target);
    assert.equal(res.status, 200, `${target} باید پاسخ ۲۰۰ بدهد`);
    const csp = res.headers.get('content-security-policy') || '';
    assert.match(csp, /default-src 'self'/, 'CSP باید default-src self داشته باشد');
    assert.match(csp, /frame-ancestors 'none'/, 'CSP باید از نمایش در iframe جلوگیری کند');
    assert.match(csp, /script-src 'self'/, 'CSP باید اسکریپت را به خود دامنه محدود کند');
    assert.match(csp, /object-src 'none'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(res.headers.get('x-powered-by'), null, 'امضای فنی نباید افشا شود');
  }
  const api = await anon('/api/products');
  assert.equal(api.headers.get('cache-control'), 'no-store', 'پاسخ API نباید کش شود');
});

test('HSTS فقط روی اتصال امن ارسال می‌شود', async () => {
  const secure = await anon('/api/health', { headers: { 'x-forwarded-proto': 'https' } });
  const hsts = secure.headers.get('strict-transport-security') || '';
  assert.match(hsts, /max-age=\d+/, 'HSTS باید روی HTTPS ارسال شود');

  const plain = await anon('/api/health');
  assert.equal(plain.headers.get('strict-transport-security'), null, 'HSTS روی HTTP نباید ارسال شود');
});

test('درخواست با Origin نامعتبر رد می‌شود', async () => {
  const res = await anon('/api/auth/login', {
    method: 'POST',
    headers: { origin: 'https://evil.example.com' },
    body: { email: 'origin@example.com', password: 'Wrong@12345' },
  });
  assert.equal(res.status, 403);
  assert.equal(res.json.error, 'origin_not_allowed');
});

test('درخواست با Origin معتبر مجاز است و اعتبارسنجی رمز انجام می‌شود', async () => {
  const res = await anon('/api/auth/login', {
    method: 'POST',
    headers: { origin: base },
    body: { email: 'origin-ok@example.com', password: 'Wrong@12345' },
  });
  assert.equal(res.status, 401, 'Origin معتبر نباید رد شود؛ خطا باید اعتبارنامه باشد');
  assert.equal(res.json.error, 'invalid_credentials');
});

test('CSRF: درخواست مرورگری با نشست و بدون توکن رد می‌شود', async () => {
  const user = client();
  const reg = await user('/api/auth/register', {
    method: 'POST',
    body: { name: 'کاربر امنیتی', email: `csrf${Date.now()}@example.com`, password: 'Buyer@12345', role: 'customer' },
  });
  assert.equal(reg.status, 201);

  const missing = await user('/api/auth/logout', { method: 'POST', headers: browserHeaders });
  assert.equal(missing.status, 403, 'بدون توکن CSRF باید رد شود');
  assert.equal(missing.json.error, 'csrf_token_invalid');

  const wrong = await user('/api/auth/logout', {
    method: 'POST',
    headers: { ...browserHeaders, 'x-csrf-token': 'not-a-valid-token-value' },
  });
  assert.equal(wrong.status, 403, 'توکن نادرست باید رد شود');

  const tokenRes = await user('/api/csrf');
  assert.equal(tokenRes.status, 200);
  assert.ok(typeof tokenRes.json.token === 'string' && tokenRes.json.token.length >= 20);

  const ok = await user('/api/auth/logout', {
    method: 'POST',
    headers: { ...browserHeaders, 'x-csrf-token': tokenRes.json.token },
  });
  assert.equal(ok.status, 200, 'با توکن درست باید پذیرفته شود');
  assert.equal(ok.json.ok, true);
});

test('محدودیت ورود: تلاش ششم با ۴۲۹ رد می‌شود', async () => {
  const email = `ratelimit${Date.now()}@example.com`;
  const attacker = client();
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const res = await attacker('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'Wrong@12345' },
    });
    assert.equal(res.status, 401, `تلاش ${attempt} باید ۴۰۱ بدهد`);
  }
  const blocked = await attacker('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'Wrong@12345' },
  });
  assert.equal(blocked.status, 429, 'تلاش ششم باید ۴۲۹ بدهد');
  assert.equal(blocked.json.error, 'too_many_attempts');
  assert.ok(blocked.json.retryAfterSeconds > 0, 'زمان انتظار باید گزارش شود');
  assert.ok(blocked.headers.get('retry-after'), 'هدر Retry-After باید تنظیم شود');
});

test('رویدادهای امنیتی در پایگاه داده ثبت می‌شوند', async () => {
  const db = getDb();
  const events = Array.isArray(db.securityEvents) ? db.securityEvents : [];
  const types = new Set(events.map((e) => e.type));
  assert.ok(types.has('login_failed'), 'رویداد ورود ناموفق ثبت شود');
  assert.ok(types.has('login_blocked'), 'رویداد قفل ورود ثبت شود');
  assert.ok(types.has('origin_rejected'), 'رویداد Origin نامعتبر ثبت شود');
  assert.ok(types.has('csrf_rejected'), 'رویداد CSRF نامعتبر ثبت شود');
  for (const event of events) {
    assert.ok(event.id && event.at, 'هر رویداد شناسه و زمان دارد');
    assert.equal(event.password, undefined, 'هیچ رمزی در رویداد ثبت نمی‌شود');
  }
});

test('ورود موفق شمارندهٔ تلاش ناموفق را پاک می‌کند', async () => {
  const email = `success${Date.now()}@example.com`;
  const password = 'Buyer@12345';
  const user = client();
  const reg = await user('/api/auth/register', {
    method: 'POST',
    body: { name: 'کاربر موفق', email, password, role: 'customer' },
  });
  assert.equal(reg.status, 201);

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const res = await user('/api/auth/login', { method: 'POST', body: { email, password: 'Wrong@12345' } });
    assert.equal(res.status, 401);
  }
  const good = await user('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(good.status, 200, 'رمز درست باید پذیرفته شود');

  const after = await user('/api/auth/login', { method: 'POST', body: { email, password: 'Wrong@12345' } });
  assert.equal(after.status, 401, 'پس از ورود موفق، شمارنده صفر شده و ۴۲۹ نمی‌دهد');
});

test('قابلیت‌های موجود پس از افزودن لایهٔ امنیت سالم مانده‌اند', async () => {
  const products = await anon('/api/products');
  assert.equal(products.status, 200);
  assert.ok(Array.isArray(products.json.items) && products.json.items.length > 0);

  const meta = await anon('/api/meta');
  assert.equal(meta.status, 200);
  assert.equal(meta.json.languages.length, 4);

  const ads = await anon('/api/ads/options');
  assert.equal(ads.status, 200);
  assert.ok(ads.json.countries.length > 0, 'کشورهای تبلیغات باید در دسترس باشند');
  assert.equal(ads.json.publishing?.enabled, false, 'انتشار واقعی باید غیرفعال بماند');
});

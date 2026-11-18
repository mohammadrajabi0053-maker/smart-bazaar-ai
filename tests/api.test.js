// تست‌های API بازار هوشمند با node:test و سرور واقعی روی پورت تصادفی
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-bazaar-test-'));
process.env.DATA_DIR = tmpDir;
process.env.SESSION_SECRET = 'test-session-secret-value-1234567890';
process.env.NODE_ENV = 'test';

const { createApp } = await import('../server.js');
const { seedIfEmpty } = await import('../src/seed.js');

seedIfEmpty();

const app = createApp();
const server = await new Promise((resolve) => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
});
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** کلاینت با نگه‌داشتن کوکی نشست */
function client() {
  let cookie = '';
  return async (pathname, { method = 'GET', body } = {}) => {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (cookie) headers.cookie = cookie;
    const res = await fetch(base + pathname, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { status: res.status, json, text };
  };
}

const anon = client();

test('سلامت سرویس و متادیتای چهارزبانه', async () => {
  const health = await anon('/api/health');
  assert.equal(health.status, 200);

  const meta = await anon('/api/meta');
  assert.equal(meta.status, 200);
  assert.deepEqual(meta.json.languages.map((l) => l.code).sort(), ['ar', 'en', 'fa', 'tr']);
  assert.ok(meta.json.categories.length >= 5, 'دسته‌بندی‌ها باید تعریف شده باشند');
  assert.ok(meta.json.categories.every((c) => c.fa && c.en && c.ar && c.tr), 'هر دسته باید چهار زبان داشته باشد');
  assert.ok(Array.isArray(meta.json.demoAccounts) && meta.json.demoAccounts.length > 0);
});

test('فهرست محصولات، جست‌وجو و پیشنهاد زنده', async () => {
  const list = await anon('/api/products?pageSize=5');
  assert.equal(list.status, 200);
  assert.ok(list.json.items.length > 0, 'دادهٔ اولیه باید محصول داشته باشد');
  assert.ok(list.json.items.every((p) => p.price > 0 && p.seller.storeName));

  const found = await anon('/api/products?q=' + encodeURIComponent('هدفون'));
  assert.equal(found.status, 200);
  assert.ok(found.json.items.length > 0, 'جست‌وجوی «هدفون» باید نتیجه بدهد');

  const suggest = await anon('/api/search/suggest?q=' + encodeURIComponent('موبایل'));
  assert.equal(suggest.status, 200);
  assert.ok(Array.isArray(suggest.json.suggestions));
});

test('صفحهٔ محصول، نظرات و کالاهای مشابه', async () => {
  const list = await anon('/api/products?pageSize=1');
  const product = list.json.items[0];

  const detail = await anon(`/api/products/${product.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.json.product.id, product.id);
  assert.ok(Array.isArray(detail.json.reviews));
  assert.ok(Array.isArray(detail.json.related));
});

test('ثبت‌نام، ورود و محدودیت نقش مشتری', async () => {
  const shopper = client();
  const email = `buyer${Date.now()}@example.com`;
  const reg = await shopper('/api/auth/register', {
    method: 'POST',
    body: { name: 'خریدار آزمایشی', email, password: 'Buyer@12345', role: 'customer' },
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.json.user.email, email);
  assert.equal(reg.json.user.role, 'customer');
  assert.equal(reg.json.user.passwordHash, undefined, 'هش رمز نباید برگردد');

  const me = await shopper('/api/auth/me');
  assert.equal(me.json.user.email, email);

  const denied = await shopper('/api/seller/products');
  assert.equal(denied.status, 403, 'مشتری نباید به پنل فروشنده دسترسی داشته باشد');

  const badLogin = await client()('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'wrong-password' },
  });
  assert.equal(badLogin.status, 401);
});

test('فروشنده کالا ثبت و ویرایش می‌کند و مشتری سفارش می‌دهد', async () => {
  const meta = (await anon('/api/meta')).json;
  const sellerAccount = meta.demoAccounts.find((a) => a.role === 'seller');

  const seller = client();
  const login = await seller('/api/auth/login', {
    method: 'POST',
    body: { email: sellerAccount.email, password: sellerAccount.password },
  });
  assert.equal(login.status, 200);
  assert.equal(login.json.user.role, 'seller');

  const created = await seller('/api/seller/products', {
    method: 'POST',
    body: {
      name: 'هدفون تست هوشمند',
      description: 'هدفون بی‌سیم با حذف نویز فعال و باتری سی ساعته برای تست خودکار فروشگاه.',
      price: 2500000,
      stock: 3,
      category: 'digital',
      tags: ['هدفون', 'تست'],
      i18n: { en: 'Smart test headphones', ar: 'سماعات اختبار', tr: 'Akıllı test kulaklığı' },
    },
  });
  assert.equal(created.status, 201);
  const productId = created.json.product.id;

  const updated = await seller(`/api/seller/products/${productId}`, {
    method: 'PUT',
    body: { price: 2400000, stock: 3 },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.product.price, 2400000);

  const englishList = await anon('/api/products?lang=en&q=' + encodeURIComponent('Smart test'));
  assert.ok(englishList.json.items.some((p) => p.id === productId), 'نام انگلیسی باید در فهرست بیاید');

  const shopper = client();
  await shopper('/api/auth/register', {
    method: 'POST',
    body: { name: 'مشتری سفارش‌دهنده', email: `order${Date.now()}@example.com`, password: 'Buyer@12345', role: 'customer' },
  });

  const order = await shopper('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId, qty: 2 }],
      shipping: {
        fullName: 'مشتری سفارش‌دهنده',
        phone: '09121234567',
        city: 'تهران',
        address: 'خیابان ولیعصر، پلاک ۱۲، واحد ۳',
        postalCode: '1234567890',
      },
      note: 'لطفاً سریع ارسال شود',
    },
  });
  assert.equal(order.status, 201);
  assert.ok(order.json.orders.length >= 1);
  assert.equal(order.json.orders[0].total, 2400000 * 2 + order.json.orders[0].shippingCost);

  const myOrders = await shopper('/api/orders');
  assert.equal(myOrders.status, 200);
  assert.ok(myOrders.json.orders.some((o) => o.id === order.json.orders[0].id));

  const afterSale = await anon(`/api/products/${productId}`);
  assert.equal(afterSale.json.product.stock, 1, 'موجودی باید پس از سفارش کم شود');

  const sellerOrders = await seller('/api/seller/orders');
  const sellerOrder = sellerOrders.json.orders.find((o) => o.id === order.json.orders[0].id);
  assert.ok(sellerOrder, 'سفارش باید در پنل فروشنده دیده شود');

  const patched = await seller(`/api/seller/orders/${sellerOrder.id}/status`, {
    method: 'PATCH',
    body: { status: 'confirmed' },
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.json.order.status, 'confirmed');

  const removed = await seller(`/api/seller/products/${productId}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);

  const gone = await anon(`/api/products/${productId}`);
  assert.equal(gone.status, 404);
});

test('ابزارهای هوش مصنوعی پاسخ معتبر می‌دهند', async () => {
  const describe = await anon('/api/ai/describe', {
    method: 'POST',
    body: { name: 'ساعت هوشمند', category: 'digital', features: ['ضدآب', 'GPS'], tone: 'friendly', lang: 'fa' },
  });
  assert.equal(describe.status, 200);
  assert.ok(describe.json.text.length > 40);
  assert.ok(['local', 'provider'].includes(describe.json.engine));

  const price = await anon('/api/ai/price', {
    method: 'POST',
    body: { name: 'ساعت هوشمند', category: 'digital', cost: 1000000 },
  });
  assert.equal(price.status, 200);
  assert.ok(price.json.recommended >= price.json.low);
  assert.ok(price.json.high >= price.json.recommended);

  const keywords = await anon('/api/ai/keywords', {
    method: 'POST',
    body: { name: 'ساعت هوشمند', description: 'ساعت هوشمند ضدآب با GPS و باتری بلندمدت', category: 'digital', lang: 'fa' },
  });
  assert.equal(keywords.status, 200);
  assert.ok(keywords.json.keywords.length > 0);

  const assistant = await anon('/api/ai/assistant', {
    method: 'POST',
    body: { message: 'هدفون بی‌سیم تا دو میلیون تومان می‌خواهم', lang: 'fa' },
  });
  assert.equal(assistant.status, 200);
  assert.ok(assistant.json.reply.length > 0);
  assert.ok(Array.isArray(assistant.json.products));
});

test('دسترسی مدیریت فقط برای نقش مدیر', async () => {
  const meta = (await anon('/api/meta')).json;
  const adminAccount = meta.demoAccounts.find((a) => a.role === 'admin');

  const admin = client();
  const login = await admin('/api/auth/login', {
    method: 'POST',
    body: { email: adminAccount.email, password: adminAccount.password },
  });
  assert.equal(login.status, 200);

  const overview = await admin('/api/admin/overview');
  assert.equal(overview.status, 200);
  assert.ok(overview.json.counts.users > 0);
  assert.ok(Array.isArray(overview.json.statusBreakdown));

  const users = await admin('/api/admin/users');
  assert.ok(users.json.users.length > 0);
  assert.ok(users.json.users.every((u) => u.passwordHash === undefined));

  const customerAccount = meta.demoAccounts.find((a) => a.role === 'customer');
  const shopper = client();
  await shopper('/api/auth/login', {
    method: 'POST',
    body: { email: customerAccount.email, password: customerAccount.password },
  });
  const forbidden = await shopper('/api/admin/overview');
  assert.equal(forbidden.status, 403);
});

test('صفحه‌های HTML با زبان فارسی و راست‌به‌چپ سرو می‌شوند', async () => {
  for (const route of ['/', '/seller.html', '/admin.html']) {
    const res = await fetch(base + route);
    assert.equal(res.status, 200, route);
    const html = await res.text();
    assert.match(html, /lang="fa"/);
    assert.match(html, /dir="rtl"/);
    assert.match(html, /viewport/);
  }
  const missing = await fetch(base + '/no-such-page');
  assert.equal(missing.status, 404);
});

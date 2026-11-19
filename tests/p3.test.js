// تست‌های فاز سوم بازار هوشمند: احراز هویت تلفنی، بانک اصناف، متقاضیان تبلیغات، CRM و حریم خصوصی
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-bazaar-p3-'));
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

/** شمارهٔ یکتا برای هر اجرا */
let phoneSeq = 0;
const uniquePhone = () => {
  phoneSeq += 1;
  return `0912${String(Date.now()).slice(-6)}${String(phoneSeq).padStart(2, '0')}`.slice(0, 13);
};

/** مقایسهٔ شماره مستقل از قالب ذخیره‌سازی (+98 / 0) */
const phoneDigits = (value) => String(value || '').replace(/\D/g, '').replace(/^98/, '0');

async function adminClient() {
  const meta = (await anon('/api/meta')).json;
  const account = meta.demoAccounts.find((a) => a.role === 'admin');
  assert.ok(account, 'حساب نمونهٔ مدیر باید وجود داشته باشد');
  const c = client();
  const login = await c('/api/auth/login', {
    method: 'POST',
    body: { email: account.email, password: account.password },
  });
  assert.equal(login.status, 200, 'ورود مدیر نمونه باید موفق باشد');
  return c;
}

async function otpSignup(c, payload) {
  const request = await c('/api/auth/phone/request', {
    method: 'POST',
    body: { ...payload, mode: 'register' },
  });
  assert.equal(request.status, 200, JSON.stringify(request.json));
  assert.ok(request.json.previewCode, 'در محیط آزمایشی کد تأیید باید در پاسخ باشد');

  const verify = await c('/api/auth/phone/verify', {
    method: 'POST',
    body: { phone: payload.phone, mode: 'register', code: request.json.previewCode },
  });
  assert.equal(verify.status, 200, JSON.stringify(verify.json));
  return verify.json.user;
}

let admin;
let agentAccount;
let customerPhone;
let sellerClient;
let sellerProfileUser;
let businessId;

test('ثبت‌نام تلفنی مشتری و فروشنده با تأیید شماره', async () => {
  const buyer = client();
  customerPhone = uniquePhone();
  const customer = await otpSignup(buyer, { phone: customerPhone, name: 'خریدار فاز سه', role: 'customer' });
  assert.equal(customer.role, 'customer');
  assert.equal(phoneDigits(customer.phone), phoneDigits(customerPhone), 'شمارهٔ تأییدشده باید روی حساب ثبت شود');
  assert.equal(customer.passwordHash, undefined, 'هش رمز نباید در پاسخ بیاید');

  const me = await buyer('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(phoneDigits(me.json.user.phone), phoneDigits(customerPhone));

  const sellerPhone = uniquePhone();
  sellerClient = client();
  sellerProfileUser = await otpSignup(sellerClient, {
    phone: sellerPhone,
    name: 'فروشنده فاز سه',
    role: 'seller',
    storeName: 'فروشگاه آزمایشی فاز سه',
    industry: 'apparel',
    city: 'تهران',
  });
  assert.equal(sellerProfileUser.role, 'seller');
  assert.ok(sellerProfileUser.storeName, 'فروشنده باید نام کسب‌وکار داشته باشد');

  const wrongCode = await client()('/api/auth/phone/verify', {
    method: 'POST',
    body: { phone: sellerPhone, mode: 'login', code: '000000' },
  });
  assert.ok([400, 401, 404].includes(wrongCode.status), 'کد نادرست نباید پذیرفته شود');
});

test('پروفایل فروشنده ذخیره و اعتبارسنجی می‌شود', async () => {
  const current = await sellerClient('/api/seller/profile');
  assert.equal(current.status, 200);
  assert.equal(current.json.profile.businessName, 'فروشگاه آزمایشی فاز سه');

  const saved = await sellerClient('/api/seller/profile', {
    method: 'PUT',
    body: {
      businessName: 'فروشگاه آزمایشی فاز سه',
      industry: 'apparel',
      country: 'IR',
      province: 'تهران',
      city: 'تهران',
      address: 'خیابان آزمایشی، پلاک ۱',
      whatsapp: '09120000000',
      telegram: '@phase3shop',
      instagram: '@phase3shop',
      website: 'https://example.com',
    },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  assert.equal(saved.json.profile.city, 'تهران');
  assert.equal(saved.json.profile.website, 'https://example.com');

  const invalid = await sellerClient('/api/seller/profile', {
    method: 'PUT',
    body: { businessName: 'x', industry: 'apparel', country: 'IR', city: 'تهران' },
  });
  assert.equal(invalid.status, 400, 'نام کوتاه کسب‌وکار باید رد شود');
  assert.equal(invalid.json.error, 'store_name_required');
});

test('دسترسی به بانک اصناف فقط برای نقش‌های مجاز و ماسک‌شدن اطلاعات تماس', async () => {
  const deniedAnon = await anon('/api/directory/businesses');
  assert.equal(deniedAnon.status, 401);

  const buyer = client();
  await otpSignup(buyer, { phone: uniquePhone(), name: 'مشتری بدون دسترسی', role: 'customer' });
  const deniedCustomer = await buyer('/api/directory/businesses');
  assert.equal(deniedCustomer.status, 403, 'مشتری نباید به بانک اصناف دسترسی داشته باشد');

  admin = await adminClient();
  const asAdmin = await admin('/api/directory/businesses?limit=5');
  assert.equal(asAdmin.status, 200);
  assert.equal(asAdmin.json.canSeeContacts, true, 'مدیر باید اطلاعات تماس را ببیند');
  assert.ok(Array.isArray(asAdmin.json.businesses));
});

test('ثبت کسب‌وکار، جلوگیری از تکرار و مدیریت رضایت تبلیغاتی', async () => {
  const catalog = (await anon('/api/directory/catalog')).json;
  assert.ok(catalog.industries.length > 0);
  assert.ok(catalog.countries.length > 0);

  const phone = uniquePhone();
  const body = {
    name: 'کلینیک آزمایشی فاز سه',
    industry: catalog.industries[0].slug,
    type: catalog.types[0].slug,
    country: catalog.countries[0].code,
    province: 'تهران',
    city: 'تهران',
    phone,
    mobile: phone,
    sourceType: catalog.sources[0].slug,
    consent: { status: 'pending' },
  };

  const created = await admin('/api/directory/businesses', { method: 'POST', body });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  businessId = created.json.business.id;
  assert.equal(created.json.business.canAdvertise, false, 'بدون رضایت نباید مجوز تبلیغ داشته باشد');

  const duplicate = await admin('/api/directory/businesses', { method: 'POST', body });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.json.error, 'duplicate_business');

  const granted = await admin(`/api/directory/businesses/${businessId}/consent`, {
    method: 'POST',
    body: { status: 'granted' },
  });
  assert.equal(granted.status, 200);
  assert.equal(granted.json.business.canAdvertise, true);

  const revoked = await admin(`/api/directory/businesses/${businessId}/consent`, {
    method: 'POST',
    body: { status: 'revoked' },
  });
  assert.equal(revoked.status, 200);
  assert.equal(revoked.json.business.canAdvertise, false, 'لغو رضایت باید مجوز تبلیغ را بردارد');

  const search = await admin(`/api/directory/businesses?q=${encodeURIComponent('کلینیک آزمایشی')}`);
  assert.equal(search.status, 200);
  assert.ok(search.json.businesses.some((row) => row.id === businessId), 'جست‌وجو باید رکورد را پیدا کند');

  const forbiddenExport = await anon('/api/directory/businesses/export.csv');
  assert.equal(forbiddenExport.status, 401, 'خروجی CSV نباید عمومی باشد');
});

test('متقاضیان تبلیغات: رضایت الزامی، جلوگیری از تکرار و تغییر وضعیت', async () => {
  const leadPhone = uniquePhone();
  const leadCatalog = (await anon('/api/directory/catalog')).json;
  const leadIndustry = leadCatalog.industries[0].slug;
  const withoutConsent = await anon('/api/public/ad-request', {
    method: 'POST',
    body: {
      name: 'متقاضی بدون رضایت',
      businessName: 'کسب‌وکار بدون رضایت',
      phone: leadPhone,
      industry: leadIndustry,
      country: 'IR',
      province: 'تهران',
      city: 'تهران',
      networks: ['instagram'],
      format: 'post',
      budgetUsd: 150,
      durationDays: 7,
      consent: false,
    },
  });
  assert.equal(withoutConsent.status, 400);
  assert.equal(withoutConsent.json.error, 'advertising_consent_required');

  const requestBody = {
    name: 'متقاضی فاز سه',
    businessName: 'کسب‌وکار متقاضی فاز سه',
    phone: leadPhone,
    industry: leadIndustry,
    country: 'IR',
    province: 'تهران',
    city: 'تهران',
    networks: ['instagram', 'telegram'],
    format: 'post',
    budgetUsd: 250,
    durationDays: 10,
    consent: true,
  };
  const created = await anon('/api/public/ad-request', { method: 'POST', body: requestBody });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  assert.ok(created.json.id);

  const duplicate = await anon('/api/public/ad-request', { method: 'POST', body: requestBody });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.json.error, 'duplicate_lead');

  const leads = await admin('/api/directory/leads?q=' + encodeURIComponent('متقاضی فاز سه'));
  assert.equal(leads.status, 200);
  const lead = leads.json.leads.find((row) => row.phone === leadPhone || row.name === 'متقاضی فاز سه');
  assert.ok(lead, 'درخواست عمومی باید در فهرست متقاضیان باشد');
  assert.equal(lead.consent.status, 'granted');

  const statusUpdate = await admin(`/api/directory/leads/${lead.id}/status`, {
    method: 'POST',
    body: { status: 'negotiating' },
  });
  assert.equal(statusUpdate.status, 200);
  assert.equal(statusUpdate.json.lead.status, 'negotiating');

  const invalidStatus = await admin(`/api/directory/leads/${lead.id}/status`, {
    method: 'POST',
    body: { status: 'not_a_status' },
  });
  assert.equal(invalidStatus.status, 400);

  const converted = await admin(`/api/directory/leads/${lead.id}/convert`, { method: 'POST' });
  assert.equal(converted.status, 200);
  assert.equal(converted.json.lead.status, 'converted');
  assert.ok(converted.json.user.id, 'تبدیل متقاضی باید کاربر مشتری بسازد');
});

test('CRM: ثبت فعالیت، یادآوری و تکمیل پیگیری', async () => {
  const nextCallAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const activity = await admin('/api/directory/activities', {
    method: 'POST',
    body: {
      entityType: 'business',
      entityId: businessId,
      type: 'call',
      outcome: 'follow_up',
      summary: 'تماس اولیه و معرفی بستهٔ تبلیغاتی',
      nextCallAt,
    },
  });
  assert.equal(activity.status, 201, JSON.stringify(activity.json));

  const list = await admin(`/api/directory/activities?entityId=${businessId}`);
  assert.equal(list.status, 200);
  assert.ok(list.json.activities.some((row) => row.id === activity.json.activity.id));

  const reminders = await admin('/api/directory/reminders?withinHours=72');
  assert.equal(reminders.status, 200);
  assert.ok(Array.isArray(reminders.json.reminders));

  const done = await admin(`/api/directory/activities/${activity.json.activity.id}/done`, { method: 'POST' });
  assert.equal(done.status, 200);
  assert.equal(done.json.activity.done, true);
});

test('حریم خصوصی: لغو رضایت، درخواست حذف و اعمال آن توسط مدیر', async () => {
  const phone = uniquePhone();
  const catalog = (await anon('/api/directory/catalog')).json;
  const created = await admin('/api/directory/businesses', {
    method: 'POST',
    body: {
      name: 'کسب‌وکار حریم خصوصی',
      industry: catalog.industries[0].slug,
      type: catalog.types[0].slug,
      country: 'IR',
      province: 'تهران',
      city: 'تهران',
      phone,
      sourceType: catalog.sources[0].slug,
      consent: { status: 'granted' },
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const targetId = created.json.business.id;

  const optOut = await anon('/api/privacy/opt-out', {
    method: 'POST',
    body: { phone, channel: 'all', reason: 'درخواست شخصی' },
  });
  assert.equal(optOut.status, 200, JSON.stringify(optOut.json));
  assert.ok(optOut.json.affected >= 1, 'لغو رضایت باید حداقل یک رکورد را به‌روزرسانی کند');

  const deletion = await anon('/api/privacy/deletion-request', {
    method: 'POST',
    body: { phone, entityType: 'business', entityId: targetId, reason: 'حذف اطلاعات کاری' },
  });
  assert.equal(deletion.status, 201, JSON.stringify(deletion.json));

  const pending = await admin('/api/directory/deletion-requests');
  assert.equal(pending.status, 200);
  const record = pending.json.requests.find((row) => row.id === deletion.json.request.id);
  assert.ok(record, 'درخواست حذف باید برای مدیر قابل مشاهده باشد');

  const applied = await admin(`/api/directory/deletion-requests/${record.id}/apply`, { method: 'POST' });
  assert.equal(applied.status, 200);

  const afterDelete = await admin(`/api/directory/businesses/${targetId}`);
  assert.equal(afterDelete.status, 404, 'رکورد حذف‌شده نباید قابل دریافت باشد');

  const forbidden = await anon('/api/directory/deletion-requests');
  assert.equal(forbidden.status, 401, 'فهرست درخواست‌های حذف نباید عمومی باشد');
});

test('کنترل دسترسی تیم: اعطا و لغو دسترسی اطلاعات تماس', async () => {
  agentAccount = client();
  const agentPhone = uniquePhone();
  await otpSignup(agentAccount, { phone: agentPhone, name: 'کارشناس فاز سه', role: 'customer' });

  const promoted = await admin('/api/directory/team', {
    method: 'POST',
    body: { phone: agentPhone, contactAccess: true },
  });
  assert.equal(promoted.status, 200, JSON.stringify(promoted.json));
  assert.equal(promoted.json.user.role, 'agent');
  assert.equal(promoted.json.user.contactAccess, true);

  const agentList = await agentAccount('/api/directory/businesses?limit=3');
  assert.equal(agentList.status, 200, 'کارشناس با دسترسی باید فهرست را ببیند');
  assert.equal(agentList.json.canSeeContacts, true);

  const unknownUser = await admin('/api/directory/team', {
    method: 'POST',
    body: { phone: uniquePhone(), contactAccess: true },
  });
  assert.equal(unknownUser.status, 404, 'شمارهٔ بدون حساب نباید به تیم اضافه شود');

  const auditByAgent = await agentAccount('/api/directory/audit');
  assert.equal(auditByAgent.status, 403, 'گزارش حسابرسی فقط برای مدیر اصلی است');

  const revoked = await admin(`/api/directory/team/${promoted.json.user.id}`, {
    method: 'PATCH',
    body: { revoke: true },
  });
  assert.equal(revoked.status, 200);
  assert.equal(revoked.json.user.role, 'customer');

  const afterRevoke = await agentAccount('/api/directory/businesses');
  assert.equal(afterRevoke.status, 403, 'دسترسی لغوشده نباید فهرست را ببیند');
});

test('سفارش چندفروشنده با کمیسیون سمت سرور و جلوگیری از تکرار', async () => {
  const buyer = client();
  await otpSignup(buyer, { phone: uniquePhone(), name: 'خریدار سفارش چندفروشنده', role: 'customer' });

  const products = (await anon('/api/products?pageSize=50')).json.items;
  const bySeller = new Map();
  for (const product of products) {
    const key = product.seller?.storeName || product.sellerId || product.seller?.slug;
    if (!bySeller.has(key)) bySeller.set(key, product);
    if (bySeller.size >= 2) break;
  }
  assert.ok(bySeller.size >= 2, 'برای تست چندفروشندگی حداقل دو فروشنده لازم است');

  const picked = [...bySeller.values()].slice(0, 2);
  const requestId = `p3-${Date.now()}`;
  const orderBody = {
    items: picked.map((product) => ({ productId: product.id, qty: 1 })),
    shipping: {
      fullName: 'خریدار سفارش چندفروشنده',
      phone: '09121234567',
      city: 'تهران',
      address: 'خیابان آزمایشی، پلاک ۲',
      postalCode: '1234567890',
    },
    requestId,
  };

  const placed = await buyer('/api/orders', { method: 'POST', body: orderBody });
  assert.equal(placed.status, 201, JSON.stringify(placed.json));
  assert.equal(placed.json.orders.length, 2, 'هر فروشنده باید سفارش مستقل بگیرد');
  const groupIds = new Set(placed.json.orders.map((o) => o.groupId));
  assert.equal(groupIds.size, 1, 'همهٔ سفارش‌ها یک گروه مشترک دارند');

  for (const order of placed.json.orders) {
    assert.equal(order.total, order.subtotal - order.discount + order.shippingCost);
    assert.equal(order.commission, undefined, 'کمیسیون نباید در پاسخ مشتری افشا شود');
    assert.equal(order.sellerPayout, undefined, 'سهم فروشنده نباید در پاسخ مشتری افشا شود');
  }

  const totalSum = placed.json.orders.reduce((sum, o) => sum + o.total, 0);
  assert.equal(placed.json.total, totalSum);

  const duplicate = await buyer('/api/orders', { method: 'POST', body: orderBody });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.json.duplicate, true, 'کلید درخواست تکراری نباید سفارش دوم بسازد');
  assert.equal(duplicate.json.orders.length, 2);
});

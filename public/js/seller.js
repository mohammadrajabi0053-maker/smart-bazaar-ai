/* بازار هوشمند — منطق پنل فروشنده */
import {
  api, t, localize, getLang, setLang, applyDir, money, esc, statusLabel, fmtDate, toast,
  meta, catLabel, openOverlay, closeOverlay, bindOverlayDismiss,
} from './core.js';

const $ = (sel) => document.querySelector(sel);
const T = (key, fallback) => {
  const value = t(key);
  return value === key ? fallback : value;
};

const state = {
  user: null,
  meta: null,
  counts: null,
  insights: null,
  products: [],
  orders: [],
  editingId: null,
  pendingImage: null,
};

/* --------------------------------- ورود --------------------------------- */

async function checkAuth() {
  try {
    const { user } = await api('/api/auth/me');
    if (user && user.role === 'seller') {
      state.user = user;
      $('#gate').hidden = true;
      $('#panel').hidden = false;
      $('#storeName').textContent = user.storeName || user.name;
      $('#storeMeta').textContent = user.email;
      await loadOverview();
      return;
    }
    if (user) {
      $('#gateText').textContent = T('as_seller', 'این بخش مخصوص فروشندگان است. با حساب فروشنده وارد شوید.');
    }
  } catch { /* فرم ورود */ }
  $('#gate').hidden = false;
  $('#panel').hidden = true;
}

async function login() {
  const email = $('#gEmail').value.trim();
  const password = $('#gPass').value;
  if (!email || !password) return;
  try {
    const { user } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    if (user.role !== 'seller' && user.role !== 'admin') {
      toast(T('as_seller', 'این بخش مخصوص فروشندگان است'), 'error');
      return;
    }
    state.user = user;
    await checkAuth();
  } catch {
    toast(T('error_generic', 'ایمیل یا رمز عبور نادرست است'), 'error');
  }
}

/* ------------------------------- داشبورد ------------------------------- */

async function loadOverview() {
  const data = await api('/api/seller/overview');
  state.counts = data.counts || {};
  state.insights = data.insights || {};
  $('#storeName').textContent = data.store?.storeName || state.user.storeName || '';
  renderStats();
  renderInsights();
  renderRecentOrders(data.recentOrders || []);
}

function renderStats() {
  const c = state.counts || {};
  const cards = [
    [T('my_products', 'کالاهای من'), c.products ?? 0],
    [T('active', 'فعال'), c.active ?? 0],
    [T('low_stock', 'کم‌موجود'), c.outOfStock ?? 0],
    [T('orders', 'سفارش‌ها'), c.orders ?? 0],
    [T('pending', 'در انتظار'), c.pending ?? 0],
    [T('revenue', 'درآمد'), money(state.insights?.revenue || 0)],
  ];
  $('#stats').innerHTML = cards
    .map(([label, value]) => `<div class="stat"><span class="hint">${esc(label)}</span><strong>${esc(value)}</strong></div>`)
    .join('');
}

function renderInsights() {
  const ins = state.insights || {};
  const lines = [];

  if (!(state.counts?.products > 0)) {
    lines.push(`<p class="hint">${esc(T('add_product_first', 'برای شروع، نخستین کالای خود را ثبت کنید'))}</p>`);
  }

  for (const tip of ins.tips || []) {
    const [kind, names] = String(tip).split(':');
    const list = names ? names.split('|').join('، ') : '';
    if (kind === 'stock') lines.push(`<div class="row-line"><span>⚠️ ${esc(T('low_stock', 'موجودی کم'))}</span><span>${esc(list)}</span></div>`);
    if (kind === 'image') lines.push(`<div class="row-line"><span>🖼️ ${esc(T('image', 'تصویر'))}</span><span>${esc(list)}</span></div>`);
    if (kind === 'description') lines.push(`<div class="row-line"><span>✍️ ${esc(T('description', 'توضیحات'))}</span><span>${esc(list)}</span></div>`);
  }

  if ((ins.bestSellers || []).length) {
    lines.push(`<h4 style="margin:12px 0 6px">🏆 ${esc(T('best_sellers', 'پرفروش‌ها'))}</h4>`);
    for (const row of ins.bestSellers) {
      lines.push(`<div class="row-line"><span>${esc(row.name)}</span><span>${esc(row.qty)} × ${esc(money(row.price))}</span></div>`);
    }
  }

  if ((ins.lowStock || []).length) {
    lines.push(`<h4 style="margin:12px 0 6px">📦 ${esc(T('restock', 'نیاز به تأمین'))}</h4>`);
    for (const row of ins.lowStock) {
      lines.push(`<div class="row-line"><span>${esc(row.name)}</span><span>${esc(row.stock)}</span></div>`);
    }
  }

  $('#insights').innerHTML = lines.join('') || `<p class="hint">${esc(T('no_data', 'داده‌ای نیست'))}</p>`;
}

function renderRecentOrders(orders) {
  $('#recentOrders').innerHTML = orders.length
    ? orders.map((order) => `<div class="row-line">
        <span>#${esc(order.number || order.id)} · ${esc(order.customerName || '')}</span>
        <span><span class="status ${esc(order.status)}">${esc(statusLabel(order.status))}</span> ${esc(money(order.total))}</span>
      </div>`).join('')
    : `<p class="hint">${esc(T('no_orders', 'سفارشی ثبت نشده است'))}</p>`;
}

/* -------------------------------- محصولات -------------------------------- */

async function loadProducts() {
  const { products } = await api('/api/seller/products');
  state.products = products || [];
  renderProducts();
}

function renderProducts() {
  const rows = state.products.map((p) => {
    const active = p.active !== false;
    return `<tr>
      <td>${p.image ? `<img src="${esc(p.image)}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:8px">` : '🛍️'}</td>
      <td>${esc(p.name)}</td>
      <td>${esc(catLabel(p.category))}</td>
      <td>${esc(money(p.price))}</td>
      <td>${esc(p.stock)}</td>
      <td><span class="status ${active ? 'delivered' : 'canceled'}">${esc(active ? T('active', 'فعال') : T('inactive', 'غیرفعال'))}</span></td>
      <td style="white-space:nowrap">
        <button class="btn small secondary" type="button" data-edit="${esc(p.id)}">${esc(T('edit', 'ویرایش'))}</button>
        <button class="btn small secondary" type="button" data-del="${esc(p.id)}">${esc(T('delete', 'حذف'))}</button>
      </td>
    </tr>`;
  });
  $('#productRows').innerHTML = rows.join('') ||
    `<tr><td colspan="7" class="hint">${esc(T('add_product_first', 'برای شروع، نخستین کالای خود را ثبت کنید'))}</td></tr>`;
}

function fillCategories() {
  const cats = state.meta?.categories || [];
  const options = cats.map((c) => `<option value="${esc(c.slug)}">${esc(catLabel(c.slug))}</option>`).join('');
  ['#fCat', '#dCat', '#pCat'].forEach((sel) => { const el = $(sel); if (el) el.innerHTML = options; });
}

function openForm(product) {
  state.editingId = product?.id || null;
  state.pendingImage = null;
  $('#pModalTitle').textContent = product ? T('edit', 'ویرایش') : T('new_product', 'کالای جدید');
  $('#fId').value = product?.id || '';
  $('#fName').value = product?.name || '';
  $('#fCat').value = product?.category || (state.meta?.categories?.[0]?.slug || 'other');
  $('#fPrice').value = product?.price ?? '';
  $('#fStock').value = product?.stock ?? 0;
  $('#fDesc').value = product?.description || '';
  $('#fTags').value = (product?.tags || []).join('، ');
  $('#fEn').value = product?.i18n?.en || '';
  $('#fAr').value = product?.i18n?.ar || '';
  $('#fTr').value = product?.i18n?.tr || '';
  $('#fImageUrl').value = product?.image || '';
  $('#fFile').value = '';
  $('#fActive').checked = product ? product.active !== false : true;
  $('#fPreview').innerHTML = product?.image
    ? `<img src="${esc(product.image)}" alt="" style="width:80px;height:80px;object-fit:cover;border-radius:10px">`
    : '';
  openOverlay('productModal');
}

async function submitProduct(event) {
  event.preventDefault();
  const body = {
    name: $('#fName').value.trim(),
    category: $('#fCat').value,
    price: Number($('#fPrice').value),
    stock: Number($('#fStock').value),
    description: $('#fDesc').value.trim(),
    tags: $('#fTags').value.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
    image: $('#fImageUrl').value.trim() || null,
    active: $('#fActive').checked,
    i18n: {
      en: $('#fEn').value.trim(),
      ar: $('#fAr').value.trim(),
      tr: $('#fTr').value.trim(),
    },
  };

  try {
    let saved;
    if (state.editingId) {
      saved = await api(`/api/seller/products/${encodeURIComponent(state.editingId)}`, { method: 'PUT', body });
    } else {
      saved = await api('/api/seller/products', { method: 'POST', body });
    }
    const productId = saved?.product?.id || saved?.id || state.editingId;

    if (state.pendingImage && productId) {
      await api(`/api/seller/products/${encodeURIComponent(productId)}/image`, {
        method: 'POST',
        body: { dataUrl: state.pendingImage },
      });
    }

    closeOverlay('productModal');
    toast(T('saved', 'ذخیره شد'));
    await Promise.all([loadProducts(), loadOverview()]);
  } catch (err) {
    toast(err?.message || T('error_generic', 'خطا در ذخیره‌سازی'), 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm(T('confirm_delete', 'این کالا حذف شود؟'))) return;
  try {
    await api(`/api/seller/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast(T('saved', 'حذف شد'));
    await Promise.all([loadProducts(), loadOverview()]);
  } catch {
    toast(T('error_generic', 'خطا در حذف'), 'error');
  }
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

/* ------------------------------- سفارش‌ها ------------------------------- */

async function loadOrders(status = '') {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const { orders } = await api(`/api/seller/orders${query}`);
  state.orders = orders || [];
  renderOrders();
}

function renderOrders() {
  $('#orderRows').innerHTML = state.orders.map((order) => {
    const items = (order.items || []).map((i) => `${i.name} ×${i.qty}`).join('، ');
    const options = (order.allowedStatuses || [])
      .map((s) => `<option value="${esc(s)}">${esc(statusLabel(s))}</option>`).join('');
    const control = options
      ? `<select data-order="${esc(order.id)}">${options}</select>`
      : `<span class="hint">${esc(statusLabel(order.status))}</span>`;
    return `<tr>
      <td>#${esc(order.number || order.id)}</td>
      <td>${esc(order.customerName || '—')}</td>
      <td>${esc(items)}</td>
      <td>${esc(money(order.total))}</td>
      <td><span class="status ${esc(order.status)}">${esc(statusLabel(order.status))}</span></td>
      <td>${control}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="hint">${esc(T('no_orders', 'سفارشی ثبت نشده است'))}</td></tr>`;
}

async function changeStatus(orderId, status) {
  try {
    await api(`/api/seller/orders/${encodeURIComponent(orderId)}/status`, { method: 'PATCH', body: { status } });
    toast(T('saved', 'وضعیت به‌روز شد'));
    await Promise.all([loadOrders($('#orderFilter').value), loadOverview()]);
  } catch {
    toast(T('error_generic', 'تغییر وضعیت ممکن نشد'), 'error');
  }
}

/* --------------------------- ابزارهای هوشمند --------------------------- */

async function runDescribe() {
  const out = $('#dOut');
  out.textContent = T('loading', 'در حال پردازش…');
  try {
    const data = await api('/api/ai/describe', {
      method: 'POST',
      body: {
        name: $('#dName').value.trim(),
        category: $('#dCat').value,
        features: $('#dFeatures').value.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
        tone: $('#dTone').value,
        lang: getLang(),
      },
    });
    out.textContent = data.text || '';
  } catch {
    out.textContent = T('error_generic', 'تولید متن ممکن نشد');
  }
}

async function runPrice() {
  const out = $('#pOut');
  out.innerHTML = `<span class="hint">${esc(T('loading', 'در حال پردازش…'))}</span>`;
  try {
    const data = await api('/api/ai/price', {
      method: 'POST',
      body: {
        name: $('#pName').value.trim(),
        category: $('#pCat').value,
        cost: Number($('#pCost').value) || 0,
      },
    });
    out.innerHTML = `
      <div class="row-line total"><span>${esc(T('suggest_price', 'پیشنهاد قیمت'))}</span><span>${esc(money(data.recommended))}</span></div>
      <div class="row-line"><span>${esc(T('price_from', 'از'))}</span><span>${esc(money(data.low))}</span></div>
      <div class="row-line"><span>${esc(T('price_to', 'تا'))}</span><span>${esc(money(data.high))}</span></div>
      <p class="hint">${esc(data.note || '')}</p>`;
  } catch {
    out.innerHTML = `<span class="hint">${esc(T('error_generic', 'محاسبه ممکن نشد'))}</span>`;
  }
}

async function runKeywords() {
  const out = $('#kOut');
  out.innerHTML = `<span class="hint">${esc(T('loading', 'در حال پردازش…'))}</span>`;
  try {
    const data = await api('/api/ai/keywords', {
      method: 'POST',
      body: {
        name: $('#dName').value.trim(),
        description: $('#kDesc').value.trim(),
        category: $('#dCat').value,
        lang: getLang(),
      },
    });
    out.innerHTML = (data.keywords || []).map((k) => `<span class="chip">${esc(k)}</span>`).join('')
      || `<span class="hint">${esc(T('no_data', 'داده‌ای نیست'))}</span>`;
  } catch {
    out.innerHTML = `<span class="hint">${esc(T('error_generic', 'تولید کلیدواژه ممکن نشد'))}</span>`;
  }
}

/* ------------------------------- پروفایل ------------------------------- */

const PROFILE_ERRORS = {
  store_name_required: 'نام کسب‌وکار الزامی است',
  industry_invalid: 'صنف را انتخاب کنید',
  country_invalid: 'کشور را انتخاب کنید',
  city_required: 'شهر الزامی است',
  website_invalid: 'آدرس وب‌سایت معتبر نیست (با https:// شروع شود)',
};

let profileCatalog = null;

async function loadProfileCatalog() {
  if (profileCatalog) return profileCatalog;
  try { profileCatalog = await api('/api/directory/catalog'); } catch { profileCatalog = null; }
  return profileCatalog;
}

function fillProfileSelect(selector, rows, current) {
  const el = $(selector);
  if (!el) return;
  const lang = getLang();
  el.innerHTML = (rows || []).map((row) => {
    const value = row.slug || row.code;
    const label = row[lang] || row.fa || row.name || value;
    return `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

async function loadProfile() {
  const catalog = await loadProfileCatalog();
  try {
    const { profile } = await api('/api/seller/profile');
    fillProfileSelect('#pfIndustry', catalog?.industries || [], profile.industry);
    fillProfileSelect('#pfCountry', catalog?.countries || [], profile.country || 'IR');
    $('#pfBusiness').value = profile.businessName || '';
    $('#pfProvince').value = profile.province || '';
    $('#pfCity').value = profile.city || '';
    $('#pfAddress').value = profile.address || '';
    $('#pfWhatsapp').value = profile.whatsapp || '';
    $('#pfTelegram').value = profile.telegram || '';
    $('#pfInstagram').value = profile.instagram || '';
    $('#pfWebsite').value = profile.website || '';
    $('#pfPhone').textContent = profile.phone || '—';
    $('#profileStatus').textContent = '';
  } catch (err) {
    $('#profileStatus').textContent = err.message;
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const status = $('#profileStatus');
  status.textContent = 'در حال ذخیره…';
  try {
    const { profile } = await api('/api/seller/profile', {
      method: 'PUT',
      body: {
        businessName: $('#pfBusiness').value.trim(),
        industry: $('#pfIndustry').value,
        country: $('#pfCountry').value,
        province: $('#pfProvince').value.trim(),
        city: $('#pfCity').value.trim(),
        address: $('#pfAddress').value.trim(),
        whatsapp: $('#pfWhatsapp').value.trim(),
        telegram: $('#pfTelegram').value.trim(),
        instagram: $('#pfInstagram').value.trim(),
        website: $('#pfWebsite').value.trim(),
      },
    });
    status.textContent = 'پروفایل ذخیره شد ✓';
    $('#storeName').textContent = profile.businessName || $('#pfBusiness').value.trim();
  } catch (err) {
    status.textContent = PROFILE_ERRORS[err.message] || err.message;
  }
}

/* -------------------------------- تب‌ها -------------------------------- */

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.querySelectorAll('section[id^="tab-"]').forEach((sec) => { sec.hidden = sec.id !== `tab-${tab}`; });
  if (tab === 'products') loadProducts().catch(() => {});
  if (tab === 'orders') loadOrders($('#orderFilter').value).catch(() => {});
  if (tab === 'dash') loadOverview().catch(() => {});
  if (tab === 'profile') loadProfile().catch(() => {});
}

/* --------------------------------- شروع --------------------------------- */

function bind() {
  $('#langSelect').value = getLang();
  $('#langSelect').addEventListener('change', (e) => setLang(e.target.value));
  document.addEventListener('langchange', () => localize());

  $('#gLogin').addEventListener('click', login);
  $('#gPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    state.user = null;
    $('#panel').hidden = true;
    $('#gate').hidden = false;
  });

  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  $('#newProductBtn').addEventListener('click', () => openForm(null));
  $('#productForm').addEventListener('submit', submitProduct);
  $('#profileForm').addEventListener('submit', saveProfile);

  $('#productRows').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit]');
    if (edit) {
      const product = state.products.find((p) => p.id === edit.dataset.edit);
      if (product) openForm(product);
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) deleteProduct(del.dataset.del);
  });

  $('#fFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast(T('error_generic', 'حجم تصویر بیش از حد مجاز است'), 'error');
      return;
    }
    try {
      state.pendingImage = await readImageFile(file);
      $('#fPreview').innerHTML = `<img src="${state.pendingImage}" alt="" style="width:80px;height:80px;object-fit:cover;border-radius:10px">`;
    } catch {
      toast(T('error_generic', 'خواندن تصویر ممکن نشد'), 'error');
    }
  });

  $('#orderFilter').addEventListener('change', (e) => loadOrders(e.target.value).catch(() => {}));
  $('#orderRows').addEventListener('change', (e) => {
    const select = e.target.closest('[data-order]');
    if (select) changeStatus(select.dataset.order, select.value);
  });

  $('#dRun').addEventListener('click', runDescribe);
  $('#pRun').addEventListener('click', runPrice);
  $('#kRun').addEventListener('click', runKeywords);

  bindOverlayDismiss();
}

async function boot() {
  applyDir();
  localize();
  try { state.meta = await meta(); } catch { state.meta = null; }
  fillCategories();
  bind();

  const filter = $('#orderFilter');
  const statuses = ['pending', 'confirmed', 'shipped', 'delivered', 'canceled', 'returned'];
  filter.innerHTML = `<option value="">${esc(T('all_status', 'همه وضعیت‌ها'))}</option>`
    + statuses.map((s) => `<option value="${s}">${esc(statusLabel(s))}</option>`).join('');

  await checkAuth();
}

boot();

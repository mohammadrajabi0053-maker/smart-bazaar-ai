/* بازار هوشمند — منطق پنل مدیریت */
import {
  api, t, localize, getLang, setLang, applyDir, money, esc, statusLabel, fmtDate, toast,
} from './core.js';

const $ = (sel) => document.querySelector(sel);
const T = (key, fallback) => {
  const value = t(key);
  return value === key ? fallback : value;
};

const state = { user: null, overview: null, users: [], orders: [], ads: { campaigns: [], stats: null }, tab: 'overview' };

const AD_STATUS_FA = {
  draft: 'پیش‌نویس',
  awaiting_payment: 'در انتظار پرداخت',
  in_review: 'در بازبینی',
  scheduled: 'زمان‌بندی‌شده',
  active: 'فعال',
  completed: 'پایان‌یافته',
  canceled: 'لغو‌شده',
  rejected: 'رد‌شده',
};
const LOCALES = { fa: 'fa-IR', en: 'en-US', ar: 'ar-AE', tr: 'tr-TR' };

function localAmount(campaign) {
  const meta = campaign.currencyMeta || { symbol: campaign.currency, decimals: 2 };
  const locale = LOCALES[getLang()] || LOCALES.fa;
  try {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: meta.decimals }).format(campaign.totalLocal || 0)} ${meta.symbol}`;
  } catch {
    return `${campaign.totalLocal || 0} ${campaign.currency}`;
  }
}

/* --------------------------------- ورود --------------------------------- */

async function checkAuth() {
  try {
    const { user } = await api('/api/auth/me');
    if (user && user.role === 'admin') {
      state.user = user;
      $('#gate').hidden = true;
      $('#panel').hidden = false;
      await loadOverview();
      return;
    }
  } catch { /* ادامه با فرم ورود */ }
  $('#gate').hidden = false;
  $('#panel').hidden = true;
}

async function login() {
  const email = $('#gEmail').value.trim();
  const password = $('#gPass').value;
  if (!email || !password) return;
  try {
    const { user } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    if (user.role !== 'admin') {
      toast(T('admin_panel', 'پنل مدیریت') + ' — ' + T('error_generic', 'خطا'), 'error');
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
  const data = await api('/api/admin/overview');
  state.overview = data;
  renderOverview();
}

function renderOverview() {
  const o = state.overview;
  if (!o) return;
  const c = o.counts || {};
  const cards = [
    [T('users', 'کاربران'), c.users ?? 0],
    [T('all_sellers', 'فروشندگان'), c.sellers ?? 0],
    [T('products', 'کالاها'), c.products ?? 0],
    [T('orders', 'سفارش‌ها'), c.orders ?? 0],
    [T('revenue', 'درآمد'), money(o.revenue || 0)],
    [T('reviews', 'نظرات'), c.reviews ?? 0],
  ];
  $('#stats').innerHTML = cards
    .map(([label, value]) => `<div class="stat"><span class="hint">${esc(label)}</span><strong>${esc(value)}</strong></div>`)
    .join('');

  $('#statusBreakdown').innerHTML = (o.statusBreakdown || [])
    .filter((row) => row.count > 0)
    .map((row) => `<span class="status ${esc(row.status)}">${esc(statusLabel(row.status))}: ${esc(row.count)}</span>`)
    .join('') || `<span class="hint">${esc(T('no_data', 'داده‌ای نیست'))}</span>`;

  $('#topProducts').innerHTML = (o.topProducts || []).length
    ? o.topProducts
      .map((p) => `<div class="row-line"><span>${esc(p.name)}</span><span>${esc(p.soldCount)} × ${esc(money(p.price))}</span></div>`)
      .join('')
    : `<p class="hint">${esc(T('no_data', 'داده‌ای نیست'))}</p>`;

  $('#recentOrders').innerHTML = (o.recentOrders || []).length
    ? o.recentOrders
      .map((order) => `<div class="row-line">
        <span>#${esc(order.number || order.id)} · ${esc(order.storeName || '')}</span>
        <span><span class="status ${esc(order.status)}">${esc(statusLabel(order.status))}</span> ${esc(money(order.total))}</span>
      </div>`)
      .join('')
    : `<p class="hint">${esc(T('no_orders', 'سفارشی ثبت نشده است'))}</p>`;
}

/* -------------------------------- کاربران -------------------------------- */

async function loadUsers() {
  const { users } = await api('/api/admin/users');
  state.users = users || [];
  renderUsers();
}

function renderUsers() {
  $('#userRows').innerHTML = state.users
    .map((u) => {
      const blocked = u.status === 'blocked';
      const action = u.role === 'admin'
        ? ''
        : `<button class="btn small ${blocked ? '' : 'secondary'}" type="button" data-user="${esc(u.id)}" data-next="${blocked ? 'active' : 'blocked'}">
            ${esc(blocked ? T('unblock', 'رفع مسدودی') : T('block', 'مسدودسازی'))}
          </button>`;
      return `<tr>
        <td>${esc(u.name)}</td>
        <td dir="ltr">${esc(u.email)}</td>
        <td><span class="chip">${esc(T(u.role, u.role))}</span></td>
        <td>${esc(u.storeName || '—')}</td>
        <td><span class="status ${blocked ? 'canceled' : 'delivered'}">${esc(blocked ? T('inactive', 'غیرفعال') : T('active', 'فعال'))}</span></td>
        <td>${action}</td>
      </tr>`;
    })
    .join('');
}

async function toggleUser(id, next) {
  try {
    await api(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status: next } });
    toast(T('saved', 'ذخیره شد'));
    await loadUsers();
  } catch {
    toast(T('error_generic', 'خطا در انجام عملیات'), 'error');
  }
}

/* ------------------------------- سفارش‌ها ------------------------------- */

async function loadOrders() {
  const { orders } = await api('/api/admin/orders');
  state.orders = orders || [];
  renderOrders();
}

function renderOrders() {
  $('#orderRows').innerHTML = state.orders
    .map((order) => `<tr>
      <td>#${esc(order.number || order.id)}</td>
      <td>${esc(order.storeName || '—')}</td>
      <td>${esc(order.customerName || '—')}</td>
      <td>${esc(money(order.total))}</td>
      <td><span class="status ${esc(order.status)}">${esc(statusLabel(order.status))}</span></td>
      <td>${esc(fmtDate(order.createdAt))}</td>
    </tr>`)
    .join('') || `<tr><td colspan="6" class="hint">${esc(T('no_orders', 'سفارشی ثبت نشده است'))}</td></tr>`;
}

/* --------------------------- کمپین‌های تبلیغاتی --------------------------- */

async function loadAds() {
  const data = await api('/api/admin/ads/campaigns');
  state.ads = { campaigns: data.campaigns || [], stats: data.stats || null };
  renderAds();
}

function renderAds() {
  const { campaigns, stats } = state.ads;
  const s = stats || {};
  const byStatus = s.byStatus || {};
  const usd = (n) => `$${Number(n || 0).toFixed(2)}`;
  const cards = [
    [T('ads_campaigns', 'کمپین‌ها'), s.total ?? campaigns.length],
    [T('awaiting_payment', 'در انتظار پرداخت'), byStatus.awaiting_payment ?? 0],
    [T('active', 'فعال'), byStatus.active ?? 0],
    [T('revenue', 'درآمد تأییدشده'), usd(s.revenueUsd)],
    [T('pipeline', 'در جریان'), usd(s.pipelineUsd)],
  ];
  $('#adStats').innerHTML = cards
    .map(([label, value]) => `<div class="stat"><span class="hint">${esc(label)}</span><strong>${esc(value)}</strong></div>`)
    .join('');

  $('#adRows').innerHTML = campaigns.length
    ? campaigns
      .map((c) => `<tr>
        <td class="mono">${esc(c.invoiceNo)}</td>
        <td>${esc(c.title)}</td>
        <td>${esc(c.countryName?.fa || c.country)}</td>
        <td>${esc(c.durationDays)} روز</td>
        <td>${esc(localAmount(c))}</td>
        <td>${esc(usd(c.totalUsd))}</td>
        <td><span class="status">${esc(AD_STATUS_FA[c.status] || c.status)}</span></td>
        <td>${esc(fmtDate(c.createdAt))}</td>
      </tr>`)
      .join('')
    : `<tr><td colspan="8" class="hint">${esc(T('no_data', 'کمپینی ثبت نشده است'))}</td></tr>`;
}

/* -------------------------------- تب‌ها -------------------------------- */

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.querySelectorAll('section[id^="tab-"]').forEach((sec) => { sec.hidden = sec.id !== `tab-${tab}`; });
  if (tab === 'overview') loadOverview().catch(() => {});
  if (tab === 'users') loadUsers().catch(() => {});
  if (tab === 'orders') loadOrders().catch(() => {});
  if (tab === 'ads') loadAds().catch(() => {});
}

function renderAll() {
  if (state.tab === 'overview') renderOverview();
  if (state.tab === 'users') renderUsers();
  if (state.tab === 'orders') renderOrders();
  if (state.tab === 'ads') renderAds();
}

/* --------------------------------- شروع --------------------------------- */

function bind() {
  $('#langSelect').value = getLang();
  $('#langSelect').addEventListener('change', (e) => setLang(e.target.value));
  document.addEventListener('langchange', () => { localize(); renderAll(); });

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

  $('#userRows').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-user]');
    if (btn) toggleUser(btn.dataset.user, btn.dataset.next);
  });
}

applyDir();
localize();
bind();
checkAuth();

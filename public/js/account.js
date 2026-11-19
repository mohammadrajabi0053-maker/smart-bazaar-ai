/* بازار هوشمند — منطق پنل مشتری: سفارش‌ها، پرداخت آزمایشی و پروفایل */
import { api } from './core.js';
import { T, mountPage, toast, fmtDate, fmtDateTime, num, esc, badge } from './p3.js';

const $ = (sel) => document.querySelector(sel);

const state = { user: null, summary: null, filter: '' };

const STATUS_TONES = {
  pending: 'warn', confirmed: 'neutral', processing: 'neutral', shipped: 'ok',
  delivered: 'ok', canceled: 'bad', returned: 'bad',
};

const ORDER_STATUS_LABEL = {
  pending: ['در انتظار تأیید', 'Pending', 'قيد الانتظار', 'Beklemede'],
  confirmed: ['تأییدشده', 'Confirmed', 'مؤكد', 'Onaylandı'],
  processing: ['در حال آماده‌سازی', 'Processing', 'قيد التجهيز', 'Hazırlanıyor'],
  shipped: ['ارسال‌شده', 'Shipped', 'تم الإرسال', 'Kargoda'],
  delivered: ['تحویل‌شده', 'Delivered', 'تم التسليم', 'Teslim edildi'],
  canceled: ['لغوشده', 'Canceled', 'ملغى', 'İptal'],
  returned: ['مرجوع‌شده', 'Returned', 'مُرتجع', 'İade'],
};

const LANG_INDEX = { fa: 0, en: 1, ar: 2, tr: 3 };
const langIdx = () => {
  const lang = document.documentElement.lang || 'fa';
  return LANG_INDEX[lang] ?? 0;
};

const statusLabel = (status) => (ORDER_STATUS_LABEL[status] || [status])[langIdx()] || status;

function renderStats() {
  const s = state.summary?.stats || { orders: 0, open: 0, spent: 0 };
  $('#stats').innerHTML = [
    ['📦', num(s.orders), T('my_orders')],
    ['⏳', num(s.open), statusLabel('processing')],
    ['💳', num(s.spent), T('total')],
    ['📞', state.user?.phoneVerified ? T('phone_verified') : T('unverified'), T('phone')],
  ].map(([icon, value, label]) => `
    <div class="p3-stat">
      <div class="p3-stat__value">${icon} ${esc(value)}</div>
      <div class="p3-stat__label">${esc(label)}</div>
    </div>`).join('');
}

function orderCard(order) {
  const paid = order.payment?.status === 'paid';
  const items = (order.items || []).map((item) => `
    <li>${esc(item.name)} × ${num(item.qty)} — ${num(item.price * item.qty)}</li>`).join('');
  return `
    <article class="p3-item" data-order="${esc(order.id)}">
      <div class="p3-item__head">
        <div>
          <div class="p3-item__title">#${esc(order.number)} · ${esc(order.storeName || '')}</div>
          <div class="p3-item__meta">
            <span>${esc(fmtDateTime(order.createdAt))}</span>
            <span>${esc(num(order.total))}</span>
            ${paid ? badge(T('paid'), 'ok') : badge(T('unpaid'), 'warn')}
            ${badge(statusLabel(order.status), STATUS_TONES[order.status] || 'neutral')}
          </div>
        </div>
        <div class="p3-row">
          ${!paid && !['canceled', 'returned'].includes(order.status)
            ? `<button class="p3-btn p3-btn--small" data-pay="${esc(order.id)}" type="button">${esc(T('pay_test'))}</button>` : ''}
        </div>
      </div>
      <ul style="margin:10px 0 0;padding-inline-start:18px;font-size:.86rem">${items}</ul>
      ${order.discount ? `<p class="p3-hint">${esc(T('total'))}: −${esc(num(order.discount))}</p>` : ''}
      ${order.tracking ? `
        <p class="p3-hint" style="margin-top:8px">
          🚚 ${esc(T('tracking'))}: ${esc(order.tracking.carrier)} — <span class="p3-mono">${esc(order.tracking.trackingNumber)}</span>
          ${order.tracking.trackingUrl ? ` · <a href="${esc(order.tracking.trackingUrl)}" target="_blank" rel="noopener noreferrer">${esc(T('tracking_url'))}</a>` : ''}
        </p>` : ''}
    </article>`;
}

function renderOrders() {
  const list = (state.summary?.recentOrders || []).filter((o) => !state.filter || o.status === state.filter);
  const host = $('#orderList');
  if (!list.length) {
    host.innerHTML = `<p class="p3-empty">${esc(T('orders_empty'))}</p>`;
    return;
  }
  host.innerHTML = list.map(orderCard).join('');
}

function renderUser() {
  const user = state.user;
  $('#userName').textContent = user.name;
  $('#userMeta').textContent = `${user.email || user.phone || ''}${user.city ? ` · ${user.city}` : ''}`;
  $('#sellerLink').hidden = user.role !== 'seller';
  $('#pName').value = user.name || '';
  $('#pPhone').value = user.phone || '';
  $('#pCity').value = user.city || '';
  $('#pAddress').value = user.address || '';
}

async function payTest(orderId) {
  try {
    await api(`/api/orders/${orderId}/pay-test`, { method: 'POST' });
    toast(T('paid'), 'ok');
    await load();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const status = $('#profileStatus');
  status.textContent = T('loading');
  try {
    const data = await api('/api/account/profile', {
      method: 'PATCH',
      body: {
        name: $('#pName').value.trim(),
        city: $('#pCity').value.trim(),
        address: $('#pAddress').value.trim(),
      },
    });
    state.user = { ...state.user, ...data.user };
    renderUser();
    status.textContent = T('saved');
    toast(T('saved'), 'ok');
  } catch (err) {
    status.textContent = err.message;
  }
}

async function load() {
  try {
    const data = await api('/api/account/summary');
    state.user = data.user;
    state.summary = data;
    $('#gate').hidden = true;
    $('#panel').hidden = false;
    renderUser();
    renderStats();
    renderOrders();
  } catch (err) {
    if (err.status === 401) {
      $('#gate').hidden = false;
      $('#panel').hidden = true;
      $('#gateText').textContent = T('login_sub');
      return;
    }
    toast(err.message, 'error');
  }
}

function init() {
  mountPage();

  document.querySelectorAll('.p3-tabs [data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.p3-tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      ['orders', 'profile'].forEach((tab) => {
        const section = document.getElementById(`tab-${tab}`);
        if (section) section.hidden = tab !== btn.dataset.tab;
      });
    });
  });

  const filter = $('#orderFilter');
  if (filter) {
    filter.innerHTML = ['', 'pending', 'shipped', 'delivered', 'canceled']
      .map((value) => `<option value="${value}">${value ? esc(statusLabel(value)) : esc(T('my_orders'))}</option>`)
      .join('');
    filter.addEventListener('change', () => {
      state.filter = filter.value;
      renderOrders();
    });
  }

  document.addEventListener('click', (event) => {
    const payBtn = event.target.closest('[data-pay]');
    if (payBtn) payTest(payBtn.dataset.pay);
  });

  $('#profileForm').addEventListener('submit', saveProfile);
  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* خروج محلی */ }
    location.assign('/');
  });
  window.addEventListener('lang-changed', () => {
    mountPage();
    renderStats();
    renderOrders();
  });

  load();
}

init();

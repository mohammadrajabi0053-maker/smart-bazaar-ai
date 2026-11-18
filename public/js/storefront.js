/* بازار هوشمند — منطق فروشگاه مشتری */
import {
  api, t, localize, getLang, setLang, applyDir, money, esc, stars, statusLabel, fmtDate,
  toast, readCart, addToCart, cartCount, setQty, clearCart, openOverlay, closeOverlay,
  openDrawer, closeDrawer, meta, catLabel, catIcon, productImage, bindOverlayDismiss,
} from './core.js';

const $ = (sel) => document.querySelector(sel);

const state = {
  q: '', category: '', minPrice: '', maxPrice: '', inStock: false, sort: 'newest',
  page: 1, pages: 1, total: 0, items: [], user: null, meta: null, loading: false,
  ai: [], authMode: 'login',
};

/* ------------------------------- محصولات ------------------------------- */

function query() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.minPrice) params.set('minPrice', state.minPrice);
  if (state.maxPrice) params.set('maxPrice', state.maxPrice);
  if (state.inStock) params.set('inStock', 'true');
  params.set('sort', state.sort);
  params.set('page', String(state.page));
  params.set('pageSize', '12');
  params.set('lang', getLang());
  return params.toString();
}

async function loadProducts(reset = false) {
  if (state.loading) return;
  state.loading = true;
  if (reset) { state.page = 1; state.items = []; $('#grid').innerHTML = `<p class="empty-state">${esc(t('loading'))}</p>`; }
  try {
    const data = await api(`/api/products?${query()}`);
    state.items = reset ? data.items : state.items.concat(data.items);
    state.total = data.total;
    state.pages = data.pages;
    renderGrid();
    renderResults();
  } catch (err) {
    $('#grid').innerHTML = `<p class="empty-state">${esc(t('error_generic'))}</p>`;
  } finally {
    state.loading = false;
  }
}

function renderResults() {
  const info = $('#resultsInfo');
  if (!state.total) {
    info.textContent = state.q ? t('no_results_ai') : t('no_products');
  } else {
    info.textContent = `${state.total.toLocaleString(getLang() === 'fa' ? 'fa-IR' : 'en-US')} ${t('results')}`;
  }
  $('#loadMore').hidden = state.page >= state.pages;
}

function renderGrid() {
  const grid = $('#grid');
  if (!state.items.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div style="font-size:34px">🔍</div><p>${esc(t('no_products'))}</p>
      <button class="btn secondary" type="button" data-ai-open>🤖 ${esc(t('ai_assistant'))}</button></div>`;
    return;
  }
  grid.innerHTML = state.items.map((p) => {
    const out = Number(p.stock) <= 0;
    return `<article class="card">
      <button type="button" class="thumb" data-open="${esc(p.id)}" style="border:0;padding:0;cursor:pointer;width:100%;background:#eef4f4" aria-label="${esc(p.name)}">
        ${productImage(p)}
        ${out ? `<span class="out-stock">${esc(t('out_of_stock'))}</span>` : ''}
      </button>
      <div class="body">
        <span class="tag-pill">${esc(catIcon(p.category))} ${esc(catLabel(p.category))}</span>
        <h3><a href="#" data-open="${esc(p.id)}" style="color:inherit">${esc(p.name)}</a></h3>
        <span class="store">🏪 ${esc(p.seller?.storeName || t('seller'))}</span>
        <span class="stars">${stars(p.rating)} <small>(${Number(p.reviewCount) || 0})</small></span>
        <div class="meta"><span>${esc(t('stock'))}: ${Number(p.stock)}</span><span>${Number(p.soldCount) || 0} ${esc(t('popular'))}</span></div>
        <div class="price">${esc(money(p.price))}</div>
        <button class="btn small block" type="button" data-add="${esc(p.id)}" ${out ? 'disabled' : ''}>
          ${out ? esc(t('out_of_stock')) : '🛒 ' + esc(t('add_to_cart'))}
        </button>
      </div>
    </article>`;
  }).join('');
}

function renderChips() {
  const cats = state.meta?.categories || [];
  const chips = [`<button class="chip ${state.category ? '' : 'active'}" type="button" data-cat="">${esc(t('all'))}</button>`]
    .concat(cats.map((c) => `<button class="chip ${state.category === c.slug ? 'active' : ''}" type="button" data-cat="${esc(c.slug)}">${esc(c.icon)} ${esc(c[getLang()] || c.fa)}</button>`));
  $('#catChips').innerHTML = chips.join('');
  $('#footerCats').innerHTML = cats.slice(0, 6).map((c) => `<li><a href="#" data-cat="${esc(c.slug)}">${esc(c.icon)} ${esc(c[getLang()] || c.fa)}</a></li>`).join('');
}

function renderDemoAccounts() {
  const list = state.meta?.demoAccounts || [];
  $('#demoAccounts').innerHTML = list.map((a) => `<li>${esc(a.role)}: ${esc(a.email)} / ${esc(a.password)}</li>`).join('');
}

/* ------------------------------- جزئیات محصول ------------------------------- */

async function openProduct(id) {
  $('#pmTitle').textContent = t('loading');
  $('#pmBody').innerHTML = '';
  openOverlay('productModal');
  try {
    const data = await api(`/api/products/${encodeURIComponent(id)}?lang=${getLang()}`);
    renderProduct(data);
  } catch {
    $('#pmTitle').textContent = t('error_generic');
  }
}

function renderProduct({ product, reviews, related }) {
  $('#pmTitle').textContent = product.name;
  const out = Number(product.stock) <= 0;
  const canReview = Boolean(state.user);
  $('#pmBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr;gap:14px">
      <div style="border-radius:12px;overflow:hidden;background:#eef4f4;aspect-ratio:16/10;position:relative">
        ${productImage(product)}
        ${out ? `<span class="out-stock">${esc(t('out_of_stock'))}</span>` : ''}
      </div>
      <div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px">
          <span class="tag-pill">${esc(catIcon(product.category))} ${esc(catLabel(product.category))}</span>
          <span class="stars">${stars(product.rating)} (${Number(product.reviewCount) || 0})</span>
          <span class="store">🏪 ${esc(product.seller?.storeName || t('seller'))}</span>
        </div>
        <div class="price" style="font-size:20px">${esc(money(product.price))}</div>
        <p class="hint" style="margin:4px 0 10px">${esc(t('stock'))}: ${Number(product.stock)} · ${Number(product.soldCount) || 0} ${esc(t('popular'))}</p>
        <h3 style="font-size:14px;margin-bottom:4px">${esc(t('description'))}</h3>
        <p style="white-space:pre-line;font-size:13.5px;margin:0 0 12px">${esc(product.description)}</p>
        ${product.tags?.length ? `<div class="pill-row" style="margin-bottom:12px">${product.tags.map((tag) => `<span class="tag-pill">#${esc(tag)}</span>`).join('')}</div>` : ''}
        <button class="btn block" type="button" data-add="${esc(product.id)}" ${out ? 'disabled' : ''}>🛒 ${esc(t('add_to_cart'))}</button>
      </div>
    </div>

    <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">

    <h3 style="font-size:15px">${esc(t('reviews'))} (${reviews.length})</h3>
    <div id="reviewList">${reviews.length ? reviews.map((r) => `
      <div style="border-bottom:1px dashed var(--line);padding:8px 0">
        <strong style="font-size:13px">${esc(r.userName)}</strong>
        <span class="stars">${stars(r.rating)}</span>
        <div class="hint">${esc(fmtDate(r.createdAt))}</div>
        <p style="margin:2px 0 0;font-size:13px">${esc(r.comment)}</p>
      </div>`).join('') : `<p class="hint">${esc(t('no_data'))}</p>`}</div>

    ${canReview ? `<form id="reviewForm" style="margin-top:12px">
      <div class="field-row">
        <div class="field"><label>${esc(t('your_rating'))}</label>
          <select name="rating" required>${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${stars(n)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>${esc(t('comment'))}</label><input name="comment" minlength="3" maxlength="500" required></div>
      </div>
      <button class="btn small" type="submit">${esc(t('write_review'))}</button>
    </form>` : `<p class="hint">${esc(t('need_login'))}</p>`}

    ${related?.length ? `<h3 style="font-size:15px;margin-top:16px">${esc(t('related'))}</h3>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">
        ${related.map((p) => `<article class="card"><button type="button" class="thumb" data-open="${esc(p.id)}" style="border:0;padding:0;cursor:pointer">${productImage(p)}</button>
          <div class="body"><h3 style="min-height:auto;font-size:12.5px">${esc(p.name)}</h3><span class="price" style="font-size:13px">${esc(money(p.price))}</span></div></article>`).join('')}
      </div>` : ''}
  `;

  const form = $('#reviewForm');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      try {
        await api(`/api/products/${encodeURIComponent(product.id)}/reviews`, {
          method: 'POST',
          body: { rating: Number(formData.get('rating')), comment: String(formData.get('comment') || '') },
        });
        toast(t('saved'), 'ok');
        openProduct(product.id);
      } catch (err) {
        toast(t(err.message) === err.message ? t('error_generic') : t(err.message), 'error');
      }
    });
  }
}

/* ------------------------------- سبد خرید ------------------------------- */

function renderCart() {
  const cart = readCart();
  const count = cartCount(cart);
  const badge = $('#cartCount');
  badge.textContent = String(count);
  badge.hidden = count === 0;

  if (!cart.length) {
    $('#cartItems').innerHTML = `<p class="empty-state">${esc(t('cart_empty'))}</p>`;
    $('#cartFoot').innerHTML = '';
    return;
  }

  $('#cartItems').innerHTML = cart.map((row) => `
    <div class="cart-item">
      ${row.image ? `<img src="${esc(row.image)}" alt="">` : `<div class="qty" style="width:56px;height:56px;display:grid;place-items:center;background:#eef4f4;border-radius:8px;font-size:22px">🛍️</div>`}
      <div class="info">
        <div style="font-weight:600">${esc(row.name)}</div>
        <div class="hint">${esc(money(row.price))}</div>
        <div class="qty">
          <button type="button" data-qty="${esc(row.productId)}" data-delta="-1">−</button>
          <span>${row.qty}</span>
          <button type="button" data-qty="${esc(row.productId)}" data-delta="1">+</button>
          <button type="button" class="btn small secondary" data-remove="${esc(row.productId)}" style="margin-inline-start:8px">${esc(t('remove'))}</button>
        </div>
      </div>
      <strong style="font-size:13px">${esc(money(row.price * row.qty))}</strong>
    </div>`).join('');

  const subtotal = cart.reduce((sum, row) => sum + row.price * row.qty, 0);
  const freeFrom = Number(state.meta?.freeShippingFrom || 0);
  const shipBase = Number(state.meta?.shippingCost || 0);
  const shipping = freeFrom && subtotal >= freeFrom ? 0 : shipBase;
  $('#cartFoot').innerHTML = `
    <div class="row-line"><span>${esc(t('subtotal'))}</span><span>${esc(money(subtotal))}</span></div>
    <div class="row-line"><span>${esc(t('shipping'))}</span><span>${shipping ? esc(money(shipping)) : esc(t('free_shipping'))}</span></div>
    <div class="row-line total"><span>${esc(t('total'))}</span><span>${esc(money(subtotal + shipping))}</span></div>
    <button class="btn block" type="button" id="goCheckout" style="margin-top:10px">${esc(t('checkout'))}</button>`;
}

function cartSummaryHtml() {
  const cart = readCart();
  const subtotal = cart.reduce((sum, row) => sum + row.price * row.qty, 0);
  const freeFrom = Number(state.meta?.freeShippingFrom || 0);
  const shipping = freeFrom && subtotal >= freeFrom ? 0 : Number(state.meta?.shippingCost || 0);
  return `<div class="row-line"><span>${esc(t('subtotal'))}</span><span>${esc(money(subtotal))}</span></div>
    <div class="row-line"><span>${esc(t('shipping'))}</span><span>${shipping ? esc(money(shipping)) : esc(t('free_shipping'))}</span></div>
    <div class="row-line total"><span>${esc(t('total'))}</span><span>${esc(money(subtotal + shipping))}</span></div>`;
}

/* ------------------------------- حساب کاربری ------------------------------- */

async function loadMe() {
  try {
    const data = await api('/api/auth/me');
    state.user = data.user || null;
  } catch { state.user = null; }
  renderAccount();
}

function renderAccount() {
  const label = $('#accountLabel');
  if (state.user) {
    label.textContent = state.user.role === 'seller' ? t('seller_panel') : t('account');
    $('#accountBtn').title = `${state.user.name} · ${state.user.email}`;
  } else {
    label.textContent = t('login');
    $('#accountBtn').title = t('login');
  }
}

function openAuth(mode = 'login') {
  state.authMode = mode;
  applyAuthMode();
  openOverlay('authModal');
}

function applyAuthMode() {
  const isRegister = state.authMode === 'register';
  $('#tabLogin').classList.toggle('active', !isRegister);
  $('#tabRegister').classList.toggle('active', isRegister);
  $('#authTitle').textContent = isRegister ? t('register') : t('login');
  $('#nameField').hidden = !isRegister;
  $('#roleField').hidden = !isRegister;
  $('#storeField').hidden = !isRegister;
  $('#auPass').autocomplete = isRegister ? 'new-password' : 'current-password';
  $('#authHint').textContent = isRegister ? '' : (state.meta?.demoAccounts || []).map((a) => `${a.role}: ${a.email}`).join(' · ');
}

async function submitAuth(event) {
  event.preventDefault();
  const formData = new FormData($('#authForm'));
  const payload = {
    email: String(formData.get('email') || '').trim(),
    password: String(formData.get('password') || ''),
  };
  if (state.authMode === 'register') {
    payload.name = String(formData.get('name') || '').trim();
    payload.role = String(formData.get('role') || 'customer');
    payload.storeName = String(formData.get('storeName') || '').trim();
  }
  try {
    const data = await api(`/api/auth/${state.authMode}`, { method: 'POST', body: payload });
    state.user = data.user;
    renderAccount();
    closeOverlay('authModal');
    toast(`${t('saved')} ${data.user.name}`, 'ok');
    if (data.user.role === 'seller') location.href = '/seller';
    else if (data.user.role === 'admin') location.href = '/admin';
    else loadProducts(true);
  } catch (err) {
    toast(t(err.message), 'error');
  }
}

async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  state.user = null;
  renderAccount();
  closeOverlay('ordersModal');
  toast(t('logout'));
}

async function openOrders() {
  if (!state.user) { openAuth('login'); return; }
  openOverlay('ordersModal');
  $('#ordersBody').innerHTML = `<p class="empty-state">${esc(t('loading'))}</p>`;
  try {
    const { orders } = await api('/api/orders');
    if (!orders.length) {
      $('#ordersBody').innerHTML = `<p class="empty-state">${esc(t('no_orders'))}</p>`;
      return;
    }
    $('#ordersBody').innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>${esc(t('order_no'))}</th><th>${esc(t('store'))}</th><th>${esc(t('items'))}</th><th>${esc(t('total'))}</th><th>${esc(t('status'))}</th><th>${esc(t('date'))}</th></tr></thead>
        <tbody>${orders.map((o) => `<tr>
          <td>${esc(o.number)}</td>
          <td>${esc(o.storeName)}</td>
          <td>${o.items.map((i) => `${esc(i.name)} ×${i.qty}`).join('<br>')}</td>
          <td>${esc(money(o.total))}</td>
          <td><span class="status ${esc(o.status)}">${esc(statusLabel(o.status))}</span></td>
          <td>${esc(fmtDate(o.createdAt))}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <button class="btn secondary small" type="button" id="doLogout" style="margin-top:12px">${esc(t('logout'))}</button>`;
    $('#doLogout').addEventListener('click', logout);
  } catch {
    $('#ordersBody').innerHTML = `<p class="empty-state">${esc(t('error_generic'))}</p>`;
  }
}

/* ------------------------------- پرداخت ------------------------------- */

function openCheckout() {
  if (!readCart().length) { toast(t('cart_empty'), 'error'); return; }
  if (!state.user) {
    closeDrawer('cartDrawer');
    toast(t('need_login'), 'error');
    openAuth('login');
    return;
  }
  const nameInput = $('#coName');
  if (!nameInput.value) nameInput.value = state.user.name || '';
  const phoneInput = $('#coPhone');
  if (!phoneInput.value && state.user.phone) phoneInput.value = state.user.phone;
  $('#checkoutSummary').innerHTML = cartSummaryHtml();
  closeDrawer('cartDrawer');
  openOverlay('checkoutModal');
}

async function submitCheckout(event) {
  event.preventDefault();
  const formData = new FormData($('#checkoutForm'));
  const items = readCart().map((row) => ({ productId: row.productId, qty: row.qty }));
  try {
    const data = await api('/api/orders', {
      method: 'POST',
      body: {
        items,
        note: String(formData.get('note') || ''),
        shipping: {
          fullName: String(formData.get('fullName') || ''),
          phone: String(formData.get('phone') || ''),
          city: String(formData.get('city') || ''),
          address: String(formData.get('address') || ''),
          postalCode: String(formData.get('postalCode') || ''),
        },
      },
    });
    clearCart();
    renderCart();
    closeOverlay('checkoutModal');
    toast(`${t('order_success')} ${data.orders.map((o) => o.number).join(' · ')}`, 'ok');
    openOrders();
  } catch (err) {
    const key = String(err.message || '');
    const extra = err.data?.name ? ` (${err.data.name})` : '';
    toast((t(key) === key ? t('error_generic') : t(key)) + extra, 'error');
  }
}

/* ------------------------------- دستیار هوشمند ------------------------------- */

function renderAi() {
  $('#aiLog').innerHTML = state.ai.length
    ? state.ai.map((m) => `<div class="ai-msg ${m.role === 'me' ? 'me' : 'bot'}">${m.html || esc(m.text)}</div>`).join('')
    : `<div class="ai-msg bot">${esc(t('assistant_intro'))}</div>`;
  $('#aiLog').scrollTop = $('#aiLog').scrollHeight;
}

function aiPills() {
  const samples = getLang() === 'fa'
    ? ['هدفون بی‌سیم زیر ۲ میلیون', 'گوشی با دوربین خوب', 'پرفروش‌ترین‌ها', 'سفارش‌های من کجاست؟']
    : getLang() === 'ar'
      ? ['سماعات لاسلكية', 'هاتف بكاميرا جيدة', 'الأكثر مبيعًا', 'أين طلباتي؟']
      : getLang() === 'tr'
        ? ['Kablosuz kulaklık', 'İyi kameralı telefon', 'En çok satanlar', 'Siparişlerim nerede?']
        : ['Wireless headphones', 'Phone with good camera', 'Best sellers', 'Where are my orders?'];
  $('#aiPills').innerHTML = samples.map((s) => `<button class="chip" type="button" data-ai-sample="${esc(s)}">${esc(s)}</button>`).join('');
}

async function askAi(message) {
  if (!message.trim()) return;
  state.ai.push({ role: 'me', text: message });
  renderAi();
  try {
    const data = await api('/api/ai/assistant', { method: 'POST', body: { message, lang: getLang() } });
    let html = esc(data.reply).replaceAll('\n', '<br>');
    if (data.products?.length) {
      html += '<div class="pill-row">' + data.products.map((p) => `<button class="chip" type="button" data-open="${esc(p.id)}">${esc(p.name)} · ${esc(money(p.price))}</button>`).join('') + '</div>';
    }
    state.ai.push({ role: 'bot', html });
    $('#aiEngine').textContent = data.engine || 'local';
  } catch {
    state.ai.push({ role: 'bot', text: t('error_generic') });
  }
  renderAi();
}

/* ------------------------------- جست‌وجو ------------------------------- */

let suggestTimer = null;
function onSearchInput() {
  const value = $('#searchInput').value.trim();
  clearTimeout(suggestTimer);
  if (value.length < 2) { $('#suggestions').hidden = true; return; }
  suggestTimer = setTimeout(async () => {
    try {
      const data = await api(`/api/search/suggest?q=${encodeURIComponent(value)}&lang=${getLang()}`);
      const box = $('#suggestions');
      const rows = [];
      data.suggestions.forEach((s) => rows.push(`<button type="button" data-suggest="${esc(s)}">🔎 ${esc(s)}</button>`));
      data.products.forEach((p) => rows.push(`<button type="button" data-open="${esc(p.id)}">${p.image ? '🖼️' : '🛍️'} ${esc(p.name)} — ${esc(money(p.price))}</button>`));
      box.innerHTML = rows.join('') || `<button type="button" disabled>${esc(t('no_products'))}</button>`;
      box.hidden = false;
    } catch { /* ignore */ }
  }, 220);
}

function runSearch(value) {
  state.q = value.trim();
  $('#searchInput').value = state.q;
  $('#suggestions').hidden = true;
  loadProducts(true);
}

/* ------------------------------- رویدادها ------------------------------- */

function bindUi() {
  bindOverlayDismiss();
  $('#year').textContent = new Date().getFullYear();
  $('#langSelect').value = getLang();
  renderAccount();
  renderCart();
  renderAi();
  aiPills();

  $('#langSelect').addEventListener('change', (event) => {
    setLang(event.target.value);
  });

  document.addEventListener('langchange', async () => {
    localize();
    renderChips();
    renderCart();
    renderAi();
    aiPills();
    renderAccount();
    renderResults();
    await loadProducts(true);
  });

  document.addEventListener('cartchange', () => renderCart());

  $('#searchInput').addEventListener('input', onSearchInput);
  $('#searchInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); runSearch(event.target.value); }
  });
  $('#searchInput').addEventListener('blur', () => setTimeout(() => { $('#suggestions').hidden = true; }, 180));

  $('#suggestions').addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.suggest) runSearch(target.dataset.suggest);
    else if (target.dataset.open) { $('#suggestions').hidden = true; openProduct(target.dataset.open); }
  });

  $('#catChips').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-cat]');
    if (!chip) return;
    state.category = chip.dataset.cat || '';
    renderChips();
    loadProducts(true);
  });
  $('#footerCats').addEventListener('click', (event) => {
    const link = event.target.closest('[data-cat]');
    if (!link) return;
    event.preventDefault();
    state.category = link.dataset.cat || '';
    renderChips();
    loadProducts(true);
    window.scrollTo({ top: 220, behavior: 'smooth' });
  });

  $('#applyFilters').addEventListener('click', () => {
    state.minPrice = $('#priceMin').value;
    state.maxPrice = $('#priceTo').value;
    state.inStock = $('#inStock').checked;
    state.sort = $('#sortSelect').value;
    loadProducts(true);
  });
  $('#resetFilters').addEventListener('click', () => {
    state.q = ''; state.category = ''; state.minPrice = ''; state.maxPrice = '';
    state.inStock = false; state.sort = 'newest';
    $('#searchInput').value = ''; $('#priceMin').value = ''; $('#priceTo').value = '';
    $('#inStock').checked = false; $('#sortSelect').value = 'newest';
    renderChips();
    loadProducts(true);
  });
  $('#sortSelect').addEventListener('change', (event) => {
    state.sort = event.target.value;
    loadProducts(true);
  });
  $('#filterToggle').addEventListener('click', () => $('#filtersPanel').classList.toggle('open'));
  $('#loadMore').addEventListener('click', () => { state.page += 1; loadProducts(false); });

  $('#grid').addEventListener('click', async (event) => {
    const open = event.target.closest('[data-open]');
    if (open) { event.preventDefault(); openProduct(open.dataset.open); return; }
    const add = event.target.closest('[data-add]');
    if (add) {
      const product = state.items.find((p) => p.id === add.dataset.add);
      if (!product) return;
      addToCart(product, 1);
      toast(t('add_success'), 'ok');
      openDrawer('cartDrawer');
    }
    const aiOpen = event.target.closest('[data-ai-open]');
    if (aiOpen) { openDrawer('aiDrawer'); renderAi(); }
  });

  $('#pmBody').addEventListener('click', (event) => {
    const open = event.target.closest('[data-open]');
    if (open) { event.preventDefault(); openProduct(open.dataset.open); return; }
    const add = event.target.closest('[data-add]');
    if (add) {
      const btn = add;
      api(`/api/products/${encodeURIComponent(btn.dataset.add)}?lang=${getLang()}`)
        .then(({ product }) => { addToCart(product, 1); toast(t('add_success'), 'ok'); openDrawer('cartDrawer'); })
        .catch(() => toast(t('error_generic'), 'error'));
    }
  });

  $('#cartBtn').addEventListener('click', () => { renderCart(); openDrawer('cartDrawer'); });
  $('#cartItems').addEventListener('click', (event) => {
    const qtyBtn = event.target.closest('[data-qty]');
    if (qtyBtn) {
      const id = qtyBtn.dataset.qty;
      const row = readCart().find((r) => r.productId === id);
      setQty(id, (row?.qty || 1) + Number(qtyBtn.dataset.delta));
      return;
    }
    const removeBtn = event.target.closest('[data-remove]');
    if (removeBtn) setQty(removeBtn.dataset.remove, 0);
  });
  $('#cartFoot').addEventListener('click', (event) => {
    if (event.target.closest('#goCheckout')) openCheckout();
  });

  $('#accountBtn').addEventListener('click', () => { if (state.user) openOrders(); else openAuth('login'); });
  $('#footOrders').addEventListener('click', (event) => { event.preventDefault(); openOrders(); });
  $('#tabLogin').addEventListener('click', () => { state.authMode = 'login'; applyAuthMode(); });
  $('#tabRegister').addEventListener('click', () => { state.authMode = 'register'; applyAuthMode(); });
  $('#authForm').addEventListener('submit', submitAuth);
  $('#checkoutForm').addEventListener('submit', submitCheckout);

  $('#aiBtn').addEventListener('click', () => { openDrawer('aiDrawer'); renderAi(); });
  $('#heroAi').addEventListener('click', () => { openDrawer('aiDrawer'); renderAi(); });
  $('#aiSearchHint').addEventListener('click', () => { openDrawer('aiDrawer'); renderAi(); });
  $('#aiForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $('#aiInput');
    const value = input.value;
    input.value = '';
    askAi(value);
  });
  $('#aiPills').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-ai-sample]');
    if (chip) askAi(chip.dataset.aiSample);
  });
  $('#aiLog').addEventListener('click', (event) => {
    const open = event.target.closest('[data-open]');
    if (open) { closeDrawer('aiDrawer'); openProduct(open.dataset.open); }
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeOverlay(btn.dataset.close));
  });
  document.querySelectorAll('[data-close-drawer]').forEach((btn) => {
    btn.addEventListener('click', () => closeDrawer(btn.dataset.closeDrawer));
  });
}

async function boot() {
  applyDir();
  localize();
  try { state.meta = await meta(); } catch { state.meta = null; }
  bindUi();
  renderChips();
  renderDemoAccounts();
  $('#aiEngine').textContent = state.meta?.ai?.engine || 'local';
  await loadMe();
  await loadProducts(true);
}

boot();

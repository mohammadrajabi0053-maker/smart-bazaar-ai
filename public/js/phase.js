// محیط آزمایشی مستقل هر فاز — فهرست امکانات، گزارش آزمایش‌ها، بررسی زندهٔ خواندنی و یادداشت جداگانه
import { getLang, setLang, applyDir, t, label, fillLangSelect, esc } from './phases-i18n.js';

const $ = (sel, root = document) => root.querySelector(sel);

const id = (() => {
  const parts = location.pathname.split('/').filter(Boolean);
  const fromPath = Number(parts[parts.length - 1]);
  const fromQuery = Number(new URLSearchParams(location.search).get('id'));
  const value = Number.isFinite(fromPath) && fromPath > 0 ? fromPath : fromQuery;
  return [1, 2, 3].includes(value) ? value : 0;
})();

// بررسی زندهٔ فقط‌خواندنی؛ انتظار «redirect» یعنی گارد صفحه فعال است.
const LIVE = {
  1: [
    { path: '/api/meta', expect: 200, label: { fa: 'متادیتای فروشگاه', en: 'Storefront metadata' } },
    { path: '/api/products', expect: 200, label: { fa: 'کاتالوگ محصولات', en: 'Product catalog' } },
    { path: '/api/ads/options', expect: 200, label: { fa: 'گزینه‌های تبلیغات و ارز', en: 'Ads options and currencies' } },
    { path: '/api/seller/products', expect: 401, label: { fa: 'گارد پنل فروشنده برای مهمان', en: 'Seller guard for a guest' } },
  ],
  2: [
    { path: '/api/finance/overview', expect: 401, label: { fa: 'گارد خلاصهٔ مالی', en: 'Finance overview guard' } },
    { path: '/api/finance/entries', expect: 401, label: { fa: 'گارد دفتر تراکنش', en: 'Ledger entries guard' } },
    { path: '/finance', expect: 'redirect', label: { fa: 'صفحهٔ مالی برای مهمان', en: 'Finance page for a guest' } },
  ],
  3: [
    { path: '/api/directory/catalog', expect: 200, label: { fa: 'کاتالوگ صنوف و کشورها', en: 'Industry and country catalog' } },
    { path: '/api/directory/businesses', expect: 401, label: { fa: 'گارد اطلاعات تماس', en: 'Contact-data guard' } },
    { path: '/api/account/summary', expect: 401, label: { fa: 'گارد حساب کاربری', en: 'Account summary guard' } },
    { path: '/business', expect: 'redirect', label: { fa: 'صفحهٔ CRM برای مهمان', en: 'CRM page for a guest' } },
  ],
};

const METRIC_LABELS = {
  products: { fa: 'محصول', en: 'Products' },
  sellers: { fa: 'فروشنده', en: 'Sellers' },
  categories: { fa: 'دسته‌بندی', en: 'Categories' },
  adCountries: { fa: 'کشور تبلیغاتی', en: 'Ad countries' },
  adMedia: { fa: 'رسانهٔ تبلیغاتی', en: 'Ad media' },
  adCampaigns: { fa: 'کمپین', en: 'Campaigns' },
  ledgerEntries: { fa: 'تراکنش دفتر', en: 'Ledger entries' },
  ledgerChained: { fa: 'زنجیرهٔ هش سالم', en: 'Hash chain intact' },
  withdrawalStages: { fa: 'مرحلهٔ تأیید برداشت', en: 'Withdrawal approval steps' },
  ownerOnly: { fa: 'دسترسی انحصاری مدیر اصلی', en: 'Owner-only access' },
  twoFactor: { fa: 'روش احراز دومرحله‌ای', en: 'Two-factor method' },
  exportFormats: { fa: 'قالب خروجی', en: 'Export formats' },
  businesses: { fa: 'کسب‌وکار', en: 'Businesses' },
  demoBusinesses: { fa: 'ردیف نمایشی', en: 'Demo rows' },
  liveBusinesses: { fa: 'ردیف واقعی', en: 'Real rows' },
  leads: { fa: 'متقاضی تبلیغات', en: 'Advertiser leads' },
  activities: { fa: 'پیگیری ارتباط', en: 'Follow-ups' },
  optOuts: { fa: 'لغو رضایت', en: 'Opt-outs' },
  deletionRequests: { fa: 'درخواست حذف', en: 'Deletion requests' },
  businessesByCountry: { fa: 'کسب‌وکار به تفکیک کشور', en: 'Businesses by country' },
};

const NOTES_KEY = `sb_sandbox_notes_p${id}`;
let phase = null;

function applyStatic() {
  document.querySelectorAll('[data-rv]').forEach((el) => {
    el.textContent = t(el.dataset.rv);
  });
  const back = $('#backBtn');
  if (back) back.textContent = `← ${t('back_review')}`;
  if (phase) document.title = `${label(phase.title)} | ${t('brand')}`;
}

function metricValue(value) {
  if (typeof value === 'boolean') return value ? '✓' : '—';
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (value && typeof value === 'object') {
    const rows = Object.entries(value).slice(0, 10).map(([k, v]) => `${k}: ${v}`);
    return rows.join(' · ') || '—';
  }
  return String(value ?? '—');
}

function metricsRows(metrics) {
  const rows = Object.entries(metrics || {});
  if (!rows.length) return `<p class="rv-loading">${esc(t('metrics_empty'))}</p>`;
  return `<div class="rv-live">${rows.map(([key, value]) => {
    const name = METRIC_LABELS[key] ? label(METRIC_LABELS[key]) : key;
    return `<div class="rv-live__row"><span>${esc(name)}</span><span class="rv-live__code">${esc(metricValue(value))}</span></div>`;
  }).join('')}</div>`;
}

function featureRow(feature) {
  const note = feature.note ? `<p class="rv-feat__note">${esc(label(feature.note))}</p>` : '';
  const link = feature.href
    ? `<a class="rv-feat__link" href="${esc(feature.href)}">${esc(t('go_section'))} ↗</a>`
    : '';
  return `<li class="rv-feat">
    <div class="rv-feat__row"><span class="rv-feat__title">${esc(label(feature.title))}</span>
    <span class="rv-pill rv-pill--${esc(feature.status)}">${esc(t(`status_${feature.status}`))}</span></div>
    ${note}${link}
  </li>`;
}

function testsTable(tests) {
  const rows = tests.map((test) => `<tr>
    <td>${esc(label(test.label))}</td>
    <td><span class="rv-pill rv-pill--${esc(test.status === 'passed' ? 'done' : test.status === 'partial' ? 'partial' : 'connect')}">
      ${esc(test.status === 'passed' ? t('pass') : test.status === 'partial' ? t('status_partial') : t('test_block'))}</span></td>
    <td>${esc(label(test.detail))}</td>
  </tr>`).join('');

  return `<table class="rv-table">
    <thead><tr><th>${esc(t('tests_title'))}</th><th>${esc(t('status_done'))}</th><th>${esc(t('actual'))}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function render() {
  applyStatic();
  const counts = phase.counts || { done: 0, partial: 0, connect: 0 };
  const demo = phase.metrics?.demoBusinesses ?? 0;
  const live = phase.metrics?.liveBusinesses ?? 0;

  $('#app').innerHTML = `
  <section class="rv-hero">
    <span class="rv-eyebrow">${esc(t('phase_label'))} ${esc(phase.id)}</span>
    <h1 class="rv-title">${esc(label(phase.title))}</h1>
    <p class="rv-sub">${esc(label(phase.tagline))}</p>
    <div class="rv-mini" style="margin-top:.8rem">
      <span class="rv-pill rv-pill--done">${esc(counts.done)} ${esc(t('status_done'))}</span>
      <span class="rv-pill rv-pill--partial">${esc(counts.partial)} ${esc(t('status_partial'))}</span>
      <span class="rv-pill rv-pill--connect">${esc(counts.connect)} ${esc(t('status_connect'))}</span>
    </div>
  </section>

  <div class="rv-note"><span aria-hidden="true">🔒</span><div><b>${esc(t('data_mode'))}:</b>
    ${esc(demo)} ${esc(t('demo_data'))} · ${esc(live)} ${esc(t('live_data'))} — ${esc(t('demo_banner'))}</div></div>

  <section class="rv-section">
    <h2>🧩 ${esc(t('features_title'))}</h2>
    <ul class="rv-feats">${phase.features.map(featureRow).join('')}</ul>
  </section>

  <section class="rv-section">
    <h2>🧪 ${esc(t('tests_title'))}</h2>
    ${testsTable(phase.tests || [])}
  </section>

  <section class="rv-section">
    <h2>⚡ ${esc(t('sandbox_title'))}</h2>
    <p class="rv-sub" style="margin-top:0">${esc(t('sandbox_sub'))}</p>
    <button class="rv-btn rv-btn--primary rv-btn--sm" id="runBtn" type="button">${esc(t('run_checks'))}</button>
    <div class="rv-live" id="liveOut" aria-live="polite"></div>
  </section>

  <div class="rv-cols">
    <section class="rv-section">
      <h2>📊 ${esc(t('metrics'))}</h2>
      ${metricsRows(phase.metrics)}
    </section>

    <section class="rv-section">
      <h2>🔗 ${esc(t('phase_links'))}</h2>
      <div class="rv-links">
        ${(phase.links || []).map((link) => `<a class="rv-btn rv-btn--ghost rv-btn--sm" href="${esc(link.href)}">${esc(label(link.label))} ↗</a>`).join('')}
      </div>
    </section>
  </div>

  <section class="rv-section">
    <h2>📝 ${esc(t('notes_title'))}</h2>
    <p class="rv-sub" style="margin-top:0">${esc(t('notes_hint'))}</p>
    <textarea class="rv-textarea" id="notes" placeholder="${esc(t('notes_hint'))}"></textarea>
    <div class="rv-links" style="margin-top:.55rem;align-items:center">
      <button class="rv-btn rv-btn--primary rv-btn--sm" id="saveNotes" type="button">${esc(t('save'))}</button>
      <span class="rv-saved" id="savedFlag" hidden>${esc(t('saved'))}</span>
    </div>
  </section>

  <p class="rv-foot">
    <a class="rv-btn rv-btn--ghost rv-btn--sm" href="/review">← ${esc(t('back_review'))}</a>
    <a class="rv-btn rv-btn--ghost rv-btn--sm" href="/">${esc(t('back_store'))}</a>
  </p>
  <p class="rv-foot">${esc(t('no_payment'))}</p>`;

  bindSandbox();
}

function bindSandbox() {
  const notes = $('#notes');
  const savedFlag = $('#savedFlag');
  try {
    notes.value = localStorage.getItem(NOTES_KEY) || '';
  } catch {
    notes.value = '';
  }

  $('#saveNotes').addEventListener('click', () => {
    try {
      localStorage.setItem(NOTES_KEY, notes.value);
      savedFlag.hidden = false;
      setTimeout(() => { savedFlag.hidden = true; }, 1800);
    } catch {
      savedFlag.hidden = true;
    }
  });

  $('#runBtn').addEventListener('click', runChecks);
}

async function runChecks() {
  const button = $('#runBtn');
  const out = $('#liveOut');
  button.disabled = true;
  button.textContent = t('running');
  out.innerHTML = `<p class="rv-loading">${esc(t('running'))}</p>`;

  const results = await Promise.all((LIVE[id] || []).map(async (check) => {
    try {
      const res = await fetch(check.path, {
        headers: { accept: 'application/json, text/html' },
        redirect: 'follow',
        cache: 'no-store',
      });
      const ok = check.expect === 'redirect' ? res.redirected === true : res.status === check.expect;
      return { check, ok, actual: res.status, url: res.url };
    } catch (error) {
      return { check, ok: false, actual: 'ERR', url: error.message };
    }
  }));

  out.innerHTML = results.map((row) => {
    const expected = row.check.expect === 'redirect' ? '302' : String(row.check.expect);
    const actual = row.check.expect === 'redirect'
      ? `${row.actual} → ${esc(new URL(row.url, location.origin).pathname)}`
      : String(row.actual);
    return `<div class="rv-live__row">
      <span>${esc(label(row.check.label))}</span>
      <span class="rv-live__code">${esc(t('expected'))}: ${esc(expected)} · ${esc(t('actual'))}: ${actual}</span>
      <span class="rv-pill rv-pill--${row.ok ? 'done' : 'connect'}">${esc(row.ok ? t('pass') : t('fail'))}</span>
    </div>`;
  }).join('');

  button.disabled = false;
  button.textContent = t('run_checks');
}

async function boot() {
  applyDir();
  fillLangSelect($('#langSelect'));
  applyStatic();

  $('#langSelect').addEventListener('change', (event) => {
    setLang(event.target.value);
    applyDir();
    if (phase) render();
    else applyStatic();
  });

  if (!id) {
    $('#app').innerHTML = `<div class="rv-section"><h2>${esc(t('not_found'))}</h2>
      <p><a class="rv-btn rv-btn--primary rv-btn--sm" href="/review">← ${esc(t('back_review'))}</a></p></div>`;
    return;
  }

  try {
    const res = await fetch(`/api/phases/${id}`, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    phase = await res.json();
    render();
  } catch (error) {
    $('#app').innerHTML = `<div class="rv-error">${esc(t('load_error'))} (${esc(error.message)})</div>`;
  }
}

boot();

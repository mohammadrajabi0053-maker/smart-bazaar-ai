// بازار هوشمند — صفحهٔ گزارش مدیریتی داخلی (توکن‌محور، فقط خواندنی)
import { applyDir, getLang, api, esc } from './core.js';

const DICT = {
  title: ['گزارش مدیریتی داخلی', 'Internal management report', 'تقرير إداري داخلي', 'Dahili yönetim raporu'],
  sub: ['این گزارش با مجوز مدیر اصلی صادر شده است.', 'Issued under the owner grant.', 'صادر بموجب إذن المالك.', 'Sahip izniyle düzenlenmiştir.'],
  recipient: ['دریافت‌کننده', 'Recipient', 'المستلم', 'Alıcı'],
  role: ['نقش', 'Role', 'الدور', 'Rol'],
  trackingId: ['شناسه رهگیری', 'Tracking ID', 'معرّف التتبع', 'Takip kimliği'],
  baseIncome: ['درآمد مبنا', 'Base income', 'الإيراد الأساسي', 'Temel gelir'],
  amount: ['مبلغ قابل نمایش', 'Visible amount', 'المبلغ الظاهر', 'Görünür tutar'],
  basis: ['مبنای محاسبه', 'Basis', 'الأساس', 'Esas'],
  permissions: ['مجوزها', 'Permissions', 'الأذونات', 'İzinler'],
  expires: ['انقضا', 'Expires', 'الانتهاء', 'Bitiş'],
  totals: ['جمع کل', 'Totals', 'الإجماليات', 'Toplamlar'],
  byCountry: ['درآمد کشورها', 'Income by country', 'الإيراد حسب الدولة', 'Ülkeye göre gelir'],
  bySource: ['درآمد منابع', 'Income by source', 'الإيراد حسب المصدر', 'Kaynağa göre gelir'],
  byCurrency: ['درآمد ارزها', 'Income by currency', 'الإيراد حسب العملة', 'Para birimine göre gelir'],
  series: ['روند زمانی', 'Time series', 'السلسلة الزمنية', 'Zaman serisi'],
  wallet: ['موجودی کیف پول', 'Wallet balance', 'رصيد المحفظة', 'Cüzdan bakiyesi'],
  copy: ['کپی گزارش', 'Copy report', 'نسخ التقرير', 'Raporu kopyala'],
  print: ['چاپ', 'Print', 'طباعة', 'Yazdır'],
  csv: ['دریافت CSV/Excel', 'Download CSV/Excel', 'تنزيل CSV/Excel', 'CSV/Excel indir'],
  pdf: ['دریافت PDF', 'Download PDF', 'تنزيل PDF', 'PDF indir'],
  copied: ['کپی شد', 'Copied', 'تم النسخ', 'Kopyalandı'],
  copyDenied: ['اجازهٔ کپی ندارید', 'Copy not permitted', 'النسخ غير مسموح', 'Kopyalama izni yok'],
  printDenied: ['اجازهٔ چاپ ندارید', 'Print not permitted', 'الطباعة غير مسموحة', 'Yazdırma izni yok'],
  downloadDenied: ['اجازهٔ دریافت فایل ندارید', 'Download not permitted', 'التنزيل غير مسموح', 'İndirme izni yok'],
  blocked: ['این لینک منقضی یا لغو شده است.', 'This link is expired or revoked.', 'هذا الرابط منتهٍ أو ملغى.', 'Bu bağlantının süresi dolmuş veya iptal edilmiş.'],
  loading: ['در حال بارگذاری…', 'Loading…', 'جارٍ التحميل…', 'Yükleniyor…'],
  internal: ['گزارش داخلی — سند رسمی نیست', 'Internal report — not an official statement', 'تقرير داخلي — ليس مستندًا رسميًا', 'Dahili rapor — resmî belge değildir'],
};

const LANG_INDEX = { fa: 0, en: 1, ar: 2, tr: 3 };
const tr = (key) => {
  const row = DICT[key];
  return row ? (row[LANG_INDEX[getLang()]] || row[0]) : key;
};
const $ = (sel) => document.querySelector(sel);
const usd = (value) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PERM_LABEL = {
  view: ['مشاهده', 'View', 'عرض', 'Görüntüle'],
  copy: ['کپی', 'Copy', 'نسخ', 'Kopyala'],
  print: ['چاپ', 'Print', 'طباعة', 'Yazdır'],
  pdf: ['PDF', 'PDF', 'PDF', 'PDF'],
  excel: ['Excel', 'Excel', 'Excel', 'Excel'],
};

const token = window.location.pathname.split('/').filter(Boolean).pop();
let payload = null;

function blocked(message) {
  $('#repSub').textContent = message;
  $('#repBody').innerHTML = '';
  $('#repStatus').textContent = '—';
}

function render() {
  const { grant, report } = payload;
  $('#repTitle').textContent = tr('title');
  $('#repSub').textContent = tr('sub');
  $('#repType').textContent = report.type;
  $('#repStatus').textContent = grant.status;

  const rows = [
    [tr('recipient'), report.recipient?.name || grant.recipientName],
    [tr('role'), report.recipient?.role || grant.recipientRole],
    [tr('trackingId'), report.trackingId],
    [tr('basis'), report.basis?.mode === 'percent' ? `${report.basis.percent}%` : usd(report.basis?.fixedUsd)],
    [tr('baseIncome'), usd(report.baseIncomeUsd)],
    [tr('amount'), usd(report.amountUsd)],
    [tr('expires'), String(report.expiresAt).slice(0, 16).replace('T', ' ')],
    [tr('permissions'), Object.entries(grant.permissions || {}).filter(([, v]) => v).map(([k]) => (PERM_LABEL[k] || [k])[LANG_INDEX[getLang()]] || k).join(' · ')],
  ];

  let html = `<div class="fin-box">
    <div class="fin-kv">${rows.map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div>
    <p class="fin-hint">${esc(report.disclaimer?.[getLang()] || report.disclaimer?.fa || '')}</p>
    <div class="fin-actions">
      ${grant.permissions?.copy ? `<button class="fin-btn" id="copyBtn" type="button">${esc(tr('copy'))}</button>` : ''}
      ${grant.permissions?.print ? `<button class="fin-btn" id="printBtn" type="button">${esc(tr('print'))}</button>` : ''}
      ${(grant.permissions?.excel || grant.permissions?.copy) ? `<a class="fin-btn ghost" id="csvBtn" href="/api/finance/grants/${esc(token)}/export?format=csv">${esc(tr('csv'))}</a>` : ''}
      ${grant.permissions?.pdf ? `<button class="fin-btn ghost" id="pdfBtn" type="button">${esc(tr('pdf'))}</button>` : ''}
    </div>
    <p class="fin-hint">${esc(tr('internal'))}</p>
  </div>`;

  if (report.totals) {
    html += `<div class="fin-box"><h3>${esc(tr('totals'))}</h3>
      <div class="fin-cards">
        ${[['income', report.totals.incomeUsd], ['expense', report.totals.expenseUsd], ['net', report.totals.netUsd], ['pending', report.totals.pendingUsd]]
          .map(([k, v]) => `<div class="fin-card"><span class="k">${esc(k)}</span><span class="v">${esc(usd(v))}</span></div>`).join('')}
      </div></div>`;
  }
  if (report.byCountry) {
    html += `<div class="fin-box"><h3>${esc(tr('byCountry'))}</h3><table class="fin-table"><thead><tr>
        <th>${esc(tr('byCountry'))}</th><th>USD</th><th>#</th></tr></thead><tbody>
        ${Object.entries(report.byCountry).map(([code, v]) => `<tr><td>${esc(code)}</td><td class="num">${esc(usd(v.incomeUsd))}</td><td class="num">${esc(v.count)}</td></tr>`).join('')}
      </tbody></table></div>`;
  }
  if (report.bySource) {
    html += `<div class="fin-box"><h3>${esc(tr('bySource'))}</h3><table class="fin-table"><thead><tr>
        <th>${esc(tr('bySource'))}</th><th>USD</th><th>#</th></tr></thead><tbody>
        ${Object.entries(report.bySource).map(([code, v]) => `<tr><td>${esc(code)}</td><td class="num">${esc(usd(v.incomeUsd))}</td><td class="num">${esc(v.count)}</td></tr>`).join('')}
      </tbody></table></div>`;
  }
  if (report.byCurrency) {
    html += `<div class="fin-box"><h3>${esc(tr('byCurrency'))}</h3><table class="fin-table"><thead><tr>
        <th>${esc(tr('byCurrency'))}</th><th>USD</th><th>#</th></tr></thead><tbody>
        ${Object.entries(report.byCurrency).map(([code, v]) => `<tr><td>${esc(code)}</td><td class="num">${esc(usd(v.incomeUsd))}</td><td class="num">${esc(v.count)}</td></tr>`).join('')}
      </tbody></table></div>`;
  }
  if (report.series?.length) {
    html += `<div class="fin-box"><h3>${esc(tr('series'))}</h3><table class="fin-table"><thead><tr>
        <th>${esc(tr('series'))}</th><th>income</th><th>expense</th><th>net</th></tr></thead><tbody>
        ${report.series.map((row) => `<tr><td>${esc(row.key)}</td><td class="num">${esc(usd(row.incomeUsd))}</td><td class="num">${esc(usd(row.expenseUsd))}</td><td class="num">${esc(usd(row.netUsd))}</td></tr>`).join('')}
      </tbody></table></div>`;
  }
  if (report.wallet) {
    html += `<div class="fin-box"><h3>${esc(tr('wallet'))}</h3><div class="fin-cards">
      <div class="fin-card"><span class="k">balance</span><span class="v">${esc(usd(report.wallet.balanceUsd))}</span></div>
      <div class="fin-card"><span class="k">available</span><span class="v">${esc(usd(report.wallet.availableUsd))}</span></div>
      <div class="fin-card"><span class="k">reserved</span><span class="v">${esc(usd(report.wallet.reservedUsd))}</span></div>
    </div></div>`;
  }

  $('#repBody').innerHTML = html;
  wireActions(grant, report);
}

async function logEvent(event) {
  try {
    await api(`/api/finance/grants/${token}/events`, { method: 'POST', body: { event } });
  } catch { /* audit best effort */ }
}

function wireActions(grant, report) {
  const copyBtn = $('#copyBtn');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      const text = [
        `${tr('title')} — ${report.trackingId}`,
        `${tr('recipient')}: ${report.recipient?.name || ''}`,
        `${tr('amount')}: ${usd(report.amountUsd)}`,
        `${tr('expires')}: ${report.expiresAt}`,
      ].join('\n');
      try {
        await navigator.clipboard.writeText(text);
        await logEvent('copy');
        copyBtn.textContent = tr('copied');
      } catch {
        alert(tr('copyDenied'));
      }
    };
  }
  const printBtn = $('#printBtn');
  if (printBtn) printBtn.onclick = async () => { await logEvent('print'); window.print(); };
  const pdfBtn = $('#pdfBtn');
  if (pdfBtn) pdfBtn.onclick = () => window.print();
}

(async function boot() {
  applyDir();
  $('#repTitle').textContent = tr('title');
  $('#repSub').textContent = tr('loading');
  if (!token) { blocked(tr('blocked')); return; }
  try {
    payload = await api(`/api/finance/grants/${token}`);
    render();
  } catch (err) {
    if (err?.status === 404) blocked(tr('blocked'));
    else if (err?.status === 403) blocked(`${tr('blocked')} (${err?.data?.error || ''})`);
    else blocked(tr('blocked'));
  }
})();

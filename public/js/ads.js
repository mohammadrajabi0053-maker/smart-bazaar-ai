/* مرکز تبلیغات هوشمند — رابط کاربری چهارزبانه: کشور، ارز محلی، رسانه، مدت، محل انتشار و پیش‌فاکتور */
import { api, applyDir, esc, getLang, setLang, toast } from './core.js';

const $ = (sel) => document.querySelector(sel);
const LANGS = ['fa', 'en', 'ar', 'tr'];
const LOCALES = { fa: 'fa-IR', en: 'en-US', ar: 'ar-AE', tr: 'tr-TR' };

/* هر کلید: [فارسی, انگلیسی, عربی, ترکی] */
const DICT = {
  brand: ['بازار هوشمند', 'Smart Bazaar', 'السوق الذكي', 'Akıllı Pazar'],
  nav_store: ['فروشگاه', 'Store', 'المتجر', 'Mağaza'],
  nav_seller: ['پنل فروشنده', 'Seller panel', 'لوحة البائع', 'Satıcı paneli'],
  nav_admin: ['پنل مدیریت', 'Admin panel', 'لوحة الإدارة', 'Yönetim paneli'],
  title: ['مرکز تبلیغات هوشمند', 'Smart Ads Center', 'مركز الإعلانات الذكي', 'Akıllı Reklam Merkezi'],
  sub: [
    'کشور، ارز محلی، رسانه و مدت تبلیغ را انتخاب کنید و هزینه را هم به ارز محلی و هم به دلار ببینید.',
    'Pick a country, local currency, media and duration — see the cost in local currency and in USD.',
    'اختر الدولة والعملة المحلية والوسيلة والمدة، وشاهد التكلفة بالعملة المحلية وبالدولار.',
    'Ülke, yerel para birimi, mecra ve süreyi seçin; maliyeti hem yerel para hem dolar olarak görün.',
  ],
  badge_countries: ['۹ کشور', '9 countries', '9 دول', '9 ülke'],
  badge_media: ['۵ رسانه', '5 media', '5 وسائل', '5 mecra'],
  badge_currency: ['۱۰ ارز', '10 currencies', '10 عملات', '10 para birimi'],
  badge_invoice: ['پیش‌فاکتور فوری', 'Instant invoice', 'فاتورة فورية', 'Anında fatura'],
  notice_title: ['حالت پیش‌نمایش', 'Preview mode', 'وضع المعاينة', 'Önizleme modu'],
  notice: [
    'پرداخت آنلاین و انتشار در شبکه‌های اجتماعی در این نسخه غیرفعال است؛ فقط محاسبهٔ هزینه، پیش‌فاکتور و ثبت سفارش انجام می‌شود.',
    'Online payment and social publishing are disabled in this version; only pricing, invoice and order registration run.',
    'الدفع الإلكتروني والنشر على الشبكات معطّلان في هذه النسخة؛ يتم فقط حساب التكلفة والفاتورة وتسجيل الطلب.',
    'Bu sürümde çevrimiçi ödeme ve sosyal medyada yayın kapalıdır; yalnızca fiyat, fatura ve sipariş kaydı yapılır.',
  ],
  form_title: ['تنظیمات کمپین', 'Campaign setup', 'إعدادات الحملة', 'Kampanya ayarları'],
  country: ['کشور', 'Country', 'الدولة', 'Ülke'],
  currency: ['واحد پول', 'Currency', 'العملة', 'Para birimi'],
  media: ['رسانه انتشار', 'Media', 'وسائل النشر', 'Mecralar'],
  media_hint: [
    'حداکثر سه رسانه؛ هر رسانه یک خط جدا در پیش‌فاکتور دارد.',
    'Up to three media; each one is a separate invoice line.',
    'حتى ثلاث وسائل؛ كل وسيلة سطر مستقل في الفاتورة.',
    'En fazla üç mecra; her biri faturada ayrı satırdır.',
  ],
  placement: ['محل انتشار', 'Placement', 'مكان النشر', 'Yayın yeri'],
  creative: ['نوع محتوا', 'Creative type', 'نوع المحتوى', 'İçerik türü'],
  duration: ['مدت تبلیغ', 'Duration', 'مدة الإعلان', 'Süre'],
  start_date: ['تاریخ شروع', 'Start date', 'تاريخ البدء', 'Başlangıç tarihi'],
  ad_title: ['عنوان تبلیغ', 'Ad title', 'عنوان الإعلان', 'Reklam başlığı'],
  ad_title_ph: ['مثلاً: جمعهٔ ویژهٔ هدفون', 'e.g. Headphone Friday', 'مثال: جمعة السماعات', 'Örn: Kulaklık Cuması'],
  ad_desc: ['توضیحات (اختیاری)', 'Description (optional)', 'الوصف (اختياري)', 'Açıklama (isteğe bağlı)'],
  ad_desc_ph: ['محصول، مخاطب و پیام کلیدی', 'Product, audience, key message', 'المنتج والجمهور والرسالة', 'Ürün, hedef kitle, ana mesaj'],
  quote_title: ['پیش‌فاکتور زنده', 'Live quote', 'فاتورة مباشرة', 'Canlı fatura'],
  live: ['زنده', 'live', 'مباشر', 'canlı'],
  get_invoice: ['دریافت پیش‌فاکتور', 'Get invoice', 'استلام الفاتورة', 'Fatura al'],
  submit: ['ثبت سفارش تبلیغ', 'Place ad order', 'تسجيل طلب الإعلان', 'Reklam siparişi ver'],
  mine: ['سفارش‌های تبلیغی من', 'My ad orders', 'طلبات إعلاناتي', 'Reklam siparişlerim'],
  inv_no: ['شماره', 'No.', 'الرقم', 'No'],
  total: ['مبلغ کل', 'Total', 'المجموع', 'Toplam'],
  status: ['وضعیت', 'Status', 'الحالة', 'Durum'],
  none: ['هنوز سفارشی ثبت نکرده‌اید.', 'No orders yet.', 'لا توجد طلبات بعد.', 'Henüz sipariş yok.'],
  invoice: ['پیش‌فاکتور', 'Invoice', 'فاتورة', 'Fatura'],
  print: ['چاپ', 'Print', 'طباعة', 'Yazdır'],
  close: ['بستن', 'Close', 'إغلاق', 'Kapat'],
  login: ['ورود', 'Sign in', 'تسجيل الدخول', 'Giriş'],
  login_hint: ['برای ثبت سفارش تبلیغ با حساب خود وارد شوید.', 'Sign in with your account to place an ad order.', 'سجّل الدخول لحسابك لتسجيل طلب إعلان.', 'Reklam siparişi için hesabınızla giriş yapın.'],
  email: ['ایمیل', 'Email', 'البريد الإلكتروني', 'E-posta'],
  password: ['رمز عبور', 'Password', 'كلمة المرور', 'Parola'],
  logout: ['خروج', 'Sign out', 'خروج', 'Çıkış'],
  days: ['روز', 'days', 'يوم', 'gün'],
  per_day: ['هزینهٔ روزانه', 'Per day', 'التكلفة اليومية', 'Günlük maliyet'],
  subtotal: ['جمع رسانه‌ها', 'Media subtotal', 'مجموع الوسائل', 'Mecra toplamı'],
  creative_cost: ['هزینهٔ محتوا', 'Creative cost', 'تكلفة المحتوى', 'İçerik maliyeti'],
  tax: ['مالیات', 'Tax', 'الضريبة', 'Vergi'],
  usd_total: ['معادل دلاری', 'USD equivalent', 'المعادل بالدولار', 'Dolar karşılığı'],
  rate_line: ['نرخ تبدیل', 'Exchange rate', 'سعر التحويل', 'Döviz kuru'],
  rate_default: ['نرخ نمونه (قابل تنظیم توسط مدیر)', 'Sample rate (admin editable)', 'سعر نموذجي (قابل للتعديل)', 'Örnek kur (yönetici düzenler)'],
  rate_admin: ['نرخ تنظیم‌شده توسط مدیر', 'Admin-set rate', 'سعر معتمد من الإدارة', 'Yönetici kuru'],
  err: ['انجام عملیات ممکن نشد.', 'Operation failed.', 'تعذّر تنفيذ العملية.', 'İşlem başarısız.'],
  err_media: ['حداقل یک رسانه انتخاب کنید.', 'Select at least one medium.', 'اختر وسيلة واحدة على الأقل.', 'En az bir mecra seçin.'],
  err_title: ['عنوان تبلیغ حداقل ۳ نویسه باشد.', 'Title needs at least 3 characters.', 'العنوان 3 أحرف على الأقل.', 'Başlık en az 3 karakter olmalı.'],
  err_duration: ['مدت انتخابی برای این رسانه کوتاه است.', 'Duration is too short for this medium.', 'المدة قصيرة لهذه الوسيلة.', 'Bu mecra için süre kısa.'],
  err_media_many: ['حداکثر سه رسانه قابل انتخاب است.', 'At most three media.', 'ثلاث وسائل كحد أقصى.', 'En fazla üç mecra.'],
  ok_submitted: ['سفارش تبلیغ ثبت شد و پیش‌فاکتور صادر گردید.', 'Ad order registered and invoice issued.', 'تم تسجيل الطلب وإصدار الفاتورة.', 'Sipariş kaydedildi, fatura oluşturuldu.'],
  preview_note: [
    'این پیش‌فاکتور پیش‌نمایش است؛ پرداخت و انتشار فعال نیست.',
    'This is a preview invoice; payment and publishing are disabled.',
    'هذه فاتورة معاينة؛ الدفع والنشر معطّلان.',
    'Bu bir önizleme faturasıdır; ödeme ve yayın kapalıdır.',
  ],
  vat: ['مالیات بر ارزش افزوده', 'VAT', 'ضريبة القيمة المضافة', 'KDV'],
  issued: ['تاریخ صدور', 'Issued', 'تاريخ الإصدار', 'Düzenleme'],
  due: ['مهلت پرداخت', 'Due', 'الاستحقاق', 'Vade'],
  bill_to: ['صاحب سفارش', 'Billed to', 'الفاتورة إلى', 'Fatura sahibi'],
  item: ['شرح', 'Description', 'الوصف', 'Açıklama'],
  amount: ['مبلغ', 'Amount', 'المبلغ', 'Tutar'],
  payment_off: ['پرداخت: غیرفعال (فاز بعد)', 'Payment: disabled (next phase)', 'الدفع: معطّل (مرحلة لاحقة)', 'Ödeme: kapalı (sonraki faz)'],
  publishing_off: ['انتشار: غیرفعال (فاز بعد)', 'Publishing: disabled (next phase)', 'النشر: معطّل (مرحلة لاحقة)', 'Yayın: kapalı (sonraki faz)'],
  discount: ['تخفیف مدت', 'Duration discount', 'خصم المدة', 'Süre indirimi'],
  status_draft: ['پیش‌نویس', 'Draft', 'مسودة', 'Taslak'],
  status_awaiting_payment: ['در انتظار پرداخت', 'Awaiting payment', 'بانتظار الدفع', 'Ödeme bekliyor'],
  status_in_review: ['در بازبینی', 'In review', 'قيد المراجعة', 'İncelemede'],
  status_scheduled: ['زمان‌بندی‌شده', 'Scheduled', 'مجدول', 'Planlandı'],
  status_active: ['فعال', 'Active', 'نشط', 'Aktif'],
  status_completed: ['پایان‌یافته', 'Completed', 'منتهي', 'Tamamlandı'],
  status_canceled: ['لغو‌شده', 'Canceled', 'ملغى', 'İptal'],
  status_rejected: ['رد‌شده', 'Rejected', 'مرفوض', 'Reddedildi'],
};

const state = {
  lang: 'fa',
  options: null,
  quote: null,
  campaigns: [],
  user: null,
  invoice: null,
  seq: 0,
  timer: null,
  form: { country: 'IR', currency: '', media: ['instagram'], placement: 'home_top', creative: 'banner', durationDays: 7 },
};

/* ------------------------------- کمک‌کننده‌ها ------------------------------- */

function t(key) {
  const row = DICT[key];
  if (!row) return key;
  const i = LANGS.indexOf(state.lang);
  return row[i] || row[0];
}

const pick = (obj) => (obj ? obj[state.lang] || obj.en || obj.fa || '' : '');
const usd = (n) => `$${(Number(n) || 0).toFixed(2)}`;

function fmtLocal(amount, code, meta) {
  const m = meta || { decimals: 2, symbol: code };
  const value = Number(amount) || 0;
  const locale = LOCALES[state.lang] || LOCALES.fa;
  let num;
  try {
    num = new Intl.NumberFormat(locale, {
      minimumFractionDigits: Math.min(m.decimals, 2),
      maximumFractionDigits: m.decimals,
    }).format(value);
  } catch {
    num = value.toFixed(m.decimals);
  }
  return `${num} ${m.symbol}`;
}

const errCode = (err) => err?.data?.error || err?.body?.error || err?.code || '';
const MESSAGES = {
  media_required: 'err_media',
  media_too_many: 'err_media_many',
  duration_too_short: 'err_duration',
  duration_invalid: 'err_duration',
};

function messageFor(err) {
  const key = MESSAGES[errCode(err)];
  return key ? t(key) : t('err');
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = false;
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
}

/* --------------------------------- زبان --------------------------------- */

function localizeStatic() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = ['fa', 'ar'].includes(state.lang) ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-ad]').forEach((el) => {
    el.textContent = t(el.dataset.ad);
  });
  document.querySelectorAll('[data-ad-ph]').forEach((el) => {
    el.placeholder = t(el.dataset.adPh);
  });
}

/* --------------------------------- بارگذاری --------------------------------- */

async function loadOptions() {
  state.options = await api('/api/ads/options');
  const countries = state.options.countries || [];
  if (!countries.some((c) => c.code === state.form.country)) {
    state.form.country = countries[0]?.code || 'IR';
  }
  state.form.currency = state.form.currency || countryCurrency();
}

function countryCurrency() {
  const c = state.options?.countries.find((x) => x.code === state.form.country);
  return c?.currency || 'USD';
}

function mediaByCode(code) {
  return state.options?.media.find((m) => m.code === code);
}

function minDays() {
  const list = state.form.media.map(mediaByCode).filter(Boolean);
  return list.length ? Math.max(...list.map((m) => m.minDays || 1)) : 1;
}

/* --------------------------------- فرم --------------------------------- */

function renderForm() {
  if (!state.options) return;

  const countrySel = $('#country');
  countrySel.innerHTML = state.options.countries
    .map((c) => `<option value="${c.code}">${c.flag} ${esc(pick(c.name))} — ${esc(c.currency)}</option>`)
    .join('');
  countrySel.value = state.form.country;

  const currencies = state.options.rates?.currencies || [];
  const curSel = $('#currency');
  curSel.innerHTML = currencies
    .map((c) => `<option value="${c.code}">${esc(pick(c.label))} (${c.code})</option>`)
    .join('');
  curSel.value = state.form.currency;

  const curMeta = currencies.find((c) => c.code === state.form.currency);
  const rateSource = state.options.rates?.source === 'admin_override' ? t('rate_admin') : t('rate_default');
  $('#currencyHint').textContent = curMeta
    ? `1 USD = ${new Intl.NumberFormat(LOCALES[state.lang] || 'fa-IR', { maximumFractionDigits: 4 }).format(curMeta.rate)} ${state.form.currency} · ${rateSource}`
    : '';

  const mediaList = $('#mediaList');
  mediaList.innerHTML = state.options.media
    .map((m) => {
      const on = state.form.media.includes(m.code);
      return `<label class="ads-chip${on ? ' on' : ''}">
        <input type="checkbox" value="${m.code}" ${on ? 'checked' : ''}>
        <span>${m.icon} ${esc(pick(m.name))}</span>
        <small>${usd(m.baseDailyUsd)} / ${t('days')}</small>
      </label>`;
    })
    .join('');

  $('#placement').innerHTML = state.options.placements
    .map((p) => `<option value="${p.code}">${p.icon} ${esc(pick(p.name))} ×${p.multiplier.toFixed(2)}</option>`)
    .join('');
  $('#placement').value = state.form.placement;

  $('#creative').innerHTML = state.options.creatives
    .map((c) => {
      const extra = c.addonUsd ? ` +${usd(c.addonUsd)}` : '';
      return `<option value="${c.code}">${c.icon} ${esc(pick(c.name))}${extra}</option>`;
    })
    .join('');
  $('#creative').value = state.form.creative;

  renderDurations();

  const startInput = $('#startDate');
  const today = new Date().toISOString().slice(0, 10);
  if (!startInput.value) startInput.value = today;
  startInput.min = today;
}

function renderDurations() {
  if (!state.options) return;
  const min = minDays();
  const durations = state.options.durations || [];
  if (!durations.some((d) => d.days === state.form.durationDays && d.days >= min)) {
    const firstValid = durations.find((d) => d.days >= min) || durations[durations.length - 1];
    state.form.durationDays = firstValid ? firstValid.days : 3;
  }
  $('#duration').innerHTML = durations
    .map((d) => {
      const off = d.days < min ? ' disabled' : '';
      const disc = d.discount < 1 ? ` (−${Math.round((1 - d.discount) * 100)}%)` : '';
      return `<option value="${d.days}"${off}>${d.days} ${t('days')}${disc}</option>`;
    })
    .join('');
  $('#duration').value = String(state.form.durationDays);
}

/* --------------------------------- محاسبه --------------------------------- */

function collectInput() {
  return {
    country: state.form.country,
    currency: state.form.currency,
    media: [...state.form.media],
    placement: state.form.placement,
    creative: state.form.creative,
    durationDays: Number(state.form.durationDays),
  };
}

function scheduleQuote() {
  clearTimeout(state.timer);
  state.timer = setTimeout(refreshQuote, 180);
}

async function refreshQuote() {
  const input = collectInput();
  if (!input.media.length) {
    state.quote = null;
    $('#quoteBody').innerHTML = `<p class="hint">${esc(t('err_media'))}</p>`;
    $('#formHint').textContent = t('err_media');
    return;
  }
  const seq = ++state.seq;
  try {
    const { quote } = await api('/api/ads/quote', { method: 'POST', body: input });
    if (seq !== state.seq) return;
    state.quote = quote;
    $('#formHint').textContent = '';
    renderQuote();
  } catch (err) {
    if (seq !== state.seq) return;
    state.quote = null;
    $('#formHint').textContent = messageFor(err);
  }
}

function renderQuote() {
  const q = state.quote;
  if (!q) return;
  const cur = q.currency;
  const meta = q.currencyMeta;
  const rateSource = q.rateBase && state.options?.rates?.source === 'admin_override' ? t('rate_admin') : t('rate_default');

  const lines = q.lines
    .map(
      (line) => `<div class="q-line">
        <div class="q-name">
          <strong>${line.icon} ${esc(pick(line.name))}</strong>
          <small>${line.days} ${t('days')} × ${usd(line.dailyUsd)}${line.discount < 1 ? ` · ${t('discount')} ${Math.round((1 - line.discount) * 100)}%` : ''}</small>
        </div>
        <div class="q-amt">
          <strong>${esc(fmtLocal(line.subtotalLocal, cur, meta))}</strong>
          <small>${usd(line.subtotalUsd)}</small>
        </div>
      </div>`,
    )
    .join('');

  const rows = [
    [t('subtotal'), fmtLocal(q.subtotalLocal, cur, meta), usd(q.subtotalUsd)],
    [`${t('creative_cost')} · ${pick(q.creative.name)}`, fmtLocal(q.creativeLocal, cur, meta), usd(q.creativeUsd)],
    [`${t('tax')} ${Math.round((q.taxRate || 0) * 100)}%`, fmtLocal(q.taxLocal, cur, meta), usd(q.taxUsd)],
  ]
    .map(
      ([label, local, dollar]) => `<div class="q-row"><span>${esc(label)}</span>
        <span>${esc(local)}<small>${dollar}</small></span></div>`,
    )
    .join('');

  $('#quoteBody').innerHTML = `
    <div class="q-context">
      <span>${q.country.flag} ${esc(pick(q.country.name))}</span>
      <span>${q.placement.icon} ${esc(pick(q.placement.name))}</span>
      <span>${q.durationDays} ${t('days')}</span>
    </div>
    ${lines}
    <div class="q-rows">${rows}</div>
    <div class="q-total">
      <div>
        <span>${esc(t('total'))}</span>
        <strong>${esc(fmtLocal(q.totalLocal, cur, meta))}</strong>
      </div>
      <div class="q-usd">
        <span>${esc(t('usd_total'))}</span>
        <strong>${usd(q.totalUsd)}</strong>
      </div>
    </div>
    <div class="q-foot">
      <span>${esc(t('per_day'))}: ${esc(fmtLocal(q.perDayLocal, cur, meta))} · ${usd(q.perDayUsd)}</span>
      <span>${esc(t('rate_line'))}: 1 USD = ${new Intl.NumberFormat(LOCALES[state.lang] || 'fa-IR', { maximumFractionDigits: 4 }).format(q.rate)} ${cur} (${esc(rateSource)})</span>
    </div>`;
  $('#quoteHint').textContent = t('preview_note');
}

/* -------------------------------- پیش‌فاکتور -------------------------------- */

function draftInvoice(q) {
  const now = new Date();
  return {
    invoiceNo: '—',
    issuedAt: now.toISOString(),
    dueAt: new Date(now.getTime() + 7 * 864e5).toISOString(),
    kind: 'advertising_preinvoice',
    status: 'draft',
    draft: true,
    billTo: { name: state.user?.name || '—', email: state.user?.email || '—' },
    campaign: {
      title: $('#adTitle').value.trim() || t('ad_title'),
      country: q.country.code,
      countryName: q.country.name,
      media: q.lines.map((l) => l.media),
      durationDays: q.durationDays,
      startDate: $('#startDate').value || '',
    },
    items: q.lines.map((l) => ({
      description: `${pick(l.name)} — ${l.days} ${t('days')}`,
      days: l.days,
      amountUsd: l.subtotalUsd,
      amountLocal: l.subtotalLocal,
    })),
    creativeAddon: { amountUsd: q.creativeUsd, amountLocal: q.creativeLocal, code: q.creative.code, name: q.creative.name },
    subtotalUsd: q.subtotalUsd,
    subtotalLocal: q.subtotalLocal,
    taxRate: q.taxRate,
    taxUsd: q.taxUsd,
    taxLocal: q.taxLocal,
    totalUsd: q.totalUsd,
    totalLocal: q.totalLocal,
    currency: q.currency,
    currencyMeta: q.currencyMeta,
    rate: q.rate,
    rateBase: q.rateBase,
    rateSource: q.rateBase,
    payment: { enabled: false },
    publishing: { enabled: false },
  };
}

function renderInvoice(inv) {
  const meta = inv.currencyMeta;
  const cur = inv.currency;
  const when = (iso) => {
    try {
      return new Date(iso).toLocaleDateString(LOCALES[state.lang] || 'fa-IR');
    } catch {
      return iso;
    }
  };
  const items = (inv.items || [])
    .map(
      (it) => `<tr>
        <td>${esc(it.description)}</td>
        <td>${esc(fmtLocal(it.amountLocal, cur, meta))}<small>${usd(it.amountUsd)}</small></td>
      </tr>`,
    )
    .join('');
  const creative = inv.creativeAddon?.amountUsd
    ? `<tr>
        <td>${esc(t('creative_cost'))}${inv.creativeAddon.name ? ` — ${esc(pick(inv.creativeAddon.name))}` : ''}</td>
        <td>${esc(fmtLocal(inv.creativeAddon.amountLocal, cur, meta))}<small>${usd(inv.creativeAddon.amountUsd)}</small></td>
      </tr>`
    : '';

  return `<div class="invoice-paper">
    <div class="paper-head">
      <div>
        <strong>${esc(t('brand'))}</strong>
        <div class="hint">${esc(t('title'))}</div>
      </div>
      <div class="paper-no">
        <span>${esc(t('invoice'))}</span>
        <strong>${esc(inv.invoiceNo)}</strong>
      </div>
    </div>
    <div class="paper-grid">
      <div>
        <span class="hint">${esc(t('bill_to'))}</span>
        <strong>${esc(inv.billTo?.name || '—')}</strong>
        <div class="hint">${esc(inv.billTo?.email || '—')}</div>
      </div>
      <div>
        <span class="hint">${esc(t('issued'))}</span>
        <div>${esc(when(inv.issuedAt))}</div>
        <span class="hint">${esc(t('due'))}</span>
        <div>${esc(when(inv.dueAt))}</div>
      </div>
      <div>
        <span class="hint">${esc(t('country'))}</span>
        <div>${esc(pick(inv.campaign?.countryName) || inv.campaign?.country || '—')}</div>
        <span class="hint">${esc(t('duration'))}</span>
        <div>${inv.campaign?.durationDays || 0} ${esc(t('days'))}</div>
      </div>
    </div>
    <table class="paper-table">
      <thead><tr><th>${esc(t('item'))}</th><th>${esc(t('amount'))}</th></tr></thead>
      <tbody>${items}${creative}</tbody>
    </table>
    <div class="paper-totals">
      <div><span>${esc(t('subtotal'))}</span><span>${esc(fmtLocal(inv.subtotalLocal, cur, meta))}</span></div>
      <div><span>${esc(t('tax'))} ${Math.round((inv.taxRate || 0) * 100)}%</span><span>${esc(fmtLocal(inv.taxLocal, cur, meta))}</span></div>
      <div class="grand"><span>${esc(t('total'))}</span><span>${esc(fmtLocal(inv.totalLocal, cur, meta))}</span></div>
      <div class="usd"><span>${esc(t('usd_total'))}</span><span>${usd(inv.totalUsd)}</span></div>
      <div class="rate"><span>${esc(t('rate_line'))}</span><span>1 USD = ${new Intl.NumberFormat(LOCALES[state.lang] || 'fa-IR', { maximumFractionDigits: 4 }).format(inv.rate)} ${cur}</span></div>
    </div>
    <p class="paper-note">${esc(t('payment_off'))} · ${esc(t('publishing_off'))} — ${esc(t('preview_note'))}</p>
  </div>`;
}

function openInvoice(inv) {
  if (!inv) return;
  state.invoice = inv;
  $('#invBody').innerHTML = renderInvoice(inv);
  openModal('invoiceModal');
}

/* -------------------------------- سفارش‌ها -------------------------------- */

function renderHeader() {
  const label = $('#authLabel');
  const btn = $('#authBtn');
  if (state.user) {
    label.textContent = `${state.user.name || state.user.email || ''} — ${t('logout')}`;
    btn.onclick = logout;
  } else {
    label.textContent = t('login');
    btn.onclick = () => openModal('loginModal');
  }
}

async function loadSession() {
  try {
    const res = await api('/api/auth/me');
    state.user = res.user || null;
  } catch {
    state.user = null;
  }
  renderHeader();
  if (state.user) await loadCampaigns();
  else $('#mineSection').hidden = true;
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    /* خروج محلی در هر حال انجام می‌شود */
  }
  state.user = null;
  state.campaigns = [];
  renderHeader();
  renderCampaigns();
  toast(t('logout'));
}

async function login() {
  const email = $('#lgEmail').value.trim();
  const password = $('#lgPass').value;
  $('#loginHint').textContent = '';
  try {
    const res = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    state.user = res.user || null;
    $('#lgPass').value = '';
    closeModal('loginModal');
    renderHeader();
    await loadCampaigns();
  } catch (err) {
    $('#loginHint').textContent = messageFor(err);
  }
}

async function loadCampaigns() {
  if (!state.user) return;
  try {
    const res = await api('/api/ads/campaigns');
    state.campaigns = res.campaigns || [];
  } catch {
    state.campaigns = [];
  }
  renderCampaigns();
}

function statusChip(status) {
  const key = `status_${status}`;
  const label = DICT[key] ? t(key) : status;
  return `<span class="ad-status s-${esc(status)}">${esc(label)}</span>`;
}

function renderCampaigns() {
  const section = $('#mineSection');
  if (!state.user) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const rows = $('#campaignRows');
  const empty = $('#mineEmpty');
  if (!state.campaigns.length) {
    rows.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  rows.innerHTML = state.campaigns
    .map((c) => {
      const meta = c.currencyMeta;
      return `<tr>
        <td class="mono">${esc(c.invoiceNo)}</td>
        <td>${esc(c.title)}</td>
        <td>${esc(pick(c.countryName) || c.country)}</td>
        <td>${c.durationDays} ${esc(t('days'))}</td>
        <td>${esc(fmtLocal(c.totalLocal, c.currency, meta))}<small>${usd(c.totalUsd)}</small></td>
        <td>${statusChip(c.status)}</td>
        <td><button class="btn secondary small" type="button" data-campaign="${esc(c.id)}">${esc(t('invoice'))}</button></td>
      </tr>`;
    })
    .join('');
}

async function showCampaignInvoice(id) {
  try {
    const res = await api(`/api/ads/campaigns/${id}`);
    openInvoice(res.invoice);
  } catch (err) {
    toast(messageFor(err));
  }
}

/* --------------------------------- ثبت سفارش --------------------------------- */

async function submit() {
  if (!state.user) {
    openModal('loginModal');
    return;
  }
  const input = collectInput();
  if (!input.media.length) {
    toast(t('err_media'));
    return;
  }
  const title = $('#adTitle').value.trim();
  if (title.length < 3) {
    toast(t('err_title'));
    $('#adTitle').focus();
    return;
  }
  const body = {
    ...input,
    title,
    description: $('#adDesc').value.trim(),
    startDate: $('#startDate').value,
  };
  try {
    const res = await api('/api/ads/campaigns', { method: 'POST', body });
    toast(t('ok_submitted'));
    await loadCampaigns();
    openInvoice(res.invoice);
  } catch (err) {
    toast(messageFor(err));
  }
}

/* --------------------------------- رویدادها --------------------------------- */

function bindEvents() {
  $('#country').addEventListener('change', (e) => {
    state.form.country = e.target.value;
    state.form.currency = countryCurrency();
    renderForm();
    scheduleQuote();
  });

  $('#currency').addEventListener('change', (e) => {
    state.form.currency = e.target.value;
    renderForm();
    scheduleQuote();
  });

  $('#mediaList').addEventListener('change', (e) => {
    const input = e.target.closest('input[type="checkbox"]');
    if (!input) return;
    const code = input.value;
    if (input.checked) {
      if (state.form.media.length >= 3) {
        input.checked = false;
        toast(t('err_media_many'));
        return;
      }
      state.form.media.push(code);
    } else {
      state.form.media = state.form.media.filter((m) => m !== code);
    }
    renderForm();
    scheduleQuote();
  });

  $('#placement').addEventListener('change', (e) => {
    state.form.placement = e.target.value;
    scheduleQuote();
  });

  $('#creative').addEventListener('change', (e) => {
    state.form.creative = e.target.value;
    scheduleQuote();
  });

  $('#duration').addEventListener('change', (e) => {
    state.form.durationDays = Number(e.target.value);
    scheduleQuote();
  });

  $('#startDate').addEventListener('change', () => {
    if (state.quote) renderQuote();
  });

  $('#invoiceBtn').addEventListener('click', () => {
    if (!state.quote) {
      toast(t('err_media'));
      return;
    }
    openInvoice(draftInvoice(state.quote));
  });

  $('#submitBtn').addEventListener('click', submit);
  $('#printBtn').addEventListener('click', () => window.print());
  $('#loginBtn').addEventListener('click', login);

  $('#campaignRows').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-campaign]');
    if (btn) showCampaignInvoice(btn.dataset.campaign);
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  ['invoiceModal', 'loginModal'].forEach((id) => {
    const overlay = document.getElementById(id);
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(id);
    });
  });

  $('#langSelect').addEventListener('change', (e) => setLang(e.target.value));

  window.addEventListener('langchange', () => {
    state.lang = LANGS.includes(getLang()) ? getLang() : 'fa';
    $('#langSelect').value = state.lang;
    localizeStatic();
    renderForm();
    if (state.quote) renderQuote();
    renderHeader();
    renderCampaigns();
  });
}

/* --------------------------------- شروع --------------------------------- */

async function boot() {
  state.lang = LANGS.includes(getLang()) ? getLang() : 'fa';
  $('#langSelect').value = state.lang;
  applyDir();
  localizeStatic();
  bindEvents();

  try {
    await loadOptions();
  } catch {
    toast(t('err'));
    return;
  }
  renderForm();
  renderHeader();
  await refreshQuote();
  await loadSession();
}

boot();

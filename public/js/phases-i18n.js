// ترجمهٔ چهارزبانهٔ مرکز بررسی سه فاز (فارسی، انگلیسی، عربی، ترکی)
export const LANGS = ['fa', 'en', 'ar', 'tr'];
export const RTL = ['fa', 'ar'];
export const LANG_NAMES = { fa: 'فارسی', en: 'English', ar: 'العربية', tr: 'Türkçe' };

const KEY = 'sb_lang';

const DICT = {
  brand: ['مرکز بررسی سه فاز', 'Three-phase review center', 'مركز مراجعة المراحل', 'Üç aşama inceleme merkezi'],
  store_link: ['فروشگاه', 'Storefront', 'المتجر', 'Mağaza'],
  hero_eyebrow: ['پیش‌نمایش سه فاز', 'Three-phase preview', 'معاينة المراحل الثلاث', 'Üç aşama önizlemesi'],
  hero_title: [
    'مرکز بررسی و مدیریت سه فاز بازار هوشمند',
    'Smart Bazaar three-phase review and management center',
    'مركز مراجعة وإدارة المراحل الثلاث لسوق الذكي',
    'Smart Bazaar üç aşama inceleme ve yönetim merkezi',
  ],
  hero_sub: [
    'هر فاز را جداگانه باز کنید، امکاناتش را ببینید و در محیط آزمایشی مستقل خودش آزمایش کنید.',
    'Open each phase separately, review its features, and test it in its own sandbox.',
    'افتح كل مرحلة على حدة، واستعرض ميزاتها، واختبرها في بيئتها التجريبية الخاصة.',
    'Her aşamayı ayrı açın, özelliklerini görün ve kendi test ortamında deneyin.',
  ],
  stat_phases: ['فاز', 'Phases', 'مراحل', 'Aşama'],
  stat_features: ['امکان ثبت‌شده', 'Recorded features', 'ميزة مسجلة', 'Kayıtlı özellik'],
  stat_done: ['تکمیل‌شده', 'Completed', 'مكتمل', 'Tamamlandı'],
  stat_partial: ['ناقص', 'Partial', 'ناقص', 'Kısmi'],
  stat_connect: ['نیازمند اتصال', 'Needs connection', 'يحتاج اتصالاً', 'Bağlantı gerekli'],
  phase_label: ['فاز', 'Phase', 'المرحلة', 'Aşama'],
  view_phase: ['مشاهده فاز', 'View phase', 'عرض المرحلة', 'Aşamayı gör'],
  back_review: ['بازگشت به مرکز بررسی', 'Back to review center', 'العودة إلى مركز المراجعة', 'İnceleme merkezine dön'],
  back_store: ['بازگشت به فروشگاه', 'Back to storefront', 'العودة إلى المتجر', 'Mağazaya dön'],
  features_title: ['فهرست امکانات', 'Feature list', 'قائمة الميزات', 'Özellik listesi'],
  tests_title: ['گزارش آزمایش‌ها', 'Test report', 'تقرير الاختبارات', 'Test raporu'],
  go_section: ['رفتن به بخش', 'Open section', 'فتح القسم', 'Bölüme git'],
  status_done: ['تکمیل‌شده', 'Completed', 'مكتمل', 'Tamamlandı'],
  status_partial: ['ناقص', 'Partial', 'ناقص', 'Kısmi'],
  status_connect: ['نیازمند اتصال', 'Needs connection', 'يحتاج اتصالاً', 'Bağlantı gerekli'],
  demo_banner: [
    'اطلاعات آزمایشی از اطلاعات واقعی جدا است؛ ردیف‌های نمایشی با برچسب demo ذخیره می‌شوند و در گزارش‌ها با دادهٔ واقعی ترکیب نمی‌شوند.',
    'Test data is kept separate from real data: demo rows carry a demo tag and are never mixed into real reports.',
    'بيانات الاختبار منفصلة عن البيانات الحقيقية: صفوف العرض تحمل وسم demo ولا تُدمج في التقارير الحقيقية.',
    'Test verileri gerçek verilerden ayrıdır: demo satırları demo etiketi taşır ve gerçek raporlara karışmaz.',
  ],
  data_mode: ['وضعیت داده‌ها', 'Data mode', 'حالة البيانات', 'Veri modu'],
  demo_data: ['نمایشی', 'Demo', 'عرض', 'Demo'],
  live_data: ['واقعی', 'Real', 'حقيقي', 'Gerçek'],
  sandbox_title: ['محیط آزمایشی مستقل این فاز', 'Independent sandbox for this phase', 'بيئة اختبار مستقلة لهذه المرحلة', 'Bu aşama için bağımsız test ortamı'],
  sandbox_sub: [
    'بررسی زنده فقط خواندنی است و روی همین نسخهٔ پیش‌نمایش اجرا می‌شود؛ هیچ داده‌ای تغییر نمی‌کند.',
    'The live check is read-only and runs against this preview; it changes no data.',
    'الفحص المباشر للقراءة فقط ويعمل على هذه المعاينة دون تغيير أي بيانات.',
    'Canlı kontrol salt okunurdur ve bu önizleme üzerinde çalışır; hiçbir veriyi değiştirmez.',
  ],
  run_checks: ['اجرای بررسی زنده', 'Run live check', 'تشغيل الفحص المباشر', 'Canlı kontrolü çalıştır'],
  running: ['در حال اجرا…', 'Running…', 'جارٍ التنفيذ…', 'Çalışıyor…'],
  expected: ['انتظار', 'Expected', 'المتوقع', 'Beklenen'],
  actual: ['نتیجه', 'Actual', 'النتيجة', 'Sonuç'],
  pass: ['موفق', 'Pass', 'ناجح', 'Başarılı'],
  fail: ['ناموفق', 'Fail', 'فاشل', 'Başarısız'],
  notes_title: ['یادداشت آزمایشی این فاز', 'Sandbox notes for this phase', 'ملاحظات اختبار هذه المرحلة', 'Bu aşamanın test notları'],
  notes_hint: [
    'یادداشت‌ها فقط در همین مرورگر و به‌صورت جدا از دادهٔ برنامه ذخیره می‌شوند.',
    'Notes are stored only in this browser, separately from application data.',
    'تُحفظ الملاحظات في هذا المتصفح فقط وبمعزل عن بيانات التطبيق.',
    'Notlar yalnızca bu tarayıcıda, uygulama verilerinden ayrı saklanır.',
  ],
  save: ['ذخیره', 'Save', 'حفظ', 'Kaydet'],
  saved: ['ذخیره شد', 'Saved', 'تم الحفظ', 'Kaydedildi'],
  phase_links: ['ورود به بخش‌های این فاز', 'Open this phase’s sections', 'فتح أقسام هذه المرحلة', 'Bu aşamanın bölümleri'],
  metrics: ['آمار زنده', 'Live metrics', 'إحصاءات مباشرة', 'Canlı metrikler'],
  not_found: ['این فاز یافت نشد', 'Phase not found', 'المرحلة غير موجودة', 'Aşama bulunamadı'],
  loading: ['در حال بارگذاری…', 'Loading…', 'جارٍ التحميل…', 'Yükleniyor…'],
  load_error: ['دریافت اطلاعات فاز ناموفق بود', 'Could not load phase data', 'تعذر تحميل بيانات المرحلة', 'Aşama verisi yüklenemedi'],
  test_ok: ['آزمایش موفق', 'Passed checks', 'اختبارات ناجحة', 'Başarılı test'],
  test_warn: ['آزمایش ناقص', 'Partial checks', 'اختبارات ناقصة', 'Kısmi test'],
  test_block: ['نیازمند اتصال', 'Needs connection', 'يحتاج اتصالاً', 'Bağlantı gerekli'],
  redirect_ok: ['هدایت محافظتی فعال است', 'Protective redirect is active', 'إعادة التوجيه الحمائية مفعّلة', 'Koruyucu yönlendirme etkin'],
  lang_label: ['زبان', 'Language', 'اللغة', 'Dil'],
  no_payment: [
    'پرداخت واقعی، برداشت بانکی و انتشار انبوه در این نسخه غیرفعال است.',
    'Real payments, bank payouts and bulk publishing are disabled in this release.',
    'المدفوعات الحقيقية والتحويلات البنكية والنشر الجماعي معطّلة في هذا الإصدار.',
    'Gerçek ödeme, banka transferi ve toplu yayın bu sürümde devre dışıdır.',
  ],
  metrics_empty: ['داده‌ای برای نمایش نیست', 'No data to show', 'لا توجد بيانات للعرض', 'Gösterilecek veri yok'],
};

export function getLang() {
  try {
    const value = localStorage.getItem(KEY);
    return LANGS.includes(value) ? value : 'fa';
  } catch {
    return 'fa';
  }
}

export function setLang(value) {
  if (!LANGS.includes(value)) return;
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* حافظهٔ محلی در دسترس نیست */
  }
}

export function applyDir() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL.includes(lang) ? 'rtl' : 'ltr';
}

export function t(key) {
  const row = DICT[key];
  if (!row) return key;
  return row[LANGS.indexOf(getLang())] || row[1] || row[0];
}

export function label(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const lang = getLang();
  return value[lang] || value.en || value.fa || '';
}

export function fillLangSelect(select) {
  if (!select) return;
  select.innerHTML = LANGS.map(
    (code) => `<option value="${code}">${LANG_NAMES[code]}</option>`,
  ).join('');
  select.value = getLang();
  select.setAttribute('aria-label', t('lang_label'));
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

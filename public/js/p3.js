/* بازار هوشمند — لایهٔ مشترک صفحات فاز سوم: چهار زبان، برچسب‌ها و ابزار نمایش */
import { getLang, setLang, applyDir, esc } from './core.js';

export { esc };
export const LANGS = ['fa', 'en', 'ar', 'tr'];
const RTL = ['fa', 'ar'];
const idxOf = (lang) => Math.max(0, LANGS.indexOf(lang));

/* هر کلید: [فارسی, انگلیسی, عربی, ترکی] */
const D = {
  brand: ['بازار هوشمند', 'Smart Bazaar', 'السوق الذكي', 'Akıllı Pazar'],
  nav_store: ['فروشگاه', 'Store', 'المتجر', 'Mağaza'],
  nav_ads: ['تبلیغات', 'Ads', 'الإعلانات', 'Reklam'],
  nav_account: ['حساب من', 'My account', 'حسابي', 'Hesabım'],
  nav_business: ['بانک اصناف', 'Business directory', 'دليل الأعمال', 'İşletme rehberi'],
  nav_privacy: ['حریم خصوصی', 'Privacy', 'الخصوصية', 'Gizlilik'],
  lang: ['زبان', 'Language', 'اللغة', 'Dil'],
  login_title: ['ورود و ثبت‌نام', 'Sign in or register', 'تسجيل الدخول والتسجيل', 'Giriş ve kayıt'],
  login_sub: ['با شماره تلفن همراه خود وارد شوید؛ کد تأیید برای شما نمایش داده می‌شود.',
    'Sign in with your mobile number; a verification code is shown to you.',
    'سجّل الدخول برقم هاتفك؛ سيظهر لك رمز التحقق.',
    'Cep numaranızla giriş yapın; doğrulama kodu gösterilir.'],
  tab_login: ['ورود', 'Sign in', 'دخول', 'Giriş'],
  tab_register: ['ثبت‌نام', 'Register', 'تسجيل', 'Kayıt'],
  phone: ['شماره تلفن همراه', 'Mobile number', 'رقم الهاتف', 'Cep numarası'],
  phone_hint: ['مثال: ۰۹۱۲۱۲۳۴۵۶۷ یا +989121234567', 'e.g. 09121234567 or +989121234567',
    'مثال: 09121234567', 'Örn: 09121234567'],
  send_code: ['ارسال کد تأیید', 'Send code', 'إرسال الرمز', 'Kod gönder'],
  code: ['کد تأیید ۶ رقمی', '6-digit code', 'رمز التحقق', 'Doğrulama kodu'],
  verify: ['تأیید و ورود', 'Verify', 'تأیيد', 'Doğrula'],
  resend: ['ارسال دوبارهٔ کد', 'Resend code', 'إعادة الإرسال', 'Kodu yeniden gönder'],
  name: ['نام و نام خانوادگی', 'Full name', 'الاسم الكامل', 'Ad soyad'],
  store_name: ['نام کسب‌وکار', 'Business name', 'اسم النشاط', 'İşletme adı'],
  role: ['نوع حساب', 'Account type', 'نوع الحساب', 'Hesap türü'],
  role_customer: ['خریدار', 'Buyer', 'مشترٍ', 'Alıcı'],
  role_seller: ['فروشنده', 'Seller', 'بائع', 'Satıcı'],
  industry: ['صنف', 'Industry', 'الصنف', 'Sektör'],
  city: ['شهر', 'City', 'المدينة', 'Şehir'],
  province: ['استان', 'Province', 'المحافظة', 'İl'],
  country: ['کشور', 'Country', 'الدولة', 'Ülke'],
  address: ['نشانی', 'Address', 'العنوان', 'Adres'],
  demo_code: ['کد تأیید آزمایشی (ارسال پیامک واقعی فعال نیست):', 'Test verification code (real SMS delivery is off):',
    'رمز تحقق تجريبي (إرسال الرسائل غير مفعّل):', 'Test doğrulama kodu (gerçek SMS kapalı):'],
  code_sent: ['کد تأیید صادر شد.', 'Verification code issued.', 'تم إصدار رمز التحقق.', 'Doğrulama kodu oluşturuldu.'],
  phone_verified: ['شماره تأیید شد', 'Number verified', 'تم التحقق من الرقم', 'Numara doğrulandı'],
  my_account: ['پنل من', 'My panel', 'لوحتي', 'Panelim'],
  profile: ['پروفایل', 'Profile', 'الملف الشخصي', 'Profil'],
  my_orders: ['سفارش‌های من', 'My orders', 'طلباتي', 'Siparişlerim'],
  save: ['ذخیره', 'Save', 'حفظ', 'Kaydet'],
  saved: ['ذخیره شد.', 'Saved.', 'تم الحفظ.', 'Kaydedildi.'],
  logout: ['خروج', 'Sign out', 'خروج', 'Çıkış'],
  orders_empty: ['هنوز سفارشی ثبت نشده است.', 'No orders yet.', 'لا توجد طلبات بعد.', 'Henüz sipariş yok.'],
  status: ['وضعیت', 'Status', 'الحالة', 'Durum'],
  total: ['مبلغ کل', 'Total', 'الإجمالي', 'Toplam'],
  pay_test: ['پرداخت آزمایشی', 'Test payment', 'دفع تجريبي', 'Test ödemesi'],
  paid: ['پرداخت‌شده (آزمایشی)', 'Paid (test)', 'مدفوع (تجريبي)', 'Ödendi (test)'],
  unpaid: ['پرداخت‌نشده', 'Unpaid', 'غير مدفوع', 'Ödenmedi'],
  tracking: ['پیگیری ارسال', 'Shipment tracking', 'تتبع الشحنة', 'Kargo takibi'],
  carrier: ['شرکت حمل', 'Carrier', 'شركة الشحن', 'Kargo firması'],
  tracking_number: ['شماره رهگیری', 'Tracking number', 'رقم التتبع', 'Takip numarası'],
  tracking_url: ['لینک پیگیری (اختیاری)', 'Tracking link (optional)', 'رابط التتبع (اختياري)', 'Takip bağlantısı (isteğe bağlı)'],
  save_tracking: ['ثبت پیگیری', 'Save tracking', 'حفظ التتبع', 'Takibi kaydet'],
  seller_profile: ['پروفایل فروشنده', 'Seller profile', 'ملف البائع', 'Satıcı profili'],
  business_name: ['نام کسب‌وکار', 'Business name', 'اسم النشاط', 'İşletme adı'],
  whatsapp: ['واتساپ', 'WhatsApp', 'واتساب', 'WhatsApp'],
  telegram: ['تلگرام', 'Telegram', 'تلغرام', 'Telegram'],
  instagram: ['اینستاگرام', 'Instagram', 'إنستغرام', 'Instagram'],
  website: ['وب‌سایت', 'Website', 'الموقع', 'Web sitesi'],
  directory_title: ['بانک اطلاعات اصناف و کسب‌وکارها', 'Business directory', 'دليل الأصناف والأعمال', 'İşletme rehberi'],
  directory_sub: ['اطلاعات تماس کاری با ثبت منبع، وضعیت صحت و مجوز استفادهٔ تبلیغاتی.',
    'Business contact data with source, verification and advertising permission.',
    'بيانات اتصال تجارية مع المصدر وحالة الصحة وإذن الإعلان.',
    'Kaynak, doğrulama ve reklam izni ile işletme iletişim verileri.'],
  tab_businesses: ['کسب‌وکارها', 'Businesses', 'الأعمال', 'İşletmeler'],
  tab_leads: ['متقاضیان تبلیغات', 'Ad leads', 'طلبات الإعلان', 'Reklam talepleri'],
  tab_crm: ['پیگیری ارتباطات', 'CRM follow-up', 'متابعة الاتصالات', 'İletişim takibi'],
  tab_team: ['دسترسی تیم', 'Team access', 'فريق الوصول', 'Ekip erişimi'],
  tab_audit: ['گزارش فعالیت', 'Activity log', 'سجل النشاط', 'Etkinlik kaydı'],
  search: ['جست‌وجو', 'Search', 'بحث', 'Ara'],
  type: ['نوع کسب‌وکار', 'Business type', 'نوع النشاط', 'İşletme türü'],
  consent: ['رضایت تبلیغاتی', 'Advertising consent', 'الموافقة الإعلانية', 'Reklam izni'],
  consent_granted: ['رضایت داده', 'Granted', 'موافقة', 'Onaylı'],
  consent_pending: ['در انتظار رضایت', 'Pending', 'قيد الانتظار', 'Beklemede'],
  consent_revoked: ['لغو شده', 'Revoked', 'ملغاة', 'İptal'],
  consent_denied: ['رد شده', 'Declined', 'مرفوضة', 'Reddedildi'],
  source: ['منبع اطلاعات', 'Source', 'المصدر', 'Kaynak'],
  verified: ['تأییدشده', 'Verified', 'مُتحقَّق', 'Doğrulandı'],
  unverified: ['تأییدنشده', 'Unverified', 'غير متحقق', 'Doğrulanmadı'],
  needs_recheck: ['نیازمند بازبینی', 'Needs recheck', 'يحتاج مراجعة', 'Yeniden kontrol'],
  last_checked: ['آخرین بررسی', 'Last checked', 'آخر تحقق', 'Son kontrol'],
  add_business: ['ثبت کسب‌وکار', 'Add business', 'إضافة نشاط', 'İşletme ekle'],
  add_lead: ['ثبت متقاضی', 'Add lead', 'إضافة طلب', 'Talep ekle'],
  budget: ['بودجهٔ پیشنهادی (دلار)', 'Proposed budget (USD)', 'الميزانية (دولار)', 'Bütçe (USD)'],
  duration: ['مدت تبلیغ (روز)', 'Duration (days)', 'المدة (أيام)', 'Süre (gün)'],
  networks: ['شبکه‌های تبلیغاتی', 'Ad networks', 'شبكات الإعلان', 'Reklam ağları'],
  ad_type: ['نوع تبلیغ', 'Ad format', 'نوع الإعلان', 'Reklam türü'],
  preferred_contact: ['راه ارتباطی ترجیحی', 'Preferred contact', 'وسيلة الاتصال المفضلة', 'Tercih edilen iletişim'],
  notes: ['یادداشت', 'Notes', 'ملاحظات', 'Notlar'],
  assign: ['واگذاری به', 'Assign to', 'إسناد إلى', 'Ata'],
  activity_type: ['نوع فعالیت', 'Activity type', 'نوع النشاط', 'Etkinlik türü'],
  summary: ['خلاصه', 'Summary', 'الملخص', 'Özet'],
  outcome: ['نتیجه', 'Outcome', 'النتيجة', 'Sonuç'],
  next_call: ['زمان تماس بعدی', 'Next call', 'الموعد القادم', 'Sonraki arama'],
  mark_done: ['انجام شد', 'Mark done', 'تم', 'Tamamlandı'],
  reminders: ['یادآوری‌های تماس', 'Call reminders', 'تذكيرات الاتصال', 'Arama hatırlatmaları'],
  convert: ['تبدیل به مشتری', 'Convert to customer', 'تحويل إلى عميل', 'Müşteriye dönüştür'],
  converted: ['تبدیل‌شده', 'Converted', 'محوَّل', 'Dönüştürüldü'],
  export_csv: ['خروجی CSV', 'Export CSV', 'تصدير CSV', 'CSV indir'],
  demo_data: ['دادهٔ نمایشی', 'Demo data', 'بيانات تجريبية', 'Demo veri'],
  live_data: ['دادهٔ واقعی', 'Live data', 'بيانات حقيقية', 'Gerçek veri'],
  contacts_hidden: ['شماره‌ها ماسک شده‌اند؛ برای مشاهدهٔ کامل مجوز مدیر لازم است.',
    'Numbers are masked; full access needs admin permission.',
    'الأرقام مقنّعة؛ يلزم إذن المدير.', 'Numaralar maskeli; yönetici izni gerekir.'],
  contacts_visible: ['دسترسی کامل به اطلاعات تماس فعال است (هر مشاهده ثبت می‌شود).',
    'Full contact access is enabled (every reveal is logged).',
    'الوصول الكامل مفعّل (كل مشاهدة تُسجَّل).', 'Tam erişim açık (her görüntüleme kaydedilir).'],
  privacy_title: ['حریم خصوصی و استفادهٔ قانونی از اطلاعات', 'Privacy and lawful data use', 'الخصوصية والاستخدام القانوني', 'Gizlilik ve yasal kullanım'],
  privacy_sub: ['فقط اطلاعات کاری مجاز ثبت می‌شود؛ رضایت دریافت تبلیغات و امکان لغو آن همیشه در دسترس است.',
    'Only lawfully obtained business data is stored; consent and opt-out are always available.',
    'تُخزَّن بيانات العمل المسموح بها فقط؛ الموافقة والإلغاء متاحان دائماً.',
    'Yalnızca yasal iş verisi saklanır; onay ve iptal her zaman erişilebilir.'],
  optout_title: ['لغو دریافت پیام تبلیغاتی', 'Stop advertising messages', 'إلغاء الرسائل الإعلانية', 'Reklam mesajlarını durdur'],
  optout_hint: ['شمارهٔ خود را وارد کنید تا در همهٔ کانال‌ها از فهرست تبلیغات خارج شوید.',
    'Enter your number to be removed from advertising across all channels.',
    'أدخل رقمك لإزالتك من الإعلانات في كل القنوات.', 'Numaranızı girin; tüm kanallarda reklam listesinden çıkarılın.'],
  optout_btn: ['ثبت لغو رضایت', 'Record opt-out', 'تسجيل الإلغاء', 'İptali kaydet'],
  optout_done: ['لغو رضایت ثبت شد.', 'Opt-out recorded.', 'تم تسجيل الإلغاء.', 'İptal kaydedildi.'],
  deletion_title: ['درخواست حذف اطلاعات', 'Data deletion request', 'طلب حذف البيانات', 'Veri silme talebi'],
  deletion_hint: ['اگر اطلاعات کسب‌وکار شما در بانک اطلاعات ثبت شده و خواهان حذف آن هستید، این فرم را تکمیل کنید.',
    'If your business is listed and you want it removed, complete this form.',
    'إذا كان نشاطك مدرجاً وتريد حذفه، أكمل هذا النموذج.', 'İşletmeniz kayıtlıysa ve kaldırılmasını istiyorsanız bu formu doldurun.'],
  deletion_btn: ['ارسال درخواست حذف', 'Send deletion request', 'إرسال طلب الحذف', 'Silme talebi gönder'],
  deletion_done: ['درخواست حذف ثبت شد و توسط مدیر بررسی می‌شود.', 'Deletion request recorded for admin review.',
    'تم تسجيل طلب الحذف للمراجعة.', 'Silme talebi incelemeye alındı.'],
  ad_request_title: ['درخواست تبلیغ در بازار هوشمند', 'Request advertising', 'طلب إعلان', 'Reklam talebi'],
  ad_request_sub: ['فرم درخواست تبلیغ برای کسب‌وکارها؛ پس از ثبت، کارشناس با شما تماس می‌گیرد.',
    'Advertising request form; our team contacts you after submission.',
    'نموذج طلب إعلان؛ يتواصل معك فريقنا بعد الإرسال.', 'Reklam talep formu; ekibimiz sizinle iletişime geçer.'],
  submit: ['ارسال', 'Submit', 'إرسال', 'Gönder'],
  consent_required: ['برای ثبت درخواست، رضایت تماس تبلیغاتی لازم است.', 'Advertising contact consent is required.',
    'الموافقة على الاتصال الإعلاني مطلوبة.', 'Reklam iletişim onayı gerekli.'],
  agree: ['رضایت می‌دهم برای تماس تبلیغاتی و ثبت اطلاعات کاری من.',
    'I consent to advertising contact and to storing my business data.',
    'أوافق على الاتصال الإعلاني وتخزين بيانات نشاطي.', 'Reklam iletişimine ve iş verimin saklanmasına onay veriyorum.'],
  request_sent: ['درخواست شما ثبت شد.', 'Your request was recorded.', 'تم تسجيل طلبك.', 'Talebiniz kaydedildi.'],
  no_results: ['نتیجه‌ای یافت نشد.', 'No results.', 'لا نتائج.', 'Sonuç yok.'],
  forbidden: ['دسترسی مجاز نیست.', 'Access denied.', 'الوصول غير مسموح.', 'Erişim yok.'],
  required: ['این فیلد الزامی است.', 'This field is required.', 'هذا الحقل مطلوب.', 'Bu alan zorunlu.'],
  duplicate: ['این کسب‌وکار یا شماره قبلاً ثبت شده است.', 'This business or number already exists.',
    'هذا النشاط أو الرقم مسجّل مسبقاً.', 'Bu işletme veya numara zaten kayıtlı.'],
  test_mode: ['محیط آزمایشی: پرداخت واقعی، برداشت بانکی و ارسال انبوه تبلیغات غیرفعال است.',
    'Test environment: real payments, bank withdrawals and bulk advertising are disabled.',
    'بيئة تجريبية: الدفع الحقيقي والسحب والإعلان الجماعي معطّلة.', 'Test ortamı: gerçek ödeme, banka çekimi ve toplu reklam kapalı.'],
  loading: ['در حال بارگذاری…', 'Loading…', 'جارٍ التحميل…', 'Yükleniyor…'],
  optional: ['اختیاری', 'optional', 'اختياري', 'isteğe bağlı'],
  stats_total: ['کل رکوردها', 'Total records', 'إجمالي السجلات', 'Toplam kayıt'],
  stats_consented: ['با رضایت تبلیغاتی', 'Ad-consented', 'بموافقة إعلانية', 'Reklam onaylı'],
  stats_pending: ['در انتظار رضایت', 'Pending consent', 'بانتظار الموافقة', 'Onay bekliyor'],
  stats_duplicates: ['تکراری جلوگیری‌شده', 'Duplicates blocked', 'مكرر محجوب', 'Engellenen tekrar'],
};

export const langOf = () => {
  const lang = getLang();
  return LANGS.includes(lang) ? lang : 'fa';
};

export function T(key) {
  const row = D[key];
  if (!row) return key;
  return row[idxOf(langOf())] || row[0];
}

export function dirOf(lang = langOf()) {
  return RTL.includes(lang) ? 'rtl' : 'ltr';
}

/* اعمال ترجمه روی [data-i18n] و [data-i18n-ph] و جهت صفحه */
export function mountPage() {
  const lang = langOf();
  document.documentElement.lang = lang;
  document.documentElement.dir = dirOf(lang);
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = T(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', T(el.dataset.i18nPh));
  });
  const select = document.getElementById('langSelect');
  if (select) {
    select.value = lang;
    select.addEventListener('change', () => {
      setLang(select.value);
      applyDir();
      mountPage();
      window.dispatchEvent(new CustomEvent('lang-changed', { detail: select.value }));
    });
  }
  return lang;
}

export const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(langOf() === 'fa' ? 'fa-IR' : langOf() === 'ar' ? 'ar-EG' : langOf() === 'tr' ? 'tr-TR' : 'en-GB', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch { return String(iso).slice(0, 10); }
};

export const fmtDateTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(langOf() === 'fa' ? 'fa-IR' : langOf() === 'ar' ? 'ar-EG' : langOf() === 'tr' ? 'tr-TR' : 'en-GB', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return String(iso).slice(0, 16); }
};

export const num = (value) => Number(value || 0).toLocaleString(langOf() === 'fa' ? 'fa-IR' : 'en-US');

export const consentLabel = (status) => ({
  granted: T('consent_granted'), pending: T('consent_pending'), revoked: T('consent_revoked'), denied: T('consent_denied'),
}[status] || status);

export const verifyLabel = (status) => ({
  verified: T('verified'), unverified: T('unverified'), needs_recheck: T('needs_recheck'),
}[status] || status);

export const badge = (text, tone = 'neutral') => `<span class="p3-badge p3-badge--${tone}">${esc(text)}</span>`;

export const toneForConsent = (status) => ({ granted: 'ok', pending: 'warn', revoked: 'bad', denied: 'bad' }[status] || 'neutral');

export function toast(message, type = '') {
  let host = document.getElementById('p3Toast');
  if (!host) {
    host = document.createElement('div');
    host.id = 'p3Toast';
    host.className = 'p3-toast';
    document.body.appendChild(host);
  }
  host.textContent = message;
  host.className = `p3-toast p3-toast--show ${type ? `p3-toast--${type}` : ''}`;
  clearTimeout(host._timer);
  host._timer = setTimeout(() => { host.className = 'p3-toast'; }, 3200);
}

export const industryOptions = (industries = []) => industries
  .map((i) => `<option value="${esc(i.slug)}">${esc(i.label[langOf()] || i.label.fa)}</option>`)
  .join('');

export const countryOptions = (countries = []) => countries
  .map((c) => `<option value="${esc(c.code)}">${esc(c.label[langOf()] || c.label.fa)}</option>`)
  .join('');

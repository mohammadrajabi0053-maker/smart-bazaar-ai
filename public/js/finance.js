// بازار هوشمند — پنل مالی محرمانه (فقط مدیر اصلی)
import {
  applyDir, getLang, setLang, api, toast, esc, fmtDate,
} from './core.js';

/* --------------------------------- واژه‌نامه --------------------------------- */
const DICT = {
  navStore: ['فروشگاه', 'Store', 'المتجر', 'Mağaza'],
  navAds: ['تبلیغات', 'Ads', 'الإعلانات', 'Reklam'],
  navAdmin: ['مدیریت', 'Admin', 'الإدارة', 'Yönetim'],
  logout: ['خروج', 'Logout', 'خروج', 'Çıkış'],
  heroTitle: ['پنل مالی محرمانه', 'Confidential finance panel', 'لوحة مالية سرية', 'Gizli finans paneli'],
  heroSub: [
    'این بخش فقط برای مدیر اصلی است. همهٔ محاسبات در سرور انجام می‌شود و هر بازدید ثبت می‌شود.',
    'Owner-only area. All calculations run on the server and every access is audited.',
    'هذه المنطقة للمالك فقط. تُحسب كل الأرقام في الخادم ويُسجّل كل دخول.',
    'Bu alan yalnızca sahibe açıktır. Tüm hesaplar sunucuda yapılır ve her erişim kaydedilir.',
  ],
  ownerBadge: ['مدیر اصلی', 'Owner', 'المالك', 'Sahip'],
  internalReport: ['گزارش مدیریتی داخلی', 'Internal management report', 'تقرير إداري داخلي', 'Dahili yönetim raporu'],
  paymentsOff: ['پرداخت واقعی غیرفعال', 'Real payments off', 'الدفع الحقيقي معطّل', 'Gerçek ödeme kapalı'],
  payoutOff: ['برداشت واقعی غیرفعال', 'Real payouts off', 'السحب الحقيقي معطّل', 'Gerçek ödeme çekme kapalı'],
  tabOverview: ['نمای کلی', 'Overview', 'نظرة عامة', 'Genel bakış'],
  tabEntries: ['تراکنش‌ها', 'Transactions', 'المعاملات', 'İşlemler'],
  tabWallet: ['کیف پول', 'Wallet', 'المحفظة', 'Cüzdan'],
  tabReports: ['گزارش‌ها و مجوزها', 'Reports & grants', 'التقارير والأذونات', 'Raporlar ve izinler'],
  tabTeam: ['تیم و دسترسی', 'Team & access', 'الفريق والوصول', 'Ekip ve erişim'],
  tabSecurity: ['امنیت', 'Security', 'الأمان', 'Güvenlik'],
  tabAudit: ['حسابرسی', 'Audit', 'التدقيق', 'Denetim'],
  from: ['از تاریخ', 'From', 'من', 'Başlangıç'],
  to: ['تا تاریخ', 'To', 'إلى', 'Bitiş'],
  country: ['کشور', 'Country', 'الدولة', 'Ülke'],
  source: ['منبع', 'Source', 'المصدر', 'Kaynak'],
  bucket: ['بازهٔ گزارش', 'Period', 'الفترة', 'Dönem'],
  day: ['روزانه', 'Daily', 'يومي', 'Günlük'],
  week: ['هفتگی', 'Weekly', 'أسبوعي', 'Haftalık'],
  month: ['ماهانه', 'Monthly', 'شهري', 'Aylık'],
  year: ['سالانه', 'Yearly', 'سنوي', 'Yıllık'],
  includeDemo: ['نمایش دادهٔ آزمایشی', 'Include demo data', 'تضمين بيانات تجريبية', 'Demo veriyi göster'],
  apply: ['اعمال', 'Apply', 'تطبيق', 'Uygula'],
  reset: ['بازنشانی', 'Reset', 'إعادة', 'Sıfırla'],
  downloadCsv: ['خروجی Excel/CSV', 'Excel/CSV export', 'تصدير Excel/CSV', 'Excel/CSV indir'],
  printPdf: ['چاپ / PDF', 'Print / PDF', 'طباعة / PDF', 'Yazdır / PDF'],
  series: ['روند درآمد و هزینه', 'Income and expense trend', 'اتجاه الإيرادات والمصروفات', 'Gelir ve gider eğilimi'],
  bySource: ['به تفکیک منبع', 'By source', 'حسب المصدر', 'Kaynağa göre'],
  byCountry: ['به تفکیک کشور', 'By country', 'حسب الدولة', 'Ülkeye göre'],
  byCurrency: ['به تفکیک ارز', 'By currency', 'حسب العملة', 'Para birimine göre'],
  income: ['درآمد', 'Income', 'الإيرادات', 'Gelir'],
  expense: ['هزینه', 'Expense', 'المصروفات', 'Gider'],
  net: ['سود خالص', 'Net profit', 'صافي الربح', 'Net kâr'],
  pending: ['درآمد در انتظار', 'Pending income', 'إيراد معلّق', 'Bekleyen gelir'],
  balance: ['موجودی کل', 'Total balance', 'الرصيد الكلي', 'Toplam bakiye'],
  available: ['قابل استفاده', 'Available', 'المتاح', 'Kullanılabilir'],
  reserved: ['رزرو برداشت', 'Reserved', 'محجوز', 'Ayrılmış'],
  count: ['تعداد', 'Count', 'العدد', 'Adet'],
  all: ['همه', 'All', 'الكل', 'Tümü'],
  entries: ['تراکنش', 'entries', 'معاملة', 'işlem'],
  addEntry: ['ثبت درآمد / هزینه', 'Add income / expense', 'تسجيل إيراد / مصروف', 'Gelir / gider ekle'],
  kind: ['نوع', 'Type', 'النوع', 'Tür'],
  amountUsd: ['مبلغ (دلار)', 'Amount (USD)', 'المبلغ (دولار)', 'Tutar (USD)'],
  currency: ['ارز', 'Currency', 'العملة', 'Para birimi'],
  account: ['حساب', 'Account', 'الحساب', 'Hesap'],
  settled: ['تسویه‌شده', 'Settled', 'مُسوّى', 'Kapandı'],
  note: ['توضیح', 'Note', 'ملاحظة', 'Not'],
  save: ['ثبت', 'Save', 'حفظ', 'Kaydet'],
  date: ['تاریخ', 'Date', 'التاريخ', 'Tarih'],
  hash: ['هش', 'Hash', 'التجزئة', 'Hash'],
  search: ['جست‌وجو', 'Search', 'بحث', 'Ara'],
  transfer: ['انتقال', 'Transfer', 'تحويل', 'Transfer'],
  withdrawal: ['برداشت', 'Withdrawal', 'سحب', 'Çekim'],
  accounts: ['حساب‌ها', 'Accounts', 'الحسابات', 'Hesaplar'],
  fromAccount: ['از حساب', 'From account', 'من الحساب', 'Kaynak hesap'],
  toAccount: ['به حساب', 'To account', 'إلى الحساب', 'Hedef hesap'],
  newWithdrawal: ['درخواست برداشت', 'Withdrawal request', 'طلب سحب', 'Çekim talebi'],
  method: ['روش دریافت', 'Method', 'الطريقة', 'Yöntem'],
  payoutNotice: [
    'در این نسخه هیچ برداشت واقعی انجام نمی‌شود؛ فقط ثبت و تأیید چندمرحله‌ای.',
    'No real payout happens in this version; only recording and multi-stage approval.',
    'لا يوجد سحب حقيقي في هذا الإصدار؛ تسجيل وموافقة على مراحل فقط.',
    'Bu sürümde gerçek ödeme yapılmaz; yalnızca kayıt ve aşamalı onay vardır.',
  ],
  requestWithdrawal: ['ثبت درخواست', 'Submit request', 'إرسال الطلب', 'Talep gönder'],
  withdrawals: ['برداشت‌ها', 'Withdrawals', 'السحوبات', 'Çekimler'],
  stage: ['مرحله', 'Stage', 'المرحلة', 'Aşama'],
  actions: ['عملیات', 'Actions', 'الإجراءات', 'İşlemler'],
  review: ['بررسی', 'Review', 'مراجعة', 'İncele'],
  approve: ['تأیید نهایی', 'Approve', 'موافقة نهائية', 'Onayla'],
  cancel: ['لغو', 'Cancel', 'إلغاء', 'İptal'],
  requested: ['درخواست‌شده', 'Requested', 'مطلوب', 'Talep edildi'],
  reviewed: ['بررسی‌شده', 'Reviewed', 'تمت المراجعة', 'İncelendi'],
  approved: ['تأییدشده', 'Approved', 'تمت الموافقة', 'Onaylandı'],
  paid: ['پرداخت‌شده', 'Paid', 'مدفوع', 'Ödendi'],
  canceled: ['لغوشده', 'Canceled', 'ملغى', 'İptal edildi'],
  newReport: ['ساخت گزارش اختصاصی', 'Create custom report', 'إنشاء تقرير مخصص', 'Özel rapor oluştur'],
  recipientName: ['نام دریافت‌کننده', 'Recipient name', 'اسم المستلم', 'Alıcı adı'],
  recipientRole: ['نقش دریافت‌کننده', 'Recipient role', 'دور المستلم', 'Alıcı rolü'],
  technicalAdmin: ['مدیر فنی', 'Technical admin', 'مدير فني', 'Teknik yönetici'],
  subAdmin: ['مدیر فرعی', 'Sub admin', 'مدير فرعي', 'Alt yönetici'],
  accountant: ['حسابدار', 'Accountant', 'محاسب', 'Muhasebeci'],
  mode: ['مبنای گزارش', 'Basis', 'الأساس', 'Esas'],
  percentMode: ['درصدی از درآمد', 'Percent of income', 'نسبة من الإيراد', 'Gelirin yüzdesi'],
  fixedMode: ['مبلغ مشخص', 'Fixed amount', 'مبلغ محدد', 'Sabit tutar'],
  percent: ['درصد', 'Percent', 'النسبة', 'Yüzde'],
  fixedUsd: ['مبلغ مشخص (دلار)', 'Fixed amount (USD)', 'المبلغ المحدد (دولار)', 'Sabit tutar (USD)'],
  expiryDays: ['اعتبار (روز)', 'Valid for (days)', 'الصلاحية (أيام)', 'Geçerlilik (gün)'],
  fields: ['اطلاعات قابل مشاهده', 'Visible fields', 'الحقول الظاهرة', 'Görünür alanlar'],
  permissions: ['مجوزها', 'Permissions', 'الأذونات', 'İzinler'],
  reportHint: [
    'ارسال گزارش فقط پس از دو مرحله تأیید (رمز + کد Authenticator و سپس تأیید نهایی) امکان‌پذیر است.',
    'Sending requires two approvals: password + authenticator code, then a final confirmation.',
    'يتطلب الإرسال موافقتين: كلمة المرور ورمز المصادقة ثم تأكيد نهائي.',
    'Gönderim iki onay gerektirir: şifre + doğrulayıcı kodu, sonra son onay.',
  ],
  create: ['ساخت گزارش', 'Create report', 'إنشاء التقرير', 'Rapor oluştur'],
  grants: ['مجوزهای گزارش', 'Report grants', 'أذونات التقارير', 'Rapor izinleri'],
  trackingId: ['شناسه رهگیری', 'Tracking ID', 'معرّف التتبع', 'Takip kimliği'],
  amount: ['مبلغ', 'Amount', 'المبلغ', 'Tutar'],
  status: ['وضعیت', 'Status', 'الحالة', 'Durum'],
  expiresAt: ['انقضا', 'Expires', 'الانتهاء', 'Bitiş'],
  active: ['فعال', 'Active', 'نشط', 'Etkin'],
  revoked: ['لغوشده', 'Revoked', 'ملغى', 'İptal'],
  expired: ['منقضی', 'Expired', 'منتهي', 'Süresi doldu'],
  revoke: ['لغو مجوز', 'Revoke', 'إلغاء الإذن', 'İzni iptal et'],
  authorize: ['تأیید مرحله ۱', 'Step 1 approval', 'موافقة المرحلة 1', 'Adım 1 onayı'],
  send: ['ارسال', 'Send', 'إرسال', 'Gönder'],
  detail: ['جزئیات', 'Details', 'التفاصيل', 'Ayrıntı'],
  sentReports: ['گزارش‌های ارسال‌شده', 'Sent reports', 'التقارير المرسلة', 'Gönderilen raporlar'],
  team: ['تیم', 'Team', 'الفريق', 'Ekip'],
  teamHint: [
    'مدیران فرعی و فنی به‌صورت پیش‌فرض هیچ دسترسی مالی ندارند و فقط گزارش‌هایی را می‌بینند که شما صادر کرده‌اید.',
    'Sub and technical admins have no finance access by default; they only see reports you grant.',
    'المديرون الفرعيون والفنيون بلا وصول مالي افتراضيًا ولا يرون إلا التقارير التي تمنحها.',
    'Alt ve teknik yöneticiler varsayılan olarak finans erişimine sahip değildir.',
  ],
  addAdmin: ['افزودن مدیر فرعی / فنی', 'Add sub / technical admin', 'إضافة مدير فرعي / فني', 'Alt / teknik yönetici ekle'],
  name: ['نام', 'Name', 'الاسم', 'Ad'],
  email: ['ایمیل', 'Email', 'البريد', 'E-posta'],
  password: ['رمز عبور', 'Password', 'كلمة المرور', 'Şifre'],
  role: ['نقش', 'Role', 'الدور', 'Rol'],
  blocked: ['مسدود', 'Blocked', 'محظور', 'Engelli'],
  block: ['مسدودسازی', 'Block', 'حظر', 'Engelle'],
  unblock: ['فعال‌سازی', 'Unblock', 'تفعيل', 'Etkinleştir'],
  twoFactor: ['احراز هویت دومرحله‌ای', 'Two-factor authentication', 'المصادقة الثنائية', 'İki adımlı doğrulama'],
  setupHint: [
    'کلید را در برنامه Authenticator ثبت کنید، سپس کد ۶ رقمی را وارد کنید.',
    'Add the key to your authenticator app, then enter the 6-digit code.',
    'أضف المفتاح إلى تطبيق المصادقة ثم أدخل الرمز المكوّن من ٦ أرقام.',
    'Anahtarı doğrulayıcı uygulamaya ekleyin, sonra 6 haneli kodu girin.',
  ],
  openInApp: ['باز کردن در برنامه Authenticator', 'Open in authenticator', 'افتح في تطبيق المصادقة', 'Doğrulayıcıda aç'],
  code: ['کد ۶ رقمی', '6-digit code', 'رمز 6 أرقام', '6 haneli kod'],
  enable: ['فعال‌سازی', 'Enable', 'تفعيل', 'Etkinleştir'],
  setup2fa: ['راه‌اندازی ۲FA', 'Set up 2FA', 'إعداد 2FA', '2FA kur'],
  disable: ['غیرفعال‌سازی', 'Disable', 'تعطيل', 'Devre dışı'],
  logoutAll: ['خروج از همهٔ دستگاه‌ها', 'Logout all devices', 'خروج من كل الأجهزة', 'Tüm cihazlardan çık'],
  securityStatus: ['وضعیت امنیتی', 'Security status', 'الحالة الأمنية', 'Güvenlik durumu'],
  audit: ['رویدادهای حسابرسی', 'Audit events', 'أحداث التدقيق', 'Denetim olayları'],
  action: ['رویداد', 'Event', 'الحدث', 'Olay'],
  target: ['هدف', 'Target', 'الهدف', 'Hedef'],
  actor: ['کاربر', 'Actor', 'المستخدم', 'Kullanıcı'],
  chainOk: ['دفتر سالم', 'Ledger verified', 'السجل سليم', 'Defter doğrulandı'],
  chainBroken: ['دفتر ناسازگار', 'Ledger broken', 'السجل غير متسق', 'Defter bozuk'],
  secondFactorTitle: ['تأیید دومرحله‌ای', 'Two-factor confirmation', 'تأكيد ثنائي', 'İki adımlı onay'],
  secondFactorHint: [
    'برای ادامه رمز عبور و کد Authenticator را وارد کنید.',
    'Enter your password and authenticator code to continue.',
    'أدخل كلمة المرور ورمز المصادقة للمتابعة.',
    'Devam etmek için şifrenizi ve doğrulayıcı kodunu girin.',
  ],
  totpCode: ['کد Authenticator', 'Authenticator code', 'رمز المصادقة', 'Doğrulayıcı kodu'],
  secondFactorRequired: ['رمز و کد ۶ رقمی الزامی است', 'Password and 6-digit code required', 'كلمة المرور ورمز 6 أرقام مطلوبان', 'Şifre ve 6 haneli kod gerekli'],
  submit: ['تأیید', 'Confirm', 'تأكيد', 'Onayla'],
  close: ['بستن', 'Close', 'إغلاق', 'Kapat'],
  copyLink: ['کپی لینک گزارش', 'Copy report link', 'نسخ رابط التقرير', 'Rapor bağlantısını kopyala'],
  copied: ['کپی شد', 'Copied', 'تم النسخ', 'Kopyalandı'],
  confirmSend: ['تأیید نهایی ارسال', 'Final send confirmation', 'التأكيد النهائي للإرسال', 'Son gönderim onayı'],
  sentOk: ['گزارش ارسال شد', 'Report sent', 'تم إرسال التقرير', 'Rapor gönderildi'],
  noData: ['داده‌ای نیست', 'No data', 'لا بيانات', 'Veri yok'],
  error: ['خطا', 'Error', 'خطأ', 'Hata'],
  forbidden: ['دسترسی فقط برای مدیر اصلی است', 'Owner access only', 'الوصول للمالك فقط', 'Yalnızca sahip erişebilir'],
  loading: ['در حال بارگذاری…', 'Loading…', 'جارٍ التحميل…', 'Yükleniyor…'],
  saved: ['ثبت شد', 'Saved', 'تم الحفظ', 'Kaydedildi'],
  created: ['ساخته شد', 'Created', 'تم الإنشاء', 'Oluşturuldu'],
  fieldTotals: ['جمع کل', 'Totals', 'الإجماليات', 'Toplamlar'],
  fieldByCountry: ['درآمد کشورها', 'By country', 'حسب الدولة', 'Ülkeye göre'],
  fieldBySource: ['درآمد منابع', 'By source', 'حسب المصدر', 'Kaynağa göre'],
  fieldByCurrency: ['درآمد ارزها', 'By currency', 'حسب العملة', 'Para birimine göre'],
  fieldSeries: ['روند زمانی', 'Time series', 'السلسلة الزمنية', 'Zaman serisi'],
  fieldWallet: ['موجودی کیف پول', 'Wallet balance', 'رصيد المحفظة', 'Cüzdan bakiyesi'],
  permView: ['مشاهده', 'View', 'عرض', 'Görüntüle'],
  permCopy: ['کپی', 'Copy', 'نسخ', 'Kopyala'],
  permPrint: ['چاپ', 'Print', 'طباعة', 'Yazdır'],
  permPdf: ['فایل PDF', 'PDF file', 'ملف PDF', 'PDF dosyası'],
  permExcel: ['فایل Excel', 'Excel file', 'ملف Excel', 'Excel dosyası'],
  disclaimer: ['این گزارش مدیریتی داخلی است و صورت‌وضعیت رسمی محسوب نمی‌شود.', 'Internal management report, not an official statement.', 'تقرير إداري داخلي وليس كشفًا رسميًا.', 'Dahili yönetim raporu; resmî beyan değildir.'],
  reportType: ['نوع گزارش', 'Report type', 'نوع التقرير', 'Rapor türü'],
  baseIncome: ['درآمد مبنا', 'Base income', 'الإيراد الأساسي', 'Temel gelir'],
  grantedBy: ['صادرکننده', 'Granted by', 'صادر عن', 'Veren'],
  linkReady: ['لینک گزارش آماده است', 'Report link ready', 'رابط التقرير جاهز', 'Rapor bağlantısı hazır'],
  openReport: ['باز کردن گزارش', 'Open report', 'فتح التقرير', 'Raporu aç'],
};

const LANG_INDEX = { fa: 0, en: 1, ar: 2, tr: 3 };
const tr = (key, vars) => {
  const row = DICT[key];
  let text = row ? (row[LANG_INDEX[getLang()]] || row[0]) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const FIELDS = ['totals', 'byCountry', 'bySource', 'byCurrency', 'series', 'wallet'];
const PERMS = ['view', 'copy', 'print', 'pdf', 'excel'];
const FIELD_LABEL = {
  totals: 'fieldTotals', byCountry: 'fieldByCountry', bySource: 'fieldBySource',
  byCurrency: 'fieldByCurrency', series: 'fieldSeries', wallet: 'fieldWallet',
};
const PERM_LABEL = { view: 'permView', copy: 'permCopy', print: 'permPrint', pdf: 'permPdf', excel: 'permExcel' };

const state = {
  tab: 'overview',
  overview: null,
  countries: [],
  filters: { from: '', to: '', country: '', source: '', bucket: 'month', includeDemo: false },
  entryFilters: { from: '', to: '', kind: '', country: '', q: '' },
  fields: FIELDS,
  permissions: PERMS,
};

/* --------------------------------- کمکی‌ها --------------------------------- */
const usd = (value) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortHash = (value) => (value ? `${String(value).slice(0, 8)}…` : '—');
const countryLabel = (code) => {
  if (!code || code === 'XX') return '—';
  const row = state.countries.find((c) => c.code === code);
  if (!row) return code;
  const name = typeof row.name === 'object' ? (row.name[getLang()] || row.name.fa) : row.name;
  return `${row.flag || ''} ${name}`.trim();
};
const sourceLabel = (ov, code) => {
  const all = [...(ov?.incomeSources || []), ...(ov?.expenseSources || [])];
  const row = all.find((s) => s.code === code);
  if (!row) return code || '—';
  const name = typeof row.name === 'object' ? (row.name[getLang()] || row.name.fa) : row.name;
  return `${row.icon || ''} ${name}`.trim();
};

function guard(err) {
  if (err?.status === 401) {
    window.location.href = '/?next=/finance';
    return true;
  }
  if (err?.status === 403 && err?.data?.error === 'owner_only') {
    toast(tr('forbidden'), 'error');
    return true;
  }
  return false;
}

async function call(path, options) {
  try {
    return await api(path, options);
  } catch (err) {
    if (guard(err)) return null;
    const code = err?.data?.error || err?.message || tr('error');
    toast(`${code}`, 'error');
    return null;
  }
}

function fillSelect(select, rows, { placeholder = null, selected = '' } = {}) {
  if (!select) return;
  const head = placeholder === null ? '' : `<option value="">${esc(placeholder)}</option>`;
  select.innerHTML = head + rows.map((row) => `<option value="${esc(row.value)}"${String(row.value) === String(selected) ? ' selected' : ''}>${esc(row.label)}</option>`).join('');
}

/* ---------------------------------- مودال ---------------------------------- */
function openModal({ title, html, okLabel, validate }) {
  return new Promise((resolve) => {
    const modal = $('#modal');
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    $('#modalOk').textContent = okLabel || tr('submit');
    modal.hidden = false;
    const finish = (value) => {
      modal.hidden = true;
      $('#modalOk').onclick = null;
      $('#modalCancel').onclick = null;
      resolve(value);
    };
    $('#modalCancel').onclick = () => finish(null);
    $('#modalOk').onclick = () => {
      const result = validate ? validate($('#modalBody')) : true;
      if (result === false) return;
      finish(result === true ? true : result);
    };
    const first = $('#modalBody').querySelector('input');
    if (first) setTimeout(() => first.focus(), 40);
  });
}

function askSecondFactor(titleKey) {
  return openModal({
    title: tr(titleKey),
    okLabel: tr('submit'),
    html: `<p class="fin-hint">${esc(tr('secondFactorHint'))}</p>
      <label>${esc(tr('password'))}<input id="sfPassword" type="password" autocomplete="current-password"></label>
      <label>${esc(tr('totpCode'))}<input id="sfCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label>`,
    validate: (body) => {
      const password = body.querySelector('#sfPassword').value;
      const code = body.querySelector('#sfCode').value.trim();
      if (!password || !/^\d{6}$/.test(code)) {
        toast(tr('secondFactorRequired'), 'error');
        return false;
      }
      return { password, code };
    },
  });
}

/* --------------------------------- نمای کلی --------------------------------- */
function renderCards(target, cards) {
  const el = $(target);
  if (!el) return;
  el.innerHTML = cards.map((c) => `<div class="fin-card ${c.cls || ''}">
      <span class="k">${esc(c.k)}</span>
      <span class="v">${esc(c.v)}</span>
      ${c.s ? `<span class="s">${esc(c.s)}</span>` : ''}
    </div>`).join('');
}

function renderSeries(series) {
  const host = $('#seriesChart');
  if (!host) return;
  if (!series.length) {
    host.innerHTML = `<p class="fin-hint">${esc(tr('noData'))}</p>`;
    return;
  }
  const max = Math.max(1, ...series.map((row) => Math.max(row.incomeUsd, row.expenseUsd)));
  host.innerHTML = series.slice(-12).map((row) => {
    const inc = Math.round((row.incomeUsd / max) * 100);
    const exp = Math.round((row.expenseUsd / max) * 100);
    return `<div class="fin-bar-row">
      <span class="lab">${esc(row.key)}</span>
      <span class="fin-bar-track" title="income ${usd(row.incomeUsd)} / expense ${usd(row.expenseUsd)}">
        <span class="fin-bar-in" style="width:${inc}%"></span>
        <span class="fin-bar-out" style="width:${exp}%;opacity:.55"></span>
      </span>
      <span class="val">${esc(usd(row.netUsd))}</span>
    </div>`;
  }).join('');
}

function renderBreakdowns(ov) {
  const s = ov.summary;
  const srcBody = $('#bySourceBody');
  if (srcBody) {
    const rows = Object.entries(s.bySource || {}).sort((a, b) => b[1].incomeUsd - a[1].incomeUsd);
    srcBody.innerHTML = rows.length ? rows.map(([code, v]) => `<tr>
        <td>${esc(sourceLabel(ov, code))}</td>
        <td class="num">${esc(usd(v.incomeUsd))}</td>
        <td class="num">${esc(usd(v.expenseUsd))}</td>
        <td class="num">${esc(v.count)}</td>
      </tr>`).join('') : `<tr><td colspan="4" class="empty">${esc(tr('noData'))}</td></tr>`;
  }
  const cBody = $('#byCountryBody');
  if (cBody) {
    const rows = Object.entries(s.byCountry || {}).sort((a, b) => b[1].incomeUsd - a[1].incomeUsd);
    cBody.innerHTML = rows.length ? rows.map(([code, v]) => `<tr>
        <td>${esc(countryLabel(code))}</td>
        <td class="num">${esc(usd(v.incomeUsd))}</td>
        <td class="num">${esc(v.count)}</td>
      </tr>`).join('') : `<tr><td colspan="3" class="empty">${esc(tr('noData'))}</td></tr>`;
  }
  const curBody = $('#byCurrencyBody');
  if (curBody) {
    const rows = Object.entries(s.byCurrency || {}).sort((a, b) => b[1].incomeUsd - a[1].incomeUsd);
    curBody.innerHTML = rows.length ? rows.map(([code, v]) => `<tr>
        <td>${esc(code)}</td>
        <td class="num">${esc(usd(v.incomeUsd))}</td>
        <td class="num">${esc(v.count)}</td>
      </tr>`).join('') : `<tr><td colspan="3" class="empty">${esc(tr('noData'))}</td></tr>`;
  }
}

function renderOverview() {
  const ov = state.overview;
  if (!ov) return;
  const s = ov.summary;
  renderCards('#ovCards', [
    { k: tr('income'), v: usd(s.incomeUsd), cls: 'ok', s: `${s.count} ${tr('entries')}` },
    { k: tr('expense'), v: usd(s.expenseUsd), cls: 'bad' },
    { k: tr('net'), v: usd(s.netUsd), cls: s.netUsd >= 0 ? 'ok' : 'bad' },
    { k: tr('pending'), v: usd(s.pendingUsd), cls: 'warn' },
    { k: tr('balance'), v: usd(ov.wallet.balanceUsd) },
    { k: tr('available'), v: usd(ov.wallet.availableUsd) },
    { k: tr('reserved'), v: usd(ov.wallet.reservedUsd) },
  ]);
  const badge = $('#chainBadge');
  if (badge) {
    const ok = Boolean(ov.chain?.valid);
    badge.className = `fin-badge ${ok ? 'ok' : 'bad'}`;
    badge.textContent = ok
      ? `⛓️ ${tr('chainOk')} · ${ov.chain.entries}`
      : `⛓️ ${tr('chainBroken')} #${ov.chain?.brokenAt ?? '?'}`;
  }
  renderSeries(ov.series || []);
  renderBreakdowns(ov);
}

async function loadOverview() {
  const f = state.filters;
  const qs = new URLSearchParams();
  if (f.from) qs.set('from', f.from);
  if (f.to) qs.set('to', f.to);
  if (f.country) qs.set('country', f.country);
  if (f.source) qs.set('source', f.source);
  qs.set('bucket', f.bucket);
  if (f.includeDemo) qs.set('includeDemo', '1');
  const data = await call(`/api/finance/overview?${qs.toString()}`);
  if (!data) return;
  state.overview = data;
  state.countries = data.countries || [];
  if (!state.countries.length === false && state.countries.length) syncCountryOptions();
  renderOverview();
  updateExportLink();
  fillWalletSelects();
}

function syncCountryOptions() {
  const rows = state.countries.map((c) => ({ value: c.code, label: countryLabel(c.code) }));
  for (const id of ['#ovCountry', '#eCountry', '#entryCountry', '#gCountries']) {
    const el = $(id);
    if (!el) continue;
    const selected = el.value;
    fillSelect(el, rows, { placeholder: tr('all'), selected });
    if (id === '#gCountries') el.removeAttribute('placeholder');
  }
  const currencies = [...new Set(state.countries.map((c) => c.currency).filter(Boolean))];
  const curEl = $('#entryCurrency');
  if (curEl) {
    fillSelect(curEl, [...new Set(['USD', ...currencies])].map((c) => ({ value: c, label: c })), { selected: 'USD' });
  }
}

function fillWalletSelects() {
  const accounts = state.overview?.accounts || [];
  const rows = accounts.map((a) => ({
    value: a.code,
    label: typeof a.name === 'object' ? (a.name[getLang()] || a.name.fa) : a.name,
  }));
  fillSelect($('#entryAccount'), rows, { selected: 'main' });
  fillSelect($('#trFrom'), rows, { selected: 'main' });
  fillSelect($('#trTo'), rows, { selected: 'reserve' });
  fillSelect($('#wdAccount'), rows, { selected: 'main' });
}

function updateExportLink() {
  const f = state.filters;
  const qs = new URLSearchParams({ format: 'csv' });
  if (f.from) qs.set('from', f.from);
  if (f.to) qs.set('to', f.to);
  if (f.country) qs.set('country', f.country);
  if (f.source) qs.set('source', f.source);
  if (f.includeDemo) qs.set('includeDemo', '1');
  const link = $('#exportCsv');
  if (link) link.href = `/api/finance/export?${qs.toString()}`;
}

/* -------------------------------- تراکنش‌ها -------------------------------- */
async function loadEntries() {
  const f = state.entryFilters;
  const qs = new URLSearchParams({ limit: '100' });
  if (f.from) qs.set('from', f.from);
  if (f.to) qs.set('to', f.to);
  if (f.kind) qs.set('kind', f.kind);
  if (f.country) qs.set('country', f.country);
  if (f.q) qs.set('q', f.q);
  if (state.filters.includeDemo) qs.set('includeDemo', '1');
  const data = await call(`/api/finance/entries?${qs.toString()}`);
  if (!data) return;
  const body = $('#entriesBody');
  body.innerHTML = data.rows.length ? data.rows.map((row) => `<tr>
      <td>${esc(String(row.at).slice(0, 16).replace('T', ' '))}</td>
      <td><span class="fin-pill ${esc(row.kind)}">${esc(row.kind)}</span></td>
      <td>${esc(sourceLabel(state.overview, row.source))}</td>
      <td>${esc(countryLabel(row.country))}</td>
      <td>${esc(row.currency || 'USD')}</td>
      <td class="num">${esc(usd(row.amountUsd))}${row.settled ? '' : ' ⏳'}</td>
      <td>${esc(row.account || '—')}</td>
      <td class="mono" title="${esc(row.hash)}">${esc(shortHash(row.hash))}</td>
    </tr>`).join('') : `<tr><td colspan="8" class="empty">${esc(tr('noData'))}</td></tr>`;
  $('#entriesMeta').textContent = `${data.total} ${tr('entries')}`;
}

/* -------------------------------- کیف پول -------------------------------- */
function renderWallet(data) {
  const w = data.wallet;
  renderCards('#walletCards', [
    { k: tr('balance'), v: usd(w.balanceUsd) },
    { k: tr('available'), v: usd(w.availableUsd), cls: 'ok' },
    { k: tr('reserved'), v: usd(w.reservedUsd), cls: 'warn' },
    { k: tr('income'), v: usd(w.incomeUsd), cls: 'ok' },
    { k: tr('expense'), v: usd(w.expenseUsd), cls: 'bad' },
  ]);
  $('#accountsList').innerHTML = (w.accounts || []).map((a) => {
    const name = typeof a.name === 'object' ? (a.name[getLang()] || a.name.fa) : a.name;
    return `<div class="fin-account"><span class="k">${esc(name)}</span><span class="v">${esc(usd(a.balanceUsd))}</span></div>`;
  }).join('');

  const body = $('#withdrawalsBody');
  body.innerHTML = data.withdrawals.length ? data.withdrawals.map((w2) => {
    const actions = [];
    if (w2.status === 'requested') actions.push(`<button class="fin-btn sm" data-wd="review" data-id="${esc(w2.id)}" type="button">${esc(tr('review'))}</button>`);
    if (w2.status === 'reviewed') actions.push(`<button class="fin-btn sm primary" data-wd="approve" data-id="${esc(w2.id)}" type="button">${esc(tr('approve'))}</button>`);
    if (['requested', 'reviewed'].includes(w2.status)) actions.push(`<button class="fin-btn sm danger" data-wd="cancel" data-id="${esc(w2.id)}" type="button">${esc(tr('cancel'))}</button>`);
    return `<tr>
      <td>${esc(String(w2.createdAt).slice(0, 10))}</td>
      <td class="num">${esc(usd(w2.amountUsd))}</td>
      <td>${esc(w2.method || '—')}</td>
      <td><span class="fin-pill ${esc(w2.status)}">${esc(tr(w2.status))}</span></td>
      <td>${actions.join(' ') || '—'}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="5" class="empty">${esc(tr('noData'))}</td></tr>`;
}

async function loadWallet() {
  const qs = state.filters.includeDemo ? '?includeDemo=1' : '';
  const data = await call(`/api/finance/wallet${qs}`);
  if (!data) return;
  renderWallet(data);
}

/* ------------------------------ گزارش‌ها ------------------------------ */
function grantRow(grant) {
  return `<tr>
    <td class="mono">${esc(grant.trackingId)}</td>
    <td>${esc(grant.recipientName)}<br><span class="mono">${esc(grant.recipientRole)}</span></td>
    <td class="num">${grant.amountUsd === null ? '—' : esc(usd(grant.amountUsd))}</td>
    <td><span class="fin-pill ${esc(grant.status)}">${esc(tr(grant.status))}</span></td>
    <td>${esc(String(grant.expiresAt).slice(0, 10))}</td>
    <td>
      <button class="fin-btn sm" data-grant="${esc(grant.id)}" type="button">${esc(tr('detail'))}</button>
      ${grant.status === 'active' ? `<button class="fin-btn sm danger" data-revoke="${esc(grant.id)}" type="button">${esc(tr('revoke'))}</button>` : ''}
    </td>
  </tr>`;
}

function renderGrants(data) {
  state.grants = data.grants || [];
  state.sent = data.sent || [];
  if (Array.isArray(data.fields) && data.fields.length) state.fields = data.fields;
  if (Array.isArray(data.permissions) && data.permissions.length) state.permissions = data.permissions;
  buildGrantOptions();
  const body = $('#grantsBody');
  body.innerHTML = state.grants.length
    ? state.grants.map(grantRow).join('')
    : `<tr><td colspan="6" class="empty">${esc(tr('noData'))}</td></tr>`;
  const sent = $('#sentBody');
  sent.innerHTML = state.sent.length ? state.sent.map((row) => `<tr>
      <td class="mono">${esc(row.trackingId)}</td>
      <td class="num">${esc(usd(row.amountUsd))}</td>
      <td>${esc(String(row.sentAt).slice(0, 16).replace('T', ' '))}</td>
      <td>${esc(String(row.expiresAt).slice(0, 10))}</td>
    </tr>`).join('') : `<tr><td colspan="4" class="empty">${esc(tr('noData'))}</td></tr>`;
}

function buildGrantOptions() {
  const fieldsHost = $('#gFields');
  if (fieldsHost && !fieldsHost.dataset.ready) {
    fieldsHost.innerHTML = state.fields.map((key) => `<label><input type="checkbox" class="gField" value="${esc(key)}"${['totals', 'byCountry', 'bySource'].includes(key) ? ' checked' : ''}> ${esc(tr(FIELD_LABEL[key] || key))}</label>`).join('');
    fieldsHost.dataset.ready = '1';
  }
  const permsHost = $('#gPerms');
  if (permsHost && !permsHost.dataset.ready) {
    permsHost.innerHTML = state.permissions.map((key) => `<label><input type="checkbox" class="gPerm" value="${esc(key)}"${key === 'view' ? ' checked disabled' : ''}> ${esc(tr(PERM_LABEL[key] || key))}</label>`).join('');
    permsHost.dataset.ready = '1';
  }
  const sources = $('#gSources');
  if (sources && !sources.dataset.ready && state.overview) {
    fillSelect(sources, (state.overview.incomeSources || []).map((s) => ({
      value: s.code,
      label: typeof s.name === 'object' ? (s.name[getLang()] || s.name.fa) : s.name,
    })));
    sources.dataset.ready = '1';
  }
}

async function loadReports() {
  const data = await call('/api/finance/reports');
  if (!data) return;
  renderGrants(data);
}

async function openGrant(id) {
  const data = await call(`/api/finance/reports/${id}`);
  if (!data) return;
  const { grant, report, recipient } = data;
  const host = $('#grantDetail');
  host.hidden = false;
  const rows = [
    [tr('trackingId'), grant.trackingId],
    [tr('recipientName'), recipient?.name || grant.recipientName],
    [tr('recipientRole'), grant.recipientRole],
    [tr('mode'), grant.mode === 'percent' ? `${grant.percent}%` : usd(grant.fixedUsd)],
    [tr('baseIncome'), usd(report.baseIncomeUsd)],
    [tr('amount'), usd(report.amountUsd)],
    [tr('permissions'), Object.entries(grant.permissions).filter(([, v]) => v).map(([k]) => tr(PERM_LABEL[k] || k)).join(' · ')],
    [tr('fields'), grant.fields.map((f) => tr(FIELD_LABEL[f] || f)).join(' · ')],
    [tr('expiresAt'), String(grant.expiresAt).slice(0, 16).replace('T', ' ')],
    [tr('status'), tr(grant.status)],
    [tr('reportType'), report.type],
  ];
  host.innerHTML = `<h3>${esc(grant.trackingId)}</h3>
    <div class="fin-kv">${rows.map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div>
    <p class="fin-hint">${esc(report.disclaimer?.[getLang()] || report.disclaimer?.fa || '')}</p>
    <div class="fin-actions">
      ${grant.status === 'active' ? `<button class="fin-btn" id="grantAuthorize" type="button">${esc(tr('authorize'))}</button>` : ''}
      <a class="fin-btn ghost" href="/api/finance/export?format=csv" id="grantExport" hidden>CSV</a>
      <button class="fin-btn ghost" id="grantClose" type="button">${esc(tr('close'))}</button>
    </div>`;
  $('#grantClose').onclick = () => { host.hidden = true; host.innerHTML = ''; };
  const authBtn = $('#grantAuthorize');
  if (authBtn) authBtn.onclick = () => authorizeGrant(grant.id);
}

async function authorizeGrant(id) {
  const second = await askSecondFactor('secondFactorTitle');
  if (!second) return;
  const data = await call(`/api/finance/reports/${id}/authorize`, { method: 'POST', body: second });
  if (!data) return;
  const c = data.confirmation;
  const rows = [
    [tr('recipientName'), c.recipient],
    [tr('recipientRole'), c.recipientRole],
    [tr('reportType'), c.reportType],
    [tr('trackingId'), c.trackingId],
    [tr('amount'), usd(c.amountUsd)],
    [tr('permissions'), Object.entries(c.permissions).filter(([, v]) => v).map(([k]) => tr(PERM_LABEL[k] || k)).join(' · ')],
    [tr('expiresAt'), String(c.expiresAt).slice(0, 16).replace('T', ' ')],
  ];
  const ok = await openModal({
    title: tr('confirmSend'),
    okLabel: tr('send'),
    html: `<div class="fin-kv">${rows.map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div>
      <p class="fin-hint">${esc(tr('reportHint'))}</p>`,
  });
  if (!ok) return;
  const sent = await call(`/api/finance/reports/${id}/send`, {
    method: 'POST',
    body: { authorizationId: data.authorization.id, confirm: true },
  });
  if (!sent) return;
  const link = `${window.location.origin}${sent.link}`;
  await openModal({
    title: tr('linkReady'),
    okLabel: tr('copyLink'),
    html: `<p class="fin-hint">${esc(tr('trackingId'))}: <b>${esc(sent.trackingId)}</b></p>
      <code class="fin-secret" id="sentLink">${esc(link)}</code>
      <p class="fin-hint">${esc(tr('expiresAt'))}: ${esc(String(sent.expiresAt).slice(0, 16).replace('T', ' '))}</p>
      <p class="fin-hint"><a class="fin-link" href="${esc(sent.link)}" target="_blank" rel="noopener">${esc(tr('openReport'))}</a></p>`,
  });
  try {
    await navigator.clipboard.writeText(link);
    toast(tr('copied'));
  } catch { /* clipboard unavailable */ }
  toast(tr('sentOk'));
  await loadReports();
  $('#grantDetail').hidden = true;
}

async function revokeGrant(id) {
  const ok = await openModal({
    title: tr('revoke'),
    okLabel: tr('revoke'),
    html: `<p class="fin-hint">${esc(tr('revoke'))} — ${esc(tr('trackingId'))} ${esc(id)}</p>`,
  });
  if (!ok) return;
  const data = await call(`/api/finance/reports/${id}/revoke`, { method: 'POST', body: {} });
  if (!data) return;
  toast(tr('saved'));
  await loadReports();
}

/* --------------------------------- تیم --------------------------------- */
async function loadTeam() {
  const data = await call('/api/finance/team');
  if (!data) return;
  const rows = [
    { ...data.owner, owner: true },
    ...data.team,
  ];
  $('#teamBody').innerHTML = rows.map((user) => `<tr>
      <td>${esc(user.name)}${user.owner ? ' 👑' : ''}</td>
      <td class="mono">${esc(user.email)}</td>
      <td>${esc(user.role)}</td>
      <td><span class="fin-pill ${user.status === 'active' ? 'active' : 'blocked'}">${esc(tr(user.status === 'active' ? 'active' : 'blocked'))}</span></td>
      <td>${user.owner ? '—' : `<button class="fin-btn sm" data-team="${esc(user.id)}" data-status="${user.status === 'active' ? 'blocked' : 'active'}" type="button">${esc(tr(user.status === 'active' ? 'block' : 'unblock'))}</button>`}</td>
    </tr>`).join('');
}

/* -------------------------------- امنیت -------------------------------- */
async function loadSecurity() {
  const data = await call('/api/finance/security');
  if (!data) return;
  const tf = data.twoFactor;
  $('#tfStatus').textContent = `${tr('twoFactor')}: ${tf.enabled ? tr('active') : tr('disable')}`;
  $('#tfSetup').hidden = tf.enabled;
  const chain = data.chain || {};
  $('#secMeta').innerHTML = [
    [tr('twoFactor'), tf.enabled ? '✅' : '❌'],
    ['AES-256-GCM', data.encryption?.algorithm || 'aes-256-gcm'],
    ['keySource', data.encryption?.keySource || '—'],
    [tr('chainOk'), chain.valid ? `${tr('chainOk')} (${chain.entries})` : tr('chainBroken')],
    ['failedTotp', String(data.failedTotp ?? 0)],
    ['deniedAttempts', String(data.deniedAttempts ?? 0)],
    ['backup', data.backup?.mode || '—'],
  ].map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('');
}

/* -------------------------------- حسابرسی -------------------------------- */
async function loadAudit() {
  const data = await call('/api/finance/audit');
  if (!data) return;
  $('#auditBody').innerHTML = data.events.length ? data.events.map((row) => `<tr>
      <td>${esc(String(row.at).slice(0, 16).replace('T', ' '))}</td>
      <td>${esc(row.action)}</td>
      <td class="mono">${esc(row.target || '—')}</td>
      <td class="mono">${esc(row.actorRole || row.actorId || '—')}</td>
    </tr>`).join('') : `<tr><td colspan="4" class="empty">${esc(tr('noData'))}</td></tr>`;
}

/* --------------------------------- تب‌ها --------------------------------- */
const LOADERS = {
  overview: loadOverview,
  entries: loadEntries,
  wallet: loadWallet,
  reports: loadReports,
  team: loadTeam,
  security: loadSecurity,
  audit: loadAudit,
};

async function switchTab(tab) {
  state.tab = tab;
  $$('.fin-tab').forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  $$('.fin-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `panel-${tab}`));
  if (LOADERS[tab]) await LOADERS[tab]();
}

/* --------------------------------- رندر کل -------------------------------- */
function localizeStatic() {
  $$('[data-i18n]').forEach((el) => { el.textContent = tr(el.dataset.i18n); });
  $$('select[data-i18n]').forEach((el) => { el.setAttribute('aria-label', tr(el.dataset.i18n)); });
}

async function renderAll() {
  localizeStatic();
  if (state.overview) renderOverview();
  if (state.tab !== 'overview') await (LOADERS[state.tab] || (() => {}))();
}

/* -------------------------------- اتصال رویدادها -------------------------------- */
function bind() {
  $('#langSelect').value = getLang();
  $('#langSelect').addEventListener('change', (event) => setLang(event.target.value));
  document.addEventListener('langchange', () => { renderAll(); });

  $$('.fin-tab').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  $('#logoutBtn').addEventListener('click', async () => {
    await call('/api/auth/logout', { method: 'POST', body: {} });
    window.location.href = '/';
  });

  $('#ovFilters').addEventListener('submit', async (event) => {
    event.preventDefault();
    state.filters = {
      from: $('#ovFrom').value,
      to: $('#ovTo').value,
      country: $('#ovCountry').value,
      source: $('#ovSource').value,
      bucket: $('#ovBucket').value,
      includeDemo: $('#ovDemo').checked,
    };
    await loadOverview();
  });
  $('#ovReset').addEventListener('click', async () => {
    $('#ovFrom').value = '';
    $('#ovTo').value = '';
    $('#ovCountry').value = '';
    $('#ovSource').value = '';
    $('#ovBucket').value = 'month';
    $('#ovDemo').checked = false;
    state.filters = { from: '', to: '', country: '', source: '', bucket: 'month', includeDemo: false };
    await loadOverview();
  });
  $('#printBtn').addEventListener('click', () => window.print());

  $('#entryForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = {
      kind: $('#entryKind').value,
      source: $('#entrySource').value,
      amountUsd: Number($('#entryAmount').value),
      currency: $('#entryCurrency').value,
      country: $('#entryCountry').value || null,
      account: $('#entryAccount').value,
      settled: $('#entrySettled').checked,
      note: $('#entryNote').value,
    };
    const data = await call('/api/finance/entries', { method: 'POST', body });
    if (!data) return;
    toast(tr('saved'));
    $('#entryAmount').value = '';
    $('#entryNote').value = '';
    await loadEntries();
    await loadOverview();
  });
  $('#entryFilters').addEventListener('submit', async (event) => {
    event.preventDefault();
    state.entryFilters = {
      from: $('#eFrom').value,
      to: $('#eTo').value,
      kind: $('#eKind').value,
      country: $('#eCountry').value,
      q: $('#eQ').value,
    };
    await loadEntries();
  });

  $('#transferForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = await call('/api/finance/transfers', {
      method: 'POST',
      body: {
        from: $('#trFrom').value,
        to: $('#trTo').value,
        amountUsd: Number($('#trAmount').value),
        note: $('#trNote').value,
      },
    });
    if (!data) return;
    toast(tr('saved'));
    $('#trAmount').value = '';
    await loadWallet();
    await loadOverview();
  });

  $('#withdrawForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = await call('/api/finance/withdrawals', {
      method: 'POST',
      body: {
        amountUsd: Number($('#wdAmount').value),
        account: $('#wdAccount').value,
        method: $('#wdMethod').value,
        note: $('#wdNote').value,
      },
    });
    if (!data) return;
    toast(tr('saved'));
    $('#wdAmount').value = '';
    await loadWallet();
  });

  $('#withdrawalsBody').addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-wd]');
    if (!btn) return;
    const action = btn.dataset.wd;
    let body = {};
    if (action === 'approve') {
      const second = await askSecondFactor('secondFactorTitle');
      if (!second) return;
      body = second;
    }
    const data = await call(`/api/finance/withdrawals/${btn.dataset.id}/${action}`, { method: 'POST', body });
    if (!data) return;
    toast(tr('saved'));
    await loadWallet();
  });

  $('#grantForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = $$('.gField').filter((el) => el.checked).map((el) => el.value);
    const permissions = {};
    for (const el of $$('.gPerm')) permissions[el.value] = el.checked || el.disabled;
    const body = {
      recipientName: $('#gName').value,
      recipientRole: $('#gRole').value,
      mode: $('#gMode').value,
      percent: Number($('#gPercent').value),
      fixedUsd: Number($('#gFixed').value),
      countries: [...$('#gCountries').selectedOptions].map((o) => o.value),
      sources: [...$('#gSources').selectedOptions].map((o) => o.value),
      from: $('#gFrom').value || null,
      to: $('#gTo').value || null,
      fields,
      permissions,
      expiresInDays: Number($('#gExpiry').value),
    };
    const data = await call('/api/finance/reports', { method: 'POST', body });
    if (!data) return;
    toast(tr('created'));
    $('#gName').value = '';
    await loadReports();
  });

  $('#grantsBody').addEventListener('click', async (event) => {
    const detail = event.target.closest('[data-grant]');
    if (detail) { await openGrant(detail.dataset.grant); return; }
    const revoke = event.target.closest('[data-revoke]');
    if (revoke) await revokeGrant(revoke.dataset.revoke);
  });

  $('#teamForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = await call('/api/finance/team', {
      method: 'POST',
      body: { name: $('#tName').value, email: $('#tEmail').value, password: $('#tPassword').value },
    });
    if (!data) return;
    toast(tr('created'));
    $('#tName').value = '';
    $('#tEmail').value = '';
    $('#tPassword').value = '';
    await loadTeam();
  });

  $('#teamBody').addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-team]');
    if (!btn) return;
    const data = await call(`/api/finance/team/${btn.dataset.team}`, {
      method: 'PATCH',
      body: { status: btn.dataset.status },
    });
    if (!data) return;
    toast(tr('saved'));
    await loadTeam();
  });

  $('#tfSetupBtn').addEventListener('click', async () => {
    const data = await call('/api/finance/security/2fa/setup', { method: 'POST', body: {} });
    if (!data) return;
    $('#tfSetup').hidden = false;
    $('#tfSecret').textContent = data.secret;
    const link = $('#tfOtpLink');
    link.href = data.otpauth;
  });

  $('#tfEnableForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = await call('/api/finance/security/2fa/enable', {
      method: 'POST',
      body: { code: $('#tfCode').value.trim() },
    });
    if (!data) return;
    toast(tr('saved'));
    $('#tfCode').value = '';
    await loadSecurity();
  });

  $('#tfDisableBtn').addEventListener('click', async () => {
    const second = await askSecondFactor('secondFactorTitle');
    if (!second) return;
    const data = await call('/api/finance/security/2fa/disable', { method: 'POST', body: second });
    if (!data) return;
    toast(tr('saved'));
    await loadSecurity();
  });

  $('#logoutAllBtn').addEventListener('click', async () => {
    const data = await call('/api/finance/security/logout-all', { method: 'POST', body: {} });
    if (!data) return;
    toast(tr('saved'));
  });
}

/* ---------------------------------- شروع ---------------------------------- */
(async function boot() {
  applyDir();
  bind();
  const me = await call('/api/auth/me');
  if (!me) return;
  if (!me.user || me.user.owner !== true) {
    toast(tr('forbidden'), 'error');
    return;
  }
  await loadOverview();
  buildGrantOptions();
  if (state.tab !== 'overview') await switchTab(state.tab);
})();

/* بازار هوشمند — حریم خصوصی: قواعد، لغو رضایت، حذف اطلاعات و فرم عمومی درخواست تبلیغ */
import { api } from './core.js';
import { T, mountPage, toast, esc, industryOptions, countryOptions, langOf } from './p3.js';

const $ = (sel) => document.querySelector(sel);

const RULES = [
  ['rule_1', 'فقط اطلاعات کاری که به‌صورت قانونی و با اجازهٔ صاحب کسب‌وکار به دست آمده ثبت می‌شود.',
    'Only business contact data obtained lawfully with the business owner’s permission is stored.',
    'تُسجّل فقط بيانات العمل التي تم الحصول عليها بشكل قانوني وبإذن صاحب العمل.',
    'Yalnızca işletme sahibinin izniyle yasal olarak elde edilen iş verileri saklanır.'],
  ['rule_2', 'شماره‌های شخصی و اطلاعات گروه‌ها و صفحات خصوصی استخراج نمی‌شوند.',
    'Personal numbers and data from private groups or private pages are never extracted.',
    'لا تُستخرج الأرقام الشخصية أو بيانات المجموعات والصفحات الخاصة.',
    'Kişisel numaralar ve özel grup/sayfa verileri çıkarılmaz.'],
  ['rule_3', 'منبع اطلاعات، تاریخ آخرین بررسی، وضعیت صحت و رضایت تبلیغاتی برای هر رکورد ثبت می‌شود.',
    'Source, last verification date, accuracy status and advertising consent are recorded for each entry.',
    'يُسجّل المصدر وتاريخ آخر تحقق وحالة الدقة والموافقة الإعلانية لكل سجل.',
    'Her kayıt için kaynak, son doğrulama tarihi, doğruluk durumu ve reklam onayı kaydedilir.'],
  ['rule_4', 'عمومی بودن شماره تلفن به‌تنهایی مجوز ارسال پیام تبلیغاتی نیست.',
    'A publicly listed phone number alone is not permission to send advertising messages.',
    'مجرد كون الرقم عاماً لا يُعد إذناً لإرسال رسائل إعلانية.',
    'Telefon numarasının açık olması tek başına reklam mesajı gönderme izni değildir.'],
  ['rule_5', 'ارسال انبوه پیام در واتساپ، تلگرام، پیامک یا شبکه‌های اجتماعی در این سامانه فعال نیست.',
    'Bulk messaging on WhatsApp, Telegram, SMS or social networks is not enabled in this system.',
    'المراسلة الجماعية عبر واتساب وتيليجرام والرسائل والشبكات غير مفعّلة في هذا النظام.',
    'WhatsApp, Telegram, SMS veya sosyal ağlarda toplu mesajlaşma bu sistemde etkin değildir.'],
  ['rule_6', 'هر شخص می‌تواند دریافت تبلیغات را لغو کند یا حذف اطلاعاتش را درخواست دهد؛ درخواست‌ها در گزارش حسابرسی ثبت می‌شوند.',
    'Anyone can withdraw advertising consent or request deletion; every request is recorded in the audit log.',
    'يمكن لأي شخص إلغاء الموافقة الإعلانية أو طلب حذف بياناته؛ وتُسجّل الطلبات في سجل التدقيق.',
    'Herkes reklam onayını geri çekebilir veya silme talep edebilir; tüm talepler denetim kaydına yazılır.'],
  ['rule_7', 'دسترسی به اطلاعات تماس بر اساس نقش و سطح دسترسی کنترل می‌شود و نمایش آن حسابرسی می‌شود.',
    'Contact access is role-based and gated by explicit permission; every reveal is audited.',
    'الوصول إلى بيانات الاتصال محكوم بالدور والصلاحية الصريحة، وكل عرض يُسجّل.',
    'İletişim erişimi role ve açık izne bağlıdır; her görüntüleme denetlenir.'],
];

const LANG_IDX = { fa: 0, en: 1, ar: 2, tr: 3 };
const li = () => LANG_IDX[langOf()] ?? 0;

const NETWORK_LABEL = {
  instagram: ['اینستاگرام', 'Instagram', 'إنستغرام', 'Instagram'],
  telegram: ['تلگرام', 'Telegram', 'تيليجرام', 'Telegram'],
  youtube: ['یوتیوب', 'YouTube', 'يوتيوب', 'YouTube'],
  google: ['گوگل', 'Google', 'جوجل', 'Google'],
  website: ['وب‌سایت', 'Website', 'الموقع', 'Web sitesi'],
  sms: ['پیامک', 'SMS', 'رسائل نصية', 'SMS'],
};

const FORMAT_LABEL = {
  post: ['پست', 'Post', 'منشور', 'Gönderi'],
  story: ['استوری', 'Story', 'قصة', 'Hikâye'],
  reel: ['ریلز', 'Reel', 'ريل', 'Reel'],
  video: ['ویدئو', 'Video', 'فيديو', 'Video'],
  banner: ['بنر', 'Banner', 'لافتة', 'Afiş'],
  poster: ['پوستر', 'Poster', 'ملصق', 'Poster'],
};

const ERRORS = {
  phone_invalid: 'شماره تلفن معتبر نیست. / Invalid phone number.',
  duplicate_lead: 'این درخواست قبلاً ثبت شده است. / This request already exists.',
  advertising_consent_required: 'رضایت تبلیغاتی الزامی است. / Advertising consent is required.',
  name_required: 'نام الزامی است. / Name required.',
  business_name_required: 'نام کسب‌وکار الزامی است. / Business name required.',
  city_required: 'شهر الزامی است. / City required.',
  request_invalid: 'اطلاعات درخواست کامل نیست. / Request details are incomplete.',
  request_not_found: 'رکوردی با این مشخصات پیدا نشد. / No matching record found.',
};
const errorText = (code) => ERRORS[code] || code;

const setStatus = (selector, text, tone = '') => {
  const el = $(selector);
  if (!el) return;
  el.textContent = text || '';
  el.style.color = tone === 'error' ? '#b42318' : tone === 'ok' ? '#0b5a4c' : '';
};

function renderRules() {
  const index = li();
  $('#rules').innerHTML = RULES.map((row) => `<li>${esc(row[index] || row[1])}</li>`).join('');
}

function fillCatalog(catalog) {
  const index0 = li();
  const networkOptions = (catalog.networks || []).map((slug) => {
    const label = NETWORK_LABEL[slug];
    return `<option value="${esc(slug)}">${esc(label ? label[index0] : slug)}</option>`;
  }).join('');
  const formatOptions = (catalog.formats || []).map((slug) => {
    const label = FORMAT_LABEL[slug];
    return `<option value="${esc(slug)}">${esc(label ? label[index0] : slug)}</option>`;
  }).join('');

  $('#rCountry').innerHTML = countryOptions(catalog.countries || []);
  $('#rIndustry').innerHTML = industryOptions(catalog.industries || []);
  $('#rNetwork').innerHTML = networkOptions;
  $('#rFormat').innerHTML = formatOptions;
}

async function loadCatalog() {
  try {
    const catalog = await api('/api/directory/catalog');
    fillCatalog(catalog);
  } catch {
    /* فرم‌ها بدون فهرست هم کار می‌کنند */
  }
}

async function submitOptOut(event) {
  event.preventDefault();
  setStatus('#optStatus', T('loading'));
  try {
    const data = await api('/api/privacy/opt-out', {
      method: 'POST',
      body: {
        phone: $('#optPhone').value.trim(),
        channel: $('#optChannel').value,
        reason: $('#optReason').value.trim(),
      },
    });
    setStatus('#optStatus', `${T('opt_out_done')} (${data.affected})`, 'ok');
    $('#optOutForm').reset();
  } catch (err) {
    setStatus('#optStatus', errorText(err.message), 'error');
  }
}

async function submitDeletion(event) {
  event.preventDefault();
  setStatus('#delStatus', T('loading'));
  const entityId = $('#delEntity').value.trim();
  try {
    await api('/api/privacy/deletion-request', {
      method: 'POST',
      body: {
        phone: $('#delPhone').value.trim(),
        entityId: entityId || undefined,
        entityType: 'business',
        reason: $('#delReason').value.trim(),
      },
    });
    setStatus('#delStatus', T('deletion_done'), 'ok');
    $('#deleteForm').reset();
  } catch (err) {
    setStatus('#delStatus', errorText(err.message), 'error');
  }
}

async function submitAdRequest(event) {
  event.preventDefault();
  setStatus('#reqStatus', T('loading'));
  try {
    await api('/api/public/ad-request', {
      method: 'POST',
      body: {
        name: $('#rName').value.trim(),
        businessName: $('#rBusiness').value.trim(),
        phone: $('#rPhone').value.trim(),
        country: $('#rCountry').value,
        city: $('#rCity').value.trim(),
        industry: $('#rIndustry').value,
        networks: [$('#rNetwork').value],
        format: $('#rFormat').value,
        budgetUsd: Number($('#rBudget').value),
        durationDays: Number($('#rDuration').value),
        preferredContact: 'phone',
        consent: $('#rConsent').checked,
      },
    });
    setStatus('#reqStatus', T('ad_request_done'), 'ok');
    $('#adRequestForm').reset();
  } catch (err) {
    setStatus('#reqStatus', errorText(err.message), 'error');
  }
}

function init() {
  mountPage();
  renderRules();
  loadCatalog();

  $('#optOutForm').addEventListener('submit', submitOptOut);
  $('#deleteForm').addEventListener('submit', submitDeletion);
  $('#adRequestForm').addEventListener('submit', submitAdRequest);
  window.addEventListener('lang-changed', () => {
    mountPage();
    renderRules();
    loadCatalog();
  });
}

init();

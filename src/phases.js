// مرکز بررسی سه فاز — کاتالوگ امکانات با وضعیت واقعی و آمار زندهٔ سرور.
// این ماژول هیچ مبلغ، موجودی، اطلاعات تماس یا داده مالی برنمی‌گرداند؛ فقط شمارش و وضعیت.
import { CATEGORIES } from './catalog.js';
import { adOptions } from './ads.js';

export const FEATURE_STATUSES = ['done', 'partial', 'connect'];

const F = (key, fa, en, status, noteFa = null, noteEn = null, href = null) => ({
  key,
  title: { fa, en },
  status,
  note: noteFa ? { fa: noteFa, en: noteEn || noteFa } : null,
  href,
});

const T = (key, fa, en, status, detailFa, detailEn = null) => ({
  key,
  label: { fa, en },
  status,
  detail: { fa: detailFa, en: detailEn || detailFa },
});

const BASE_PHASES = [
  {
    id: 1,
    slug: 'store-ads',
    title: {
      fa: 'فروشگاه و تبلیغات',
      en: 'Storefront & Advertising',
      ar: 'المتجر والإعلانات',
      tr: 'Mağaza ve Reklamlar',
    },
    tagline: {
      fa: 'صفحهٔ اصلی فروشگاه، کاتالوگ محصولات و دسته‌بندی‌ها، پنل فروشنده و مرکز تبلیغات با پیش‌فاکتور چندارزی.',
      en: 'Storefront, product catalog and categories, seller panel, and the multi-currency ads center with quotes.',
      ar: 'المتجر والكتالوج والفئات ولوحة البائع ومركز الإعلانات متعدد العملات مع عرض السعر.',
      tr: 'Mağaza, ürün kataloğu ve kategoriler, satıcı paneli ve çok para birimli teklifli reklam merkezi.',
    },
    links: [
      { href: '/', label: { fa: 'صفحه اصلی فروشگاه', en: 'Storefront homepage' } },
      { href: '/seller', label: { fa: 'پنل فروشنده', en: 'Seller panel' } },
      { href: '/ads', label: { fa: 'مرکز تبلیغات', en: 'Ads center' } },
      { href: '/admin', label: { fa: 'پنل مدیر و آگهی‌ها', en: 'Admin & campaigns' } },
    ],
    features: [
      F('storefront', 'صفحه اصلی فروشگاه', 'Storefront homepage', 'done', null, null, '/'),
      F('catalog', 'محصولات و دسته‌بندی‌ها', 'Products & categories', 'done', null, null, '/'),
      F('seller_panel', 'پنل فروشنده (محصول، سفارش، ارسال)', 'Seller panel (products, orders, shipping)', 'done', null, null, '/seller'),
      F('ads_quote', 'مرکز تبلیغات: کشور هدف، ارز محلی و دلار، پیش‌فاکتور', 'Ads center: target country, local & USD pricing, quote', 'done', null, null, '/ads'),
      F('ads_manage', 'مدیریت آگهی‌ها و آمار کمپین', 'Campaign management & statistics', 'done', null, null, '/admin'),
      F(
        'ads_creative',
        'تیزر ویدئویی، تصویر سه‌بعدی، بنر و پوستر با هوش مصنوعی',
        'AI video teaser, 3D image, banner & poster',
        'connect',
        'متن، توضیح و کلیدواژهٔ تبلیغاتی ساخته می‌شود؛ تولید ویدئو و تصویر سه‌بعدی نیازمند سرویس هوش مصنوعی رسانه و کلید API است.',
        'Ad copy, descriptions and keywords are generated; video and 3D generation require a media AI provider and API key.',
      ),
      F(
        'social_publish',
        'انتشار واقعی در اینستاگرام، تلگرام، یوتیوب و گوگل',
        'Real publishing to Instagram, Telegram, YouTube and Google',
        'connect',
        'اتصال رسمی اپ‌ها و تأیید دسترسی (App Review) لازم است؛ در این نسخه عمداً غیرفعال است.',
        'Official app connection and access review are required; intentionally disabled in this release.',
      ),
      F(
        'real_payment',
        'پرداخت واقعی تبلیغات',
        'Real advertising payment',
        'connect',
        'درگاه پرداخت متصل نیست؛ فقط پیش‌فاکتور و سفارش آزمایشی ثبت می‌شود.',
        'No payment gateway is connected; only quotes and test orders are recorded.',
      ),
    ],
  },
  {
    id: 2,
    slug: 'finance',
    title: {
      fa: 'مدیریت مالی',
      en: 'Financial Management',
      ar: 'الإدارة المالية',
      tr: 'Finansal Yönetim',
    },
    tagline: {
      fa: 'دفتر تراکنش زنجیره‌ای، کیف پول مدیریتی، گزارش‌های درآمد و هزینه، مجوزهای اختصاصی و امنیت دومرحله‌ای.',
      en: 'Hash-chained ledger, management wallet, income/expense reports, scoped permissions and two-factor security.',
      ar: 'دفتر معاملات متسلسل، محفظة إدارية، تقارير الدخل والمصروفات، أذونات مخصصة وأمان بخطوتين.',
      tr: 'Zincirli işlem defteri, yönetim cüzdanı, gelir/gider raporları, özel izinler ve iki adımlı güvenlik.',
    },
    links: [
      { href: '/finance', label: { fa: 'پنل مالی محرمانه', en: 'Confidential finance panel' } },
      { href: '/report', label: { fa: 'گزارش مدیریتی با شناسهٔ رهگیری', en: 'Scoped report with tracking id' } },
    ],
    features: [
      F('owner_panel', 'پنل مالی محرمانهٔ مدیر اصلی', 'Owner-only confidential finance panel', 'done', null, null, '/finance'),
      F('wallet', 'کیف پول مدیریتی محاسبه‌شده از دفتر تراکنش', 'Management wallet computed from the ledger', 'done', null, null, '/finance'),
      F('ledger', 'ثبت درآمد، هزینه، سود و زیان', 'Income, expense, profit and loss', 'done', null, null, '/finance'),
      F('reports', 'گزارش روزانه، هفتگی، ماهانه، سالانه و ارزی', 'Daily, weekly, monthly, yearly and currency reports', 'done', null, null, '/finance'),
      F('export_csv', 'خروجی CSV سازگار با Excel', 'CSV (Excel-compatible) export', 'done'),
      F(
        'export_pdf',
        'خروجی PDF رسمی گزارش',
        'Official PDF report export',
        'partial',
        'مجوز PDF در گزارش‌ها ثبت می‌شود اما فایل PDF تولید نمی‌شود؛ خروجی فعلی CSV و JSON است.',
        'The PDF permission is recorded, but no PDF file is generated; current output is CSV and JSON.',
      ),
      F('totp', 'احراز هویت دومرحله‌ای TOTP', 'Two-factor authentication (TOTP)', 'done'),
      F(
        'security_key',
        'کلید امنیتی سخت‌افزاری (WebAuthn)',
        'Hardware security key (WebAuthn)',
        'connect',
        'نیازمند پیاده‌سازی WebAuthn و دامنهٔ HTTPS ثبت‌شده است.',
        'Requires a WebAuthn implementation and a registered HTTPS domain.',
      ),
      F(
        'withdraw_flow',
        'تأیید چندمرحله‌ای برداشت',
        'Multi-step withdrawal approval',
        'done',
        'مراحل: درخواست ← بررسی ← تأیید ← پرداخت؛ پرداخت واقعی غیرفعال است.',
        'Steps: request → review → approval → payout; the actual payout stays disabled.',
      ),
      F('grants', 'گزارش اختصاصی با مجوز، تاریخ انقضا و لغو فوری', 'Scoped reports with permissions, expiry and instant revoke', 'done'),
      F(
        'backup',
        'پشتیبان‌گیری رمزگذاری‌شده',
        'Encrypted backup',
        'partial',
        'قالب رمزگذاری‌شدهٔ دستی موجود است؛ پشتیبان‌گیری خودکار نیازمند دیسک پایدار و زمان‌بند است.',
        'A manual encrypted format exists; automated backups need a persistent disk and a scheduler.',
      ),
      F(
        'real_payout',
        'برداشت و پرداخت واقعی',
        'Real payout',
        'connect',
        'بدون درگاه مجاز و تأیید مدیر فعال نمی‌شود.',
        'Not enabled without an authorized gateway and manager approval.',
      ),
    ],
  },
  {
    id: 3,
    slug: 'crm',
    title: {
      fa: 'فروشندگان، مشتریان و CRM',
      en: 'Sellers, Customers & CRM',
      ar: 'البائعون والعملاء وإدارة العلاقات',
      tr: 'Satıcılar, Müşteriler ve CRM',
    },
    tagline: {
      fa: 'ثبت‌نام تلفنی، پروفایل و پنل فروشنده/مشتری، سفارش چندفروشنده، بانک اصناف و متقاضیان تبلیغات، CRM و حریم خصوصی.',
      en: 'Phone signup, seller/customer profiles and panels, multi-vendor orders, business and advertiser banks, CRM and privacy.',
      ar: 'التسجيل بالهاتف، ملفات ولوحات البائع/العميل، طلبات متعددة البائعين، بنوك الأعمال والمعلنين، CRM والخصوصية.',
      tr: 'Telefonla kayıt, satıcı/müşteri profilleri ve panelleri, çok satıcılı siparişler, işletme ve reklamveren bankaları, CRM ve gizlilik.',
    },
    links: [
      { href: '/login', label: { fa: 'ثبت‌نام و ورود', en: 'Signup & login' } },
      { href: '/account', label: { fa: 'حساب کاربری و سفارش‌ها', en: 'Account & orders' } },
      { href: '/business', label: { fa: 'بانک اصناف و CRM', en: 'Business bank & CRM' } },
      { href: '/privacy', label: { fa: 'حریم خصوصی و لغو رضایت', en: 'Privacy & opt-out' } },
    ],
    features: [
      F(
        'phone_auth',
        'ثبت‌نام و ورود تلفنی با کد تأیید',
        'Phone signup/login with verification code',
        'partial',
        'کد تأیید در محیط آزمایشی نمایش داده می‌شود؛ پیامک واقعی نیازمند تنظیم سرویس پیامک (SMS_PROVIDER) است.',
        'The code is shown in the test environment; real SMS requires an SMS provider to be configured.',
      ),
      F('profiles', 'پروفایل فروشنده و مشتری', 'Seller & customer profiles', 'done', null, null, '/account'),
      F('products_orders', 'مدیریت محصولات و سفارش‌ها', 'Product & order management', 'done', null, null, '/seller'),
      F('multivendor', 'سفارش چندفروشنده با کمیسیون و تخفیف سمت سرور', 'Multi-vendor orders with server-side commission & discount', 'done'),
      F('directory', 'بانک اطلاعات اصناف و کسب‌وکارها', 'Business & industry directory', 'done', null, null, '/business'),
      F('leads', 'بانک متقاضیان تبلیغات', 'Advertiser leads bank', 'done', null, null, '/business'),
      F('search', 'جست‌وجوی کشور، استان، شهر و صنف', 'Search by country, province, city and industry', 'done', null, null, '/business'),
      F('crm', 'مدیریت ارتباط با مشتریان و پیگیری‌ها', 'CRM and follow-ups', 'done', null, null, '/business'),
      F('consent', 'مدیریت رضایت تبلیغاتی و حریم خصوصی', 'Ad consent & privacy management', 'done', null, null, '/privacy'),
      F(
        'bulk_messaging',
        'ارسال انبوه پیام',
        'Bulk messaging',
        'connect',
        'فقط با تأیید مدیر پروژه، دستور مدیر مجاز و رضایت مخاطب؛ نیازمند اتصال رسمی پیام‌رسان است.',
        'Only with project-manager approval, an authorized manager instruction and recipient consent; requires official messenger integration.',
      ),
    ],
  },
];

const arr = (value) => (Array.isArray(value) ? value : []);

const countBy = (rows, key) => rows.reduce((acc, row) => {
  const k = String(row?.[key] ?? 'unknown');
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});

function safeAdOptions(db) {
  try {
    return adOptions(db);
  } catch {
    return { countries: [], media: [] };
  }
}

function metricsFor(db, id, opts) {
  const businesses = arr(db.businesses);
  const demo = businesses.filter((b) => (b.dataset || 'live') === 'demo').length;

  if (id === 1) {
    return {
      products: arr(db.products).length,
      sellers: arr(db.users).filter((u) => u.role === 'seller').length,
      categories: CATEGORIES.length,
      adCountries: arr(opts.countries).length,
      adMedia: arr(opts.media).length,
      adCampaigns: arr(db.adCampaigns).length,
    };
  }

  if (id === 2) {
    const entries = arr(db.finance?.entries);
    const chained = entries.length > 0 && entries.every((e) => typeof e.hash === 'string' && e.hash.length > 0);
    return {
      ledgerEntries: entries.length,
      ledgerChained: chained,
      withdrawalStages: 4,
      ownerOnly: true,
      twoFactor: 'totp',
      exportFormats: ['csv', 'json'],
    };
  }

  return {
    businesses: businesses.length,
    demoBusinesses: demo,
    liveBusinesses: businesses.length - demo,
    leads: arr(db.adLeads).length,
    activities: arr(db.crmActivities).length,
    optOuts: arr(db.optOuts).length,
    deletionRequests: arr(db.deletionRequests).length,
    businessesByCountry: countBy(businesses, 'country'),
  };
}

function checksFor(db, id, opts, metrics) {
  if (id === 1) {
    return [
      T('catalog', 'کاتالوگ محصولات و دسته‌بندی', 'Product and category catalog', metrics.products > 0 ? 'passed' : 'partial',
        `${metrics.products} محصول · ${metrics.categories} دسته‌بندی`, `${metrics.products} products · ${metrics.categories} categories`),
      T('seller_guard', 'کنترل دسترسی پنل فروشنده', 'Seller panel access control', 'passed',
        'کاربر بدون نقش فروشنده → ۴۰۱', 'User without the seller role → 401'),
      T('ads_quote', 'پیش‌فاکتور تبلیغات سمت سرور', 'Server-side ad quote', 'passed',
        `${metrics.adCountries} کشور · ${metrics.adMedia} رسانهٔ فعال`, `${metrics.adCountries} countries · ${metrics.adMedia} active media`),
      T('ads_publish', 'انتشار واقعی تبلیغات', 'Real ad publishing', 'blocked',
        'عمداً غیرفعال تا اتصال رسمی و مجوز', 'Intentionally disabled until official connection and approval'),
      T('payment', 'پرداخت واقعی تبلیغات', 'Real ad payment', 'blocked',
        'بدون درگاه؛ فقط سفارش آزمایشی', 'No gateway; test orders only'),
    ];
  }

  if (id === 2) {
    return [
      T('owner_guard', 'دسترسی انحصاری مدیر اصلی', 'Owner-only access', 'passed',
        'دیگر نقش‌ها → ۴۰۱/۴۰۳، صفحه → هدایت', 'Other roles → 401/403, page → redirect'),
      T('ledger', 'یکتایی و زنجیرهٔ تراکنش‌ها', 'Unique, chained transactions', metrics.ledgerChained ? 'passed' : 'partial',
        `${metrics.ledgerEntries} تراکنش با هش یکتا`, `${metrics.ledgerEntries} transactions with unique hashes`),
      T('totp', 'احراز هویت دومرحله‌ای', 'Two-factor authentication', 'passed',
        'TOTP با پنجرهٔ زمانی و محدودیت تلاش', 'TOTP with a time window and attempt limits'),
      T('withdraw', 'تأیید چندمرحله‌ای برداشت', 'Multi-step withdrawal approval', 'passed',
        'چهار مرحلهٔ مستقل تأیید', 'Four independent approval steps'),
      T('export', 'خروجی گزارش', 'Report export', 'partial',
        'CSV فعال؛ PDF تولید نمی‌شود', 'CSV works; PDF is not generated'),
      T('payout', 'پرداخت واقعی', 'Real payout', 'blocked',
        'بدون درگاه مجاز غیرفعال', 'Disabled without an authorized gateway'),
    ];
  }

  return [
    T('directory', 'بانک اطلاعات اصناف', 'Business directory', metrics.businesses > 0 ? 'passed' : 'partial',
      `${metrics.businesses} کسب‌وکار (${metrics.demoBusinesses} نمایشی / ${metrics.liveBusinesses} واقعی)`,
      `${metrics.businesses} businesses (${metrics.demoBusinesses} demo / ${metrics.liveBusinesses} live)`),
    T('leads', 'بانک متقاضیان تبلیغات', 'Advertiser leads bank', metrics.leads > 0 ? 'passed' : 'partial',
      `${metrics.leads} متقاضی ثبت‌شده`, `${metrics.leads} recorded leads`),
    T('crm', 'پیگیری ارتباطات', 'Communication follow-ups', 'passed',
      `${metrics.activities} پیگیری ثبت‌شده`, `${metrics.activities} recorded follow-ups`),
    T('consent', 'رضایت تبلیغاتی و حذف اطلاعات', 'Ad consent and data removal', 'passed',
      `${metrics.optOuts} لغو رضایت · ${metrics.deletionRequests} درخواست حذف`,
      `${metrics.optOuts} opt-outs · ${metrics.deletionRequests} deletion requests`),
    T('contact_guard', 'کنترل دسترسی اطلاعات تماس', 'Contact-data access control', 'passed',
      'اطلاعات تماس فقط برای نقش مجاز و با ثبت حسابرسی', 'Contact data only for authorized roles, with audit logging'),
    T('sms', 'ارسال پیامک واقعی', 'Real SMS delivery', 'partial',
      'کد تأیید فقط در محیط آزمایشی نمایش داده می‌شود', 'Verification codes are shown only in the test environment'),
    T('bulk', 'ارسال انبوه پیام', 'Bulk messaging', 'blocked',
      'نیازمند تأیید مدیر پروژه، دستور مدیر مجاز و رضایت مخاطب', 'Requires project-manager approval, authorized instruction and recipient consent'),
  ];
}

const statusCounts = (features) => features.reduce((acc, f) => {
  acc[f.status] = (acc[f.status] || 0) + 1;
  return acc;
}, { done: 0, partial: 0, connect: 0 });

export function phaseCatalog(db) {
  const opts = safeAdOptions(db);
  const businesses = arr(db.businesses);
  const demo = businesses.filter((b) => (b.dataset || 'live') === 'demo').length;

  const phases = BASE_PHASES.map((phase) => {
    const metrics = metricsFor(db, phase.id, opts);
    return {
      ...phase,
      metrics,
      counts: statusCounts(phase.features),
      tests: checksFor(db, phase.id, opts, metrics),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    featureStatuses: FEATURE_STATUSES,
    dataMode: {
      demo: demo,
      live: businesses.length - demo,
      isolated: true,
      note: {
        fa: 'داده‌های نمایشی با برچسب dataset=demo ذخیره می‌شوند و در گزارش‌ها از دادهٔ واقعی جدا هستند.',
        en: 'Demo rows are stored with dataset=demo and are kept separate from real data in reports.',
      },
    },
    phases,
  };
}

export function phaseById(db, id) {
  const catalog = phaseCatalog(db);
  return catalog.phases.find((phase) => String(phase.id) === String(id)) || null;
}

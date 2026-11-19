// موتور قیمت‌گذاری و چرخهٔ سفارش تبلیغات.
// همهٔ محاسبات سمت سرور انجام می‌شود؛ ورودی کاربر فقط انتخاب است، نه قیمت.
// انتشار واقعی در شبکه‌های اجتماعی و پرداخت آنلاین در این فاز عمداً غیرفعال است.

import {
  currencyMeta, fromUsd, isCurrency, rateOf, ratesSnapshot, roundLocal, roundUsd,
} from './money.js';

/* --------------------------------- کشورها --------------------------------- */

export const AD_COUNTRIES = [
  {
    code: 'IR', currency: 'IRR', vat: 0.10, priceIndex: 0.55, flag: '🇮🇷',
    name: { fa: 'ایران', en: 'Iran', ar: 'إيران', tr: 'İran' },
  },
  {
    code: 'AE', currency: 'AED', vat: 0.05, priceIndex: 1.00, flag: '🇦🇪',
    name: { fa: 'امارات متحده عربی', en: 'United Arab Emirates', ar: 'الإمارات العربية المتحدة', tr: 'Birleşik Arap Emirlikleri' },
  },
  {
    code: 'SA', currency: 'SAR', vat: 0.15, priceIndex: 1.05, flag: '🇸🇦',
    name: { fa: 'عربستان سعودی', en: 'Saudi Arabia', ar: 'المملكة العربية السعودية', tr: 'Suudi Arabistan' },
  },
  {
    code: 'EG', currency: 'EGP', vat: 0.14, priceIndex: 0.60, flag: '🇪🇬',
    name: { fa: 'مصر', en: 'Egypt', ar: 'مصر', tr: 'Mısır' },
  },
  {
    code: 'IQ', currency: 'IQD', vat: 0, priceIndex: 0.50, flag: '🇮🇶',
    name: { fa: 'عراق', en: 'Iraq', ar: 'العراق', tr: 'Irak' },
  },
  {
    code: 'KW', currency: 'KWD', vat: 0, priceIndex: 1.10, flag: '🇰🇼',
    name: { fa: 'کویت', en: 'Kuwait', ar: 'الكويت', tr: 'Kuveyt' },
  },
  {
    code: 'QA', currency: 'QAR', vat: 0, priceIndex: 1.05, flag: '🇶🇦',
    name: { fa: 'قطر', en: 'Qatar', ar: 'قطر', tr: 'Katar' },
  },
  {
    code: 'OM', currency: 'OMR', vat: 0.05, priceIndex: 0.95, flag: '🇴🇲',
    name: { fa: 'عمان', en: 'Oman', ar: 'عُمان', tr: 'Umman' },
  },
  {
    code: 'JO', currency: 'JOD', vat: 0.16, priceIndex: 0.70, flag: '🇯🇴',
    name: { fa: 'اردن', en: 'Jordan', ar: 'الأردن', tr: 'Ürdün' },
  },
];

/* --------------------------------- رسانه‌ها --------------------------------- */

export const AD_MEDIA = [
  {
    code: 'instagram', icon: '📸', baseDailyUsd: 12, minDays: 3, publishing: false,
    name: { fa: 'اینستاگرام', en: 'Instagram', ar: 'إنستغرام', tr: 'Instagram' },
  },
  {
    code: 'telegram', icon: '✈️', baseDailyUsd: 6, minDays: 3, publishing: false,
    name: { fa: 'تلگرام', en: 'Telegram', ar: 'تلغرام', tr: 'Telegram' },
  },
  {
    code: 'youtube', icon: '▶️', baseDailyUsd: 20, minDays: 7, publishing: false,
    name: { fa: 'یوتیوب', en: 'YouTube', ar: 'يوتيوب', tr: 'YouTube' },
  },
  {
    code: 'google', icon: '🔎', baseDailyUsd: 25, minDays: 7, publishing: false,
    name: { fa: 'گوگل', en: 'Google', ar: 'جوجل', tr: 'Google' },
  },
  {
    code: 'inapp', icon: '🛍️', baseDailyUsd: 5, minDays: 1, publishing: true,
    name: { fa: 'درون بازار هوشمند', en: 'Inside Smart Bazaar', ar: 'داخل السوق الذكي', tr: 'Smart Bazaar içinde' },
  },
];

/* -------------------------------- محل انتشار -------------------------------- */

export const AD_PLACEMENTS = [
  {
    code: 'home_slider', icon: '🎠', multiplier: 1.40,
    name: { fa: 'اسلایدر صفحهٔ اصلی', en: 'Home slider', ar: 'شريط الصفحة الرئيسية', tr: 'Ana sayfa slaytı' },
  },
  {
    code: 'home_top', icon: '🏠', multiplier: 1.30,
    name: { fa: 'بالای صفحهٔ اصلی', en: 'Top of home', ar: 'أعلى الصفحة الرئيسية', tr: 'Ana sayfa üstü' },
  },
  {
    code: 'search', icon: '🔍', multiplier: 1.20,
    name: { fa: 'نتایج جست‌وجو', en: 'Search results', ar: 'نتائج البحث', tr: 'Arama sonuçları' },
  },
  {
    code: 'product_page', icon: '📦', multiplier: 1.15,
    name: { fa: 'صفحهٔ محصول', en: 'Product page', ar: 'صفحة المنتج', tr: 'Ürün sayfası' },
  },
  {
    code: 'category', icon: '🗂️', multiplier: 1.10,
    name: { fa: 'صفحهٔ دسته‌بندی', en: 'Category page', ar: 'صفحة الفئة', tr: 'Kategori sayfası' },
  },
  {
    code: 'footer', icon: '⬇️', multiplier: 0.80,
    name: { fa: 'پانوشت سایت', en: 'Site footer', ar: 'تذييل الموقع', tr: 'Site alt bilgisi' },
  },
];

/* ------------------------------- نوع محتوا ------------------------------- */

export const AD_CREATIVES = [
  {
    code: 'banner', icon: '🖼️', addonUsd: 0, multiplier: 1, instant: true,
    name: { fa: 'بنر گرافیکی', en: 'Graphic banner', ar: 'بانر رسومي', tr: 'Grafik afiş' },
  },
  {
    code: 'poster', icon: '📄', addonUsd: 8, multiplier: 1.05, instant: true,
    name: { fa: 'پوستر تبلیغاتی', en: 'Ad poster', ar: 'ملصق إعلاني', tr: 'Reklam posteri' },
  },
  {
    code: 'video', icon: '🎬', addonUsd: 40, multiplier: 1.25, instant: false,
    name: { fa: 'تیزر ویدئویی', en: 'Video teaser', ar: 'إعلان فيديو', tr: 'Video tanıtım' },
  },
  {
    code: 'three_d', icon: '🧊', addonUsd: 60, multiplier: 1.35, instant: false,
    name: { fa: 'نمای سه‌بعدی ۳۶۰°', en: '3D 360° view', ar: 'عرض ثلاثي الأبعاد', tr: '3B 360° görünüm' },
  },
];

/* --------------------------------- مدت‌ها --------------------------------- */

export const AD_DURATIONS = [
  { days: 3, discount: 1.00 },
  { days: 7, discount: 0.95 },
  { days: 14, discount: 0.90 },
  { days: 30, discount: 0.85 },
  { days: 60, discount: 0.80 },
];

/* ------------------------------ چرخهٔ وضعیت ------------------------------ */

export const AD_STATUSES = [
  'draft', 'awaiting_payment', 'in_review', 'scheduled', 'active', 'completed', 'canceled', 'rejected',
];

export const AD_STATUS_FLOW = {
  draft: ['awaiting_payment', 'canceled'],
  awaiting_payment: ['in_review', 'canceled'],
  in_review: ['scheduled', 'rejected', 'canceled'],
  scheduled: ['active', 'canceled'],
  active: ['completed', 'canceled'],
  completed: [],
  canceled: [],
  rejected: ['draft'],
};

export function canTransition(from, to) {
  return (AD_STATUS_FLOW[from] || []).includes(to);
}

/* ------------------------------- خطای ورودی ------------------------------- */

export class AdInputError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'AdInputError';
    this.code = code;
    this.status = status;
  }
}

const asArray = (value) => (Array.isArray(value) ? value : String(value || '').split(','));

/** اعتبارسنجی و نرمال‌سازی ورودی قیمت‌گذاری */
export function normalizeAdInput(input = {}) {
  const countryCode = String(input.country || '').toUpperCase();
  const country = AD_COUNTRIES.find((c) => c.code === countryCode);
  if (!country) throw new AdInputError('country_invalid');

  const mediaCodes = [...new Set(asArray(input.media).map((m) => String(m).trim()).filter(Boolean))];
  const media = mediaCodes
    .map((code) => AD_MEDIA.find((m) => m.code === code))
    .filter(Boolean);
  if (!media.length) throw new AdInputError('media_required');
  if (media.length > 3) throw new AdInputError('media_too_many');

  const placement = AD_PLACEMENTS.find((p) => p.code === input.placement) || AD_PLACEMENTS[0];
  const creative = AD_CREATIVES.find((c) => c.code === input.creative) || AD_CREATIVES[0];

  const durationDays = Number(input.durationDays ?? input.days);
  const duration = AD_DURATIONS.find((d) => d.days === durationDays);
  if (!duration) throw new AdInputError('duration_invalid');

  const shortest = Math.max(...media.map((m) => m.minDays));
  if (duration.days < shortest) throw new AdInputError('duration_too_short');

  const requested = String(input.currency || '').toUpperCase();
  const currency = isCurrency(requested) ? requested : country.currency;

  return { country, media, placement, creative, duration, currency };
}

/* -------------------------------- محاسبه -------------------------------- */

/**
 * پیش‌فاکتور محاسباتی: هر رسانه خط جدا دارد، افزودنی محتوا، مالیات کشور و
 * معادل دلاری همه‌چیز. هیچ ورودی‌ای از سمت کاربر به‌عنوان مبلغ پذیرفته نمی‌شود.
 */
export function buildQuote(input = {}, db = null) {
  const { country, media, placement, creative, duration, currency } = normalizeAdInput(input);
  const rate = rateOf(currency, db);

  const lines = media.map((m) => {
    const dailyUsd = roundUsd(m.baseDailyUsd * country.priceIndex * placement.multiplier);
    const subtotalUsd = roundUsd(dailyUsd * duration.days * duration.discount);
    return {
      media: m.code,
      icon: m.icon,
      name: m.name,
      dailyUsd,
      days: duration.days,
      discount: duration.discount,
      subtotalUsd,
      subtotalLocal: fromUsd(subtotalUsd, currency, db),
    };
  });

  const mediaUsd = roundUsd(lines.reduce((sum, line) => sum + line.subtotalUsd, 0));
  const creativeMultiplierUsd = roundUsd(mediaUsd * (creative.multiplier - 1));
  const creativeUsd = roundUsd(creative.addonUsd + creativeMultiplierUsd);
  const subtotalUsd = roundUsd(mediaUsd + creativeMultiplierUsd);
  const taxRate = country.vat;
  const taxUsd = roundUsd((subtotalUsd + creative.addonUsd) * taxRate);
  const totalUsd = roundUsd(subtotalUsd + creative.addonUsd + taxUsd);

  const subtotalLocal = fromUsd(subtotalUsd, currency, db);
  const creativeLocal = fromUsd(creative.addonUsd, currency, db);
  const taxLocal = fromUsd(taxUsd, currency, db);
  const totalLocal = roundLocal(subtotalLocal + creativeLocal + taxLocal, currency);
  const perDayUsd = roundUsd(totalUsd / duration.days);

  return {
    pricingVersion: 'ads-v1',
    quotedAt: new Date().toISOString(),
    country: {
      code: country.code, name: country.name, flag: country.flag,
      currency: country.currency, vatRate: taxRate, priceIndex: country.priceIndex,
    },
    currency,
    currencyMeta: currencyMeta(currency),
    rate,
    rateBase: 'USD',
    durationDays: duration.days,
    durationDiscount: duration.discount,
    placement: { code: placement.code, icon: placement.icon, name: placement.name, multiplier: placement.multiplier },
    creative: {
      code: creative.code, icon: creative.icon, name: creative.name,
      multiplier: creative.multiplier, addonUsd: creative.addonUsd, instant: creative.instant,
    },
    lines,
    mediaUsd,
    subtotalUsd,
    subtotalLocal,
    creativeUsd,
    creativeLocal,
    taxRate,
    taxUsd,
    taxLocal,
    totalUsd,
    totalLocal,
    perDayUsd,
    perDayLocal: fromUsd(perDayUsd, currency, db),
  };
}

/* ------------------------------ گزینه‌های رابط ------------------------------ */

export function adOptions(db = null) {
  const snapshot = ratesSnapshot(db);
  return {
    base: 'USD',
    countries: AD_COUNTRIES.map((c) => ({
      code: c.code,
      flag: c.flag,
      name: c.name,
      currency: c.currency,
      vatRate: c.vat,
      priceIndex: c.priceIndex,
      rate: snapshot.rates[c.currency],
    })),
    media: AD_MEDIA.map((m) => ({
      code: m.code, icon: m.icon, name: m.name,
      baseDailyUsd: m.baseDailyUsd, minDays: m.minDays, publishing: m.publishing,
    })),
    placements: AD_PLACEMENTS.map((p) => ({
      code: p.code, icon: p.icon, name: p.name, multiplier: p.multiplier,
    })),
    creatives: AD_CREATIVES.map((c) => ({
      code: c.code, icon: c.icon, name: c.name,
      addonUsd: c.addonUsd, multiplier: c.multiplier, instant: c.instant,
    })),
    durations: AD_DURATIONS,
    statuses: AD_STATUSES,
    statusFlow: AD_STATUS_FLOW,
    rates: snapshot,
    publishing: {
      enabled: false,
      reason: 'social_publishing_disabled',
      media: AD_MEDIA.map((m) => ({ code: m.code, publishing: m.publishing })),
    },
    payments: {
      enabled: false,
      mode: 'disabled',
      reason: 'online_payment_disabled',
    },
  };
}

/* --------------------------------- نمایش --------------------------------- */

const MEDIA_BY_CODE = Object.fromEntries(AD_MEDIA.map((m) => [m.code, m]));
const PLACEMENT_BY_CODE = Object.fromEntries(AD_PLACEMENTS.map((p) => [p.code, p]));
const CREATIVE_BY_CODE = Object.fromEntries(AD_CREATIVES.map((c) => [c.code, c]));

export function campaignView(campaign) {
  if (!campaign) return null;
  const media = (campaign.media || []).map((code) => MEDIA_BY_CODE[code]).filter(Boolean);
  return {
    id: campaign.id,
    invoiceNo: campaign.invoiceNo,
    title: campaign.title,
    description: campaign.description || '',
    country: campaign.country,
    countryName: campaign.countryName || null,
    currency: campaign.currency,
    media: campaign.media || [],
    mediaNames: media.map((m) => ({ code: m.code, icon: m.icon, name: m.name })),
    placement: campaign.placement,
    placementName: PLACEMENT_BY_CODE[campaign.placement]?.name || null,
    creative: campaign.creative,
    creativeName: CREATIVE_BY_CODE[campaign.creative]?.name || null,
    durationDays: campaign.durationDays,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    status: campaign.status,
    paymentStatus: campaign.paymentStatus || 'disabled',
    paymentEnabled: false,
    publishingEnabled: false,
    totalLocal: campaign.totalLocal,
    totalUsd: campaign.totalUsd,
    currencyMeta: currencyMeta(campaign.currency),
    rate: campaign.rate,
    breakdown: campaign.breakdown || null,
    statusHistory: campaign.statusHistory || [],
    ownerName: campaign.ownerName || null,
    ownerEmail: campaign.ownerEmail || null,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

/** پیش‌فاکتور قابل چاپ: شماره، اقلام، مالیات، معادل دلاری و شرایط پرداخت */
export function invoiceFor(campaign) {
  if (!campaign) return null;
  const b = campaign.breakdown || {};
  const issuedAt = campaign.createdAt || new Date().toISOString();
  const dueAt = new Date(new Date(issuedAt).getTime() + 7 * 864e5).toISOString();
  return {
    invoiceNo: campaign.invoiceNo,
    issuedAt,
    dueAt,
    kind: 'advertising_preinvoice',
    status: campaign.status === 'canceled' ? 'canceled' : 'issued',
    billTo: { name: campaign.ownerName || '—', email: campaign.ownerEmail || '—' },
    campaign: {
      id: campaign.id,
      title: campaign.title,
      country: campaign.country,
      countryName: campaign.countryName || null,
      media: campaign.media || [],
      placement: campaign.placement,
      creative: campaign.creative,
      durationDays: campaign.durationDays,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
    },
    items: (b.lines || []).map((line) => ({
      description: `تبلیغ ${line.days} روزه — ${line.media}`,
      days: line.days,
      dailyUsd: line.dailyUsd,
      discount: line.discount,
      amountUsd: line.subtotalUsd,
      amountLocal: line.subtotalLocal,
    })),
    creativeAddon: { amountUsd: b.creativeUsd || 0, amountLocal: b.creativeLocal || 0, code: campaign.creative },
    subtotalUsd: b.subtotalUsd || 0,
    subtotalLocal: b.subtotalLocal || 0,
    taxRate: b.taxRate || 0,
    taxUsd: b.taxUsd || 0,
    taxLocal: b.taxLocal || 0,
    totalUsd: campaign.totalUsd || 0,
    totalLocal: campaign.totalLocal || 0,
    currency: campaign.currency,
    currencyMeta: currencyMeta(campaign.currency),
    rate: campaign.rate,
    rateBase: 'USD',
    rateSource: campaign.rateSource || 'default_sample',
    payment: {
      enabled: false,
      mode: 'disabled',
      instructions: 'payment_disabled_preview',
    },
    publishing: { enabled: false, note: 'social_publishing_disabled' },
  };
}

/** شمارهٔ فاکتور یکتا: AD-YYYYMM-#### */
export function nextInvoiceNo(db) {
  const settings = db.settings || (db.settings = {});
  const prefix = `AD-${new Date().toISOString().slice(0, 7).replace('-', '')}`;
  settings.adSeq = Number(settings.adSeq || 1000) + 1;
  return `${prefix}-${settings.adSeq}`;
}

/** آمار خلاصه برای پنل مدیر */
export function adStats(campaigns = []) {
  const byStatus = {};
  const byCountry = {};
  const byCurrency = {};
  let revenueUsd = 0;
  let pipelineUsd = 0;

  for (const campaign of campaigns) {
    byStatus[campaign.status] = (byStatus[campaign.status] || 0) + 1;
    byCountry[campaign.country] = (byCountry[campaign.country] || 0) + 1;
    const amount = Number(campaign.totalUsd || 0);
    byCurrency[campaign.currency] = roundUsd((byCurrency[campaign.currency] || 0) + amount);
    if (['in_review', 'scheduled', 'active', 'completed'].includes(campaign.status)) {
      revenueUsd = roundUsd(revenueUsd + amount);
    }
    if (['draft', 'awaiting_payment'].includes(campaign.status)) {
      pipelineUsd = roundUsd(pipelineUsd + amount);
    }
  }

  return {
    total: campaigns.length,
    byStatus,
    byCountry,
    byCurrencyUsd: byCurrency,
    revenueUsd,
    pipelineUsd,
    publishingEnabled: false,
    paymentsEnabled: false,
  };
}

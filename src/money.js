// ارزها، نرخ تبدیل و قالب‌بندی مبلغ.
// لنگر همهٔ محاسبات «دلار آمریکا» است؛ نرخ‌ها را مدیر می‌تواند در تنظیمات بازنویسی کند
// (settings.adRates) و هر پیش‌فاکتور، نرخ لحظهٔ صدور خود را نگه می‌دارد.

export const CURRENCIES = {
  USD: {
    code: 'USD', symbol: '$', decimals: 2, step: 0.01, base: true,
    label: { fa: 'دلار آمریکا', en: 'US Dollar', ar: 'دولار أمريكي', tr: 'ABD Doları' },
  },
  IRR: {
    code: 'IRR', symbol: 'تومان', decimals: 0, step: 1000,
    label: { fa: 'تومان ایران', en: 'Iranian Toman', ar: 'التومان الإيراني', tr: 'İran Tümeni' },
  },
  AED: {
    code: 'AED', symbol: 'د.إ', decimals: 2, step: 0.01,
    label: { fa: 'درهم امارات', en: 'UAE Dirham', ar: 'درهم إماراتي', tr: 'BAE Dirhemi' },
  },
  SAR: {
    code: 'SAR', symbol: 'ر.س', decimals: 2, step: 0.01,
    label: { fa: 'ریال سعودی', en: 'Saudi Riyal', ar: 'ريال سعودي', tr: 'Suudi Riyali' },
  },
  EGP: {
    code: 'EGP', symbol: 'ج.م', decimals: 2, step: 0.25,
    label: { fa: 'پوند مصر', en: 'Egyptian Pound', ar: 'جنيه مصري', tr: 'Mısır Lirası' },
  },
  IQD: {
    code: 'IQD', symbol: 'ع.د', decimals: 0, step: 250,
    label: { fa: 'دینار عراق', en: 'Iraqi Dinar', ar: 'دينار عراقي', tr: 'Irak Dinarı' },
  },
  KWD: {
    code: 'KWD', symbol: 'د.ك', decimals: 3, step: 0.001,
    label: { fa: 'دینار کویت', en: 'Kuwaiti Dinar', ar: 'دينار كويتي', tr: 'Kuveyt Dinarı' },
  },
  QAR: {
    code: 'QAR', symbol: 'ر.ق', decimals: 2, step: 0.05,
    label: { fa: 'ریال قطر', en: 'Qatari Riyal', ar: 'ريال قطري', tr: 'Katar Riyali' },
  },
  OMR: {
    code: 'OMR', symbol: 'ر.ع', decimals: 3, step: 0.001,
    label: { fa: 'ریال عمان', en: 'Omani Rial', ar: 'ريال عماني', tr: 'Umman Riyali' },
  },
  JOD: {
    code: 'JOD', symbol: 'د.أ', decimals: 3, step: 0.001,
    label: { fa: 'دینار اردن', en: 'Jordanian Dinar', ar: 'دينار أردني', tr: 'Ürdün Dinarı' },
  },
};

/** نرخ نمونه (واحد ارز در برابر ۱ دلار). قابل بازنویسی از پنل مدیریت. */
export const DEFAULT_RATES = {
  USD: 1,
  IRR: 108000,
  AED: 3.6725,
  SAR: 3.75,
  EGP: 48.5,
  IQD: 1310,
  KWD: 0.307,
  QAR: 3.64,
  OMR: 0.3845,
  JOD: 0.709,
};

export const LOCALES = { fa: 'fa-IR', en: 'en-US', ar: 'ar-AE', tr: 'tr-TR' };

export function isCurrency(code) {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, String(code || '').toUpperCase());
}

export function currencyMeta(code) {
  return CURRENCIES[String(code || 'USD').toUpperCase()] || CURRENCIES.USD;
}

export function currencyLabel(code, lang = 'fa') {
  const meta = currencyMeta(code);
  return meta.label?.[lang] || meta.label?.en || meta.code;
}

/** نرخ‌های مؤثر: پیش‌فرض + بازنویسی مدیر */
export function resolveRates(db) {
  const out = { ...DEFAULT_RATES };
  const overrides = db?.settings?.adRates || {};
  for (const [code, value] of Object.entries(overrides)) {
    const key = String(code).toUpperCase();
    if (key === 'UPDATEDAT' || !CURRENCIES[key]) continue;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) out[key] = n;
  }
  return out;
}

export function rateOf(code, db) {
  const key = String(code || 'USD').toUpperCase();
  return resolveRates(db)[key] || 1;
}

/** گِرد کردن مبلغ محلی به پلهٔ منطقی همان ارز (مثلاً هزار تومان) */
export function roundLocal(amount, code) {
  const meta = currencyMeta(code);
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  const stepped = Math.round(n / meta.step) * meta.step;
  return Number(stepped.toFixed(meta.decimals));
}

export function roundUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
}

export function toUsd(amountLocal, code, db) {
  const rate = rateOf(code, db);
  return roundUsd(Number(amountLocal || 0) / (rate || 1));
}

export function fromUsd(usd, code, db) {
  const rate = rateOf(code, db);
  return roundLocal(Number(usd || 0) * (rate || 1), code);
}

export function formatMoney(amount, code, lang = 'fa') {
  const meta = currencyMeta(code);
  const value = Number(amount) || 0;
  const locale = LOCALES[lang] || LOCALES.fa;
  let num;
  try {
    num = new Intl.NumberFormat(locale, {
      minimumFractionDigits: Math.min(meta.decimals, 2),
      maximumFractionDigits: meta.decimals,
    }).format(value);
  } catch {
    num = value.toFixed(meta.decimals);
  }
  return `${num} ${meta.symbol}`;
}

/** تصویر نرخ‌ها برای نمایش در رابط و پیش‌فاکتور */
export function ratesSnapshot(db) {
  const rates = resolveRates(db);
  return {
    base: 'USD',
    rates,
    updatedAt: db?.settings?.adRates?.updatedAt || null,
    source: db?.settings?.adRates ? 'admin_override' : 'default_sample',
    currencies: Object.keys(CURRENCIES).map((code) => ({
      code,
      symbol: CURRENCIES[code].symbol,
      decimals: CURRENCIES[code].decimals,
      label: CURRENCIES[code].label,
      rate: rates[code],
    })),
  };
}

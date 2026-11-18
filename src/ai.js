// موتور هوش مصنوعی بازار هوشمند
// ۱) حالت محلی و قطعی (بدون کلید API): تولید توضیحات، پیشنهاد قیمت، کلیدواژه، جست‌وجوی معنایی و دستیار
// ۲) حالت ارائه‌دهنده: اگر AI_API_KEY تنظیم شده باشد، از مدل زبانی سازگار با OpenAI استفاده می‌شود
import { CATEGORIES, categoryLabel } from './catalog.js';

const LANGS = ['fa', 'en', 'ar', 'tr'];

/* ----------------------------- کمک‌تابع‌های متنی ----------------------------- */

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u064A\u0649]/g, 'ی')
    .replace(/[\u0643]/g, 'ک')
    .replace(/[\u0629]/g, 'ه')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/[ؤئ]/g, 'ی')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text) {
  return normalize(text).split(' ').filter((t) => t.length > 1);
}

const SYNONYMS = {
  mobile: ['موبایل', 'گوشی', 'تلفن', 'هوشمند', 'mobile', 'phone', 'smartphone', 'جوال', 'هاتف', 'telefon', 'cep'],
  digital: ['دیجیتال', 'لپ', 'تاپ', 'کامپیوتر', 'هدفون', 'digital', 'laptop', 'computer', 'headphone', 'حاسوب', 'حاسب', 'bilgisayar', 'kulaklık'],
  home: ['خانه', 'آشپزخانه', 'لوازم', 'مبل', 'home', 'kitchen', 'house', 'منزل', 'مطبخ', 'ev', 'mutfak'],
  clothing: ['پوشاک', 'لباس', 'پیراهن', 'کفش', 'clothing', 'shirt', 'dress', 'shoes', 'ملابس', 'قميص', 'حذاء', 'giyim', 'elbise', 'ayakkabı'],
  beauty: ['زیبایی', 'آرایش', 'عطر', 'مراقبت', 'beauty', 'makeup', 'perfume', 'skincare', 'جمال', 'عطر', 'makyaj', 'parfüm'],
  books: ['کتاب', 'دفتر', 'قلم', 'لوازم', 'تحریر', 'book', 'stationery', 'pen', 'كتاب', 'قلم', 'kitap', 'kalem'],
  sport: ['ورزش', 'سفر', 'کوه', 'دوچرخه', 'sport', 'travel', 'bike', 'رياضة', 'سفر', 'spor', 'seyahat'],
};

function expandToken(token) {
  const out = new Set([token]);
  for (const group of Object.values(SYNONYMS)) {
    if (group.some((word) => normalize(word) === token || normalize(word).startsWith(token) || token.startsWith(normalize(word)))) {
      group.forEach((w) => out.add(normalize(w)));
    }
  }
  return [...out];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

/* ------------------------------- جست‌وجوی هوشمند ------------------------------- */

// امتیازدهی متنی به محصول؛ در جست‌وجو، پیشنهادها و دستیار استفاده می‌شود
export function scoreProduct(product, query) {
  const q = normalize(query);
  if (!q) return 0;
  const qTokens = tokens(query);
  const localizedNames = Object.values(product.i18n || {}).filter(Boolean).join(' ');
  const fields = [
    { text: normalize(product.name), weight: 6 },
    { text: normalize(localizedNames), weight: 6 },
    { text: normalize((product.tags || []).join(' ')), weight: 4 },
    { text: normalize(product.storeName || ''), weight: 3 },
    { text: normalize(product.category || ''), weight: 2 },
    { text: normalize(product.description || ''), weight: 1 },
  ];

  let score = 0;
  for (const field of fields) {
    if (!field.text) continue;
    if (field.text.includes(q)) score += field.weight * 3;
    for (const token of qTokens) {
      const variants = expandToken(token);
      const fieldTokens = field.text.split(' ');
      for (const variant of variants) {
        if (field.text.includes(variant)) score += field.weight;
        else if (variant.length >= 4 && fieldTokens.some((ft) => ft.length >= 4 && levenshtein(ft, variant) <= 1)) {
          score += field.weight * 0.5;
        }
      }
    }
  }
  return Math.round(score * 10) / 10;
}

export function smartSearch(products, query, limit = 24) {
  const scored = products
    .map((p) => ({ product: p, score: scoreProduct(p, query) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || (b.product.rating || 0) - (a.product.rating || 0));
  return scored.slice(0, limit);
}

export function suggestQueries(products, query, categories, limit = 6) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const names = new Set();
  for (const p of products) {
    if (normalize(p.name).includes(q)) names.add(p.name);
    for (const tag of p.tags || []) if (normalize(tag).includes(q)) names.add(tag);
  }
  for (const c of categories) {
    for (const lang of LANGS) if (normalize(c[lang]).includes(q)) names.add(c[lang]);
  }
  return [...names].slice(0, limit);
}

/* --------------------------- تولید توضیحات محصول --------------------------- */

const TONE = {
  fa: {
    friendly: 'دوستانه',
    professional: 'حرفه‌ای',
    short: 'کوتاه',
  },
};

const DESC_TEMPLATES = {
  fa: {
    intro: (n, c) => `${n} یکی از انتخاب‌های محبوب دستهٔ ${c} در بازار هوشمند است.`,
    body: (f) => (f.length ? `ویژگی‌های کلیدی: ${f.join('، ')}.` : 'کیفیت ساخت مناسب و کارایی روزمره از مزیت‌های اصلی این محصول است.'),
    trust: 'با خرید از فروشندگان تأییدشدهٔ بازار هوشمند، امکان پیگیری سفارش و پشتیبانی پس از خرید را دارید.',
    cta: 'همین حالا سفارش دهید و تجربهٔ خرید هوشمند را امتحان کنید.',
    short: (n, c) => `${n} — انتخابی مطمئن در دستهٔ ${c} با کیفیت مناسب و ارسال سریع.`,
  },
  en: {
    intro: (n, c) => `${n} is a popular pick in the ${c} category on Smart Bazaar.`,
    body: (f) => (f.length ? `Key features: ${f.join(', ')}.` : 'Solid build quality and dependable everyday performance are the highlights of this product.'),
    trust: 'Buying from verified Smart Bazaar sellers gives you order tracking and after-sales support.',
    cta: 'Order now and enjoy a smarter shopping experience.',
    short: (n, c) => `${n} — a reliable ${c} choice with great quality and fast delivery.`,
  },
  ar: {
    intro: (n, c) => `${n} من الخيارات الشائعة في فئة ${c} على سوق ذكي.`,
    body: (f) => (f.length ? `أهم الميزات: ${f.join('، ')}.` : 'جودة تصنيع جيدة وأداء يومي موثوق من أبرز مزايا هذا المنتج.'),
    trust: 'الشراء من بائعين موثوقين في سوق ذكي يمنحك تتبع الطلب ودعمًا بعد البيع.',
    cta: 'اطلب الآن واستمتع بتجربة تسوق أذكى.',
    short: (n, c) => `${n} — خيار موثوق في فئة ${c} بجودة مناسبة وتوصيل سريع.`,
  },
  tr: {
    intro: (n, c) => `${n}, Smart Bazaar'da ${c} kategorisinin popüler seçeneklerinden biridir.`,
    body: (f) => (f.length ? `Öne çıkan özellikler: ${f.join(', ')}.` : 'Sağlam yapı kalitesi ve günlük kullanımda güvenilir performans bu ürünün öne çıkan avantajlarıdır.'),
    trust: 'Smart Bazaar’da onaylı satıcılardan alışveriş yaparak sipariş takibi ve satış sonrası destek alırsınız.',
    cta: 'Hemen sipariş verin ve akıllı alışveriş deneyimini yaşayın.',
    short: (n, c) => `${n} — ${c} kategorisinde kaliteli ve hızlı teslimatlı güvenilir bir seçim.`,
  },
};

export function localDescription({ name, category, features = [], tone = 'friendly', lang = 'fa' }) {
  const l = LANGS.includes(lang) ? lang : 'fa';
  const t = DESC_TEMPLATES[l];
  const catLabel = categoryLabel(category || 'other', l);
  const cleanName = String(name || '').trim() || (l === 'fa' ? 'این محصول' : 'This product');
  const featureList = (Array.isArray(features) ? features : String(features).split(/[,،\n]/))
    .map((f) => String(f).trim())
    .filter(Boolean)
    .slice(0, 6);

  if (tone === 'short') {
    return { text: t.short(cleanName, catLabel), engine: 'local' };
  }

  const parts = [t.intro(cleanName, catLabel), t.body(featureList)];
  if (tone === 'professional') parts.push(t.trust);
  parts.push(t.cta);
  return { text: parts.join(' '), engine: 'local' };
}

/* ----------------------------- پیشنهاد قیمت ----------------------------- */

export function suggestPrice({ name, category, cost = 0, products = [], lang = 'fa' }) {
  const similar = products.filter((p) => p.category === category && p.active !== false);
  const prices = similar.map((p) => Number(p.price) || 0).filter((p) => p > 0).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
  const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
  const c = Number(cost) || 0;

  // اگر بهای تمام‌شده داده شده باشد، حاشیهٔ سود ۳۵٪ مبنا قرار می‌گیرد
  const fromCost = c > 0 ? Math.round(c * 1.35) : 0;
  const base = median || avg || fromCost || 500000;
  const recommended = c > 0 ? Math.round((base * 0.6 + fromCost * 0.4) / 1000) * 1000 : base;

  const low = Math.round((recommended * 0.85) / 1000) * 1000;
  const high = Math.round((recommended * 1.18) / 1000) * 1000;
  const samples = similar
    .slice()
    .sort((a, b) => scoreProduct(b, name || '') - scoreProduct(a, name || ''))
    .slice(0, 3)
    .map((p) => ({ id: p.id, name: p.name, price: p.price }));

  const notes = {
    fa: prices.length
      ? `بر اساس ${prices.length} محصول مشابه در دستهٔ «${categoryLabel(category, 'fa')}»، بازهٔ قیمت منطقی ${low.toLocaleString('fa-IR')} تا ${high.toLocaleString('fa-IR')} تومان است.`
      : 'در این دسته محصول مشابهی ثبت نشده است؛ پیشنهاد بر اساس بهای تمام‌شده و حاشیهٔ سود متعارف محاسبه شد.',
    en: `Based on ${prices.length} similar items, a sensible range is ${low} - ${high}.`,
    ar: `بناءً على ${prices.length} منتجًا مشابهًا، النطاق المنطقي هو ${low} - ${high}.`,
    tr: `${prices.length} benzer ürüne göre mantıklı aralık ${low} - ${high}.`,
  };

  return {
    recommended,
    low,
    high,
    median,
    average: avg,
    samples,
    sampleCount: prices.length,
    note: notes[LANGS.includes(lang) ? lang : 'fa'],
    engine: 'local',
  };
}

/* ------------------------------ کلیدواژه SEO ------------------------------ */

export function localKeywords({ name, description, category, lang = 'fa', limit = 12 }) {
  const stop = new Set([
    'و', 'در', 'به', 'از', 'که', 'این', 'را', 'با', 'برای', 'است', 'یک', 'the', 'and', 'for', 'with', 'this', 'that', 'a', 'of', 'في', 'من', 'على', 'هذا', 've', 'bir', 'ile', 'için',
  ]);
  const words = tokens(`${name || ''} ${description || ''}`).filter((w) => w.length > 2 && !stop.has(w));
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  const base = String(name || '').trim();
  const catLabel = categoryLabel(category || 'other', lang);
  const list = new Set();
  if (base) {
    list.add(base);
    list.add(`${base} ${catLabel}`);
  }
  [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([w]) => list.add(w));
  list.add(catLabel);
  if (base) list.add(`${base} خرید`);
  const tags = [...list].filter(Boolean).slice(0, limit);
  return { keywords: tags, engine: 'local' };
}

/* -------------------------------- دستیار -------------------------------- */

function money(n, lang) {
  const value = Number(n) || 0;
  try {
    return value.toLocaleString(lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar-EG' : lang === 'tr' ? 'tr-TR' : 'en-US');
  } catch {
    return String(value);
  }
}

export function localAssistant(message, { lang = 'fa', products = [], orders = [], role = 'customer', sellerName = '' } = {}) {
  const l = LANGS.includes(lang) ? lang : 'fa';
  const text = normalize(message);
  const sellerOrders = role === 'seller' ? orders : [];
  const revenue = sellerOrders
    .filter((o) => o.status !== 'canceled' && o.status !== 'returned')
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const openOrders = sellerOrders.filter((o) => ['pending', 'confirmed'].includes(o.status)).length;

  const has = (...words) => words.some((w) => text.includes(normalize(w)));

  if (has('سلام', 'درود', 'hi', 'hello', 'مرحبا', 'merhaba')) {
    return {
      reply: {
        fa: 'سلام! من دستیار هوشمند بازار هوشمند هستم. می‌توانم محصول پیشنهاد بدهم، دربارهٔ فروش و موجودی راهنمایی کنم یا در نوشتن توضیحات محصول کمک کنم.',
        en: 'Hello! I am the Smart Bazaar assistant. I can recommend products, explain sales and stock, or help you write product descriptions.',
        ar: 'مرحبًا! أنا مساعد سوق ذكي. أستطيع اقتراح منتجات أو توضيح المبيعات والمخزون أو المساعدة في كتابة وصف المنتج.',
        tr: 'Merhaba! Ben Smart Bazaar asistanıyım. Ürün önerebilir, satış ve stok konusunda yardımcı olabilir veya ürün açıklaması yazabilirim.',
      }[l],
      engine: 'local',
    };
  }

  if (has('درآمد', 'فروش', 'revenue', 'sales', 'مبيعات', 'satış', 'درامد')) {
    return {
      reply: {
        fa: `درآمد ثبت‌شدهٔ شما ${money(revenue, l)} تومان از ${sellerOrders.length} سفارش است. ${openOrders} سفارش در انتظار بررسی دارید.`,
        en: `Your recorded revenue is ${money(revenue, l)} from ${sellerOrders.length} orders, with ${openOrders} awaiting action.`,
        ar: `إيراداتك المسجلة ${money(revenue, l)} من ${sellerOrders.length} طلبًا، ولديك ${openOrders} طلبًا بانتظار الإجراء.`,
        tr: `Kayıtlı geliriniz ${sellerOrders.length} siparişten ${money(revenue, l)}; ${openOrders} sipariş işlem bekliyor.`,
      }[l],
      engine: 'local',
    };
  }

  if (has('موجودی', 'کم', 'stock', 'low', 'مخزون', 'stok')) {
    const low = products.filter((p) => Number(p.stock) <= 5).slice(0, 5);
    return {
      reply: low.length
        ? {
            fa: `این محصولات موجودی کمی دارند: ${low.map((p) => `${p.name} (${p.stock})`).join('، ')}. پیشنهاد می‌کنم موجودی را افزایش دهید.`,
            en: `Low stock items: ${low.map((p) => `${p.name} (${p.stock})`).join(', ')}. Consider restocking.`,
            ar: `منتجات بمخزون منخفض: ${low.map((p) => `${p.name} (${p.stock})`).join('، ')}.`,
            tr: `Stoğu az ürünler: ${low.map((p) => `${p.name} (${p.stock})`).join(', ')}.`,
          }[l]
        : {
            fa: 'در حال حاضر موجودی همهٔ محصولات شما مناسب است.',
            en: 'All your products currently have healthy stock.',
            ar: 'جميع منتجاتك لديها مخزون مناسب حاليًا.',
            tr: 'Şu anda tüm ürünlerinizin stoğu yeterli.',
          }[l],
      engine: 'local',
    };
  }

  if (has('پیشنهاد', 'recommend', 'suggest', 'اقترح', 'öner')) {
    const found = smartSearch(products, message.replace(/(پیشنهاد|recommend|suggest|اقترح|öner)/g, ' '), 3);
    const picks = found.length ? found.map((f) => f.product) : products.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3);
    return {
      reply: {
        fa: `این گزینه‌ها را پیشنهاد می‌کنم: ${picks.map((p) => p.name).join('، ') || 'هنوز محصولی ثبت نشده است'}.`,
        en: `I recommend: ${picks.map((p) => p.name).join(', ') || 'no products yet'}.`,
        ar: `أقترح: ${picks.map((p) => p.name).join('، ') || 'لا توجد منتجات بعد'}.`,
        tr: `Önerilerim: ${picks.map((p) => p.name).join(', ') || 'henüz ürün yok'}.`,
      }[l],
      products: picks.map((p) => ({ id: p.id, name: p.name, price: p.price })),
      engine: 'local',
    };
  }

  const found = smartSearch(products, message, 4);
  if (found.length) {
    return {
      reply: {
        fa: `برای «${message}» ${found.length} محصول پیدا کردم: ${found.map((f) => f.product.name).join('، ')}.`,
        en: `I found ${found.length} products for “${message}”: ${found.map((f) => f.product.name).join(', ')}.`,
        ar: `وجدت ${found.length} منتجات لـ «${message}»: ${found.map((f) => f.product.name).join('، ')}.`,
        tr: `“${message}” için ${found.length} ürün buldum: ${found.map((f) => f.product.name).join(', ')}.`,
      }[l],
      products: found.map((f) => ({ id: f.product.id, name: f.product.name, price: f.product.price })),
      engine: 'local',
    };
  }

  return {
    reply: {
      fa: 'می‌توانم در این موارد کمک کنم: جست‌وجوی محصول، پیشنهاد محصول، تحلیل فروش و درآمد فروشنده، هشدار موجودی کم، و نوشتن توضیحات و کلیدواژه‌های محصول. کافی است نام یک محصول یا دسته را بنویسید.',
      en: 'I can help with product search, recommendations, seller revenue and order insights, low-stock alerts, and writing product descriptions and keywords. Just mention a product or category.',
      ar: 'أستطيع المساعدة في البحث عن المنتجات، التوصيات، تحليل المبيعات والإيرادات، تنبيهات المخزون، وكتابة وصف المنتج والكلمات المفتاحية.',
      tr: 'Ürün arama, öneri, satış ve gelir analizi, düşük stok uyarıları, ürün açıklaması ve anahtar kelime yazımında yardımcı olabilirim.',
    }[l],
    engine: 'local',
  };
}

/* ----------------------------- تحلیل فروشنده ----------------------------- */

export function sellerInsights(products, orders) {
  const active = orders.filter((o) => !['canceled', 'returned'].includes(o.status));
  const revenue = active.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const units = new Map();
  for (const order of active) {
    for (const item of order.items || []) {
      units.set(item.productId, (units.get(item.productId) || 0) + Number(item.qty || 0));
    }
  }
  const best = [...units.entries()]
    .map(([pid, qty]) => ({ product: products.find((p) => p.id === pid), qty }))
    .filter((row) => row.product)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const lowStock = products.filter((p) => Number(p.stock) <= 5).slice(0, 5);
  const noImage = products.filter((p) => !p.image).slice(0, 5);
  const shortDesc = products.filter((p) => (p.description || '').length < 80).slice(0, 5);

  const tips = [];
  if (lowStock.length) tips.push(`stock:${lowStock.map((p) => p.name).join('|')}`);
  if (noImage.length) tips.push(`image:${noImage.map((p) => p.name).join('|')}`);
  if (shortDesc.length) tips.push(`description:${shortDesc.map((p) => p.name).join('|')}`);
  if (!products.length) tips.push('empty');

  return {
    revenue,
    orderCount: active.length,
    openOrders: orders.filter((o) => ['pending', 'confirmed'].includes(o.status)).length,
    unitsSold: [...units.values()].reduce((a, b) => a + b, 0),
    bestSellers: best.map((b) => ({ id: b.product.id, name: b.product.name, qty: b.qty, price: b.product.price })),
    lowStock: lowStock.map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
    tips,
  };
}

/* ------------------------- اتصال اختیاری به ارائه‌دهنده ------------------------- */

export function providerConfig() {
  const key = process.env.AI_API_KEY;
  if (!key) return null;
  return {
    key,
    baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.AI_MODEL || 'gpt-4o-mini',
  };
}

export async function providerComplete(messages, { maxTokens = 400 } = {}) {
  const config = providerConfig();
  if (!config) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.key}` },
      body: JSON.stringify({ model: config.model, messages, max_tokens: maxTokens, temperature: 0.6 }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export { CATEGORIES, LANGS };

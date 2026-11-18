// دسته‌بندی‌ها و ثابت‌های مشترک بازار هوشمند
export const LANGS = ['fa', 'en', 'ar', 'tr'];
export const RTL_LANGS = ['fa', 'ar'];

export const CATEGORIES = [
  { slug: 'mobile', icon: '📱', fa: 'موبایل و تبلت', en: 'Mobile & Tablets', ar: 'الجوال والأجهزة اللوحية', tr: 'Mobil ve Tablet' },
  { slug: 'digital', icon: '💻', fa: 'کالای دیجیتال', en: 'Digital Goods', ar: 'الأجهزة الرقمية', tr: 'Dijital Ürünler' },
  { slug: 'home', icon: '🏠', fa: 'خانه و آشپزخانه', en: 'Home & Kitchen', ar: 'المنزل والمطبخ', tr: 'Ev ve Mutfak' },
  { slug: 'clothing', icon: '👕', fa: 'پوشاک و مد', en: 'Clothing & Fashion', ar: 'الملابس والأزياء', tr: 'Giyim ve Moda' },
  { slug: 'beauty', icon: '💄', fa: 'زیبایی و سلامت', en: 'Beauty & Health', ar: 'الجمال والصحة', tr: 'Güzellik ve Sağlık' },
  { slug: 'books', icon: '📚', fa: 'کتاب و لوازم‌التحریر', en: 'Books & Stationery', ar: 'الكتب والأدوات المكتبية', tr: 'Kitap ve Kırtasiye' },
  { slug: 'sport', icon: '⚽', fa: 'ورزش و سفر', en: 'Sports & Travel', ar: 'الرياضة والسفر', tr: 'Spor ve Seyahat' },
  { slug: 'other', icon: '📦', fa: 'سایر', en: 'Other', ar: 'أخرى', tr: 'Diğer' },
];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

export const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'canceled', 'returned'];

// گذارهای مجاز وضعیت سفارش برای فروشنده
export const STATUS_FLOW = {
  pending: ['confirmed', 'canceled'],
  confirmed: ['shipped', 'canceled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  canceled: [],
  returned: [],
};

export function categoryLabel(slug, lang = 'fa') {
  const found = CATEGORIES.find((c) => c.slug === slug);
  if (!found) return CATEGORIES[CATEGORIES.length - 1][lang] || slug;
  return found[lang] || found.fa;
}

export function isValidCategory(slug) {
  return CATEGORY_SLUGS.includes(slug);
}

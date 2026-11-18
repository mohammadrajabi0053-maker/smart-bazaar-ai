// دادهٔ اولیهٔ نمایشی برای بازار هوشمند (فروشندگان، محصولات، کاربران نمونه)
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from './catalog.js';
import { getDb, saveDb, id, ensureUploadDir } from './store.js';
import { hashPassword } from './auth.js';

const SEED_IMG_DIR = path.join(process.cwd(), 'public', 'img', 'seed');

const PALETTE = ['#0f7664', '#1d4fa1', '#8a4bd6', '#c2410e', '#b02a6a', '#0e7a9c', '#3f7d21', '#5b5f6b'];

function svgPlaceholder(emoji, index) {
  const c1 = PALETTE[index % PALETTE.length];
  const c2 = PALETTE[(index + 3) % PALETTE.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
  </linearGradient></defs>
  <rect width="640" height="480" fill="url(#g)"/>
  <circle cx="520" cy="80" r="140" fill="#ffffff" opacity="0.10"/>
  <circle cx="90" cy="430" r="170" fill="#000000" opacity="0.10"/>
  <text x="320" y="300" font-size="170" text-anchor="middle">${emoji}</text>
</svg>`;
}

export function ensureSeedImages() {
  fs.mkdirSync(SEED_IMG_DIR, { recursive: true });
  CATEGORIES.forEach((cat, index) => {
    const file = path.join(SEED_IMG_DIR, `${cat.slug}.svg`);
    if (!fs.existsSync(file)) fs.writeFileSync(file, svgPlaceholder(cat.icon, index));
  });
  ensureUploadDir();
}

const SELLERS = [
  { name: 'سارا محمدی', email: 'sara@bazaar.ir', storeName: 'دیجی‌لند', slug: 'digiland', phone: '09120000001' },
  { name: 'رضا کریمی', email: 'reza@bazaar.ir', storeName: 'خانهٔ مدرن', slug: 'modern-home', phone: '09120000002' },
  { name: 'نیلوفر احمدی', email: 'nilo@bazaar.ir', storeName: 'مد و پوشاک', slug: 'moda', phone: '09120000003' },
];

// نام چهارزبانه و قیمت به تومان
const PRODUCTS = [
  {
    s: 0, cat: 'mobile', name: 'گوشی هوشمند گلکسی A55', price: 14500000, stock: 18,
    i18n: { en: 'Galaxy A55 Smartphone', ar: 'هاتف جالاكسي A55', tr: 'Galaxy A55 Akıllı Telefon' },
    tags: ['گوشی', 'سامسونگ', 'اندروید'],
    desc: 'گوشی هوشمند با صفحهٔ ۶.۵ اینچی سوپر امولد، دوربین ۵۰ مگاپیکسلی و باتری ۵۰۰۰ میلی‌آمپری که یک روز کامل کار می‌کند.',
  },
  {
    s: 0, cat: 'digital', name: 'هدفون بی‌سیم پلاس', price: 2350000, stock: 40,
    i18n: { en: 'Wireless Headphones Plus', ar: 'سماعات لاسلكية بلس', tr: 'Kablosuz Kulaklık Plus' },
    tags: ['هدفون', 'بی‌سیم', 'موسیقی'],
    desc: 'هدفون بی‌سیم با حذف نویز فعال، ۳۰ ساعت شارژدهی و اتصال پایدار به دو دستگاه به‌طور همزمان.',
  },
  {
    s: 0, cat: 'digital', name: 'لپ‌تاپ ۱۴ اینچی ادیت', price: 32800000, stock: 6,
    i18n: { en: '14-inch Edit Laptop', ar: 'حاسوب محمول إديت ١٤ بوصة', tr: '14 inç Edit Dizüstü' },
    tags: ['لپ‌تاپ', 'کامپیوتر'],
    desc: 'لپ‌تاپ سبک با پردازندهٔ ۸ هسته‌ای، ۱۶ گیگابایت رم و حافظهٔ ۵۱۲ گیگابایتی؛ مناسب کارهای اداری و طراحی.',
  },
  {
    s: 1, cat: 'home', name: 'سرویس چینی شش‌نفره', price: 890000, stock: 25,
    i18n: { en: 'Six-piece Porcelain Tea Set', ar: 'طقم شاي من الصيني ست حبات', tr: 'Altı Kişilik Porselen Çay Seti' },
    tags: ['چینی', 'سرویس', 'آشپزخانه'],
    desc: 'سرویس چینی شش‌نفره با نقاشی دستی و لعاب مقاوم؛ مناسب مصرف روزانه و هدیه.',
  },
  {
    s: 1, cat: 'home', name: 'جاروبرقی بی‌سیم شارژی', price: 3450000, stock: 14,
    i18n: { en: 'Cordless Rechargeable Vacuum', ar: 'مكنسة كهربائية لاسلكية', tr: 'Kablosuz Şarjlı Süpürge' },
    tags: ['جارو', 'برقی', 'نظافت'],
    desc: 'جاروبرقی سبک با موتور بدون جاروبک و ۴۵ دقیقه کارکرد مداوم؛ مناسب خانه و خودرو.',
  },
  {
    s: 1, cat: 'home', name: 'چراغ رومیزی اتاق خواب', price: 620000, stock: 30,
    i18n: { en: 'Bedroom Table Lamp', ar: 'مصباح غرفة النوم', tr: 'Yatak Odası Masa Lambası' },
    tags: ['چراغ', 'دکوراسیون'],
    desc: 'چراغ رومیزی با نور گرم و بدنهٔ چوبی؛ جلوه‌ای دلنشین برای اتاق خواب.',
  },
  {
    s: 2, cat: 'clothing', name: 'پیراهن مردانه کتان', price: 780000, stock: 22,
    i18n: { en: 'Men’s Linen Shirt', ar: 'قميص كتان رجالي', tr: 'Erkek Keten Gömlek' },
    tags: ['پیراهن', 'مردانه', 'کتان'],
    desc: 'پیراهن کتان با برش آزاد و پارچهٔ تنفس‌پذیر؛ مناسب فصل گرم و استایل روزمره.',
  },
  {
    s: 2, cat: 'clothing', name: 'کفش رنگی زنانه', price: 1290000, stock: 9,
    i18n: { en: 'Women’s Sneakers', ar: 'حذاء رياضي نسائي', tr: 'Kadın Spor Ayakkabısı' },
    tags: ['کفش', 'زنانه', 'ورزشی'],
    desc: 'کفش رنگی با کفی نرم و رویهٔ تنفس‌پذیر؛ برای پیاده‌روی روزانه و ورزش سبک.',
  },
  {
    s: 2, cat: 'beauty', name: 'ست مراقبت از پوست ویتامین C', price: 1150000, stock: 17,
    i18n: { en: 'Vitamin C Skin Care Set', ar: 'طقم عناية بالبشرة فيتامين C', tr: 'C Vitamini Cilt Bakım Seti' },
    tags: ['مراقبت', 'پوست', 'ویتامین'],
    desc: 'ست شامل شوینده، سرم ویتامین C و کرم آب‌رسان با فرمول بدون الکل.',
  },
  {
    s: 0, cat: 'books', name: 'کتاب برنامه‌نویسی با پایتون', price: 540000, stock: 35,
    i18n: { en: 'Python Programming Handbook', ar: 'كتاب البرمجة ببايثون', tr: 'Python Programlama Kitabı' },
    tags: ['کتاب', 'برنامه‌نویسی', 'پایتون'],
    desc: 'کتاب آموزش پایتون از مبانی تا پروژه‌های عملی؛ شامل تمرین‌های حل‌شده.',
  },
  {
    s: 1, cat: 'sport', name: 'مت ورزشی یوگا', price: 420000, stock: 28,
    i18n: { en: 'Yoga Exercise Mat', ar: 'سجادة يوغا للتمارين', tr: 'Yoga Egzersiz Matı' },
    tags: ['ورزش', 'یوگا'],
    desc: 'مت ضدلغزش با ضخامت ۶ میلی‌متر و بند حمل؛ مناسب یوگا و تمرین‌های کششی.',
  },
  {
    s: 2, cat: 'clothing', name: 'شال گردنی زنانه', price: 360000, stock: 4,
    i18n: { en: 'Women’s Neck Scarf', ar: 'وشاح رقبة نسائي', tr: 'Kadın Boyun Atkısı' },
    tags: ['شال', 'زنانه', 'پوشاک'],
    desc: 'شال نرم با بافت ریس و طرح کلاسیک؛ هدیه‌ای مناسب برای فصل سرد.',
  },
];

const DEMO_REVIEWS = [
  { p: 0, rating: 5, comment: 'کیفیت صفحه و دوربین خیلی خوب است، از خریدم راضی‌ام.' },
  { p: 0, rating: 4, comment: 'باتری خوبی دارد ولی کمی سنگین است.' },
  { p: 1, rating: 5, comment: 'حذف نویز واقعاً عالی است.' },
  { p: 3, rating: 4, comment: 'بسته‌بندی سالم رسید، طرحش خوشمزه است.' },
  { p: 7, rating: 5, comment: 'سایز دقیقاً مطابق جدول بود.' },
];

export function seedIfEmpty() {
  const db = getDb();
  if (db.users.length > 0) return { seeded: false };

  ensureSeedImages();
  const now = new Date().toISOString();

  db.users.push({
    id: id(), name: 'مدیر بازار', email: 'admin@bazaar.ir',
    passwordHash: hashPassword(process.env.ADMIN_PASSWORD || 'Admin@1234'),
    role: 'admin', status: 'active', createdAt: now,
  });

  const sellerIds = SELLERS.map((s) => {
    const user = {
      id: id(), name: s.name, email: s.email,
      passwordHash: hashPassword('Seller@1234'),
      role: 'seller', storeName: s.storeName, storeSlug: s.slug, phone: s.phone,
      status: 'active', createdAt: now,
    };
    db.users.push(user);
    return user.id;
  });

  const customer = {
    id: id(), name: 'مشتری نمونه', email: 'customer@bazaar.ir',
    passwordHash: hashPassword('Customer@1234'),
    role: 'customer', status: 'active', createdAt: now,
  };
  db.users.push(customer);

  const products = PRODUCTS.map((p) => ({
    id: id(),
    sellerId: sellerIds[p.s],
    storeName: SELLERS[p.s].storeName,
    name: p.name,
    i18n: p.i18n,
    description: p.desc,
    price: p.price,
    category: p.cat,
    stock: p.stock,
    tags: p.tags,
    image: `/img/seed/${p.cat}.svg`,
    active: true,
    rating: 0,
    reviewCount: 0,
    soldCount: 0,
    createdAt: now,
    updatedAt: now,
  }));
  db.products.push(...products);

  DEMO_REVIEWS.forEach((r) => {
    const product = products[r.p];
    db.reviews.push({
      id: id(), productId: product.id, userId: customer.id,
      userName: customer.name, rating: r.rating, comment: r.comment, createdAt: now,
    });
    const all = db.reviews.filter((x) => x.productId === product.id);
    product.reviewCount = all.length;
    product.rating = Math.round((all.reduce((sum, x) => sum + x.rating, 0) / all.length) * 10) / 10;
  });

  // یک سفارش نمونه برای نمایش پنل فروشنده
  const demoItem = products[3];
  db.orders.push({
    id: id(), number: 'SB-100001', groupId: 'seed-group-1',
    customerId: customer.id, customerName: customer.name,
    sellerId: demoItem.sellerId, storeName: demoItem.storeName,
    items: [{ productId: demoItem.id, name: demoItem.name, price: demoItem.price, qty: 2, image: demoItem.image }],
    subtotal: demoItem.price * 2, shippingCost: 45000, total: demoItem.price * 2 + 45000,
    status: 'pending',
    shipping: {
      fullName: 'مشتری نمونه', phone: '09121111111', city: 'تهران',
      address: 'خیابان ولیعصر، پلاک ۱۲', postalCode: '1234567890',
    },
    note: '', createdAt: now, updatedAt: now,
    history: [{ status: 'pending', at: now, by: 'customer' }],
  });

  db.settings = { ...(db.settings || {}), shippingCost: 45000, currency: 'IRT', seededAt: now };
  saveDb();
  return { seeded: true, users: db.users.length, products: products.length };
}

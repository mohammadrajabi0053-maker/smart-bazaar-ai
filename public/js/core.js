/* بازار هوشمند — هستهٔ مشترک فرانت‌اند: چهار زبان، RTL، API، سبد خرید، اعلان‌ها */
export const LANGS = ['fa', 'en', 'ar', 'tr'];
export const RTL = ['fa', 'ar'];
export const LANG_NAMES = { fa: 'فارسی', en: 'English', ar: 'العربية', tr: 'Türkçe' };
export const CURRENCY = { fa: 'تومان', en: 'Toman', ar: 'تومان', tr: 'Toman' };

const idx = { fa: 0, en: 1, ar: 2, tr: 3 };

/* هر کلید: [فارسی, انگلیسی, عربی, ترکی] */
const DICT = {
  brand: ['بازار هوشمند', 'Smart Bazaar', 'السوق الذكي', 'Akıllı Pazar'],
  tagline: ['فروشگاه چندفروشندگی با دستیار هوشمند', 'Multi-vendor marketplace with an AI assistant', 'سوق متعدد البائعين مع مساعد ذكي', 'Yapay zeka asistanlı çok satıcılı pazar'],
  hero_title: ['از فروشندگان واقعی، هوشمند خرید کن', 'Shop smart from real sellers', 'تسوّق بذكاء من بائعين حقيقيين', 'Gerçek satıcılardan akıllıca alışveriş yap'],
  hero_sub: ['هزاران کالا در چهار زبان، جست‌وجوی معنایی و پنل اختصاصی فروشندگان', 'Thousands of products in four languages, semantic search and a dedicated seller panel', 'آلاف المنتجات بأربع لغات وبحث دلالي ولوحة خاصة للبائعين', 'Dört dilde binlerce ürün, anlamsal arama ve satıcı paneli'],
  ai_assistant: ['دستیار هوشمند', 'AI assistant', 'المساعد الذكي', 'Yapay zeka asistanı'],
  seller_panel: ['پنل فروشنده', 'Seller panel', 'لوحة البائع', 'Satıcı paneli'],
  admin_panel: ['پنل مدیریت', 'Admin panel', 'لوحة الإدارة', 'Yönetim paneli'],
  price: ['قیمت', 'Price', 'السعر', 'Fiyat'],
  customer: ['مشتری', 'Customer', 'العميل', 'Müşteri'],
  role: ['نقش', 'Role', 'الدور', 'Rol'],
  store: ['فروشگاه', 'Store', 'المتجر', 'Mağaza'],
  status_breakdown: ['وضعیت سفارش‌ها', 'Order status', 'حالة الطلبات', 'Sipariş durumu'],
  top_products: ['پرفروش‌ترین کالاها', 'Top products', 'المنتجات الأكثر مبيعًا', 'En çok satanlar'],
  recent_orders: ['سفارش‌های اخیر', 'Recent orders', 'أحدث الطلبات', 'Son siparişler'],
  my_orders_tab: ['سفارش‌های من', 'My orders', 'طلباتي', 'Siparişlerim'],
  add_product_first: ['برای شروع، نخستین کالای خود را ثبت کنید', 'Add your first product to get started', 'أضف منتجك الأول للبدء', 'Başlamak için ilk ürününüzü ekleyin'],
  search_ph: ['جست‌وجوی کالا، فروشگاه یا دسته‌بندی…', 'Search products, stores or categories…', 'ابحث عن منتج أو متجر أو فئة…', 'Ürün, mağaza veya kategori ara…'],
  all: ['همه', 'All', 'الكل', 'Tümü'],
  categories: ['دسته‌بندی‌ها', 'Categories', 'الفئات', 'Kategoriler'],
  filters: ['فیلترها', 'Filters', 'الفلاتر', 'Filtreler'],
  price_from: ['قیمت از', 'Price from', 'السعر من', 'Fiyat (en az)'],
  price_to: ['قیمت تا', 'Price to', 'السعر إلى', 'Fiyat (en çok)'],
  sort: ['ترتیب', 'Sort', 'الترتيب', 'Sıralama'],
  newest: ['جدیدترین', 'Newest', 'الأحدث', 'En yeni'],
  price_asc: ['ارزان‌ترین', 'Cheapest', 'الأرخص', 'En ucuz'],
  price_desc: ['گران‌ترین', 'Most expensive', 'الأغلى', 'En pahalı'],
  rating_sort: ['بیشترین امتیاز', 'Top rated', 'الأعلى تقييمًا', 'En yüksek puan'],
  popular: ['پرفروش‌ترین', 'Best selling', 'الأكثر مبيعًا', 'En çok satan'],
  in_stock_only: ['فقط موجود', 'In stock only', 'المتوفر فقط', 'Sadece stokta'],
  apply: ['اعمال', 'Apply', 'تطبيق', 'Uygula'],
  reset: ['پاک کردن', 'Reset', 'إعادة', 'Sıfırla'],
  results: ['کالا', 'products', 'منتج', 'ürün'],
  no_products: ['کالایی با این مشخصات پیدا نشد.', 'No products matched your search.', 'لا توجد منتجات مطابقة.', 'Eşleşen ürün bulunamadı.'],
  loading: ['در حال بارگذاری…', 'Loading…', 'جارٍ التحميل…', 'Yükleniyor…'],
  add_to_cart: ['افزودن به سبد', 'Add to cart', 'أضف إلى السلة', 'Sepete ekle'],
  out_of_stock: ['ناموجود', 'Out of stock', 'غير متوفر', 'Stokta yok'],
  cart: ['سبد خرید', 'Cart', 'السلة', 'Sepet'],
  cart_empty: ['سبد خرید خالی است.', 'Your cart is empty.', 'سلتك فارغة.', 'Sepetiniz boş.'],
  subtotal: ['جمع کالاها', 'Subtotal', 'المجموع الفرعي', 'Ara toplam'],
  shipping: ['هزینه ارسال', 'Shipping', 'الشحن', 'Kargo'],
  free_shipping: ['رایگان', 'Free', 'مجاني', 'Ücretsiz'],
  total: ['مبلغ قابل پرداخت', 'Total', 'الإجمالي', 'Toplam'],
  checkout: ['ثبت سفارش', 'Checkout', 'إتمام الطلب', 'Siparişi tamamla'],
  order_note: ['توضیح سفارش (اختیاری)', 'Order note (optional)', 'ملاحظة الطلب (اختياري)', 'Sipariş notu (isteğe bağlı)'],
  full_name: ['نام و نام خانوادگی', 'Full name', 'الاسم الكامل', 'Ad soyad'],
  phone: ['شماره تماس', 'Phone', 'الهاتف', 'Telefon'],
  city: ['شهر', 'City', 'المدينة', 'Şehir'],
  address: ['نشانی کامل', 'Address', 'العنوان', 'Adres'],
  postal_code: ['کد پستی', 'Postal code', 'الرمز البريدي', 'Posta kodu'],
  place_order: ['پرداخت و ثبت نهایی', 'Place order', 'تأكيد الطلب', 'Siparişi ver'],
  order_success: ['سفارش شما ثبت شد.', 'Your order has been placed.', 'تم تسجيل طلبك.', 'Siparişiniz alındı.'],
  my_orders: ['سفارش‌های من', 'My orders', 'طلباتي', 'Siparişlerim'],
  no_orders: ['هنوز سفارشی ثبت نکرده‌اید.', 'You have no orders yet.', 'لا توجد طلبات بعد.', 'Henüz siparişiniz yok.'],
  login: ['ورود', 'Log in', 'تسجيل الدخول', 'Giriş'],
  register: ['ثبت‌نام', 'Sign up', 'إنشاء حساب', 'Kayıt ol'],
  logout: ['خروج', 'Log out', 'خروج', 'Çıkış'],
  account: ['حساب من', 'My account', 'حسابي', 'Hesabım'],
  email: ['ایمیل', 'Email', 'البريد الإلكتروني', 'E-posta'],
  password: ['رمز عبور', 'Password', 'كلمة المرور', 'Şifre'],
  name: ['نام', 'Name', 'الاسم', 'Ad'],
  store_name: ['نام فروشگاه', 'Store name', 'اسم المتجر', 'Mağaza adı'],
  as_customer: ['خریدار', 'Customer', 'مشترٍ', 'Müşteri'],
  as_seller: ['فروشنده', 'Seller', 'بائع', 'Satıcı'],
  submit: ['تأیید', 'Submit', 'تأكيد', 'Gönder'],
  cancel: ['انصراف', 'Cancel', 'إلغاء', 'İptal'],
  close: ['بستن', 'Close', 'إغلاق', 'Kapat'],
  quantity: ['تعداد', 'Quantity', 'الكمية', 'Adet'],
  remove: ['حذف', 'Remove', 'حذف', 'Kaldır'],
  reviews: ['نظرات', 'Reviews', 'التقييمات', 'Yorumlar'],
  write_review: ['ثبت نظر', 'Write a review', 'أضف تقييمًا', 'Yorum yaz'],
  your_rating: ['امتیاز شما', 'Your rating', 'تقييمك', 'Puanınız'],
  comment: ['متن نظر', 'Comment', 'التعليق', 'Yorum'],
  send: ['ارسال', 'Send', 'إرسال', 'Gönder'],
  description: ['توضیحات', 'Description', 'الوصف', 'Açıklama'],
  stock: ['موجودی', 'Stock', 'المخزون', 'Stok'],
  seller: ['فروشنده', 'Seller', 'البائع', 'Satıcı'],
  related: ['کالاهای مشابه', 'Related products', 'منتجات مشابهة', 'Benzer ürünler'],
  order_no: ['شماره سفارش', 'Order no.', 'رقم الطلب', 'Sipariş no'],
  status: ['وضعیت', 'Status', 'الحالة', 'Durum'],
  date: ['تاریخ', 'Date', 'التاريخ', 'Tarih'],
  items: ['اقلام', 'Items', 'العناصر', 'Ürünler'],
  need_login: ['برای این کار ابتدا وارد شوید.', 'Please log in first.', 'يرجى تسجيل الدخول أولًا.', 'Lütfen önce giriş yapın.'],
  demo_accounts: ['حساب‌های نمونه', 'Demo accounts', 'حسابات تجريبية', 'Demo hesaplar'],
  confirm_delete: ['آیا مطمئن هستید؟', 'Are you sure?', 'هل أنت متأكد؟', 'Emin misiniz?'],
  edit: ['ویرایش', 'Edit', 'تعديل', 'Düzenle'],
  delete: ['حذف', 'Delete', 'حذف', 'Sil'],
  new_product: ['کالای جدید', 'New product', 'منتج جديد', 'Yeni ürün'],
  my_products: ['کالاهای من', 'My products', 'منتجاتي', 'Ürünlerim'],
  my_sales: ['سفارش‌های فروشگاه', 'Store orders', 'طلبات المتجر', 'Mağaza siparişleri'],
  dashboard: ['داشبورد', 'Dashboard', 'لوحة التحكم', 'Panel'],
  insights: ['تحلیل هوشمند', 'AI insights', 'تحليلات ذكية', 'Akıllı analiz'],
  ai_tools: ['ابزارهای هوش مصنوعی', 'AI tools', 'أدوات الذكاء الاصطناعي', 'Yapay zeka araçları'],
  generate_desc: ['تولید توضیحات', 'Generate description', 'توليد الوصف', 'Açıklama oluştur'],
  suggest_price: ['پیشنهاد قیمت', 'Suggest price', 'اقترح سعرًا', 'Fiyat öner'],
  seo_keywords: ['کلیدواژه‌های سئو', 'SEO keywords', 'كلمات مفتاحية', 'SEO anahtar kelimeler'],
  features: ['ویژگی‌ها (با کاما جدا کنید)', 'Features (comma separated)', 'الميزات (مفصولة بفاصلة)', 'Özellikler (virgülle)'],
  tone: ['لحن', 'Tone', 'الأسلوب', 'Üslup'],
  friendly: ['صمیمی', 'Friendly', 'ودّي', 'Samimi'],
  professional: ['حرفه‌ای', 'Professional', 'احترافي', 'Profesyonel'],
  short: ['کوتاه', 'Short', 'قصير', 'Kısa'],
  use_it: ['استفاده', 'Use it', 'استخدام', 'Kullan'],
  assistant_ph: ['مثلاً: هدفون زیر ۲ میلیون با تحویل سریع', 'e.g. headphones under 2M with fast delivery', 'مثال: سماعات بأقل من مليونين', 'Örn: 2 milyon altı kulaklık'],
  assistant_intro: ['سلام! چه کالایی می‌خواهید؟ بودجه و نیازتان را بنویسید.', 'Hi! What are you looking for? Tell me your budget and needs.', 'مرحبًا! ماذا تبحث عنه؟ اذكر ميزانيتك.', 'Merhaba! Ne arıyorsunuz? Bütçenizi yazın.'],
  all_sellers: ['فروشگاه‌ها', 'Stores', 'المتاجر', 'Mağazalar'],
  users: ['کاربران', 'Users', 'المستخدمون', 'Kullanıcılar'],
  orders: ['سفارش‌ها', 'Orders', 'الطلبات', 'Siparişler'],
  active: ['فعال', 'Active', 'نشط', 'Aktif'],
  inactive: ['غیرفعال', 'Inactive', 'غير نشط', 'Pasif'],
  block: ['مسدود کردن', 'Block', 'حظر', 'Engelle'],
  unblock: ['رفع مسدودی', 'Unblock', 'إلغاء الحظر', 'Engeli kaldır'],
  save: ['ذخیره', 'Save', 'حفظ', 'Kaydet'],
  image: ['تصویر', 'Image', 'الصورة', 'Görsel'],
  upload_image: ['بارگذاری تصویر', 'Upload image', 'رفع صورة', 'Görsel yükle'],
  or_image_url: ['یا نشانی تصویر', 'or image URL', 'أو رابط الصورة', 'veya görsel bağlantısı'],
  tags: ['برچسب‌ها', 'Tags', 'الوسوم', 'Etiketler'],
  active_product: ['نمایش در فروشگاه', 'Visible in store', 'ظاهر في المتجر', 'Mağazada görünür'],
  saved: ['ذخیره شد.', 'Saved.', 'تم الحفظ.', 'Kaydedildi.'],
  error_generic: ['خطایی رخ داد. دوباره تلاش کنید.', 'Something went wrong. Please retry.', 'حدث خطأ. حاول مجددًا.', 'Bir hata oluştu. Tekrar deneyin.'],
  add_success: ['به سبد اضافه شد.', 'Added to cart.', 'أُضيف إلى السلة.', 'Sepete eklendi.'],
  low_stock: ['کم‌موجود', 'Low stock', 'مخزون منخفض', 'Az stok'],
  no_results_ai: ['چیزی پیدا نشد؛ دستیار هوشمند را امتحان کنید.', 'Nothing found; try the AI assistant.', 'لا نتائج؛ جرّب المساعد الذكي.', 'Sonuç yok; yapay zeka asistanını deneyin.'],
  store: ['فروشگاه', 'Store', 'المتجر', 'Mağaza'],
  all_status: ['همه وضعیت‌ها', 'All statuses', 'كل الحالات', 'Tüm durumlar'],
  pending: ['در انتظار تأیید', 'Pending', 'قيد الانتظار', 'Beklemede'],
  confirmed: ['تأیید شده', 'Confirmed', 'مؤكد', 'Onaylandı'],
  shipped: ['ارسال شده', 'Shipped', 'تم الشحن', 'Kargoda'],
  delivered: ['تحویل شده', 'Delivered', 'تم التسليم', 'Teslim edildi'],
  canceled: ['لغو شده', 'Canceled', 'ملغى', 'İptal'],
  returned: ['مرجوعی', 'Returned', 'مرتجع', 'İade'],
  next_status: ['تغییر وضعیت', 'Update status', 'تغيير الحالة', 'Durumu güncelle'],
  profile: ['پروفایل', 'Profile', 'الملف الشخصي', 'Profil'],
  product_count: ['تعداد کالا', 'Products', 'المنتجات', 'Ürünler'],
  revenue: ['فروش کل', 'Revenue', 'إجمالي المبيعات', 'Ciro'],
  best_sellers: ['پرفروش‌ها', 'Top products', 'الأكثر مبيعًا', 'En çok satanlar'],
  restock: ['نیاز به تأمین', 'Needs restock', 'يحتاج تزويد', 'Stok gerekli'],
  tips: ['پیشنهادها', 'Suggestions', 'اقتراحات', 'Öneriler'],
  open_store: ['ورود به فروشگاه', 'Open store', 'فتح المتجر', 'Mağazayı aç'],
  no_data: ['داده‌ای نیست.', 'No data.', 'لا بيانات.', 'Veri yok.'],
  preview_banner: ['نسخهٔ پیش‌نمایش شاخهٔ appjet — برای بررسی شما', 'appjet branch preview — for your review', 'معاينة فرع appjet — للمراجعة', 'appjet dalı önizlemesi — incelemeniz için'],
};

let currentLang = (() => {
  try {
    const saved = localStorage.getItem('sb_lang');
    if (LANGS.includes(saved)) return saved;
  } catch { /* ignore */ }
  return 'fa';
})();

export function getLang() { return currentLang; }

export function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  currentLang = lang;
  try { localStorage.setItem('sb_lang', lang); } catch { /* ignore */ }
  applyDir();
  document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
}

export function applyDir() {
  const rtl = RTL.includes(currentLang);
  document.documentElement.lang = currentLang;
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
}

export function t(key, vars) {
  const row = DICT[key];
  let text = row ? (row[idx[currentLang]] || row[0]) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

export function localize(node = document) {
  node.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  node.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
}

/* ------------------------------- CSRF ------------------------------- */
const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function csrfTokenFromCookie() {
  const match = document.cookie.match(/(?:^|;\s*)sb_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

let csrfPending = null;

export function ensureCsrfToken() {
  const existing = csrfTokenFromCookie();
  if (existing) return Promise.resolve(existing);
  if (!csrfPending) {
    csrfPending = fetch('/api/csrf', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => data?.token || '')
      .catch(() => '')
      .finally(() => { csrfPending = null; });
  }
  return csrfPending;
}

// افزودن خودکار توکن CSRF به همهٔ درخواست‌های تغییردهندهٔ هم‌مبدأ
if (typeof window !== 'undefined' && !window.__sbCsrfPatched) {
  window.__sbCsrfPatched = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const request = typeof input === 'string' ? null : input;
    const url = typeof input === 'string' ? input : (request?.url || '');
    const method = String(init.method || request?.method || 'GET').toUpperCase();
    const sameOrigin = !/^[a-z]+:\/\//i.test(url) || url.startsWith(window.location.origin);
    if (STATE_CHANGING.has(method) && sameOrigin) {
      let token = csrfTokenFromCookie();
      if (!token) {
        try { token = await ensureCsrfToken(); } catch { token = ''; }
      }
      if (token) {
        const headers = new Headers(init.headers || request?.headers);
        if (!headers.has('x-csrf-token')) headers.set('x-csrf-token', token);
        init = { ...init, headers };
      }
    }
    return nativeFetch(input, init);
  };
}

/* ------------------------------- API ------------------------------- */
export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const err = new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const money = (value, lang = currentLang) => {
  const n = Number(value) || 0;
  const digits = n.toLocaleString(lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar-EG' : lang === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 0 });
  return `${digits} ${CURRENCY[lang] || CURRENCY.fa}`;
};

export const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export const stars = (rating) => {
  const r = Math.round(Number(rating) || 0);
  return '★'.repeat(Math.max(0, Math.min(5, r))) + '☆'.repeat(Math.max(0, 5 - r));
};

export const statusLabel = (status) => t(status);

export const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(currentLang === 'fa' ? 'fa-IR' : currentLang === 'ar' ? 'ar-EG' : currentLang === 'tr' ? 'tr-TR' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return String(iso).slice(0, 10); }
};

/* ------------------------------- اعلان‌ها ------------------------------- */
export function toast(message, type = '') {
  let host = document.querySelector('.toasts');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toasts';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

/* ------------------------------- سبد خرید ------------------------------- */
const CART_KEY = 'sb_cart';

export function readCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((row) => row && typeof row.productId === 'string')
      .map((row) => ({ productId: row.productId, qty: Math.max(1, Math.min(20, Number(row.qty) || 1)), name: row.name || '', price: Number(row.price) || 0, image: row.image || null }))
      .slice(0, 40);
  } catch { return []; }
}

export function writeCart(cart) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart.slice(0, 40))); } catch { /* ignore */ }
  document.dispatchEvent(new CustomEvent('cartchange', { detail: cart }));
}

export function addToCart(product, qty = 1) {
  const cart = readCart();
  const found = cart.find((row) => row.productId === product.id);
  if (found) found.qty = Math.min(20, found.qty + qty);
  else cart.push({ productId: product.id, qty, name: product.name, price: product.price, image: product.image || null });
  writeCart(cart);
  return cart;
}

export function cartCount(cart = readCart()) {
  return cart.reduce((sum, row) => sum + row.qty, 0);
}

export function setQty(productId, qty) {
  const cart = readCart();
  const row = cart.find((r) => r.productId === productId);
  if (!row) return cart;
  row.qty = Math.max(0, Math.min(20, Number(qty) || 0));
  writeCart(cart.filter((r) => r.qty > 0));
  return readCart();
}

export function clearCart() { writeCart([]); }

/* ------------------------------- مودال ------------------------------- */
export function openOverlay(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  const focusable = el.querySelector('input, select, textarea, button');
  if (focusable) setTimeout(() => focusable.focus(), 60);
}

export function closeOverlay(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.overlay.open, .drawer.open')) document.body.style.overflow = '';
}

export function openDrawer(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeDrawer(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  if (!document.querySelector('.overlay.open, .drawer.open')) document.body.style.overflow = '';
}

/* ------------------------------- دسته‌بندی ------------------------------- */
let metaCache = null;
export async function meta() {
  if (metaCache) return metaCache;
  metaCache = await api('/api/meta');
  return metaCache;
}
export function catLabel(slug) {
  const list = metaCache?.categories || [];
  const cat = list.find((c) => c.slug === slug);
  if (!cat) return slug || '';
  return cat[currentLang] || cat.fa || slug;
}
export function catIcon(slug) {
  const cat = (metaCache?.categories || []).find((c) => c.slug === slug);
  return cat?.icon || '🛍️';
}

/* ------------------------------- تصویر محصول ------------------------------- */
export function productImage(product, size = 'card') {
  if (product?.image) return `<img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">`;
  return `<div class="emoji" aria-hidden="true">${catIcon(product?.category)}</div>`;
}

export function bindOverlayDismiss() {
  document.querySelectorAll('.overlay').forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeOverlay(overlay.id);
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.overlay.open').forEach((o) => closeOverlay(o.id));
    document.querySelectorAll('.drawer.open').forEach((d) => closeDrawer(d.id));
  });
}

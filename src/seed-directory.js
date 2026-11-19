// بازار هوشمند — دادهٔ نمایشی بانک اصناف و متقاضیان تبلیغات (کاملاً جدا از دادهٔ واقعی: dataset='demo')
import { id } from './store.js';

const iso = (daysAgo = 0) => new Date(Date.now() - daysAgo * 864e5).toISOString();

const RAW_BUSINESSES = [
  ['نان‌آوران سپید', 'manufacturer', 'manufacturer', 'IR', 'تهران', 'تهران', '+982188770011', '+989121110011', 'https://nanaavaran.example.ir', 'public_website', 'granted'],
  ['پخش مواد غذایی البرز', 'wholesaler', 'wholesaler', 'IR', 'البرز', 'کرج', '+982632220022', '+989121110022', 'https://alborzfood.example.ir', 'public_website', 'granted'],
  ['آرایشگاه مردانهٔ رضوان', 'salon_male', 'service', 'IR', 'تهران', 'تهران', '+982144550033', '+989121110033', null, 'official_page', 'granted'],
  ['سالن زیبایی نگار', 'salon_female', 'service', 'IR', 'اصفهان', 'اصفهان', '+983132220044', '+989121110044', 'https://negar-salon.example.ir', 'official_page', 'pending'],
  ['رستوران باغ ایرانی', 'restaurant', 'service', 'IR', 'فارس', 'شیراز', '+987132330055', '+989121110055', 'https://bagh-irani.example.ir', 'public_website', 'granted'],
  ['کافه رُز', 'cafe', 'service', 'IR', 'خراسان رضوی', 'مشهد', '+985138440066', '+989121110066', null, 'business_card', 'revoked'],
  ['کلینیک دندان‌پزشکی مهر', 'dental_clinic', 'service', 'IR', 'تهران', 'تهران', '+982199660077', '+989121110077', 'https://mehrdental.example.ir', 'public_website', 'granted'],
  ['مطب دکتر کاظمی', 'doctor_office', 'service', 'IR', 'خوزستان', 'اهواز', '+986133770088', '+989121110088', null, 'public_directory', 'pending'],
  ['کلینیک خصوصی شفا', 'private_clinic', 'service', 'IR', 'مازندران', 'ساری', '+981133880099', '+989121110099', 'https://shafaclinic.example.ir', 'public_website', 'granted'],
  ['فروشگاه لوازم خانگی پارس', 'store', 'retailer', 'IR', 'آذربایجان شرقی', 'تبریز', '+984133990100', '+989121110100', 'https://pars-home.example.ir', 'public_website', 'granted'],
  ['توزیع‌کنندهٔ پوشاک آتوسا', 'wholesaler', 'distributor', 'IR', 'تهران', 'تهران', '+982177110111', '+989121110111', null, 'business_card', 'pending'],
  ['واردات قطعات یدکی خلیج', 'importer', 'importer', 'AE', 'دبی', 'دبی', '+971422220222', '+971502220222', 'https://gulf-parts.example.ae', 'public_website', 'granted'],
  ['مطعم الشام', 'restaurant', 'service', 'IQ', 'بغداد', 'بغداد', '+964781110333', '+964781110333', null, 'official_page', 'granted'],
  ['صالون الياسمين', 'salon_female', 'service', 'IQ', 'بصره', 'بصره', '+964781110444', '+964781110444', null, 'official_page', 'pending'],
  ['عيادة النور للأسنان', 'dental_clinic', 'service', 'SA', 'ریاض', 'ریاض', '+966112220555', '+966502220555', 'https://alnoor-dental.example.sa', 'public_website', 'granted'],
  ['متجر التمور الفاخرة', 'retailer', 'retailer', 'SA', 'جده', 'جده', '+966112220666', '+966502220666', 'https://dates-lux.example.sa', 'public_website', 'granted'],
  ['İstanbul Tekstil Toptan', 'wholesaler', 'wholesaler', 'TR', 'استانبول', 'استانبول', '+902122220777', '+905322220777', 'https://ist-tekstil.example.tr', 'public_website', 'granted'],
  ['Ankara Kahve', 'cafe', 'service', 'TR', 'آنکارا', 'آنکارا', '+903122220888', '+905322220888', null, 'official_page', 'pending'],
  ['مرکز پخش مسقط', 'store', 'distributor', 'OM', 'مسقط', 'مسقط', '+968221110999', '+968921110999', null, 'business_card', 'granted'],
  ['کارخانهٔ صنایع چوب شرق', 'manufacturer', 'manufacturer', 'IR', 'خراسان رضوی', 'نیشابور', '+985133001100', '+989121111100', null, 'public_website', 'revoked'],
];

const RAW_LEADS = [
  ['سارا محمدی', 'گالری فرش سارا', 'retailer', 'IR', 'تهران', 'تهران', '+989121230001', ['instagram'], 'story', 1200, 14, 'negotiating', 'granted', 'instagram'],
  ['علی کریمی', 'کافهٔ کریمی', 'cafe', 'IR', 'اصفهان', 'اصفهان', '+989121230002', ['instagram', 'telegram'], 'post', 650, 10, 'new', 'granted', 'instagram'],
  ['مهدی رضایی', 'پخش رضایی', 'wholesaler', 'IR', 'فارس', 'شیراز', '+989121230003', ['google', 'website'], 'search', 2400, 30, 'contacted', 'pending', 'google'],
  ['نورا الحربي', 'متجر نورا', 'retailer', 'SA', 'ریاض', 'ریاض', '+966501230004', ['instagram', 'tiktok'], 'reel', 1800, 21, 'new', 'granted', 'instagram'],
  ['حسن العبيدي', 'مطعم الرافدين', 'restaurant', 'IQ', 'بغداد', 'بغداد', '+964781230005', ['telegram'], 'video', 900, 7, 'won', 'granted', 'telegram'],
  ['Ece Yılmaz', 'Ece Kozmetik', 'store', 'TR', 'استانبول', 'استانبول', '+905321230006', ['instagram', 'youtube'], 'video', 3000, 28, 'converted', 'granted', 'youtube'],
  ['خالد المنصوري', 'عيادة المنصوري', 'private_clinic', 'AE', 'دبی', 'دبی', '+971501230007', ['instagram', 'google'], 'banner', 4200, 45, 'negotiating', 'granted', 'instagram'],
  ['زهرا احمدی', 'آرایشگاه زهرا', 'salon_female', 'IR', 'مازندران', 'بابل', '+989121230008', ['instagram'], 'post', 400, 5, 'lost', 'revoked', 'instagram'],
];

export function seedDirectory(db) {
  if (!Array.isArray(db.businesses)) db.businesses = [];
  if (!Array.isArray(db.adLeads)) db.adLeads = [];
  if (!Array.isArray(db.crmActivities)) db.crmActivities = [];
  if (!Array.isArray(db.auditLog)) db.auditLog = [];
  if (db.businesses.length || db.adLeads.length) return { seeded: false };

  const admin = db.users.find((u) => u.role === 'admin');
  const businesses = RAW_BUSINESSES.map((row, index) => {
    const [name, industry, type, country, province, city, phone, mobile, website, sourceType, consent] = row;
    return {
      id: id(),
      name,
      industry,
      type,
      country,
      province,
      city,
      address: `${city}، خیابان اصلی، پلاک ${10 + index}`,
      phone,
      mobile,
      whatsapp: index % 3 === 0 ? mobile : null,
      telegram: index % 4 === 0 ? `https://t.me/${name.replace(/\s+/g, '_').slice(0, 18)}` : null,
      instagram: index % 2 === 0 ? `https://instagram.com/${name.replace(/\s+/g, '_').slice(0, 18)}` : null,
      website: website || null,
      socials: {},
      sourceType,
      sourceUrl: website || '',
      sourceNote: 'اطلاعات کاری منتشرشده توسط خود کسب‌وکار',
      verifiedStatus: index % 5 === 0 ? 'stale' : 'verified',
      lastCheckedAt: iso(index % 9),
      consent: {
        status: consent,
        at: iso(index + 1),
        source: 'self_registration',
        note: consent === 'revoked' ? 'درخواست لغو دریافت تبلیغات' : '',
        revokedAt: consent === 'revoked' ? iso(index) : null,
      },
      consentHistory: [],
      adLicense: consent === 'granted',
      notes: index % 3 === 0 ? 'علاقه‌مند به تبلیغ فصلی؛ پیگیری در ابتدای فصل.' : '',
      assignedTo: admin?.id || null,
      assignedName: admin?.name || 'مدیر',
      dataset: 'demo',
      createdAt: iso(index + 2),
      updatedAt: iso(index),
    };
  });

  const leads = RAW_LEADS.map((row, index) => {
    const [name, businessName, industry, country, province, city, phone, networks, format, budgetUsd, durationDays, status, consent, network] = row;
    return {
      id: id(),
      name,
      businessName,
      industry,
      country,
      province,
      city,
      phone,
      preferredContact: network === 'telegram' ? 'telegram' : 'whatsapp',
      networks,
      format,
      budgetUsd,
      durationDays,
      startAt: null,
      status,
      consent: { status: consent, at: iso(index + 1), source: 'self_registration', note: '', revokedAt: consent === 'revoked' ? iso(index) : null },
      consentHistory: [],
      adLicense: consent === 'granted',
      notes: index % 2 === 0 ? 'درخواست از طریق فرم سایت ثبت شد.' : '',
      assignedTo: admin?.id || null,
      assignedName: admin?.name || 'مدیر',
      dataset: 'demo',
      convertedUserId: null,
      createdAt: iso(index + 1),
      updatedAt: iso(index),
    };
  });

  db.businesses.push(...businesses);
  db.adLeads.push(...leads);

  const firstBusiness = businesses[0];
  const firstLead = leads[0];
  db.crmActivities.push(
    {
      id: id(), entityType: 'business', entityId: firstBusiness.id, type: 'call',
      summary: 'تماس اولیه برای معرفی بستهٔ تبلیغاتی؛ درخواست ارسال پیش‌فاکتور.', outcome: 'interested',
      nextCallAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString(), ownerId: admin?.id || null,
      ownerName: admin?.name || 'مدیر', createdBy: admin?.id || null, createdByName: admin?.name || 'مدیر',
      done: false, createdAt: iso(2),
    },
    {
      id: id(), entityType: 'lead', entityId: firstLead.id, type: 'message',
      summary: 'ارسال پیش‌فاکتور تبلیغ اینستاگرام و پیگیری پاسخ.', outcome: 'callback',
      nextCallAt: new Date(Date.now() + 26 * 3600 * 1000).toISOString(), ownerId: admin?.id || null,
      ownerName: admin?.name || 'مدیر', createdBy: admin?.id || null, createdByName: admin?.name || 'مدیر',
      done: false, createdAt: iso(1),
    },
  );

  if (!Array.isArray(db.discounts) || !db.discounts.length) {
    db.discounts = [
      { id: id(), code: 'WELCOME10', type: 'percent', value: 10, maxAmount: 500000, active: true, dataset: 'demo', createdAt: iso(30) },
      { id: id(), code: 'BAZAAR15', type: 'percent', value: 15, maxAmount: 900000, active: true, dataset: 'demo', createdAt: iso(12) },
    ];
  }

  if (!db.settings) db.settings = {};
  if (db.settings.commissionRate === undefined) db.settings.commissionRate = 0.07;

  db.auditLog.push({
    id: id(), at: iso(0), actorId: admin?.id || null, actorRole: 'admin',
    action: 'directory_seed', target: 'demo', meta: { businesses: businesses.length, leads: leads.length }, ip: '',
  });

  return { seeded: true, businesses: businesses.length, leads: leads.length };
}

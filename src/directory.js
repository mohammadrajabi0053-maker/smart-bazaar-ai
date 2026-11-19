// بازار هوشمند — بانک اطلاعات اصناف، متقاضیان تبلیغات و CRM پیگیری
// قواعد حریم خصوصی: فقط اطلاعات کاری مجاز، ثبت منبع، رضایت و لغو رضایت، کنترل دسترسی نقش‌محور
import crypto from 'node:crypto';
import { id } from './store.js';
import { phoneKey, maskPhone, normalizePhone } from './otp.js';

/* --------------------------------- ثابت‌ها --------------------------------- */

export const INDUSTRIES = [
  { slug: 'manufacturer', icon: '🏭', fa: 'تولیدکننده', en: 'Manufacturer', ar: 'مُصنّع', tr: 'Üretici' },
  { slug: 'importer', icon: '🚢', fa: 'واردکننده', en: 'Importer', ar: 'مستورد', tr: 'İthalatçı' },
  { slug: 'wholesaler', icon: '📦', fa: 'توزیع‌کننده عمده', en: 'Wholesaler', ar: 'تاجر جملة', tr: 'Toptancı' },
  { slug: 'retailer', icon: '🛍️', fa: 'خرده‌فروش', en: 'Retailer', ar: 'تاجر تجزئة', tr: 'Perakendeci' },
  { slug: 'store', icon: '🏬', fa: 'فروشگاه و مرکز پخش', en: 'Store & distribution center', ar: 'متجر ومركز توزيع', tr: 'Mağaza ve dağıtım merkezi' },
  { slug: 'salon_male', icon: '💈', fa: 'آرایشگاه مردانه', en: 'Men’s salon', ar: 'صالون رجالي', tr: 'Erkek kuaförü' },
  { slug: 'salon_female', icon: '💇', fa: 'آرایشگاه زنانه', en: 'Women’s salon', ar: 'صالون نسائي', tr: 'Kadın kuaförü' },
  { slug: 'restaurant', icon: '🍽️', fa: 'رستوران', en: 'Restaurant', ar: 'مطعم', tr: 'Restoran' },
  { slug: 'cafe', icon: '☕', fa: 'کافی‌شاپ', en: 'Coffee shop', ar: 'مقهى', tr: 'Kafe' },
  { slug: 'dental_clinic', icon: '🦷', fa: 'کلینیک دندان‌پزشکی', en: 'Dental clinic', ar: 'عيادة أسنان', tr: 'Diş kliniği' },
  { slug: 'doctor_office', icon: '🩺', fa: 'مطب پزشک', en: 'Doctor’s office', ar: 'عيادة طبيب', tr: 'Doktor muayenehanesi' },
  { slug: 'private_clinic', icon: '🏥', fa: 'کلینیک خصوصی', en: 'Private clinic', ar: 'عيادة خاصة', tr: 'Özel klinik' },
  { slug: 'other', icon: '🏷️', fa: 'سایر اصناف', en: 'Other businesses', ar: 'أعمال أخرى', tr: 'Diğer işletmeler' },
];

export const INDUSTRY_SLUGS = INDUSTRIES.map((i) => i.slug);

export const BUSINESS_TYPES = [
  { slug: 'manufacturer', fa: 'تولیدکننده', en: 'Manufacturer', ar: 'مُصنّع', tr: 'Üretici' },
  { slug: 'importer', fa: 'واردکننده', en: 'Importer', ar: 'مستورد', tr: 'İthalatçı' },
  { slug: 'wholesaler', fa: 'عمده‌فروش', en: 'Wholesale', ar: 'بيع بالجملة', tr: 'Toptan' },
  { slug: 'retailer', fa: 'خرده‌فروش', en: 'Retail', ar: 'بيع بالتجزئة', tr: 'Perakende' },
  { slug: 'distributor', fa: 'توزیع‌کننده', en: 'Distributor', ar: 'موزّع', tr: 'Distribütör' },
  { slug: 'service', fa: 'خدمات', en: 'Services', ar: 'خدمات', tr: 'Hizmet' },
];

export const TYPE_SLUGS = BUSINESS_TYPES.map((b) => b.slug);

export const COUNTRIES = [
  {
    code: 'IR', fa: 'ایران', en: 'Iran', ar: 'إيران', tr: 'İran',
    provinces: [
      { fa: 'تهران', en: 'Tehran' }, { fa: 'اصفهان', en: 'Isfahan' }, { fa: 'خراسان رضوی', en: 'Razavi Khorasan' },
      { fa: 'فارس', en: 'Fars' }, { fa: 'آذربایجان شرقی', en: 'East Azerbaijan' }, { fa: 'خوزستان', en: 'Khuzestan' },
      { fa: 'البرز', en: 'Alborz' }, { fa: 'مازندران', en: 'Mazandaran' },
    ],
  },
  {
    code: 'IQ', fa: 'عراق', en: 'Iraq', ar: 'العراق', tr: 'Irak',
    provinces: [
      { fa: 'بغداد', en: 'Baghdad' }, { fa: 'بصره', en: 'Basra' }, { fa: 'اربیل', en: 'Erbil' }, { fa: 'نجف', en: 'Najaf' },
    ],
  },
  {
    code: 'AE', fa: 'امارات', en: 'United Arab Emirates', ar: 'الإمارات', tr: 'Birleşik Arap Emirlikleri',
    provinces: [
      { fa: 'دبی', en: 'Dubai' }, { fa: 'ابوظبی', en: 'Abu Dhabi' }, { fa: 'شارجه', en: 'Sharjah' },
    ],
  },
  {
    code: 'SA', fa: 'عربستان', en: 'Saudi Arabia', ar: 'السعودية', tr: 'Suudi Arabistan',
    provinces: [
      { fa: 'ریاض', en: 'Riyadh' }, { fa: 'جده', en: 'Jeddah' }, { fa: 'مکه', en: 'Makkah' },
    ],
  },
  {
    code: 'TR', fa: 'ترکیه', en: 'Türkiye', ar: 'تركيا', tr: 'Türkiye',
    provinces: [
      { fa: 'استانبول', en: 'Istanbul' }, { fa: 'آنکارا', en: 'Ankara' }, { fa: 'ازمیر', en: 'Izmir' },
    ],
  },
  {
    code: 'OM', fa: 'عمان', en: 'Oman', ar: 'عُمان', tr: 'Umman',
    provinces: [{ fa: 'مسقط', en: 'Muscat' }, { fa: 'صلاله', en: 'Salalah' }],
  },
];

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code);

export const SOURCE_TYPES = [
  { slug: 'public_website', fa: 'وب‌سایت رسمی', en: 'Official website', ar: 'الموقع الرسمي', tr: 'Resmî web sitesi' },
  { slug: 'official_page', fa: 'صفحهٔ رسمی شبکه اجتماعی', en: 'Official social page', ar: 'صفحة رسمية', tr: 'Resmî sosyal sayfa' },
  { slug: 'business_card', fa: 'کارت ویزیت کسب‌وکار', en: 'Business card', ar: 'بطاقة العمل', tr: 'Kartvizit' },
  { slug: 'self_registration', fa: 'ثبت‌نام خود کسب‌وکار', en: 'Self registration', ar: 'تسجيل ذاتي', tr: 'Kendi kaydı' },
  { slug: 'referral', fa: 'معرفی با اجازه', en: 'Referral with consent', ar: 'إحالة بموافقة', tr: 'Onaylı referans' },
  { slug: 'public_directory', fa: 'راهنمای عمومی اصناف', en: 'Public business directory', ar: 'دليل أعمال عام', tr: 'Genel işletme rehberi' },
];

export const SOURCE_SLUGS = SOURCE_TYPES.map((s) => s.slug);

export const CONSENT_STATUSES = ['pending', 'granted', 'revoked'];

export const VERIFY_STATUSES = ['unverified', 'verified', 'stale'];

export const LEAD_STATUSES = ['new', 'contacted', 'negotiating', 'won', 'lost', 'converted'];

export const AD_NETWORKS = ['instagram', 'telegram', 'youtube', 'google', 'website', 'tiktok', 'whatsapp'];

export const AD_FORMATS = ['post', 'story', 'reel', 'video', 'banner', 'search', 'article'];

export const ACTIVITY_TYPES = ['call', 'meeting', 'message', 'note'];

export const ACTIVITY_OUTCOMES = ['no_answer', 'interested', 'callback', 'not_interested', 'converted'];

export class DirectoryError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

/* --------------------------------- ابزارها --------------------------------- */

const text = (value, max = 200) => String(value ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/[\u0000-\u001f\u007f]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const multiline = (value, max = 800) => String(value ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/[^\S\n]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
  .slice(0, max);

const iso = () => new Date().toISOString();

export function isCountry(code) {
  return COUNTRY_CODES.includes(String(code || '').toUpperCase());
}

export function isIndustry(slug) {
  return INDUSTRY_SLUGS.includes(slug);
}

export function isType(slug) {
  return TYPE_SLUGS.includes(slug);
}

export function isSource(slug) {
  return SOURCE_SLUGS.includes(slug);
}

export function industryLabel(slug, lang = 'fa') {
  const row = INDUSTRIES.find((i) => i.slug === slug);
  return row ? row[lang] || row.fa : slug;
}

export function typeLabel(slug, lang = 'fa') {
  const row = BUSINESS_TYPES.find((b) => b.slug === slug);
  return row ? row[lang] || row.fa : slug;
}

export function countryLabel(code, lang = 'fa') {
  const row = COUNTRIES.find((c) => c.code === code);
  return row ? row[lang] || row.fa : code;
}

export function catalogPayload() {
  return {
    industries: INDUSTRIES,
    types: BUSINESS_TYPES,
    countries: COUNTRIES,
    sources: SOURCE_TYPES,
    consentStatuses: CONSENT_STATUSES,
    verifyStatuses: VERIFY_STATUSES,
    leadStatuses: LEAD_STATUSES,
    networks: AD_NETWORKS,
    formats: AD_FORMATS,
    activityTypes: ACTIVITY_TYPES,
    activityOutcomes: ACTIVITY_OUTCOMES,
  };
}

/* ------------------------------ رویداد حسابرسی ------------------------------ */

export function logAudit(db, { actor = null, action, target = '', meta = {}, ip = '' }) {
  if (!Array.isArray(db.auditLog)) db.auditLog = [];
  db.auditLog.push({
    id: id(),
    at: iso(),
    actorId: actor?.id || null,
    actorRole: actor?.role || 'system',
    action: text(action, 60),
    target: text(target, 120),
    meta: meta && typeof meta === 'object' ? JSON.parse(JSON.stringify(meta)) : {},
    ip: text(ip, 60),
  });
  if (db.auditLog.length > 2000) db.auditLog = db.auditLog.slice(-2000);
  return db.auditLog[db.auditLog.length - 1];
}

/* --------------------------- رضایت و مجوز تبلیغات --------------------------- */

export function consentView(consent) {
  const row = consent || { status: 'pending' };
  return {
    status: CONSENT_STATUSES.includes(row.status) ? row.status : 'pending',
    at: row.at || null,
    source: row.source || null,
    note: row.note || '',
    revokedAt: row.revokedAt || null,
  };
}

export function canAdvertise(entity) {
  const consent = consentView(entity?.consent);
  const adLicense = entity?.adLicense === true;
  return consent.status === 'granted' && adLicense && !entity?.deletedAt;
}

export function setConsent(entity, { status, source = '', note = '' }, actor = null) {
  if (!CONSENT_STATUSES.includes(status)) throw new DirectoryError('consent_status_invalid');
  const previous = consentView(entity.consent);
  entity.consent = {
    status,
    at: iso(),
    source: text(source, 120) || previous.source || '',
    note: text(note, 300),
    revokedAt: status === 'revoked' ? iso() : null,
  };
  if (status === 'revoked') entity.adLicense = false;
  entity.consentHistory = Array.isArray(entity.consentHistory) ? entity.consentHistory : [];
  entity.consentHistory.push({
    status,
    at: entity.consent.at,
    by: actor?.id || 'public',
    source: entity.consent.source,
    note: entity.consent.note,
  });
  if (entity.consentHistory.length > 40) entity.consentHistory = entity.consentHistory.slice(-40);
  entity.updatedAt = iso();
  return entity;
}

/* --------------------------- اعتبارسنجی کسب‌وکار --------------------------- */

export function normalizeBusinessInput(body = {}) {
  const errors = [];
  const name = text(body.name, 120);
  const industry = String(body.industry || '').trim();
  const type = String(body.type || 'retailer').trim();
  const country = String(body.country || 'IR').toUpperCase().trim();
  const province = text(body.province, 60);
  const city = text(body.city, 60);
  const phone = normalizePhone(body.phone);
  const mobile = normalizePhone(body.mobile);
  const sourceType = String(body.sourceType || '').trim();
  const sourceUrl = text(body.sourceUrl, 300);

  if (name.length < 3) errors.push('business_name_required');
  if (!isIndustry(industry)) errors.push('industry_invalid');
  if (!isType(type)) errors.push('business_type_invalid');
  if (!isCountry(country)) errors.push('country_invalid');
  if (province.length < 2) errors.push('province_required');
  if (city.length < 2) errors.push('city_required');
  if (!phone && !mobile) errors.push('contact_required');
  if (!isSource(sourceType)) errors.push('source_required');
  if (sourceUrl && !/^https?:\/\/[^\s]+$/i.test(sourceUrl)) errors.push('source_url_invalid');

  const socials = {};
  for (const key of ['instagram', 'telegram', 'youtube', 'google', 'website', 'whatsapp']) {
    const raw = text(body?.[key] ?? body?.socials?.[key], 200);
    if (!raw) continue;
    socials[key] = raw;
  }

  return {
    errors,
    value: {
      name,
      industry,
      type,
      country,
      province,
      city,
      address: multiline(body.address, 300),
      phone,
      mobile,
      whatsapp: socials.whatsapp || normalizePhone(body.whatsapp) || null,
      telegram: socials.telegram || null,
      instagram: socials.instagram || null,
      website: socials.website || null,
      socials,
      sourceType,
      sourceUrl,
      sourceNote: text(body.sourceNote, 200),
      notes: multiline(body.notes, 800),
    },
  };
}

/** جلوگیری از ثبت تکراری: شمارهٔ کاری/همراه یا نام+شهر یکسان */
export function findDuplicate(db, value, excludeId = null) {
  const keys = [phoneKey(value.phone), phoneKey(value.mobile)].filter(Boolean);
  const nameKey = `${String(value.name || '').replace(/\s+/g, '').toLowerCase()}|${String(value.city || '').toLowerCase()}`;
  return (db.businesses || []).find((row) => {
    if (excludeId && row.id === excludeId) return false;
    if (row.deletedAt) return false;
    const rowKeys = [phoneKey(row.phone), phoneKey(row.mobile)].filter(Boolean);
    if (keys.length && rowKeys.some((k) => keys.includes(k))) return true;
    const rowName = `${String(row.name || '').replace(/\s+/g, '').toLowerCase()}|${String(row.city || '').toLowerCase()}`;
    return rowName === nameKey;
  }) || null;
}

export function findLeadDuplicate(db, { phone, name, city }, excludeId = null) {
  const key = phoneKey(phone);
  return (db.adLeads || []).find((row) => {
    if (excludeId && row.id === excludeId) return false;
    if (key && phoneKey(row.phone) === key) return true;
    return String(row.name || '').replace(/\s+/g, '').toLowerCase() === String(name || '').replace(/\s+/g, '').toLowerCase()
      && String(row.city || '').toLowerCase() === String(city || '').toLowerCase();
  }) || null;
}

/* ------------------------------ نمایش و دسترسی ------------------------------ */

/**
 * نمایش کسب‌وکار بر اساس سطح دسترسی.
 * فقط نقش‌های مجاز (admin/agent) شمارهٔ کامل می‌بینند؛ بقیه ماسک می‌شوند.
 */
export function businessView(row, { canSeeContacts = false, lang = 'fa' } = {}) {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry,
    industryLabel: industryLabel(row.industry, lang),
    type: row.type,
    typeLabel: typeLabel(row.type, lang),
    country: row.country,
    countryLabel: countryLabel(row.country, lang),
    province: row.province,
    city: row.city,
    address: row.address || '',
    phone: canSeeContacts ? row.phone || null : maskPhone(row.phone),
    mobile: canSeeContacts ? row.mobile || null : maskPhone(row.mobile),
    whatsapp: canSeeContacts ? row.whatsapp || null : null,
    telegram: canSeeContacts ? row.telegram || null : null,
    instagram: canSeeContacts ? row.instagram || null : null,
    website: row.website || null,
    contactsVisible: canSeeContacts,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl || '',
    sourceNote: row.sourceNote || '',
    verifiedStatus: row.verifiedStatus || 'unverified',
    lastCheckedAt: row.lastCheckedAt || null,
    consent: consentView(row.consent),
    adLicense: Boolean(row.adLicense),
    canAdvertise: canAdvertise(row),
    assignedTo: row.assignedTo || null,
    assignedName: row.assignedName || null,
    dataset: row.dataset || 'live',
    notes: canSeeContacts ? row.notes || '' : '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function leadView(row, { canSeeContacts = false, lang = 'fa' } = {}) {
  return {
    id: row.id,
    name: row.name,
    businessName: row.businessName,
    industry: row.industry,
    industryLabel: industryLabel(row.industry, lang),
    country: row.country,
    countryLabel: countryLabel(row.country, lang),
    province: row.province,
    city: row.city,
    phone: canSeeContacts ? row.phone : maskPhone(row.phone),
    preferredContact: row.preferredContact || 'phone',
    networks: row.networks || [],
    format: row.format || 'post',
    budgetUsd: Number(row.budgetUsd) || 0,
    durationDays: Number(row.durationDays) || 0,
    startAt: row.startAt || null,
    status: LEAD_STATUSES.includes(row.status) ? row.status : 'new',
    consent: consentView(row.consent),
    canAdvertise: canAdvertise(row),
    assignedTo: row.assignedTo || null,
    assignedName: row.assignedName || null,
    dataset: row.dataset || 'live',
    notes: canSeeContacts ? row.notes || '' : '',
    convertedUserId: row.convertedUserId || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function normalizeLeadInput(body = {}) {
  const errors = [];
  const name = text(body.name, 80);
  const businessName = text(body.businessName, 120);
  const industry = String(body.industry || '').trim();
  const country = String(body.country || 'IR').toUpperCase().trim();
  const province = text(body.province, 60);
  const city = text(body.city, 60);
  const phone = normalizePhone(body.phone);
  const networks = Array.isArray(body.networks)
    ? body.networks.map((n) => String(n)).filter((n) => AD_NETWORKS.includes(n))
    : [];
  const format = AD_FORMATS.includes(String(body.format)) ? String(body.format) : 'post';
  const preferredContact = ['phone', 'whatsapp', 'telegram', 'instagram', 'email'].includes(String(body.preferredContact))
    ? String(body.preferredContact)
    : 'phone';
  const budgetUsd = Math.max(0, Math.min(10_000_000, Number(body.budgetUsd) || 0));
  const durationDays = Math.max(0, Math.min(365, Math.trunc(Number(body.durationDays) || 0)));

  if (name.length < 3) errors.push('lead_name_required');
  if (businessName.length < 2) errors.push('business_name_required');
  if (!isIndustry(industry)) errors.push('industry_invalid');
  if (!isCountry(country)) errors.push('country_invalid');
  if (province.length < 2) errors.push('province_required');
  if (city.length < 2) errors.push('city_required');
  if (!phone) errors.push('phone_invalid');
  if (!networks.length) errors.push('network_required');
  if (budgetUsd <= 0) errors.push('budget_required');

  return {
    errors,
    value: {
      name,
      businessName,
      industry,
      country,
      province,
      city,
      phone,
      preferredContact,
      networks,
      format,
      budgetUsd,
      durationDays,
      startAt: body.startAt ? text(body.startAt, 40) : null,
      notes: multiline(body.notes, 800),
    },
  };
}

/* --------------------------------- جست‌وجو --------------------------------- */

export function filterBusinesses(db, query = {}) {
  const q = text(query.q, 120).toLowerCase();
  const country = String(query.country || '').toUpperCase();
  const province = text(query.province, 60).toLowerCase();
  const city = text(query.city, 60).toLowerCase();
  const industry = String(query.industry || '');
  const type = String(query.type || '');
  const consent = String(query.consent || '');
  const dataset = String(query.dataset || '');
  const assignedTo = String(query.assignedTo || '');
  const phoneQuery = phoneKey(query.phone || '');

  return (db.businesses || [])
    .filter((row) => !row.deletedAt)
    .filter((row) => (country ? row.country === country : true))
    .filter((row) => (province ? String(row.province).toLowerCase().includes(province) : true))
    .filter((row) => (city ? String(row.city).toLowerCase().includes(city) : true))
    .filter((row) => (industry ? row.industry === industry : true))
    .filter((row) => (type ? row.type === type : true))
    .filter((row) => (consent ? consentView(row.consent).status === consent : true))
    .filter((row) => (dataset ? (row.dataset || 'live') === dataset : true))
    .filter((row) => (assignedTo ? row.assignedTo === assignedTo : true))
    .filter((row) => {
      if (!phoneQuery) return true;
      return [phoneKey(row.phone), phoneKey(row.mobile)].includes(phoneQuery);
    })
    .filter((row) => {
      if (!q) return true;
      const haystack = [row.name, row.city, row.province, row.address, row.notes, row.sourceNote, row.phone, row.mobile]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

export function filterLeads(db, query = {}) {
  const q = text(query.q, 120).toLowerCase();
  const country = String(query.country || '').toUpperCase();
  const industry = String(query.industry || '');
  const status = String(query.status || '');
  const dataset = String(query.dataset || '');
  const network = String(query.network || '');

  return (db.adLeads || [])
    .filter((row) => !row.deletedAt)
    .filter((row) => (country ? row.country === country : true))
    .filter((row) => (industry ? row.industry === industry : true))
    .filter((row) => (status ? row.status === status : true))
    .filter((row) => (dataset ? (row.dataset || 'live') === dataset : true))
    .filter((row) => (network ? (row.networks || []).includes(network) : true))
    .filter((row) => {
      if (!q) return true;
      const haystack = [row.name, row.businessName, row.city, row.province, row.notes, row.phone]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/* ----------------------------------- CRM ----------------------------------- */

export function addActivity(db, { entityType, entityId, type, summary, outcome, nextCallAt, actor }) {
  if (!['business', 'lead'].includes(entityType)) throw new DirectoryError('entity_type_invalid');
  const entity = entityType === 'business'
    ? (db.businesses || []).find((b) => b.id === entityId)
    : (db.adLeads || []).find((l) => l.id === entityId);
  if (!entity) throw new DirectoryError('entity_not_found', 404);
  if (!ACTIVITY_TYPES.includes(type)) throw new DirectoryError('activity_type_invalid');
  const cleanSummary = multiline(summary, 600);
  if (cleanSummary.length < 3) throw new DirectoryError('activity_summary_required');

  const activity = {
    id: id(),
    entityType,
    entityId,
    type,
    summary: cleanSummary,
    outcome: ACTIVITY_OUTCOMES.includes(outcome) ? outcome : null,
    nextCallAt: nextCallAt ? new Date(nextCallAt).toISOString() : null,
    ownerId: entity.assignedTo || actor?.id || null,
    ownerName: entity.assignedName || actor?.name || null,
    createdBy: actor?.id || null,
    createdByName: actor?.name || null,
    done: false,
    createdAt: iso(),
  };
  if (activity.nextCallAt && Number.isNaN(Date.parse(activity.nextCallAt))) activity.nextCallAt = null;
  db.crmActivities = [...(db.crmActivities || []), activity];
  entity.lastActivityAt = activity.createdAt;
  if (outcome) entity.lastOutcome = outcome;
  entity.updatedAt = iso();
  return activity;
}

export function completeActivity(db, activityId, actor) {
  const activity = (db.crmActivities || []).find((a) => a.id === activityId);
  if (!activity) throw new DirectoryError('activity_not_found', 404);
  activity.done = true;
  activity.doneAt = iso();
  activity.doneBy = actor?.id || null;
  return activity;
}

export function activityView(row) {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    type: row.type,
    summary: row.summary,
    outcome: row.outcome || null,
    nextCallAt: row.nextCallAt || null,
    ownerName: row.ownerName || null,
    createdByName: row.createdByName || null,
    done: Boolean(row.done),
    doneAt: row.doneAt || null,
    createdAt: row.createdAt,
  };
}

export function dueReminders(db, { withinHours = 24, actorId = null } = {}) {
  const until = Date.now() + withinHours * 3600 * 1000;
  return (db.crmActivities || [])
    .filter((row) => row.nextCallAt && !row.done)
    .filter((row) => Date.parse(row.nextCallAt) <= until)
    .filter((row) => (actorId ? row.ownerId === actorId : true))
    .sort((a, b) => String(a.nextCallAt).localeCompare(String(b.nextCallAt)))
    .map((row) => {
      const entity = row.entityType === 'business'
        ? (db.businesses || []).find((b) => b.id === row.entityId)
        : (db.adLeads || []).find((l) => l.id === row.entityId);
      return {
        ...activityView(row),
        entityName: entity?.name || '',
        entityCity: entity?.city || '',
        phone: maskPhone(entity?.phone),
        overdue: Date.parse(row.nextCallAt) < Date.now(),
      };
    });
}

export function crmStats(db) {
  const activities = db.crmActivities || [];
  const open = activities.filter((a) => a.nextCallAt && !a.done);
  return {
    businesses: (db.businesses || []).filter((b) => !b.deletedAt).length,
    leads: (db.adLeads || []).filter((l) => !l.deletedAt).length,
    consentGranted: (db.businesses || []).filter((b) => canAdvertise(b)).length,
    consentRevoked: (db.businesses || []).filter((b) => consentView(b.consent).status === 'revoked').length,
    activities: activities.length,
    remindersDue: open.filter((a) => Date.parse(a.nextCallAt) <= Date.now()).length,
    optOuts: (db.optOuts || []).length,
    deletionRequests: (db.deletionRequests || []).filter((r) => r.status !== 'done').length,
    convertedLeads: (db.adLeads || []).filter((l) => l.status === 'converted').length,
  };
}

/* ------------------------------- لغو رضایت ------------------------------- */

export function recordOptOut(db, { phone, channel = 'all', reason = '', source = 'public_form' }) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new DirectoryError('phone_invalid');
  db.optOuts = Array.isArray(db.optOuts) ? db.optOuts : [];
  const existing = db.optOuts.find((o) => phoneKey(o.phone) === phoneKey(normalized) && o.channel === channel);
  const record = existing || { id: id(), phone: normalized, channel, createdAt: iso() };
  record.reason = text(reason, 300);
  record.source = text(source, 60);
  record.at = iso();
  if (!existing) db.optOuts.push(record);

  // لغو رضایت روی همهٔ رکوردهای مرتبط اعمال می‌شود
  let affected = 0;
  for (const row of [...(db.businesses || []), ...(db.adLeads || [])]) {
    if (phoneKey(row.phone) === phoneKey(normalized) || phoneKey(row.mobile) === phoneKey(normalized)) {
      setConsent(row, { status: 'revoked', source: 'opt_out', note: record.reason }, null);
      affected += 1;
    }
  }
  return { record, affected };
}

export function isOptedOut(db, phone) {
  const key = phoneKey(phone);
  if (!key) return false;
  return (db.optOuts || []).some((o) => phoneKey(o.phone) === key);
}

export function requestDeletion(db, { entityType, entityId, phone, reason, actor = null }) {
  const entity = entityType === 'business'
    ? (db.businesses || []).find((b) => b.id === entityId)
    : (db.adLeads || []).find((l) => l.id === entityId);
  if (!entity) throw new DirectoryError('entity_not_found', 404);
  const requestedPhone = normalizePhone(phone);
  if (requestedPhone && phoneKey(requestedPhone) !== phoneKey(entity.phone) && phoneKey(requestedPhone) !== phoneKey(entity.mobile)) {
    throw new DirectoryError('phone_mismatch', 403);
  }
  db.deletionRequests = Array.isArray(db.deletionRequests) ? db.deletionRequests : [];
  const record = {
    id: id(),
    entityType,
    entityId,
    name: entity.name,
    phone: entity.phone || entity.mobile || null,
    reason: text(reason, 300),
    status: 'pending',
    requestedBy: actor?.id || 'public',
    createdAt: iso(),
  };
  db.deletionRequests.push(record);
  entity.deletionRequestedAt = record.createdAt;
  entity.updatedAt = record.createdAt;
  return record;
}

export function applyDeletion(db, requestId, actor) {
  const record = (db.deletionRequests || []).find((r) => r.id === requestId);
  if (!record) throw new DirectoryError('request_not_found', 404);
  const list = record.entityType === 'business' ? db.businesses : db.adLeads;
  const entity = (list || []).find((row) => row.id === record.entityId);
  if (entity) {
    // حذف منطقی: اطلاعات تماس پاک می‌شود تا سابقهٔ حسابرسی حفظ شود
    entity.phone = null;
    entity.mobile = null;
    entity.whatsapp = null;
    entity.telegram = null;
    entity.instagram = null;
    entity.address = '';
    entity.notes = '';
    entity.deletedAt = iso();
    entity.deletedBy = actor?.id || null;
    setConsent(entity, { status: 'revoked', source: 'deletion_request', note: 'deleted' }, actor);
  }
  record.status = 'done';
  record.doneAt = iso();
  record.doneBy = actor?.id || null;
  return record;
}

/* ---------------------------------- آمار ---------------------------------- */

export function directoryStats(db) {
  const list = (db.businesses || []).filter((b) => !b.deletedAt);
  const byCountry = {};
  const byIndustry = {};
  for (const row of list) {
    byCountry[row.country] = (byCountry[row.country] || 0) + 1;
    byIndustry[row.industry] = (byIndustry[row.industry] || 0) + 1;
  }
  return { total: list.length, byCountry, byIndustry };
}

export function csvForBusinesses(db, rows) {
  const head = ['id', 'name', 'industry', 'type', 'country', 'province', 'city', 'phone', 'mobile', 'website', 'sourceType', 'lastCheckedAt', 'consent', 'adLicense', 'dataset'];
  const escape = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const lines = [head.join(',')];
  for (const row of rows) {
    const view = businessView(row, { canSeeContacts: true });
    lines.push(head.map((k) => escape(k === 'consent' ? view.consent.status : view[k])).join(','));
  }
  return lines.join('\n');
}

export function randomDemoKey() {
  return crypto.randomBytes(4).toString('hex');
}

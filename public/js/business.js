/* بازار هوشمند — منطق پنل بانک اطلاعات اصناف، متقاضیان تبلیغات و CRM */
import { api } from './core.js';
import {
  T, mountPage, toast, esc, num, badge, fmtDateTime, consentLabel, toneForConsent,
  industryOptions, countryOptions, langOf,
} from './p3.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/* برچسب چهارزبانه برای مقادیر ثابت سرور */
const LABELS = {
  networks: {
    instagram: ['اینستاگرام', 'Instagram', 'إنستغرام', 'Instagram'],
    telegram: ['تلگرام', 'Telegram', 'تيليجرام', 'Telegram'],
    youtube: ['یوتیوب', 'YouTube', 'يوتيوب', 'YouTube'],
    google: ['گوگل', 'Google', 'جوجل', 'Google'],
    website: ['وب‌سایت', 'Website', 'الموقع', 'Web sitesi'],
    sms: ['پیامک', 'SMS', 'رسائل نصية', 'SMS'],
  },
  formats: {
    post: ['پست', 'Post', 'منشور', 'Gönderi'],
    story: ['استوری', 'Story', 'قصة', 'Hikâye'],
    reel: ['ریلز', 'Reel', 'ريل', 'Reel'],
    video: ['ویدئو', 'Video', 'فيديو', 'Video'],
    banner: ['بنر', 'Banner', 'لافتة', 'Afiş'],
    poster: ['پوستر', 'Poster', 'ملصق', 'Poster'],
  },
  activities: {
    call: ['تماس تلفنی', 'Phone call', 'مكالمة', 'Telefon'],
    whatsapp: ['واتساپ', 'WhatsApp', 'واتساب', 'WhatsApp'],
    telegram: ['تلگرام', 'Telegram', 'تيليجرام', 'Telegram'],
    meeting: ['جلسه', 'Meeting', 'اجتماع', 'Toplantı'],
    email: ['ایمیل', 'Email', 'بريد إلكتروني', 'E-posta'],
    note: ['یادداشت', 'Note', 'ملاحظة', 'Not'],
  },
  outcomes: {
    no_answer: ['پاسخ نداد', 'No answer', 'لا إجابة', 'Cevap yok'],
    interested: ['علاقه‌مند', 'Interested', 'مهتم', 'İlgili'],
    negotiating: ['در مذاکره', 'Negotiating', 'قيد التفاوض', 'Görüşülüyor'],
    won: ['موفق', 'Won', 'ناجح', 'Kazanıldı'],
    lost: ['ناموفق', 'Lost', 'خسارة', 'Kaybedildi'],
    follow_up: ['نیازمند پیگیری', 'Follow up', 'متابعة', 'Takip'],
  },
  leads: {
    new: ['جدید', 'New', 'جديد', 'Yeni'],
    contacted: ['تماس گرفته‌شده', 'Contacted', 'تم التواصل', 'İletişimde'],
    negotiating: ['در مذاکره', 'Negotiating', 'قيد التفاوض', 'Görüşülüyor'],
    won: ['تبدیل‌شده', 'Won', 'ناجح', 'Kazanıldı'],
    lost: ['از دست رفته', 'Lost', 'مفقود', 'Kaybedildi'],
    converted: ['مشتری شده', 'Converted', 'أصبح عميلاً', 'Müşteri oldu'],
  },
  types: {
    manufacturer: ['تولیدکننده', 'Manufacturer', 'مُصنّع', 'Üretici'],
    importer: ['واردکننده', 'Importer', 'مستورد', 'İthalatçı'],
    wholesaler: ['عمده‌فروش', 'Wholesaler', 'تاجر جملة', 'Toptancı'],
    retailer: ['خرده‌فروش', 'Retailer', 'تاجر تجزئة', 'Perakendeci'],
    distributor: ['توزیع‌کننده', 'Distributor', 'موزّع', 'Distribütör'],
    shop: ['فروشگاه', 'Shop', 'متجر', 'Mağaza'],
    salon: ['آرایشگاه', 'Salon', 'صالون', 'Salon'],
    restaurant: ['رستوران', 'Restaurant', 'مطعم', 'Restoran'],
    cafe: ['کافی‌شاپ', 'Café', 'مقهى', 'Kafe'],
    clinic: ['کلینیک', 'Clinic', 'عيادة', 'Klinik'],
    doctor: ['مطب پزشک', 'Doctor office', 'عيادة طبيب', 'Doktor'],
    other: ['سایر', 'Other', 'أخرى', 'Diğer'],
  },
};

const LANG_IDX = { fa: 0, en: 1, ar: 2, tr: 3 };
const pick = (group, slug, fallback) => {
  const row = LABELS[group]?.[slug];
  if (!row) return fallback || slug;
  return row[LANG_IDX[langOf()] ?? 0] || row[0];
};

const state = {
  catalog: null,
  canSeeContacts: false,
  businesses: [],
  leads: [],
  activities: [],
  reminders: [],
  team: [],
  audit: [],
  deletions: [],
  bizFilters: {},
  leadFilters: {},
};

/* --------------------------------- ابزارها --------------------------------- */

function optionsFrom(rows, { emptyLabel = '—' } = {}) {
  const lang = langOf();
  return [`<option value="">${esc(emptyLabel)}</option>`]
    .concat(rows.map((row) => `<option value="${esc(row.slug || row.code)}">${esc(row[lang] || row.fa)}</option>`))
    .join('');
}

function slugOptions(group, slugs, selected = '') {
  return slugs.map((slug) => {
    const label = pick(group, slug);
    return `<option value="${esc(slug)}"${slug === selected ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

function fillSelect(selector, html) {
  const el = $(selector);
  if (el) el.innerHTML = html;
}

function setStatus(selector, text, tone = '') {
  const el = $(selector);
  if (!el) return;
  el.textContent = text || '';
  el.style.color = tone === 'error' ? '#b42318' : tone === 'ok' ? '#0b5a4c' : '';
}

const ERRORS = {
  duplicate_business: 'این کسب‌وکار یا شماره قبلاً ثبت شده است. / Duplicate business or phone.',
  duplicate_lead: 'این متقاضی قبلاً ثبت شده است. / Duplicate lead.',
  phone_invalid: 'شماره تلفن معتبر نیست. / Invalid phone.',
  name_required: 'نام الزامی است. / Name required.',
  city_required: 'شهر الزامی است. / City required.',
  consent_required: 'وضعیت رضایت نامعتبر است. / Invalid consent.',
  forbidden: 'دسترسی ندارید. / Not allowed.',
  user_not_found: 'کاربری با این شماره پیدا نشد. / User not found.',
  admin_protected: 'حساب مدیر اصلی قابل تغییر نیست. / Owner account is protected.',
};
const errorText = (code) => ERRORS[code] || code;

/* ---------------------------------- آمار ---------------------------------- */

function renderStats() {
  const total = state.businesses.length;
  const granted = state.businesses.filter((b) => b.canAdvertise).length;
  const leads = state.leads.length;
  const openReminders = state.reminders.length;
  $('#stats').innerHTML = [
    ['🏢', num(total), T('tab_businesses')],
    ['✅', num(granted), T('consent_granted')],
    ['📣', num(leads), T('tab_leads')],
    ['⏰', num(openReminders), T('reminders')],
  ].map(([icon, value, label]) => `
    <div class="p3-stat">
      <div class="p3-stat__value">${icon} ${esc(value)}</div>
      <div class="p3-stat__label">${esc(label)}</div>
    </div>`).join('');
}

/* ------------------------------ کسب‌وکارها ------------------------------ */

function businessCard(row) {
  const contact = row.contactsVisible
    ? `<span class="p3-mono">${esc(row.phone || '—')}</span>${row.mobile ? ` · <span class="p3-mono">${esc(row.mobile)}</span>` : ''}`
    : `<span class="p3-mono">${esc(row.phone || '—')}</span> <span class="p3-hint">(${esc(T('contacts_hidden'))})</span>`;
  const links = [
    row.whatsapp ? `<a href="https://wa.me/${esc(String(row.whatsapp).replace(/[^\d]/g, ''))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : '',
    row.telegram ? `<a href="https://t.me/${esc(String(row.telegram).replace(/^@/, ''))}" target="_blank" rel="noopener noreferrer">Telegram</a>` : '',
    row.instagram ? `<a href="https://instagram.com/${esc(String(row.instagram).replace(/^@/, ''))}" target="_blank" rel="noopener noreferrer">Instagram</a>` : '',
    row.website ? `<a href="${esc(row.website)}" target="_blank" rel="noopener noreferrer">${esc(T('website'))}</a>` : '',
  ].filter(Boolean).join(' · ');

  return `
    <article class="p3-item">
      <div class="p3-item__head">
        <div>
          <div class="p3-item__title">${esc(row.name)} ${row.dataset === 'demo' ? badge(T('demo_data'), 'neutral') : ''}</div>
          <div class="p3-item__meta">
            <span>${esc(row.industryLabel)} · ${esc(row.typeLabel)}</span>
            <span>${esc(row.countryLabel)} / ${esc(row.province || '—')} / ${esc(row.city)}</span>
            ${badge(consentLabel(row.consent.status), toneForConsent(row.consent.status))}
            ${row.canAdvertise ? badge(T('consent_granted'), 'ok') : ''}
            ${badge(row.verifiedStatus === 'verified' ? T('verified') : T('unverified'), row.verifiedStatus === 'verified' ? 'ok' : 'warn')}
          </div>
        </div>
        <div class="p3-row">
          <button class="p3-btn p3-btn--ghost p3-btn--small" type="button" data-consent="${esc(row.id)}" data-next="${row.consent.status === 'granted' ? 'revoked' : 'granted'}">
            ${row.consent.status === 'granted' ? T('revoke_consent') : T('grant_consent')}
          </button>
          <button class="p3-btn p3-btn--ghost p3-btn--small" type="button" data-crm="${esc(row.id)}" data-kind="business">CRM</button>
        </div>
      </div>
      <div class="p3-item__meta" style="margin-top:8px">
        <span>${contact}</span>
        <span>${esc(T('source'))}: ${esc(row.sourceType)}${row.sourceUrl ? ` · ${esc(row.sourceUrl)}` : ''}</span>
        <span>${esc(T('last_checked'))}: ${esc(row.lastCheckedAt ? fmtDateTime(row.lastCheckedAt) : '—')}</span>
        ${row.assignedName ? `<span>${esc(T('owner'))}: ${esc(row.assignedName)}</span>` : ''}
      </div>
      ${links ? `<div class="p3-hint" style="margin-top:6px">${links}</div>` : ''}
      ${row.address ? `<p class="p3-hint" style="margin-top:4px">📍 ${esc(row.address)}</p>` : ''}
    </article>`;
}

function renderBusinesses() {
  $('#bizList').innerHTML = state.businesses.length
    ? state.businesses.map(businessCard).join('')
    : `<p class="p3-empty">${esc(T('no_results'))}</p>`;
  $('#bizCount').textContent = `${num(state.businesses.length)} / ${num(state.businesses.length)}`;
  $('#accessNote').textContent = state.canSeeContacts ? T('contacts_visible') : T('contacts_hidden');
}

async function loadBusinesses() {
  const params = new URLSearchParams();
  Object.entries(state.bizFilters).forEach(([key, value]) => { if (value) params.set(key, value); });
  params.set('limit', '100');
  try {
    const data = await api(`/api/directory/businesses?${params}`);
    state.businesses = data.businesses || [];
    state.canSeeContacts = Boolean(data.canSeeContacts);
    renderBusinesses();
    renderStats();
    const exportLink = $('#exportBtn');
    if (exportLink) exportLink.href = `/api/directory/businesses/export.csv?${params}`;
  } catch (err) {
    toast(errorText(err.message), 'error');
  }
}

async function submitBusiness(event) {
  event.preventDefault();
  setStatus('#bizFormStatus', T('loading'));
  const body = {
    name: $('#fName').value.trim(),
    industry: $('#fIndustry').value,
    type: $('#fType').value,
    country: $('#fCountry').value,
    province: $('#fProvince').value.trim(),
    city: $('#fCity').value.trim(),
    phone: $('#fPhone').value.trim(),
    mobile: $('#fMobile').value.trim(),
    whatsapp: $('#fWhatsapp').value.trim(),
    telegram: $('#fTelegram').value.trim(),
    instagram: $('#fInstagram').value.trim(),
    website: $('#fWebsite').value.trim(),
    address: $('#fAddress').value.trim(),
    sourceType: $('#fSource').value,
    consent: { status: $('#fConsent').value },
  };
  try {
    await api('/api/directory/businesses', { method: 'POST', body });
    setStatus('#bizFormStatus', T('saved'), 'ok');
    $('#bizForm').reset();
    await loadBusinesses();
  } catch (err) {
    setStatus('#bizFormStatus', errorText(err.message), 'error');
  }
}

async function setConsent(id, status) {
  try {
    await api(`/api/directory/businesses/${id}/consent`, { method: 'POST', body: { status } });
    toast(T('saved'), 'ok');
    await loadBusinesses();
  } catch (err) {
    toast(errorText(err.message), 'error');
  }
}

/* ---------------------------- متقاضیان تبلیغات ---------------------------- */

function leadCard(row) {
  return `
    <article class="p3-item">
      <div class="p3-item__head">
        <div>
          <div class="p3-item__title">${esc(row.name)} · ${esc(row.businessName)}</div>
          <div class="p3-item__meta">
            <span>${esc(row.industryLabel)} · ${esc(row.countryLabel)} / ${esc(row.city)}</span>
            ${badge(pick('leads', row.status, row.status), row.status === 'won' || row.status === 'converted' ? 'ok' : row.status === 'lost' ? 'bad' : 'neutral')}
            ${badge(consentLabel(row.consent.status), toneForConsent(row.consent.status))}
            ${row.dataset === 'demo' ? badge(T('demo_data'), 'neutral') : ''}
          </div>
        </div>
        <div class="p3-row">
          <select class="p3-btn p3-btn--ghost p3-btn--small" data-lead-status="${esc(row.id)}">
            ${slugOptions('leads', ['new', 'contacted', 'negotiating', 'won', 'lost'], row.status)}
          </select>
          <button class="p3-btn p3-btn--ghost p3-btn--small" type="button" data-convert="${esc(row.id)}">${esc(T('convert'))}</button>
          <button class="p3-btn p3-btn--ghost p3-btn--small" type="button" data-crm="${esc(row.id)}" data-kind="lead">CRM</button>
        </div>
      </div>
      <div class="p3-item__meta" style="margin-top:8px">
        <span class="p3-mono">${esc(row.phone)}</span>
        <span>${esc(T('networks'))}: ${esc((row.networks || []).map((n) => pick('networks', n)).join(', ') || '—')}</span>
        <span>${esc(T('format'))}: ${esc(pick('formats', row.format))}</span>
        <span>${esc(T('budget'))}: $${esc(num(row.budgetUsd))}</span>
        <span>${esc(T('duration'))}: ${esc(num(row.durationDays))} ${esc(T('days'))}</span>
      </div>
      ${row.canAdvertise ? '' : `<p class="p3-hint" style="margin-top:6px;color:#b42318">${esc(T('consent_required'))}</p>`}
    </article>`;
}

function renderLeads() {
  $('#leadList').innerHTML = state.leads.length
    ? state.leads.map(leadCard).join('')
    : `<p class="p3-empty">${esc(T('no_results'))}</p>`;
  $('#leadCount').textContent = num(state.leads.length);
}

async function loadLeads() {
  const params = new URLSearchParams();
  Object.entries(state.leadFilters).forEach(([key, value]) => { if (value) params.set(key, value); });
  params.set('limit', '100');
  try {
    const data = await api(`/api/directory/leads?${params}`);
    state.leads = data.leads || [];
    renderLeads();
    renderStats();
  } catch (err) {
    toast(errorText(err.message), 'error');
  }
}

async function updateLeadStatus(id, status) {
  try {
    await api(`/api/directory/leads/${id}/status`, { method: 'POST', body: { status } });
    toast(T('saved'), 'ok');
    await loadLeads();
  } catch (err) {
    toast(errorText(err.message), 'error');
  }
}

async function convertLead(id) {
  try {
    await api(`/api/directory/leads/${id}/convert`, { method: 'POST' });
    toast(T('converted'), 'ok');
    await loadLeads();
  } catch (err) {
    toast(errorText(err.message), 'error');
  }
}

/* ---------------------------------- CRM ---------------------------------- */

function activityCard(row) {
  return `
    <article class="p3-item">
      <div class="p3-item__head">
        <div>
          <div class="p3-item__title">${esc(pick('activities', row.type, row.type))} · ${esc(row.entityType)}</div>
          <div class="p3-item__meta">
            <span>${esc(fmtDateTime(row.createdAt))}</span>
            <span>${esc(row.createdByName || row.ownerName || '')}</span>
            ${row.outcome ? badge(pick('outcomes', row.outcome, row.outcome), 'neutral') : ''}
            ${row.done ? badge(T('done'), 'ok') : ''}
          </div>
        </div>
        <div class="p3-row">
          ${!row.done && row.nextCallAt ? `<button class="p3-btn p3-btn--ghost p3-btn--small" type="button" data-done="${esc(row.id)}">${esc(T('done'))}</button>` : ''}
        </div>
      </div>
      <p class="p3-hint" style="margin:8px 0 0">${esc(row.summary)}</p>
      ${row.nextCallAt ? `<p class="p3-hint" style="margin-top:4px">⏰ ${esc(T('next_call'))}: ${esc(fmtDateTime(row.nextCallAt))}</p>` : ''}
    </article>`;
}

async function loadActivities() {
  try {
    const [acts, rem] = await Promise.all([
      api('/api/directory/activities'),
      api('/api/directory/reminders?withinHours=72'),
    ]);
    state.activities = acts.activities || [];
    state.reminders = rem.reminders || [];
    $('#activityList').innerHTML = state.activities.length
      ? state.activities.map(activityCard).join('')
      : `<p class="p3-empty">${esc(T('no_results'))}</p>`;
    $('#reminderList').innerHTML = state.reminders.length
      ? state.reminders.map((row) => `
        <article class="p3-item">
          <div class="p3-item__head">
            <div>
              <div class="p3-item__title">${esc(row.entityType)} · ${esc(fmtDateTime(row.nextCallAt))}</div>
              <div class="p3-item__meta"><span>${esc(row.summary || '')}</span><span>${esc(row.ownerName || '')}</span></div>
            </div>
            <button class="p3-btn p3-btn--ghost p3-btn--small" type="button" data-done="${esc(row.id)}">${esc(T('done'))}</button>
          </div>
        </article>`).join('')
      : `<p class="p3-empty">${esc(T('no_reminders'))}</p>`;
    renderStats();
  } catch (err) {
    toast(errorText(err.message), 'error');
  }
}

async function submitActivity(event) {
  event.preventDefault();
  setStatus('#activityStatus', T('loading'));
  const raw = $('#aEntity').value.trim();
  const [entityType, entityId] = raw.includes(':') ? raw.split(':') : ['business', raw];
  try {
    await api('/api/directory/activities', {
      method: 'POST',
      body: {
        entityType,
        entityId,
        type: $('#aType').value,
        outcome: $('#aOutcome').value,
        summary: $('#aSummary').value.trim(),
        nextCallAt: $('#aNext').value ? new Date($('#aNext').value).toISOString() : null,
      },
    });
    setStatus('#activityStatus', T('saved'), 'ok');
    $('#activityForm').reset();
    await loadActivities();
  } catch (err) {
    setStatus('#activityStatus', errorText(err.message), 'error');
  }
}

async function markDone(id) {
  try {
    await api(`/api/directory/activities/${id}/done`, { method: 'POST' });
    await loadActivities();
  } catch (err) {
    toast(errorText(err.message), 'error');
  }
}

/* ------------------------------ تیم و حسابرسی ------------------------------ */

async function loadTeam() {
  try {
    const [team, audit, deletions] = await Promise.all([
      api('/api/directory/team'),
      api('/api/directory/audit?limit=80'),
      api('/api/directory/deletion-requests'),
    ]);
    state.team = team.users || [];
    state.audit = audit.entries || [];
    state.deletions = deletions.requests || [];

    $('#teamList').innerHTML = state.team.map((user) => `
      <article class="p3-item">
        <div class="p3-item__head">
          <div>
            <div class="p3-item__title">${esc(user.name)}</div>
            <div class="p3-item__meta">
              <span class="p3-mono">${esc(user.phone || '')}</span>
              <span>${esc(user.role)}</span>
              ${user.contactAccess ? badge(T('contacts_visible'), 'ok') : badge(T('contacts_hidden'), 'warn')}
            </div>
          </div>
          <div class="p3-row">
            <button class="p3-btn p3-btn--ghost p3-btn--small" type="button" data-team="${esc(user.id)}" data-access="${user.contactAccess ? '0' : '1'}">
              ${user.contactAccess ? T('revoke_access') : T('grant_access')}
            </button>
            ${user.role !== 'admin' ? `<button class="p3-btn p3-btn--ghost p3-btn--small" type="button" data-revoke="${esc(user.id)}">${esc(T('revoke_role'))}</button>` : ''}
          </div>
        </div>
      </article>`).join('') || `<p class="p3-empty">${esc(T('no_results'))}</p>`;

    const deletionHtml = state.deletions.length ? `
      <h3 style="margin-top:18px">${esc(T('deletion'))}</h3>
      ${state.deletions.map((row) => `
        <article class="p3-item">
          <div class="p3-item__head">
            <div>
              <div class="p3-item__title">${esc(row.entityType)} · ${esc(row.status)}</div>
              <div class="p3-item__meta"><span>${esc(fmtDateTime(row.createdAt))}</span><span>${esc(row.reason || '')}</span></div>
            </div>
            ${row.status === 'pending' ? `<button class="p3-btn p3-btn--small" type="button" data-apply="${esc(row.id)}">${esc(T('apply'))}</button>` : ''}
          </div>
        </article>`).join('')}` : '';
    $('#teamList').insertAdjacentHTML('afterend', `<div id="deletionBlock">${deletionHtml}</div>`);
    const previous = $('#deletionBlock');
    if (previous && previous.dataset.fresh !== '1') previous.dataset.fresh = '1';

    $('#auditList').innerHTML = state.audit.length ? state.audit.map((row) => `
      <article class="p3-item">
        <div class="p3-item__title">${esc(row.action)} · ${esc(row.actorRole || row.actorName || '')}</div>
        <div class="p3-item__meta">
          <span>${esc(fmtDateTime(row.at))}</span>
          <span>${esc(row.target || '')}</span>
          <span class="p3-mono">${esc(row.ip || '')}</span>
        </div>
      </article>`).join('') : `<p class="p3-empty">${esc(T('no_results'))}</p>`;
  } catch (err) {
    toast(errorText(err.message), 'error');
  }
}

async function setTeamAccess(id, contactAccess) {
  try {
    await api(`/api/directory/team/${id}`, { method: 'PATCH', body: { contactAccess: contactAccess === '1' } });
    await loadTeam();
    await loadBusinesses();
  } catch (err) {
    toast(errorText(err.message), 'error');
  }
}

async function revokeTeam(id) {
  try {
    await api(`/api/directory/team/${id}`, { method: 'PATCH', body: { revoke: true } });
    toast(T('saved'), 'ok');
    await loadTeam();
  } catch (err) {
    toast(errorText(err.message), 'error');
  }
}

async function addTeam(event) {
  event.preventDefault();
  try {
    await api('/api/directory/team', {
      method: 'POST',
      body: { phone: $('#tPhone').value.trim(), contactAccess: $('#tAccess').value === '1' },
    });
    toast(T('saved'), 'ok');
    $('#teamForm').reset();
    await loadTeam();
  } catch (err) {
    toast(errorText(err.message), 'error');
  }
}

async function applyDeletion(id) {
  try {
    await api(`/api/directory/deletion-requests/${id}/apply`, { method: 'POST' });
    toast(T('saved'), 'ok');
    await loadTeam();
    await loadBusinesses();
  } catch (err) {
    toast(errorText(err.message), 'error');
  }
}

/* --------------------------------- راه‌اندازی --------------------------------- */

function fillCatalogForms() {
  const c = state.catalog || {};
  const industries = c.industries || [];
  const countries = c.countries || [];

  fillSelect('#bizCountry', countryOptions(countries));
  fillSelect('#bizIndustry', industryOptions(industries));
  fillSelect('#bizType', optionsFrom(c.types || []));
  fillSelect('#bizProvince', optionsFrom([]));

  fillSelect('#fIndustry', industryOptions(industries));
  fillSelect('#fType', optionsFrom(c.types || []));
  fillSelect('#fCountry', countryOptions(countries));
  fillSelect('#fSource', optionsFrom(c.sources || []));

  fillSelect('#leadStatus', `<option value="">—</option>${slugOptions('leads', c.leadStatuses || [])}`);
  fillSelect('#leadNetwork', `<option value="">—</option>${slugOptions('networks', c.networks || [])}`);
  fillSelect('#aType', slugOptions('activities', c.activityTypes || []));
  fillSelect('#aOutcome', `<option value="">—</option>${slugOptions('outcomes', c.activityOutcomes || [])}`);
}

function bindTabs() {
  $$('.p3-tabs [data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.p3-tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      ['businesses', 'leads', 'crm', 'team', 'audit'].forEach((tab) => {
        const section = document.getElementById(`tab-${tab}`);
        if (section) section.hidden = tab !== btn.dataset.tab;
      });
      if (btn.dataset.tab === 'team' || btn.dataset.tab === 'audit') loadTeam();
    });
  });
}

function bindFilters() {
  $('#applyFilters').addEventListener('click', () => {
    state.bizFilters = {
      q: $('#bizSearch').value.trim(),
      country: $('#bizCountry').value,
      industry: $('#bizIndustry').value,
      type: $('#bizType').value,
      province: $('#bizProvince').value,
      city: $('#bizCity').value.trim(),
      consent: $('#bizConsent').value,
      dataset: $('#bizDataset').value,
    };
    loadBusinesses();
  });
  $('#resetFilters').addEventListener('click', () => {
    $('#bizFilters').reset();
    state.bizFilters = {};
    loadBusinesses();
  });
  $('#bizSearch').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); $('#applyFilters').click(); }
  });

  $('#applyLeadFilters').addEventListener('click', () => {
    state.leadFilters = {
      q: $('#leadSearch').value.trim(),
      status: $('#leadStatus').value,
      network: $('#leadNetwork').value,
    };
    loadLeads();
  });
}

function bindActions() {
  document.addEventListener('click', (event) => {
    const consentBtn = event.target.closest('[data-consent]');
    if (consentBtn) return setConsent(consentBtn.dataset.consent, consentBtn.dataset.next);

    const crmBtn = event.target.closest('[data-crm]');
    if (crmBtn) {
      const prefix = crmBtn.dataset.kind === 'lead' ? 'lead' : 'business';
      $('#aEntity').value = `${prefix}:${crmBtn.dataset.crm}`;
      $$('.p3-tabs [data-tab]').find((b) => b.dataset.tab === 'crm')?.click();
      $('#aEntity').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return undefined;
    }

    const convertBtn = event.target.closest('[data-convert]');
    if (convertBtn) return convertLead(convertBtn.dataset.convert);

    const doneBtn = event.target.closest('[data-done]');
    if (doneBtn) return markDone(doneBtn.dataset.done);

    const teamBtn = event.target.closest('[data-team]');
    if (teamBtn) return setTeamAccess(teamBtn.dataset.team, teamBtn.dataset.access);

    const revokeBtn = event.target.closest('[data-revoke]');
    if (revokeBtn) return revokeTeam(revokeBtn.dataset.revoke);

    const applyBtn = event.target.closest('[data-apply]');
    if (applyBtn) return applyDeletion(applyBtn.dataset.apply);

    return undefined;
  });

  document.addEventListener('change', (event) => {
    const statusSelect = event.target.closest('[data-lead-status]');
    if (statusSelect) updateLeadStatus(statusSelect.dataset.leadStatus, statusSelect.value);
  });

  $('#toggleBizForm').addEventListener('click', () => {
    const form = $('#bizForm');
    form.hidden = !form.hidden;
  });
  $('#bizForm').addEventListener('submit', submitBusiness);
  $('#activityForm').addEventListener('submit', submitActivity);
  $('#teamForm').addEventListener('submit', addTeam);

  window.addEventListener('lang-changed', () => {
    mountPage();
    fillCatalogForms();
    renderBusinesses();
    renderLeads();
    loadActivities();
    loadTeam();
  });
}

async function init() {
  mountPage();
  bindTabs();
  bindFilters();
  bindActions();
  try {
    state.catalog = await api('/api/directory/catalog');
    fillCatalogForms();
  } catch (err) {
    toast(err.message, 'error');
  }
  await Promise.all([loadBusinesses(), loadLeads(), loadActivities(), loadTeam()]);
}

init();

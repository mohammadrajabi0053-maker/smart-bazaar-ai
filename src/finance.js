// بازار هوشمند — سیستم مالی مرکزی: دفتر تراکنش تغییرناپذیر، کیف پول، برداشت، مجوز گزارش و حسابرسی
import { id } from './store.js';
import { roundUsd, currencyMeta, resolveRates } from './money.js';
import { AD_COUNTRIES } from './ads.js';
import {
  decryptJson, encryptJson, isEncrypted, randomToken, sha256, trackingId,
} from './secure.js';

export const KINDS = ['income', 'expense', 'transfer_in', 'transfer_out', 'withdrawal'];

export const INCOME_SOURCES = [
  { code: 'ads', name: { fa: 'درآمد تبلیغات', en: 'Advertising income', ar: 'إيرادات الإعلانات', tr: 'Reklam geliri' }, icon: '📣' },
  { code: 'storefront', name: { fa: 'درآمد فروشگاه', en: 'Storefront income', ar: 'إيرادات المتجر', tr: 'Mağaza geliri' }, icon: '🛍️' },
  { code: 'service', name: { fa: 'خدمات', en: 'Services', ar: 'الخدمات', tr: 'Hizmetler' }, icon: '🧰' },
  { code: 'subscription', name: { fa: 'اشتراک', en: 'Subscriptions', ar: 'الاشتراكات', tr: 'Abonelikler' }, icon: '🔁' },
];

export const EXPENSE_SOURCES = [
  { code: 'operating', name: { fa: 'هزینهٔ عملیاتی', en: 'Operating', ar: 'تشغيلي', tr: 'Operasyonel' }, icon: '🏢' },
  { code: 'marketing', name: { fa: 'بازاریابی', en: 'Marketing', ar: 'تسويق', tr: 'Pazarlama' }, icon: '📈' },
  { code: 'infra', name: { fa: 'زیرساخت', en: 'Infrastructure', ar: 'البنية التحتية', tr: 'Altyapı' }, icon: '🖥️' },
  { code: 'refund', name: { fa: 'بازپرداخت', en: 'Refund', ar: 'استرداد', tr: 'İade' }, icon: '↩️' },
  { code: 'payout', name: { fa: 'برداشت', en: 'Payout', ar: 'سحب', tr: 'Ödeme' }, icon: '🏦' },
];

export const ACCOUNTS = [
  { code: 'main', name: { fa: 'کیف پول اصلی', en: 'Main wallet', ar: 'المحفظة الرئيسية', tr: 'Ana cüzdan' } },
  { code: 'reserve', name: { fa: 'ذخیره', en: 'Reserve', ar: 'احتياطي', tr: 'Rezerv' } },
  { code: 'ads', name: { fa: 'بودجهٔ تبلیغات', en: 'Ads budget', ar: 'ميزانية الإعلانات', tr: 'Reklam bütçesi' } },
];

export const WITHDRAWAL_STAGES = ['requested', 'reviewed', 'approved', 'paid', 'canceled'];
export const GRANT_FIELDS = ['totals', 'byCountry', 'bySource', 'byCurrency', 'series', 'wallet'];
export const GRANT_PERMISSIONS = ['view', 'copy', 'print', 'pdf', 'excel'];

const GENESIS = '0'.repeat(64);
const HASH_FIELDS = [
  'seq', 'kind', 'source', 'account', 'amountUsd', 'amountLocal', 'currency', 'country',
  'rate', 'settled', 'demo', 'refType', 'refId', 'at', 'actor', 'note', 'prevHash',
];

export class FinanceError extends Error {
  constructor(code, status = 400, extra = {}) {
    super(code);
    this.code = code;
    this.status = status;
    Object.assign(this, extra);
  }
}

/* ------------------------------- آماده‌سازی ------------------------------- */

export function ensureFinance(db) {
  if (!db.finance || typeof db.finance !== 'object') {
    db.finance = {};
  }
  const f = db.finance;
  for (const name of ['entries', 'withdrawals', 'grants', 'sentReports', 'audit', 'authorizations']) {
    if (!Array.isArray(f[name])) f[name] = [];
  }
  if (!Number.isFinite(f.seq)) f.seq = f.entries.length;
  if (!f.security || typeof f.security !== 'object') {
    f.security = { failedTotp: 0, lastFailedAt: null, denied: 0 };
  }
  if (!f.seeded) f.seeded = false;
  return f;
}

export function isOwner(db, user) {
  if (!user) return false;
  if (user.role !== 'admin') return false;
  if (user.owner === true) return true;
  const configured = db?.settings?.ownerEmail;
  if (configured && user.email === configured) return true;
  return false;
}

export function ensureOwnerFlag(db) {
  const admins = db.users.filter((u) => u.role === 'admin');
  if (!admins.length) return null;
  if (db.settings?.ownerEmail) {
    const configured = admins.find((u) => u.email === db.settings.ownerEmail);
    if (configured) {
      admins.forEach((u) => { u.owner = u.id === configured.id; });
      return configured;
    }
  }
  const current = admins.find((u) => u.owner === true);
  if (current) return current;
  const first = admins[0];
  admins.forEach((u) => { u.owner = u.id === first.id; });
  db.settings = db.settings || {};
  db.settings.ownerEmail = first.email;
  return first;
}

/* ------------------------------ زنجیرهٔ هش ------------------------------ */

export function entryHash(entry) {
  return sha256(HASH_FIELDS.map((field) => `${field}=${entry[field] ?? ''}`).join('|'));
}

export function chainHead(finance) {
  return finance.entries.length ? finance.entries[finance.entries.length - 1].hash : GENESIS;
}

export function verifyChain(db) {
  const f = ensureFinance(db);
  let prev = GENESIS;
  for (const entry of f.entries) {
    if (entry.prevHash !== prev) return { valid: false, brokenAt: entry.seq, reason: 'prev_hash_mismatch' };
    if (entryHash(entry) !== entry.hash) return { valid: false, brokenAt: entry.seq, reason: 'hash_mismatch' };
    prev = entry.hash;
  }
  return { valid: true, entries: f.entries.length, head: prev };
}

function localAmount(amountUsd, rate, decimals) {
  const value = amountUsd * (Number(rate) || 1);
  const factor = 10 ** Math.max(0, Math.min(6, Number(decimals) || 0));
  return Math.round(value * factor) / factor;
}

export function appendEntry(db, input = {}) {
  const f = ensureFinance(db);
  const kind = String(input.kind || '');
  if (!KINDS.includes(kind)) throw new FinanceError('kind_invalid');
  const amountUsd = roundUsd(Math.abs(Number(input.amountUsd) || 0));
  if (!(amountUsd > 0)) throw new FinanceError('amount_invalid');

  if (input.idempotencyKey) {
    const dup = f.entries.find((e) => e.idempotencyKey === input.idempotencyKey);
    if (dup) throw new FinanceError('duplicate_entry', 409, { entryId: dup.id });
  }

  const currency = String(input.currency || 'USD').toUpperCase();
  const meta = currencyMeta(currency);
  const rate = Number(input.rate) || meta?.rate || 1;
  const at = input.at || new Date().toISOString();

  f.seq += 1;
  const entry = {
    id: id(),
    seq: f.seq,
    kind,
    source: String(input.source || (kind === 'income' ? 'storefront' : 'operating')),
    account: String(input.account || 'main'),
    amountUsd,
    amountLocal: input.amountLocal !== undefined
      ? Number(input.amountLocal) || 0
      : localAmount(amountUsd, rate, meta?.decimals ?? 2),
    currency,
    country: input.country ? String(input.country).toUpperCase() : null,
    rate,
    settled: input.settled !== false,
    demo: input.demo === true,
    refType: input.refType ? String(input.refType) : null,
    refId: input.refId ? String(input.refId) : null,
    note: String(input.note || '').slice(0, 300),
    actor: String(input.actor || 'system'),
    idempotencyKey: input.idempotencyKey ? String(input.idempotencyKey) : null,
    at,
    prevHash: chainHead(f),
  };
  entry.hash = entryHash(entry);
  f.entries.push(entry);
  return entry;
}

/* -------------------------------- گزارش‌ها -------------------------------- */

export function signedUsd(entry) {
  if (entry.kind === 'income' || entry.kind === 'transfer_in') return entry.amountUsd;
  if (entry.kind === 'expense' || entry.kind === 'withdrawal' || entry.kind === 'transfer_out') return -entry.amountUsd;
  return 0;
}

const dayOf = (iso) => String(iso || '').slice(0, 10);

export function matchesFilter(entry, q = {}) {
  const day = dayOf(entry.at);
  if (q.from && day < q.from) return false;
  if (q.to && day > q.to) return false;
  if (q.kind && entry.kind !== q.kind) return false;
  if (q.source && entry.source !== q.source) return false;
  if (q.country && entry.country !== String(q.country).toUpperCase()) return false;
  if (q.currency && entry.currency !== String(q.currency).toUpperCase()) return false;
  if (q.account && entry.account !== q.account) return false;
  if (q.settled === true && entry.settled !== true) return false;
  if (q.settled === false && entry.settled !== false) return false;
  if (!q.includeDemo && entry.demo) return false;
  if (q.q) {
    const needle = String(q.q).toLowerCase();
    const hay = `${entry.note} ${entry.source} ${entry.country} ${entry.refId} ${entry.actor} ${entry.id}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

export function filterEntries(db, q = {}) {
  const f = ensureFinance(db);
  const rows = f.entries.filter((entry) => matchesFilter(entry, q));
  const sorted = rows.slice().sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.seq - a.seq));
  const limit = Math.min(500, Math.max(1, Number(q.limit) || 100));
  const offset = Math.max(0, Number(q.offset) || 0);
  return { total: sorted.length, rows: sorted.slice(offset, offset + limit), limit, offset };
}

export function summarize(entries = []) {
  const out = {
    count: entries.length,
    incomeUsd: 0,
    expenseUsd: 0,
    netUsd: 0,
    pendingUsd: 0,
    bySource: {},
    byCountry: {},
    byCurrency: {},
  };
  for (const entry of entries) {
    const signed = signedUsd(entry);
    if (entry.kind === 'income' && !entry.settled) {
      out.pendingUsd = roundUsd(out.pendingUsd + entry.amountUsd);
      continue;
    }
    if (entry.kind === 'income') out.incomeUsd = roundUsd(out.incomeUsd + entry.amountUsd);
    if (entry.kind === 'expense') out.expenseUsd = roundUsd(out.expenseUsd + entry.amountUsd);
    if (entry.kind === 'withdrawal') out.expenseUsd = roundUsd(out.expenseUsd + entry.amountUsd);

    const source = entry.source || 'other';
    if (!out.bySource[source]) out.bySource[source] = { incomeUsd: 0, expenseUsd: 0, count: 0 };
    out.bySource[source].count += 1;
    if (signed > 0) out.bySource[source].incomeUsd = roundUsd(out.bySource[source].incomeUsd + signed);
    if (signed < 0) out.bySource[source].expenseUsd = roundUsd(out.bySource[source].expenseUsd - signed);

    const country = entry.country || 'XX';
    if (!out.byCountry[country]) out.byCountry[country] = { incomeUsd: 0, expenseUsd: 0, count: 0 };
    out.byCountry[country].count += 1;
    if (signed > 0) out.byCountry[country].incomeUsd = roundUsd(out.byCountry[country].incomeUsd + signed);
    if (signed < 0) out.byCountry[country].expenseUsd = roundUsd(out.byCountry[country].expenseUsd - signed);

    const currency = entry.currency || 'USD';
    if (!out.byCurrency[currency]) out.byCurrency[currency] = { incomeUsd: 0, incomeLocal: 0, count: 0 };
    out.byCurrency[currency].count += 1;
    if (signed > 0) {
      out.byCurrency[currency].incomeUsd = roundUsd(out.byCurrency[currency].incomeUsd + signed);
      out.byCurrency[currency].incomeLocal += entry.amountLocal;
    }
  }
  out.netUsd = roundUsd(out.incomeUsd - out.expenseUsd);
  return out;
}

export function groupSeries(entries = [], bucket = 'day') {
  const keyOf = (iso) => {
    const day = dayOf(iso);
    if (bucket === 'year') return day.slice(0, 4);
    if (bucket === 'month') return day.slice(0, 7);
    if (bucket === 'week') {
      const date = new Date(`${day}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return day;
      const dayNum = (date.getUTCDay() + 6) % 7;
      date.setUTCDate(date.getUTCDate() - dayNum);
      return date.toISOString().slice(0, 10);
    }
    return day;
  };
  const map = new Map();
  for (const entry of entries) {
    const key = keyOf(entry.at);
    if (!map.has(key)) map.set(key, { key, incomeUsd: 0, expenseUsd: 0, netUsd: 0 });
    const row = map.get(key);
    if (entry.kind === 'income' && entry.settled) row.incomeUsd = roundUsd(row.incomeUsd + entry.amountUsd);
    if (entry.kind === 'expense' || entry.kind === 'withdrawal') row.expenseUsd = roundUsd(row.expenseUsd + entry.amountUsd);
  }
  return [...map.values()]
    .map((row) => ({ ...row, netUsd: roundUsd(row.incomeUsd - row.expenseUsd) }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}

/* -------------------------------- کیف پول -------------------------------- */

const ACTIVE_WITHDRAWAL = ['requested', 'reviewed', 'approved'];

export function walletState(db, { includeDemo = false } = {}) {
  const f = ensureFinance(db);
  const rows = f.entries.filter((e) => e.settled && (includeDemo || !e.demo));
  const balanceUsd = roundUsd(rows.reduce((sum, entry) => sum + signedUsd(entry), 0));
  const incomeUsd = roundUsd(rows.filter((e) => e.kind === 'income').reduce((s, e) => s + e.amountUsd, 0));
  const expenseUsd = roundUsd(rows
    .filter((e) => e.kind === 'expense' || e.kind === 'withdrawal')
    .reduce((s, e) => s + e.amountUsd, 0));
  const reservedUsd = roundUsd(f.withdrawals
    .filter((w) => ACTIVE_WITHDRAWAL.includes(w.status))
    .reduce((s, w) => s + w.amountUsd, 0));
  const accounts = ACCOUNTS.map((account) => {
    const accountRows = rows.filter((e) => e.account === account.code);
    return {
      code: account.code,
      name: account.name,
      balanceUsd: roundUsd(accountRows.reduce((sum, entry) => sum + signedUsd(entry), 0)),
    };
  });
  return {
    balanceUsd,
    availableUsd: roundUsd(balanceUsd - reservedUsd),
    reservedUsd,
    incomeUsd,
    expenseUsd,
    accounts,
    payoutEnabled: false,
    currency: 'USD',
  };
}

export function createWithdrawal(db, user, input = {}) {
  const f = ensureFinance(db);
  const amountUsd = roundUsd(Number(input.amountUsd) || 0);
  if (!(amountUsd >= 10)) throw new FinanceError('amount_too_small');
  const wallet = walletState(db);
  if (amountUsd > wallet.availableUsd) throw new FinanceError('insufficient_balance', 400, { availableUsd: wallet.availableUsd });
  const method = ['bank', 'wallet', 'crypto'].includes(input.method) ? input.method : 'bank';
  const at = new Date().toISOString();
  const withdrawal = {
    id: id(),
    amountUsd,
    method,
    destinationMasked: String(input.destination || '').replace(/\d(?=\d{2})/g, '•').slice(0, 60),
    note: String(input.note || '').slice(0, 200),
    status: 'requested',
    payoutEnabled: false,
    requestedBy: user.id,
    requestedByName: user.name,
    history: [{ status: 'requested', at, by: user.id, note: 'request_created' }],
    createdAt: at,
    updatedAt: at,
  };
  f.withdrawals.push(withdrawal);
  audit(db, {
    actorId: user.id, actorRole: user.role, action: 'withdrawal_requested', target: withdrawal.id,
    meta: { amountUsd },
  });
  return withdrawal;
}

export function advanceWithdrawal(db, user, withdrawalId, action, input = {}) {
  const f = ensureFinance(db);
  const withdrawal = f.withdrawals.find((w) => w.id === withdrawalId);
  if (!withdrawal) throw new FinanceError('not_found', 404);
  const at = new Date().toISOString();
  if (action === 'cancel') {
    if (withdrawal.status === 'paid') throw new FinanceError('withdrawal_paid', 409);
    withdrawal.status = 'canceled';
    withdrawal.history.push({ status: 'canceled', at, by: user.id, note: String(input.note || '').slice(0, 160) });
    withdrawal.updatedAt = at;
    audit(db, { actorId: user.id, actorRole: user.role, action: 'withdrawal_canceled', target: withdrawal.id, meta: {} });
    return withdrawal;
  }
  if (action === 'review') {
    if (withdrawal.status !== 'requested') throw new FinanceError('stage_invalid', 409, { status: withdrawal.status });
    withdrawal.status = 'reviewed';
    withdrawal.history.push({ status: 'reviewed', at, by: user.id, note: String(input.note || '').slice(0, 160) || 'stage_1_review' });
    withdrawal.updatedAt = at;
    audit(db, { actorId: user.id, actorRole: user.role, action: 'withdrawal_reviewed', target: withdrawal.id, meta: {} });
    return withdrawal;
  }
  if (action === 'approve') {
    if (withdrawal.status !== 'reviewed') throw new FinanceError('stage_invalid', 409, { status: withdrawal.status });
    withdrawal.status = 'approved';
    withdrawal.payoutStatus = 'disabled';
    withdrawal.history.push({
      status: 'approved', at, by: user.id, note: 'stage_2_approved_payout_disabled',
    });
    withdrawal.updatedAt = at;
    audit(db, {
      actorId: user.id, actorRole: user.role, action: 'withdrawal_approved', target: withdrawal.id,
      meta: { payoutEnabled: false },
    });
    return withdrawal;
  }
  throw new FinanceError('action_invalid');
}

export function internalTransfer(db, user, input = {}) {
  const from = String(input.from || 'main');
  const to = String(input.to || 'reserve');
  if (from === to) throw new FinanceError('accounts_identical');
  if (!ACCOUNTS.some((a) => a.code === from) || !ACCOUNTS.some((a) => a.code === to)) {
    throw new FinanceError('account_invalid');
  }
  const amountUsd = roundUsd(Number(input.amountUsd) || 0);
  if (!(amountUsd > 0)) throw new FinanceError('amount_invalid');
  const transferId = id();
  const out = appendEntry(db, {
    kind: 'transfer_out', source: 'transfer', account: from, amountUsd,
    refType: 'transfer', refId: transferId, actor: user.id, note: input.note || 'internal_transfer',
    idempotencyKey: `transfer-out-${transferId}`,
  });
  const into = appendEntry(db, {
    kind: 'transfer_in', source: 'transfer', account: to, amountUsd,
    refType: 'transfer', refId: transferId, actor: user.id, note: input.note || 'internal_transfer',
    idempotencyKey: `transfer-in-${transferId}`,
  });
  audit(db, {
    actorId: user.id, actorRole: user.role, action: 'internal_transfer', target: transferId,
    meta: { from, to, amountUsd },
  });
  return { transferId, out, in: into };
}

/* ------------------------------ مجوز گزارش ------------------------------ */

export function createGrant(db, owner, input = {}) {
  const f = ensureFinance(db);
  const mode = input.mode === 'fixed' ? 'fixed' : 'percent';
  const percent = Math.min(100, Math.max(0.1, Number(input.percent) || 10));
  const fixedUsd = Math.max(0, roundUsd(Number(input.fixedUsd) || 0));
  if (mode === 'fixed' && !(fixedUsd > 0)) throw new FinanceError('fixed_amount_required');

  const countries = Array.isArray(input.countries)
    ? input.countries.map((c) => String(c).toUpperCase()).filter((c) => AD_COUNTRIES.some((x) => x.code === c)).slice(0, 12)
    : [];
  const sources = Array.isArray(input.sources)
    ? input.sources.map((s) => String(s)).filter((s) => INCOME_SOURCES.some((x) => x.code === s)).slice(0, 6)
    : [];
  const fields = Array.isArray(input.fields)
    ? input.fields.filter((x) => GRANT_FIELDS.includes(x)).slice(0, GRANT_FIELDS.length)
    : ['totals'];
  const permissions = {};
  for (const key of GRANT_PERMISSIONS) permissions[key] = Boolean(input.permissions?.[key]);
  if (!permissions.view) permissions.view = true;

  const recipientName = String(input.recipientName || '').slice(0, 80);
  if (recipientName.length < 2) throw new FinanceError('recipient_required');
  const recipientEmail = String(input.recipientEmail || '').slice(0, 120);

  const token = randomToken(24);
  const nowIso = new Date().toISOString();
  const days = Math.min(365, Math.max(1, Number(input.expiresInDays) || 30));
  const expiresAt = input.expiresAt
    ? new Date(input.expiresAt).toISOString()
    : new Date(Date.now() + days * 864e5).toISOString();

  const grant = {
    id: id(),
    trackingId: trackingId('GRT'),
    tokenHash: sha256(token),
    recipientName,
    recipientEncrypted: encryptJson({ name: recipientName, email: recipientEmail }),
    recipientRole: String(input.recipientRole || 'sub_admin').slice(0, 30),
    mode,
    percent: mode === 'percent' ? percent : null,
    fixedUsd: mode === 'fixed' ? fixedUsd : null,
    countries,
    sources,
    from: input.from ? String(input.from).slice(0, 10) : null,
    to: input.to ? String(input.to).slice(0, 10) : null,
    fields,
    permissions,
    expiresAt,
    revoked: false,
    revokedAt: null,
    createdBy: owner.id,
    createdAt: nowIso,
    sentAt: null,
    views: 0,
    downloads: 0,
    copies: 0,
    prints: 0,
  };
  f.grants.push(grant);
  audit(db, {
    actorId: owner.id, actorRole: owner.role, action: 'grant_created', target: grant.id,
    meta: { mode, percent: grant.percent, fixedUsd: grant.fixedUsd, countries, fields },
  });
  return { grant, token };
}

export function grantScopeEntries(db, grant) {
  const f = ensureFinance(db);
  return f.entries.filter((entry) => {
    if (!entry.settled || entry.demo) return false;
    if (entry.kind !== 'income') return false;
    if (grant.countries?.length && !grant.countries.includes(entry.country)) return false;
    if (grant.sources?.length && !grant.sources.includes(entry.source)) return false;
    const day = dayOf(entry.at);
    if (grant.from && day < grant.from) return false;
    if (grant.to && day > grant.to) return false;
    return true;
  });
}

export function grantReport(db, grant) {
  const entries = grantScopeEntries(db, grant);
  const summary = summarize(entries);
  const baseUsd = summary.incomeUsd;
  let amountUsd = grant.mode === 'percent'
    ? roundUsd(baseUsd * (grant.percent / 100))
    : roundUsd(grant.fixedUsd);
  let capped = false;
  if (grant.mode === 'fixed' && amountUsd > baseUsd) {
    amountUsd = baseUsd;
    capped = true;
  }
  const report = {
    trackingId: grant.trackingId,
    type: 'internal_management_report',
    basis: {
      mode: grant.mode,
      percent: grant.percent,
      fixedUsd: grant.fixedUsd,
      countries: grant.countries,
      sources: grant.sources,
      from: grant.from,
      to: grant.to,
      capped,
    },
    recipient: { name: grant.recipientName, role: grant.recipientRole },
    baseIncomeUsd: baseUsd,
    amountUsd,
    amountLocal: roundUsd(amountUsd * (resolveRates(db).rates?.IRR || 1)),
    permissions: grant.permissions,
    expiresAt: grant.expiresAt,
    disclaimer: {
      fa: 'این گزارش مدیریتی داخلی است و صورت‌وضعیت رسمی یا گزارش قانونی محسوب نمی‌شود.',
      en: 'Internal management report. Not an official statement or statutory filing.',
      ar: 'تقرير إداري داخلي وليس كشفًا رسميًا أو تقريرًا قانونيًا.',
      tr: 'Dahili yönetim raporudur; resmî beyan veya yasal rapor değildir.',
    },
    fields: grant.fields,
  };
  if (grant.fields.includes('totals')) report.totals = { ...summary, bySource: undefined, byCountry: undefined, byCurrency: undefined };
  if (grant.fields.includes('byCountry')) report.byCountry = summary.byCountry;
  if (grant.fields.includes('bySource')) report.bySource = summary.bySource;
  if (grant.fields.includes('byCurrency')) report.byCurrency = summary.byCurrency;
  if (grant.fields.includes('series')) report.series = groupSeries(entries, 'month');
  if (grant.fields.includes('wallet')) {
    const wallet = walletState(db);
    report.wallet = { balanceUsd: wallet.balanceUsd, reservedUsd: wallet.reservedUsd, availableUsd: wallet.availableUsd };
  }
  return report;
}

export function findGrantByToken(db, token) {
  const f = ensureFinance(db);
  if (!token) return null;
  const hash = sha256(token);
  return f.grants.find((g) => g.tokenHash === hash) || null;
}

export function grantStatus(grant) {
  if (!grant) return 'missing';
  if (grant.revoked) return 'revoked';
  if (new Date(grant.expiresAt).getTime() < Date.now()) return 'expired';
  return 'active';
}

export function grantView(grant, db) {
  const status = grantStatus(grant);
  return {
    id: grant.id,
    trackingId: grant.trackingId,
    recipientName: grant.recipientName,
    recipientRole: grant.recipientRole,
    mode: grant.mode,
    percent: grant.percent,
    fixedUsd: grant.fixedUsd,
    countries: grant.countries,
    sources: grant.sources,
    from: grant.from,
    to: grant.to,
    fields: grant.fields,
    permissions: grant.permissions,
    expiresAt: grant.expiresAt,
    revoked: grant.revoked,
    status,
    sentAt: grant.sentAt,
    createdAt: grant.createdAt,
    views: grant.views,
    downloads: grant.downloads,
    amountUsd: status === 'active' ? grantReport(db, grant).amountUsd : null,
  };
}

/* -------------------------------- حسابرسی -------------------------------- */

export function audit(db, event = {}) {
  const f = ensureFinance(db);
  const row = {
    id: id(),
    at: new Date().toISOString(),
    actorId: event.actorId || null,
    actorRole: event.actorRole || null,
    action: String(event.action || 'unknown'),
    target: event.target ? String(event.target) : null,
    meta: event.meta && typeof event.meta === 'object' ? event.meta : {},
    ip: event.ip ? String(event.ip).slice(0, 60) : null,
  };
  f.audit.push(row);
  if (f.audit.length > 1000) f.audit.splice(0, f.audit.length - 1000);
  return row;
}

/* ------------------------------- خروجی CSV ------------------------------- */

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function entriesToCsv(entries = []) {
  const header = ['seq', 'date', 'kind', 'source', 'account', 'country', 'currency', 'amount_local', 'rate', 'amount_usd', 'settled', 'demo', 'ref', 'note'];
  const lines = [header.join(',')];
  for (const entry of entries) {
    lines.push([
      entry.seq, entry.at, entry.kind, entry.source, entry.account, entry.country || '',
      entry.currency, entry.amountLocal, entry.rate, entry.amountUsd,
      entry.settled ? 'yes' : 'no', entry.demo ? 'demo' : 'real',
      entry.refId || '', entry.note || '',
    ].map(csvCell).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/* ------------------------- درآمد خودکار از رویدادها ------------------------- */

export function recordStorefrontIncome(db, order) {
  if (!order || !(Number(order.total) > 0)) return null;
  const rate = resolveRates(db).rates?.IRR || 1;
  const amountUsd = roundUsd(Number(order.total) / rate);
  try {
    return appendEntry(db, {
      kind: 'income',
      source: 'storefront',
      account: 'main',
      amountUsd,
      amountLocal: Number(order.total),
      currency: 'IRR',
      rate,
      country: 'IR',
      settled: true,
      refType: 'order',
      refId: order.id,
      note: `order ${order.number}`,
      actor: 'system',
      idempotencyKey: `order-income-${order.id}`,
    });
  } catch (err) {
    if (err.code === 'duplicate_entry') return null;
    throw err;
  }
}

export function recordAdsPipeline(db, campaign) {
  if (!campaign || !(Number(campaign.totalUsd) > 0)) return null;
  try {
    return appendEntry(db, {
      kind: 'income',
      source: 'ads',
      account: 'main',
      amountUsd: campaign.totalUsd,
      amountLocal: campaign.totalLocal,
      currency: campaign.currency,
      rate: campaign.rate,
      country: campaign.country,
      settled: false,
      refType: 'ad_campaign',
      refId: campaign.id,
      note: `campaign ${campaign.invoiceNo}`,
      actor: 'system',
      idempotencyKey: `ads-income-${campaign.id}`,
    });
  } catch (err) {
    if (err.code === 'duplicate_entry') return null;
    throw err;
  }
}

/* --------------------------- دادهٔ آزمایشی جدا --------------------------- */

export function seedDemoLedger(db) {
  const f = ensureFinance(db);
  if (f.seeded || f.entries.length) {
    f.seeded = true;
    return 0;
  }
  const rates = resolveRates(db).rates || {};
  const sources = ['ads', 'storefront', 'service'];
  let count = 0;
  const now = Date.now();
  AD_COUNTRIES.forEach((country, countryIndex) => {
    const rate = rates[country.currency] || 1;
    for (let month = 5; month >= 0; month -= 1) {
      const base = new Date(now);
      base.setUTCMonth(base.getUTCMonth() - month);
      base.setUTCDate(Math.min(26, 4 + countryIndex * 2 + month));
      const at = base.toISOString();
      const amountUsd = roundUsd((220 + countryIndex * 65 + month * 40) * country.priceIndex);
      appendEntry(db, {
        kind: 'income',
        source: sources[(countryIndex + month) % sources.length],
        account: 'main',
        amountUsd,
        currency: country.currency,
        rate,
        country: country.code,
        settled: true,
        demo: true,
        refType: 'demo',
        refId: `demo-${country.code}-${month}`,
        note: 'demo ledger entry',
        actor: 'seed',
        at,
      });
      count += 1;
    }
  });
  for (let month = 5; month >= 0; month -= 1) {
    const base = new Date(now);
    base.setUTCMonth(base.getUTCMonth() - month);
    base.setUTCDate(8);
    appendEntry(db, {
      kind: 'expense',
      source: month % 2 ? 'infra' : 'operating',
      account: 'main',
      amountUsd: roundUsd(140 + month * 25),
      currency: 'USD',
      rate: 1,
      country: 'AE',
      settled: true,
      demo: true,
      refType: 'demo',
      refId: `demo-expense-${month}`,
      note: 'demo operating expense',
      actor: 'seed',
      at: base.toISOString(),
    });
    count += 1;
  }
  f.seeded = true;
  return count;
}

/* ------------------------------ امنیت گزارش ------------------------------ */

export function registerFailedTotp(db) {
  const f = ensureFinance(db);
  f.security.failedTotp = (Number(f.security.failedTotp) || 0) + 1;
  f.security.lastFailedAt = new Date().toISOString();
  return f.security.failedTotp;
}

export function resetFailedTotp(db) {
  const f = ensureFinance(db);
  f.security.failedTotp = 0;
  return f.security;
}

export function decryptRecipient(grant) {
  if (isEncrypted(grant?.recipientEncrypted)) return decryptJson(grant.recipientEncrypted) || {};
  return { name: grant?.recipientName || '', email: '' };
}

// بازار هوشمند — سرور اصلی (Express 5)
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { phaseById, phaseCatalog } from './src/phases.js';
import {
  CSRF_COOKIE, csrfGuard, csrfIssue, clearLoginFailures, loginStatus, originGuard,
  registerLoginFailure, securityHeaders, recordSecurityEvent, LOGIN_MAX_FAILURES,
} from './src/security.js';

import {
  CATEGORIES, LANGS, ORDER_STATUSES, STATUS_FLOW, categoryLabel, isValidCategory,
} from './src/catalog.js';
import {
  AD_COUNTRIES, AdInputError, adOptions, adStats, buildQuote, campaignView, canTransition, invoiceFor, nextInvoiceNo,
} from './src/ads.js';
import {
  ACCOUNTS, EXPENSE_SOURCES, FinanceError, GRANT_FIELDS, GRANT_PERMISSIONS, INCOME_SOURCES, WITHDRAWAL_STAGES,
  advanceWithdrawal, appendEntry, audit, createGrant, createWithdrawal, decryptRecipient, ensureFinance,
  ensureOwnerFlag, entriesToCsv, filterEntries, findGrantByToken, grantReport, grantStatus, grantView,
  groupSeries, internalTransfer, isOwner, matchesFilter, recordAdsPipeline, recordStorefrontIncome,
  chainFingerprint, chainKeySource, registerFailedTotp, resetFailedTotp, seedDemoLedger, summarize,
  verifyChain, walletState,
} from './src/finance.js';
import {
  decryptJson, encryptJson, newTotpSecret, otpauthUrl, randomToken, sha256, verifyTotp,
} from './src/secure.js';
import {
  getDb, saveDb, saveDbSoon, flushDb, id, ensureUploadDir, UPLOAD_DIR, replaceDb,
} from './src/store.js';
import {
  generateRecoveryCodes, listSessions, recoveryCodeCount, revokeAllSessions, revokeOtherSessions,
  revokeSession, sessionView, verifyRecoveryCode,
} from './src/sessions.js';
import { EnvError, currentMode, envSummary, setMode } from './src/envmode.js';
import {
  WebAuthnError, consumeChallenge, credentialView, issueChallenge, verifyAssertion, verifyRegistration,
} from './src/webauthn.js';
import { alertConfig, dispatchAlert, monitorOverview, recentAlerts, setAlertConfig } from './src/monitor.js';
import {
  attachUser, requireAuth, requireRole, setSessionCookie, clearSessionCookie,
  publicUser, hashPassword, verifyPassword, parseCookies, currentSessionId,
} from './src/auth.js';
import {
  BackupError, backupFingerprint, backupKeySource, createBackup, createRecoveryKit, installKeys,
  readBackupFile, readBackupForRestore, readRecoveryKit, restoreUploads, runScheduledBackup,
  saveBackupFile, startBackupScheduler, uploadLimits, verifyBackup,
} from './src/backup.js';
import { seedIfEmpty, ensureSeedImages } from './src/seed.js';
import { seedDirectory } from './src/seed-directory.js';
import {
  ACTIVITY_OUTCOMES, ACTIVITY_TYPES, AD_FORMATS, AD_NETWORKS, CONSENT_STATUSES, LEAD_STATUSES,
  VERIFY_STATUSES, DirectoryError, activityView, addActivity, applyDeletion, businessView, canAdvertise,
  catalogPayload, completeActivity, consentView, crmStats, csvForBusinesses, directoryStats, dueReminders,
  filterBusinesses, filterLeads, findDuplicate, findLeadDuplicate, isCountry, isIndustry, isSource, isType,
  leadView, logAudit, normalizeBusinessInput, normalizeLeadInput, recordOptOut, requestDeletion, setConsent,
} from './src/directory.js';
import { maskPhone, normalizePhone, phoneKey, requestOtp, verifyOtp } from './src/otp.js';
import {
  localDescription, suggestPrice, localKeywords, localAssistant, sellerInsights,
  smartSearch, suggestQueries, providerComplete, providerConfig, normalize,
} from './src/ai.js';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const FREE_SHIPPING_FROM = 5000000;

/* --------------------------------- ابزارها --------------------------------- */

const clean = (value, max = 500) => String(value ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/[\u0000-\u001f\u007f]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const cleanMultiline = (value, max = 4000) => String(value ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
  .slice(0, max);

const toNumber = (value, fallback = 0) => {
  const n = Number(String(value ?? '').replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

const clampInt = (value, min, max, fallback) => {
  // مقدار خالی یا نامعتبر باید پیش‌فرض بگیرد؛ toNumber('') صفر برمی‌گرداند
  const raw = String(value ?? '').trim();
  if (raw === '') return fallback;
  const n = Math.trunc(toNumber(raw, NaN));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const lang = (value) => (LANGS.includes(value) ? value : 'fa');
const now = () => new Date().toISOString();
const pickLang = (value, l) => (LANGS.includes(l) ? l : 'fa');

function displayName(product, l = 'fa') {
  const localized = product.i18n?.[pickLang(l, 'fa')];
  return (localized && String(localized).trim()) || product.name;
}

// خروجی عمومی محصول: قیمت تمام‌شده و اطلاعات تماس فروشنده افشا نمی‌شود
function publicProduct(product, l = 'fa') {
  const db = getDb();
  const seller = db.users.find((u) => u.id === product.sellerId);
  return {
    id: product.id,
    name: displayName(product, l),
    baseName: product.name,
    description: product.description,
    price: product.price,
    category: product.category,
    categoryLabel: categoryLabel(product.category, l),
    stock: product.stock,
    image: product.image || null,
    tags: product.tags || [],
    rating: product.rating || 0,
    reviewCount: product.reviewCount || 0,
    soldCount: product.soldCount || 0,
    active: product.active !== false,
    seller: {
      id: seller?.id || null,
      storeName: seller?.storeName || product.storeName || '',
      slug: seller?.storeSlug || null,
    },
    createdAt: product.createdAt,
  };
}

function orderView(order) {
  return {
    id: order.id,
    number: order.number,
    groupId: order.groupId,
    status: order.status,
    items: order.items,
    subtotal: order.subtotal,
    discount: Number(order.discount || 0),
    discountCode: order.discountCode || null,
    shippingCost: order.shippingCost,
    total: order.total,
    shipping: order.shipping,
    note: order.note,
    storeName: order.storeName,
    customerName: order.customerName,
    payment: order.payment || { method: null, status: 'unpaid' },
    tracking: order.tracking || null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    history: order.history || [],
    allowedStatuses: STATUS_FLOW[order.status] || [],
  };
}

// نمای فروشنده/مدیر: کمیسیون و سهم فروشنده فقط برای همین نقش‌ها
function internalOrderView(order) {
  return {
    ...orderView(order),
    commission: Number(order.commission || 0),
    commissionRate: Number(order.commissionRate || 0),
    sellerPayout: Number(order.sellerPayout ?? order.total),
  };
}

// تخفیف سمت سرور: کد، سقف مبلغ و اعتبار بررسی می‌شود
function resolveDiscount(db, rawCode, subtotal) {
  const code = String(rawCode || '').trim().toUpperCase().slice(0, 24);
  if (!code) return { code: null, amount: 0, reason: null };
  const row = (db.discounts || []).find((d) => d.code === code && d.active !== false);
  if (!row) return { code, amount: 0, reason: 'discount_invalid' };
  let amount = row.type === 'percent'
    ? Math.round((subtotal * Number(row.value || 0)) / 100)
    : Math.round(Number(row.value || 0));
  if (row.maxAmount) amount = Math.min(amount, Number(row.maxAmount));
  amount = Math.max(0, Math.min(amount, subtotal));
  return { code, amount, reason: null };
}

/* ------------------------------- محدودکننده ------------------------------- */

function createLimiter({ windowMs = 60000, max = 20 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const at = Date.now();
    const entry = hits.get(key) || { count: 0, reset: at + windowMs };
    if (at > entry.reset) {
      entry.count = 0;
      entry.reset = at + windowMs;
    }
    entry.count += 1;
    hits.set(key, entry);
    if (entry.count > max) return res.status(429).json({ error: 'rate_limited' });
    if (hits.size > 5000) hits.clear();
    return next();
  };
}

/* ------------------------------- اعتبارسنجی ------------------------------- */

function validateProduct(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || body.name !== undefined) {
    const name = clean(body.name, 120);
    if (name.length < 2) errors.push('name_required');
    else out.name = name;
  }

  if (!partial || body.description !== undefined) {
    const description = cleanMultiline(body.description, 4000);
    if (description.length < 10) errors.push('description_too_short');
    else out.description = description;
  }

  if (!partial || body.price !== undefined) {
    const price = Math.trunc(toNumber(body.price, NaN));
    if (!Number.isFinite(price) || price < 1000) errors.push('price_invalid');
    else out.price = price;
  }

  if (!partial || body.stock !== undefined) {
    const stock = Math.trunc(toNumber(body.stock, NaN));
    if (!Number.isFinite(stock) || stock < 0) errors.push('stock_invalid');
    else out.stock = stock;
  }

  if (!partial || body.category !== undefined) {
    const category = clean(body.category, 30);
    if (!isValidCategory(category)) errors.push('category_invalid');
    else out.category = category;
  }

  if (body.tags !== undefined) {
    const raw = Array.isArray(body.tags) ? body.tags : String(body.tags).split(/[,،]/);
    out.tags = raw.map((t) => clean(t, 30)).filter(Boolean).slice(0, 12);
  }

  if (body.image !== undefined) {
    const image = String(body.image || '').trim();
    const ok = image === '' || /^https?:\/\/[^\s]+$/i.test(image) || /^\/uploads\/[\w.-]+$/i.test(image) || /^\/img\/[\w./-]+$/i.test(image);
    if (!ok) errors.push('image_url_invalid');
    else out.image = image;
  }

  if (body.i18n !== undefined && body.i18n && typeof body.i18n === 'object') {
    out.i18n = {};
    for (const code of ['en', 'ar', 'tr']) {
      const value = clean(body.i18n[code], 120);
      if (value) out.i18n[code] = value;
    }
  }

  if (body.active !== undefined) out.active = Boolean(body.active);

  return { errors, value: out };
}

function validateShipping(body = {}) {
  const errors = [];
  const shipping = {
    fullName: clean(body.fullName, 80),
    phone: clean(body.phone, 20).replace(/[^\d+]/g, ''),
    city: clean(body.city, 60),
    address: cleanMultiline(body.address, 300),
    postalCode: clean(body.postalCode, 20),
  };
  if (shipping.fullName.length < 3) errors.push('shipping_name_required');
  if (!/^0?\d{9,12}$/.test(shipping.phone)) errors.push('shipping_phone_invalid');
  if (shipping.city.length < 2) errors.push('shipping_city_required');
  if (shipping.address.length < 8) errors.push('shipping_address_required');
  return { errors, shipping };
}

/* ---------------------------------- اپ ---------------------------------- */

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(securityHeaders);

  app.use((req, _res, next) => {
    req.cookies = parseCookies(req.headers.cookie || '');
    next();
  });
  app.use(csrfIssue);
  app.use(originGuard);
  app.use(csrfGuard);
  app.use(express.json({ limit: '4mb' }));
  app.use(attachUser);

  const authLimiter = createLimiter({ windowMs: 60000, max: 25 });
  const aiLimiter = createLimiter({ windowMs: 60000, max: 40 });
  const financeLimiter = createLimiter({ windowMs: 60000, max: 90 });
  const reportLimiter = createLimiter({ windowMs: 60000, max: 30 });

  /* ------------------------- راه‌اندازی مالی (مالک) ------------------------- */

  {
    const db = getDb();
    ensureFinance(db);
    ensureOwnerFlag(db);
    seedDemoLedger(db);
    seedDirectory(db);
    saveDbSoon();
  }

  const isDay = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null);

  const safeIso = (value) => {
    if (!value) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  };

  const financeFail = (res, err) => {
    if (err instanceof FinanceError) {
      return res.status(err.status || 400).json({
        error: err.code,
        ...(err.availableUsd !== undefined ? { availableUsd: err.availableUsd } : {}),
      });
    }
    throw err;
  };

  const deniedHtml = '<!doctype html><meta charset="utf-8"><title>403</title>'
    + '<div style="font-family:system-ui;padding:2rem;text-align:center;line-height:2">'
    + '<h1 style="font-size:1.3rem">دسترسی فقط برای مدیر اصلی مجاز است</h1>'
    + '<p>Owner access only. This financial panel is restricted.</p>'
    + '<p><a href="/admin">بازگشت به پنل مدیریت</a></p></div>';

  const requireOwner = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'auth_required' });
    const db = getDb();
    const finance = ensureFinance(db);
    if (!isOwner(db, req.user)) {
      finance.security.denied = (Number(finance.security.denied) || 0) + 1;
      audit(db, {
        actorId: req.user.id, actorRole: req.user.role, action: 'finance_access_denied',
        target: req.path, meta: { method: req.method }, ip: req.ip,
      });
      saveDbSoon();
      return res.status(403).json({ error: 'owner_only' });
    }
    return next();
  };

  // مرحلهٔ دوم امنیتی: رمز عبور مجدد + کد Authenticator
  const verifySecondFactor = (req, db) => {
    const finance = ensureFinance(db);
    const failed = Number(finance.security.failedTotp) || 0;
    if (failed >= 8) {
      const last = finance.security.lastFailedAt ? Date.parse(finance.security.lastFailedAt) : 0;
      if (Date.now() - last < 15 * 60000) return { ok: false, status: 429, error: 'too_many_attempts' };
      finance.security.failedTotp = 0;
    }
    if (!verifyPassword(String(req.body?.password || ''), req.user.passwordHash)) {
      audit(db, { actorId: req.user.id, actorRole: req.user.role, action: 'finance_password_failed', target: req.path, meta: {}, ip: req.ip });
      saveDbSoon();
      return { ok: false, status: 403, error: 'password_invalid' };
    }
    if (!req.user.totp?.enabled) return { ok: false, status: 409, error: 'totp_not_enabled' };
    const stored = decryptJson(req.user.totp.secret);
    if (!verifyTotp(stored?.secret, req.body?.code)) {
      registerFailedTotp(db);
      audit(db, { actorId: req.user.id, actorRole: req.user.role, action: 'finance_totp_failed', target: req.path, meta: {}, ip: req.ip });
      saveDbSoon();
      return { ok: false, status: 403, error: 'totp_invalid' };
    }
    resetFailedTotp(db);
    return { ok: true };
  };

  /* ---------------------------------- متا ---------------------------------- */

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'smart-bazaar', engine: providerConfig() ? 'provider' : 'local', at: now() });
  });

  app.get('/api/meta', (_req, res) => {
    const db = getDb();
    res.json({
      categories: CATEGORIES,
      languages: LANGS,
      statuses: ORDER_STATUSES,
      shippingCost: db.settings?.shippingCost ?? 45000,
      freeShippingFrom: FREE_SHIPPING_FROM,
      currency: 'IRT',
      ai: { engine: providerConfig() ? 'provider' : 'local' },
      demoAccounts: [
        { role: 'customer', email: 'customer@bazaar.ir', password: 'Customer@1234' },
        { role: 'seller', email: 'sara@bazaar.ir', password: 'Seller@1234' },
        { role: 'admin', email: 'admin@bazaar.ir', password: 'Admin@1234' },
      ],
    });
  });

  /* --------------------------------- احراز هویت --------------------------------- */

  app.get('/api/csrf', (req, res) => {
    if (req.csrfToken) return res.json({ token: req.csrfToken });
    const token = crypto.randomBytes(32).toString('base64url');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: Boolean(req.secure),
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    });
    return res.json({ token });
  });

  app.post('/api/auth/register', authLimiter, (req, res) => {
    const db = getDb();
    const name = clean(req.body?.name, 80);
    const email = clean(req.body?.email, 120).toLowerCase();
    const password = String(req.body?.password || '');
    const role = req.body?.role === 'seller' ? 'seller' : 'customer';
    const storeName = clean(req.body?.storeName, 80);

    if (name.length < 3) return res.status(400).json({ error: 'name_required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'email_invalid' });
    if (password.length < 8) return res.status(400).json({ error: 'password_too_short' });
    if (role === 'seller' && storeName.length < 3) return res.status(400).json({ error: 'store_name_required' });
    if (db.users.some((u) => u.email === email)) return res.status(409).json({ error: 'email_taken' });

    const user = {
      id: id(),
      name,
      email,
      passwordHash: hashPassword(password),
      role,
      storeName: role === 'seller' ? storeName : null,
      storeSlug: role === 'seller' ? `${storeName.replace(/\s+/g, '-').slice(0, 24)}-${id().slice(0, 4)}` : null,
      status: 'active',
      createdAt: now(),
    };
    db.users.push(user);
    saveDbSoon();
    setSessionCookie(res, user, req);
    res.status(201).json({ user: publicUser(user) });
  });

  app.post('/api/auth/login', authLimiter, (req, res) => {
    const db = getDb();
    const email = clean(req.body?.email, 120).toLowerCase();
    const password = String(req.body?.password || '');

    const attempt = loginStatus(req, email);
    if (attempt.blocked) {
      recordSecurityEvent({
        type: 'login_blocked',
        severity: 'warning',
        ip: req.ip,
        identity: email,
        path: '/api/auth/login',
        detail: `failures=${attempt.failures}`,
      });
      const retryAfter = Math.max(1, Math.ceil(attempt.retryAfterMs / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'too_many_attempts', retryAfterSeconds: retryAfter });
    }

    const user = db.users.find((u) => u.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      const failures = registerLoginFailure(req, email);
      recordSecurityEvent({
        type: 'login_failed',
        severity: failures >= LOGIN_MAX_FAILURES ? 'warning' : 'info',
        ip: req.ip,
        identity: email,
        path: '/api/auth/login',
        detail: `failures=${failures}`,
      });
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    if (user.status === 'blocked') return res.status(403).json({ error: 'account_blocked' });
    clearLoginFailures(req, email);
    setSessionCookie(res, user, req);
    res.json({ user: publicUser(user) });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    if (!req.user) return res.json({ user: null });
    const db = getDb();
    const productCount = db.products.filter((p) => p.sellerId === req.user.id).length;
    res.json({ user: publicUser(req.user), productCount });
  });

  app.patch('/api/auth/profile', requireAuth, (req, res) => {
    const name = clean(req.body?.name, 80);
    const phone = clean(req.body?.phone, 20).replace(/[^\d+]/g, '');
    if (name && name.length < 3) return res.status(400).json({ error: 'name_required' });
    if (name) req.user.name = name;
    if (phone) req.user.phone = phone;
    if (req.user.role === 'seller' && req.body?.storeName !== undefined) {
      const storeName = clean(req.body.storeName, 80);
      if (storeName.length < 3) return res.status(400).json({ error: 'store_name_required' });
      req.user.storeName = storeName;
      getDb().products.filter((p) => p.sellerId === req.user.id).forEach((p) => { p.storeName = storeName; });
    }
    req.user.updatedAt = now();
    saveDbSoon();
    res.json({ user: publicUser(req.user) });
  });

  /* --------------------------------- محصولات --------------------------------- */

  app.get('/api/products', (req, res) => {
    const db = getDb();
    const l = lang(req.query.lang);
    const q = clean(req.query.q, 120);
    const category = clean(req.query.category, 30);
    const sellerId = clean(req.query.seller, 40);
    const minPrice = toNumber(req.query.minPrice, 0);
    const maxPrice = toNumber(req.query.maxPrice, 0);
    const inStock = req.query.inStock === 'true' || req.query.inStock === '1';
    const sort = clean(req.query.sort, 20) || 'newest';
    const page = clampInt(req.query.page, 1, 500, 1);
    const pageSize = clampInt(req.query.pageSize, 1, 60, 12);

    let items = db.products.filter((p) => p.active !== false);

    if (q) {
      const scored = smartSearch(items, q, 500);
      items = scored.map((row) => row.product);
    }
    if (category && isValidCategory(category)) items = items.filter((p) => p.category === category);
    if (sellerId) items = items.filter((p) => p.sellerId === sellerId);
    if (minPrice > 0) items = items.filter((p) => p.price >= minPrice);
    if (maxPrice > 0) items = items.filter((p) => p.price <= maxPrice);
    if (inStock) items = items.filter((p) => Number(p.stock) > 0);

    if (!q) {
      const sorters = {
        newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
        price_asc: (a, b) => a.price - b.price,
        price_desc: (a, b) => b.price - a.price,
        rating: (a, b) => (b.rating || 0) - (a.rating || 0),
        popular: (a, b) => (b.soldCount || 0) - (a.soldCount || 0),
      };
      items = items.slice().sort(sorters[sort] || sorters.newest);
    }

    const total = items.length;
    const start = (page - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);

    const counts = new Map();
    db.products.filter((p) => p.active !== false).forEach((p) => {
      counts.set(p.category, (counts.get(p.category) || 0) + 1);
    });

    const sellers = new Map();
    db.products.filter((p) => p.active !== false).forEach((p) => {
      if (!p.sellerId) return;
      const entry = sellers.get(p.sellerId) || { id: p.sellerId, storeName: p.storeName, count: 0 };
      entry.count += 1;
      sellers.set(p.sellerId, entry);
    });

    res.json({
      items: pageItems.map((p) => publicProduct(p, l)),
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      facets: {
        categories: CATEGORIES.map((c) => ({ slug: c.slug, count: counts.get(c.slug) || 0 })),
        sellers: [...sellers.values()].sort((a, b) => b.count - a.count).slice(0, 20),
      },
    });
  });

  app.get('/api/products/:id', (req, res) => {
    const db = getDb();
    const l = lang(req.query.lang);
    const product = db.products.find((p) => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'product_not_found' });
    const reviews = db.reviews
      .filter((r) => r.productId === product.id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 20)
      .map((r) => ({ id: r.id, userName: r.userName, rating: r.rating, comment: r.comment, createdAt: r.createdAt }));
    const related = db.products
      .filter((p) => p.id !== product.id && p.category === product.category && p.active !== false)
      .slice(0, 4)
      .map((p) => publicProduct(p, l));
    res.json({ product: publicProduct(product, l), reviews, related });
  });

  app.get('/api/products/:id/reviews', (req, res) => {
    const db = getDb();
    const reviews = db.reviews
      .filter((r) => r.productId === req.params.id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((r) => ({ id: r.id, userName: r.userName, rating: r.rating, comment: r.comment, createdAt: r.createdAt }));
    res.json({ reviews });
  });

  app.post('/api/products/:id/reviews', requireAuth, (req, res) => {
    const db = getDb();
    const product = db.products.find((p) => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'product_not_found' });
    const rating = clampInt(req.body?.rating, 1, 5, 0);
    const comment = cleanMultiline(req.body?.comment, 500);
    if (!rating) return res.status(400).json({ error: 'rating_invalid' });
    if (comment.length < 3) return res.status(400).json({ error: 'comment_too_short' });

    const existing = db.reviews.find((r) => r.productId === product.id && r.userId === req.user.id);
    if (existing) {
      existing.rating = rating;
      existing.comment = comment;
      existing.createdAt = now();
    } else {
      db.reviews.push({
        id: id(), productId: product.id, userId: req.user.id,
        userName: req.user.name, rating, comment, createdAt: now(),
      });
    }
    const all = db.reviews.filter((r) => r.productId === product.id);
    product.reviewCount = all.length;
    product.rating = Math.round((all.reduce((s, r) => s + r.rating, 0) / all.length) * 10) / 10;
    saveDbSoon();
    res.status(201).json({ ok: true, rating: product.rating, reviewCount: product.reviewCount });
  });

  /* --------------------------------- جست‌وجو --------------------------------- */

  app.get('/api/search/suggest', (req, res) => {
    const db = getDb();
    const l = lang(req.query.lang);
    const q = clean(req.query.q, 80);
    if (q.length < 2) return res.json({ suggestions: [], products: [] });
    const products = db.products.filter((p) => p.active !== false);
    const suggestions = suggestQueries(products, q, CATEGORIES, 6);
    const matches = smartSearch(products, q, 6).map((row) => ({
      id: row.product.id,
      name: displayName(row.product, l),
      price: row.product.price,
      image: row.product.image,
      score: row.score,
    }));
    res.json({ suggestions, products: matches });
  });

  app.get('/api/sellers', (_req, res) => {
    const db = getDb();
    const list = db.users
      .filter((u) => u.role === 'seller' && u.status === 'active')
      .map((u) => {
        const products = db.products.filter((p) => p.sellerId === u.id && p.active !== false);
        const rating = products.length
          ? Math.round((products.reduce((s, p) => s + (p.rating || 0), 0) / products.length) * 10) / 10
          : 0;
        return {
          id: u.id, storeName: u.storeName, slug: u.storeSlug,
          productCount: products.length, rating,
        };
      })
      .filter((s) => s.productCount > 0)
      .sort((a, b) => b.productCount - a.productCount);
    res.json({ sellers: list });
  });

  /* --------------------------------- سفارش‌ها --------------------------------- */

  app.post('/api/orders', requireAuth, (req, res) => {
    const db = getDb();
    const rawItems = Array.isArray(req.body?.items) ? req.body.items.slice(0, 40) : [];
    if (!rawItems.length) return res.status(400).json({ error: 'cart_empty' });

    const { errors, shipping } = validateShipping(req.body?.shipping);
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const wanted = new Map();
    for (const item of rawItems) {
      const productId = clean(item?.productId, 40);
      const qty = clampInt(item?.qty, 1, 20, 0);
      if (!productId || !qty) continue;
      wanted.set(productId, (wanted.get(productId) || 0) + qty);
    }
    if (!wanted.size) return res.status(400).json({ error: 'cart_empty' });

    const lines = [];
    for (const [productId, qty] of wanted) {
      const product = db.products.find((p) => p.id === productId);
      if (!product || product.active === false) return res.status(400).json({ error: 'product_unavailable', productId });
      if (Number(product.stock) < qty) return res.status(400).json({ error: 'insufficient_stock', productId, name: product.name, stock: product.stock });
      lines.push({ product, qty });
    }

    const cartSubtotal = lines.reduce((s, line) => s + line.product.price * line.qty, 0);
    const discount = resolveDiscount(db, req.body?.discountCode, cartSubtotal);
    if (discount.reason) return res.status(400).json({ error: discount.reason });

    // جلوگیری از ثبت سفارش تکراری با کلید درخواست
    const requestId = clean(req.body?.requestId, 40);
    if (requestId) {
      const existing = db.orders.find((o) => o.requestId === requestId && o.customerId === req.user.id);
      if (existing) {
        const group = db.orders.filter((o) => o.groupId === existing.groupId);
        return res.json({
          groupId: existing.groupId,
          orders: group.map(orderView),
          total: group.reduce((s, o) => s + o.total, 0),
          duplicate: true,
        });
      }
    }

    const groupId = id();
    const seqBase = Number(db.settings?.orderSeq || 100000);
    let seq = seqBase;
    const bySeller = new Map();
    for (const line of lines) {
      const key = line.product.sellerId;
      if (!bySeller.has(key)) bySeller.set(key, []);
      bySeller.get(key).push(line);
    }

    const created = [];
    for (const [sellerId, sellerLines] of bySeller) {
      const seller = db.users.find((u) => u.id === sellerId);
      const subtotal = sellerLines.reduce((s, line) => s + line.product.price * line.qty, 0);
      const sellerDiscount = cartSubtotal > 0 ? Math.round((discount.amount * subtotal) / cartSubtotal) : 0;
      const shippingCost = subtotal >= FREE_SHIPPING_FROM ? 0 : Number(db.settings?.shippingCost ?? 45000);
      const commissionRate = Number(db.settings?.commissionRate ?? 0.07);
      const commission = Math.round((subtotal - sellerDiscount) * commissionRate);
      const total = subtotal - sellerDiscount + shippingCost;
      const sellerPayout = subtotal - sellerDiscount - commission + shippingCost;
      seq += 1;
      const order = {
        id: id(),
        number: `SB-${seq}`,
        groupId,
        customerId: req.user.id,
        customerName: req.user.name,
        sellerId,
        storeName: seller?.storeName || 'فروشگاه',
        items: sellerLines.map((line) => ({
          productId: line.product.id,
          name: line.product.name,
          price: line.product.price,
          qty: line.qty,
          image: line.product.image || null,
        })),
        subtotal,
        discount: sellerDiscount,
        discountCode: discount.code,
        shippingCost,
        total,
        commission,
        commissionRate,
        sellerPayout,
        requestId: requestId || null,
        payment: { method: null, status: 'unpaid', at: null },
        tracking: null,
        status: 'pending',
        shipping,
        note: cleanMultiline(req.body?.note, 400),
        createdAt: now(),
        updatedAt: now(),
        history: [{ status: 'pending', at: now(), by: req.user.name }],
      };
      db.orders.push(order);
      created.push(order);
      for (const line of sellerLines) {
        line.product.stock = Math.max(0, Number(line.product.stock) - line.qty);
        line.product.soldCount = Number(line.product.soldCount || 0) + line.qty;
      }
    }

    db.settings = { ...(db.settings || {}), orderSeq: seq };
    for (const order of created) recordStorefrontIncome(db, order);
    saveDbSoon();
    res.status(201).json({
      groupId,
      orders: created.map(orderView),
      total: created.reduce((s, o) => s + o.total, 0),
      cart: {
        subtotal: cartSubtotal,
        discount: discount.amount,
        discountCode: discount.code,
        shipping: created.reduce((s, o) => s + Number(o.shippingCost || 0), 0),
        total: created.reduce((s, o) => s + Number(o.total || 0), 0),
      },
    });
  });

  app.get('/api/orders', requireAuth, (req, res) => {
    const db = getDb();
    const orders = db.orders
      .filter((o) => o.customerId === req.user.id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(orderView);
    res.json({ orders });
  });

  app.get('/api/orders/:id', requireAuth, (req, res) => {
    const db = getDb();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'order_not_found' });
    const allowed = order.customerId === req.user.id || order.sellerId === req.user.id || req.user.role === 'admin';
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    res.json({ order: orderView(order) });
  });

  /* --------------------------------- فروشنده --------------------------------- */

  app.get('/api/seller/overview', requireRole('seller'), (req, res) => {
    const db = getDb();
    const products = db.products.filter((p) => p.sellerId === req.user.id);
    const orders = db.orders.filter((o) => o.sellerId === req.user.id);
    const insights = sellerInsights(products, orders);
    res.json({
      store: { storeName: req.user.storeName, storeSlug: req.user.storeSlug },
      counts: {
        products: products.length,
        active: products.filter((p) => p.active !== false).length,
        outOfStock: products.filter((p) => Number(p.stock) === 0).length,
        orders: orders.length,
        pending: orders.filter((o) => o.status === 'pending').length,
      },
      insights,
      recentOrders: orders
        .slice()
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 5)
        .map(orderView),
    });
  });

  app.get('/api/seller/products', requireRole('seller'), (req, res) => {
    const db = getDb();
    const l = lang(req.query.lang);
    const products = db.products
      .filter((p) => p.sellerId === req.user.id)
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
      .map((p) => ({
        ...publicProduct(p, l),
        i18n: p.i18n || {},
        active: p.active !== false,
      }));
    res.json({ products });
  });

  app.post('/api/seller/products', requireRole('seller'), (req, res) => {
    const { errors, value } = validateProduct(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    const db = getDb();
    const product = {
      id: id(),
      sellerId: req.user.id,
      storeName: req.user.storeName,
      i18n: value.i18n || {},
      tags: value.tags || [],
      image: value.image || null,
      active: value.active !== false,
      rating: 0,
      reviewCount: 0,
      soldCount: 0,
      createdAt: now(),
      updatedAt: now(),
      ...value,
    };
    db.products.push(product);
    saveDbSoon();
    res.status(201).json({ product: publicProduct(product, lang(req.body?.lang)) });
  });

  app.put('/api/seller/products/:id', requireRole('seller'), (req, res) => {
    const db = getDb();
    const product = db.products.find((p) => p.id === req.params.id && p.sellerId === req.user.id);
    if (!product) return res.status(404).json({ error: 'product_not_found' });
    const { errors, value } = validateProduct(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    Object.assign(product, value, { updatedAt: now() });
    if (req.user.storeName) product.storeName = req.user.storeName;
    saveDbSoon();
    res.json({ product: publicProduct(product, lang(req.body?.lang)) });
  });

  app.delete('/api/seller/products/:id', requireRole('seller'), (req, res) => {
    const db = getDb();
    const index = db.products.findIndex((p) => p.id === req.params.id && p.sellerId === req.user.id);
    if (index === -1) return res.status(404).json({ error: 'product_not_found' });
    db.products.splice(index, 1);
    saveDbSoon();
    res.json({ ok: true });
  });

  app.post('/api/seller/products/:id/image', requireRole('seller'), (req, res) => {
    const db = getDb();
    const product = db.products.find((p) => p.id === req.params.id && p.sellerId === req.user.id);
    if (!product) return res.status(404).json({ error: 'product_not_found' });

    const dataUrl = String(req.body?.dataUrl || '');
    const match = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) return res.status(400).json({ error: 'image_invalid' });
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > MAX_UPLOAD_BYTES) return res.status(413).json({ error: 'image_too_large' });

    ensureUploadDir();
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const filename = `${product.id}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
    product.image = `/uploads/${filename}`;
    product.updatedAt = now();
    saveDbSoon();
    res.json({ image: product.image });
  });

  app.get('/api/seller/orders', requireRole('seller'), (req, res) => {
    const db = getDb();
    const status = clean(req.query.status, 20);
    let orders = db.orders.filter((o) => o.sellerId === req.user.id);
    if (ORDER_STATUSES.includes(status)) orders = orders.filter((o) => o.status === status);
    orders = orders
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(internalOrderView);
    res.json({ orders });
  });

  app.patch('/api/seller/orders/:id/status', requireRole('seller'), (req, res) => {
    const db = getDb();
    const order = db.orders.find((o) => o.id === req.params.id && o.sellerId === req.user.id);
    if (!order) return res.status(404).json({ error: 'order_not_found' });
    const status = clean(req.body?.status, 20);
    if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'status_invalid' });
    if (!(STATUS_FLOW[order.status] || []).includes(status)) {
      return res.status(409).json({ error: 'status_transition_invalid', from: order.status, to: status });
    }

    // بازگرداندن موجودی در صورت لغو یا مرجوعی
    if (['canceled', 'returned'].includes(status)) {
      for (const item of order.items) {
        const product = db.products.find((p) => p.id === item.productId);
        if (product) {
          product.stock = Number(product.stock) + Number(item.qty || 0);
          product.soldCount = Math.max(0, Number(product.soldCount || 0) - Number(item.qty || 0));
        }
      }
    }

    order.status = status;
    order.updatedAt = now();
    order.history = [...(order.history || []), { status, at: now(), by: req.user.name }];
    saveDbSoon();
    res.json({ order: orderView(order) });
  });

  /* --------------------------------- مدیر --------------------------------- */

  app.get('/api/admin/overview', requireRole('admin'), (_req, res) => {
    const db = getDb();
    const activeOrders = db.orders.filter((o) => !['canceled', 'returned'].includes(o.status));
    res.json({
      counts: {
        users: db.users.length,
        sellers: db.users.filter((u) => u.role === 'seller').length,
        customers: db.users.filter((u) => u.role === 'customer').length,
        products: db.products.length,
        orders: db.orders.length,
        reviews: db.reviews.length,
      },
      revenue: activeOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
      statusBreakdown: ORDER_STATUSES.map((status) => ({
        status,
        count: db.orders.filter((o) => o.status === status).length,
      })),
      topProducts: db.products
        .slice()
        .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
        .slice(0, 5)
        .map((p) => ({ id: p.id, name: p.name, soldCount: p.soldCount || 0, price: p.price })),
      recentOrders: db.orders
        .slice()
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 8)
        .map(orderView),
    });
  });

  app.get('/api/admin/users', requireRole('admin'), (req, res) => {
    const db = getDb();
    const role = clean(req.query.role, 20);
    const users = db.users
      .filter((u) => !role || u.role === role)
      .map((u) => ({
        ...publicUser(u),
        productCount: db.products.filter((p) => p.sellerId === u.id).length,
        orderCount: db.orders.filter((o) => o.customerId === u.id || o.sellerId === u.id).length,
      }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({ users });
  });

  app.patch('/api/admin/users/:id', requireRole('admin'), (req, res) => {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'admin_protected' });
    const status = clean(req.body?.status, 20);
    if (status && !['active', 'blocked'].includes(status)) return res.status(400).json({ error: 'status_invalid' });
    if (status) user.status = status;
    user.updatedAt = now();
    saveDbSoon();
    res.json({ user: publicUser(user) });
  });

  app.get('/api/admin/orders', requireRole('admin'), (req, res) => {
    const db = getDb();
    const status = clean(req.query.status, 20);
    const orders = db.orders
      .filter((o) => !status || o.status === status)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(internalOrderView);
    res.json({ orders });
  });

  /* ------------------------------ ابزارهای هوش مصنوعی ------------------------------ */

  app.get('/api/ai/status', (_req, res) => {
    const config = providerConfig();
    res.json({ engine: config ? 'provider' : 'local', model: config?.model || null });
  });

  app.post('/api/ai/describe', requireRole('seller', 'admin'), aiLimiter, async (req, res) => {
    const db = getDb();
    const name = clean(req.body?.name, 120);
    const category = clean(req.body?.category, 30);
    const tone = ['friendly', 'professional', 'short'].includes(req.body?.tone) ? req.body.tone : 'friendly';
    const l = lang(req.body?.lang);
    const features = Array.isArray(req.body?.features) ? req.body.features : String(req.body?.features || '').split(/[,،\n]/);
    if (name.length < 2) return res.status(400).json({ error: 'name_required' });

    let text = null;
    let engine = 'local';
    const prompt = [
      { role: 'system', content: `You are a marketplace copywriter. Reply in ${l === 'fa' ? 'Persian' : l === 'ar' ? 'Arabic' : l === 'tr' ? 'Turkish' : 'English'} only.` },
      { role: 'user', content: `Write a ${tone} product description (max 90 words) for "${name}" in category "${categoryLabel(category || 'other', l)}". Features: ${features.join(', ') || 'general'}.` },
    ];
    const providerText = await providerComplete(prompt);
    if (providerText) {
      text = providerText;
      engine = 'provider';
    } else {
      const local = localDescription({ name, category, features, tone, lang: l });
      text = local.text;
    }
    db.assistantLogs.push({ id: id(), userId: req.user.id, tool: 'describe', at: now() });
    saveDbSoon();
    res.json({ text, engine });
  });

  app.post('/api/ai/price', requireRole('seller', 'admin'), aiLimiter, (req, res) => {
    const db = getDb();
    const name = clean(req.body?.name, 120);
    const category = clean(req.body?.category, 30) || 'other';
    const cost = toNumber(req.body?.cost, 0);
    const l = lang(req.body?.lang);
    if (!isValidCategory(category)) return res.status(400).json({ error: 'category_invalid' });
    const result = suggestPrice({ name, category, cost, products: db.products, lang: l });
    res.json(result);
  });

  app.post('/api/ai/keywords', requireRole('seller', 'admin'), aiLimiter, async (req, res) => {
    const name = clean(req.body?.name, 120);
    const description = cleanMultiline(req.body?.description, 2000);
    const category = clean(req.body?.category, 30) || 'other';
    const l = lang(req.body?.lang);
    const local = localKeywords({ name, description, category, lang: l });
    const providerText = await providerComplete([
      { role: 'system', content: 'You generate SEO keywords. Reply with a comma separated list only, max 12 items.' },
      { role: 'user', content: `Product: ${name}. Category: ${categoryLabel(category, l)}. Description: ${description || 'n/a'}. Language: ${l}.` },
    ]);
    if (providerText) {
      return res.json({ keywords: providerText.split(/[,،\n]/).map((k) => k.trim()).filter(Boolean).slice(0, 12), engine: 'provider' });
    }
    res.json(local);
  });

  app.post('/api/ai/assistant', aiLimiter, (req, res) => {
    const db = getDb();
    const message = cleanMultiline(req.body?.message, 500);
    const l = lang(req.body?.lang);
    if (message.length < 2) return res.status(400).json({ error: 'message_required' });

    const isSeller = req.user?.role === 'seller' || req.user?.role === 'admin';
    const products = isSeller
      ? db.products.filter((p) => p.sellerId === req.user.id)
      : db.products.filter((p) => p.active !== false);
    const orders = isSeller
      ? db.orders.filter((o) => o.sellerId === req.user.id)
      : db.orders.filter((o) => req.user && o.customerId === req.user.id);

    const result = localAssistant(message, {
      lang: l, products, orders,
      role: isSeller ? 'seller' : 'customer',
      sellerName: req.user?.storeName || '',
    });
    res.json({ reply: result.reply, products: result.products || [], engine: result.engine });
  });

  app.get('/api/ai/insights', requireRole('seller'), (req, res) => {
    const db = getDb();
    const products = db.products.filter((p) => p.sellerId === req.user.id);
    const orders = db.orders.filter((o) => o.sellerId === req.user.id);
    res.json({ insights: sellerInsights(products, orders), engine: 'local' });
  });

  /* ------------------------------ مرکز تبلیغات ------------------------------ */

  const adDay = 864e5;
  const toIsoDay = (value) => {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10);
  };
  const plusDays = (isoDay, days) =>
    new Date(new Date(`${isoDay}T00:00:00Z`).getTime() + days * adDay).toISOString().slice(0, 10);
  const adFail = (res, err) => {
    if (err instanceof AdInputError) return res.status(err.status).json({ error: err.code });
    throw err;
  };

  app.get('/api/ads/options', (_req, res) => {
    res.json(adOptions(getDb()));
  });

  app.post('/api/ads/quote', (req, res) => {
    try {
      res.json({ quote: buildQuote(req.body || {}, getDb()) });
    } catch (err) {
      adFail(res, err);
    }
  });

  app.get('/api/ads/campaigns', requireAuth, (req, res) => {
    const db = getDb();
    const campaigns = db.adCampaigns
      .filter((c) => req.user.role === 'admin' || c.userId === req.user.id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(campaignView);
    res.json({ campaigns, publishingEnabled: false, paymentsEnabled: false });
  });

  app.post('/api/ads/campaigns', requireAuth, (req, res) => {
    const db = getDb();
    const body = req.body || {};
    const title = clean(body.title, 120);
    if (title.length < 3) return res.status(400).json({ error: 'title_required' });
    const description = cleanMultiline(body.description, 1000);

    let quote;
    try {
      quote = buildQuote(body, db);
    } catch (err) {
      return adFail(res, err);
    }

    const startDate = toIsoDay(body.startDate);
    const endDate = plusDays(startDate, quote.durationDays);
    const stamp = new Date().toISOString();
    const campaign = {
      id: id(),
      invoiceNo: nextInvoiceNo(db),
      userId: req.user.id,
      ownerName: req.user.name || '',
      ownerEmail: req.user.email || '',
      title,
      description,
      country: quote.country.code,
      countryName: quote.country.name,
      currency: quote.currency,
      media: quote.lines.map((line) => line.media),
      placement: quote.placement.code,
      creative: quote.creative.code,
      durationDays: quote.durationDays,
      startDate,
      endDate,
      rate: quote.rate,
      rateSource: quote.rateBase,
      totalLocal: quote.totalLocal,
      totalUsd: quote.totalUsd,
      breakdown: quote,
      status: 'awaiting_payment',
      paymentStatus: 'disabled',
      paymentEnabled: false,
      publishingEnabled: false,
      statusHistory: [
        { status: 'awaiting_payment', at: stamp, by: req.user.id, note: 'online_payment_disabled' },
      ],
      createdAt: stamp,
      updatedAt: stamp,
    };
    db.adCampaigns.push(campaign);
    recordAdsPipeline(db, campaign);
    saveDbSoon();
    res.status(201).json({ campaign: campaignView(campaign), invoice: invoiceFor(campaign) });
  });

  app.get('/api/ads/campaigns/:id', requireAuth, (req, res) => {
    const db = getDb();
    const campaign = db.adCampaigns.find((c) => c.id === req.params.id);
    if (!campaign) return res.status(404).json({ error: 'not_found' });
    if (campaign.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    res.json({ campaign: campaignView(campaign), invoice: invoiceFor(campaign) });
  });

  app.post('/api/ads/campaigns/:id/cancel', requireAuth, (req, res) => {
    const db = getDb();
    const campaign = db.adCampaigns.find((c) => c.id === req.params.id);
    if (!campaign) return res.status(404).json({ error: 'not_found' });
    if (campaign.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (!canTransition(campaign.status, 'canceled')) {
      return res.status(409).json({ error: 'status_locked', status: campaign.status });
    }
    campaign.status = 'canceled';
    campaign.paymentStatus = 'disabled';
    campaign.updatedAt = new Date().toISOString();
    campaign.statusHistory.push({
      status: 'canceled', at: campaign.updatedAt, by: req.user.id, note: 'canceled_by_user',
    });
    saveDbSoon();
    res.json({ campaign: campaignView(campaign), invoice: invoiceFor(campaign) });
  });

  app.get('/api/admin/ads/campaigns', requireRole('admin'), (req, res) => {
    const db = getDb();
    const status = clean(req.query.status, 24);
    const campaigns = db.adCampaigns
      .filter((c) => !status || c.status === status)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(campaignView);
    res.json({ campaigns, stats: adStats(db.adCampaigns) });
  });

  app.get('/api/admin/ads/stats', requireRole('admin'), (_req, res) => {
    res.json(adStats(getDb().adCampaigns));
  });

  app.patch('/api/admin/ads/campaigns/:id', requireRole('admin'), (req, res) => {
    const db = getDb();
    const campaign = db.adCampaigns.find((c) => c.id === req.params.id);
    if (!campaign) return res.status(404).json({ error: 'not_found' });
    const next = clean(req.body?.status, 24);
    if (!next) return res.status(400).json({ error: 'status_required' });
    if (!canTransition(campaign.status, next)) {
      return res.status(409).json({ error: 'status_transition_invalid', from: campaign.status, to: next });
    }
    campaign.status = next;
    campaign.updatedAt = new Date().toISOString();
    campaign.statusHistory.push({
      status: next, at: campaign.updatedAt, by: req.user.id, note: clean(req.body?.note, 160) || 'admin_update',
    });
    saveDbSoon();
    res.json({ campaign: campaignView(campaign), stats: adStats(db.adCampaigns) });
  });

  /* --------------------------- مالی محرمانه (مالک) --------------------------- */

  app.get('/api/finance/overview', requireOwner, financeLimiter, (req, res) => {
    const db = getDb();
    const includeDemo = req.query.includeDemo === '1';
    const q = {
      from: isDay(req.query.from),
      to: isDay(req.query.to),
      country: req.query.country || null,
      source: req.query.source || null,
      includeDemo,
    };
    const rows = ensureFinance(db).entries.filter((entry) => matchesFilter(entry, q));
    const bucket = ['day', 'week', 'month', 'year'].includes(req.query.bucket) ? req.query.bucket : 'month';
    res.json({
      summary: summarize(rows),
      series: groupSeries(rows, bucket),
      wallet: walletState(db, { includeDemo }),
      chain: verifyChain(db),
      countries: AD_COUNTRIES.map((c) => ({ code: c.code, currency: c.currency, flag: c.flag, name: c.name })),
      incomeSources: INCOME_SOURCES,
      expenseSources: EXPENSE_SOURCES,
      accounts: ACCOUNTS,
      includeDemo,
      bucket,
      reportType: 'internal_management_report',
      paymentsEnabled: false,
      payoutEnabled: false,
    });
  });

  app.get('/api/finance/entries', requireOwner, financeLimiter, (req, res) => {
    const db = getDb();
    res.json(filterEntries(db, {
      from: isDay(req.query.from),
      to: isDay(req.query.to),
      kind: req.query.kind || null,
      source: req.query.source || null,
      country: req.query.country || null,
      currency: req.query.currency || null,
      account: req.query.account || null,
      q: req.query.q || null,
      includeDemo: req.query.includeDemo === '1',
      limit: req.query.limit,
      offset: req.query.offset,
    }));
  });

  app.post('/api/finance/entries', requireOwner, financeLimiter, (req, res) => {
    const db = getDb();
    const body = req.body || {};
    const kind = body.kind === 'expense' ? 'expense' : 'income';
    try {
      const entry = appendEntry(db, {
        kind,
        source: clean(body.source, 30) || (kind === 'income' ? 'service' : 'operating'),
        account: ACCOUNTS.some((a) => a.code === body.account) ? body.account : 'main',
        amountUsd: toNumber(body.amountUsd, 0),
        currency: clean(body.currency, 4).toUpperCase() || 'USD',
        country: clean(body.country, 4).toUpperCase() || null,
        settled: body.settled !== false,
        note: cleanMultiline(body.note, 200),
        at: safeIso(body.at),
        actor: req.user.id,
        idempotencyKey: clean(body.idempotencyKey, 80) || null,
      });
      audit(db, {
        actorId: req.user.id, actorRole: req.user.role, action: `entry_created_${kind}`,
        target: entry.id, meta: { amountUsd: entry.amountUsd, currency: entry.currency }, ip: req.ip,
      });
      saveDbSoon();
      res.status(201).json({ entry, chain: verifyChain(db) });
    } catch (err) {
      financeFail(res, err);
    }
  });

  app.get('/api/finance/wallet', requireOwner, financeLimiter, (req, res) => {
    const db = getDb();
    const finance = ensureFinance(db);
    res.json({
      wallet: walletState(db, { includeDemo: req.query.includeDemo === '1' }),
      withdrawals: finance.withdrawals
        .slice()
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 50),
      stages: WITHDRAWAL_STAGES,
      payoutEnabled: false,
    });
  });

  app.post('/api/finance/transfers', requireOwner, financeLimiter, (req, res) => {
    const db = getDb();
    try {
      const result = internalTransfer(db, req.user, req.body || {});
      saveDbSoon();
      res.status(201).json({ ...result, wallet: walletState(db) });
    } catch (err) {
      financeFail(res, err);
    }
  });

  app.post('/api/finance/withdrawals', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    try {
      const withdrawal = createWithdrawal(db, req.user, req.body || {});
      saveDbSoon();
      res.status(201).json({ withdrawal, payoutEnabled: false, wallet: walletState(db) });
    } catch (err) {
      financeFail(res, err);
    }
  });

  app.post('/api/finance/withdrawals/:id/:action', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const action = String(req.params.action);
    if (!['review', 'approve', 'cancel'].includes(action)) {
      return res.status(400).json({ error: 'action_invalid' });
    }
    if (action === 'approve') {
      const second = verifySecondFactor(req, db);
      if (!second.ok) return res.status(second.status).json({ error: second.error });
    }
    try {
      const withdrawal = advanceWithdrawal(db, req.user, req.params.id, action, req.body || {});
      saveDbSoon();
      res.json({ withdrawal, payoutEnabled: false, wallet: walletState(db) });
    } catch (err) {
      financeFail(res, err);
    }
  });

  app.get('/api/finance/reports', requireOwner, financeLimiter, (req, res) => {
    const db = getDb();
    const finance = ensureFinance(db);
    res.json({
      grants: finance.grants.slice().reverse().map((grant) => grantView(grant, db)),
      sent: finance.sentReports.slice().reverse().slice(0, 50),
      fields: GRANT_FIELDS,
      permissions: GRANT_PERMISSIONS,
      reportType: 'internal_management_report',
    });
  });

  app.post('/api/finance/reports', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    try {
      const { grant } = createGrant(db, req.user, req.body || {});
      saveDbSoon();
      res.status(201).json({ grant: grantView(grant, db) });
    } catch (err) {
      financeFail(res, err);
    }
  });

  app.get('/api/finance/reports/:id', requireOwner, financeLimiter, (req, res) => {
    const db = getDb();
    const grant = ensureFinance(db).grants.find((g) => g.id === req.params.id);
    if (!grant) return res.status(404).json({ error: 'not_found' });
    res.json({
      grant: grantView(grant, db),
      report: grantReport(db, grant),
      recipient: decryptRecipient(grant),
      status: grantStatus(grant),
    });
  });

  app.post('/api/finance/reports/:id/revoke', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const grant = ensureFinance(db).grants.find((g) => g.id === req.params.id);
    if (!grant) return res.status(404).json({ error: 'not_found' });
    grant.revoked = true;
    grant.revokedAt = new Date().toISOString();
    grant.revokedBy = req.user.id;
    audit(db, { actorId: req.user.id, actorRole: req.user.role, action: 'grant_revoked', target: grant.trackingId, meta: {}, ip: req.ip });
    saveDbSoon();
    res.json({ grant: grantView(grant, db) });
  });

  // مرحلهٔ ۱ ارسال گزارش: ورود مجدد رمز + کد Authenticator
  app.post('/api/finance/reports/:id/authorize', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const finance = ensureFinance(db);
    const grant = finance.grants.find((g) => g.id === req.params.id);
    if (!grant) return res.status(404).json({ error: 'not_found' });
    const status = grantStatus(grant);
    if (status !== 'active') return res.status(409).json({ error: 'grant_not_active', status });
    const second = verifySecondFactor(req, db);
    if (!second.ok) return res.status(second.status).json({ error: second.error });
    const authorization = {
      id: id(),
      grantId: grant.id,
      by: req.user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
      usedAt: null,
    };
    finance.authorizations.push(authorization);
    audit(db, {
      actorId: req.user.id, actorRole: req.user.role, action: 'report_authorized_step1',
      target: grant.trackingId, meta: {}, ip: req.ip,
    });
    saveDbSoon();
    res.json({
      authorization: { id: authorization.id, expiresAt: authorization.expiresAt },
      confirmation: {
        recipient: decryptRecipient(grant),
        recipientRole: grant.recipientRole,
        reportType: 'internal_management_report',
        trackingId: grant.trackingId,
        permissions: grant.permissions,
        fields: grant.fields,
        amountUsd: grantReport(db, grant).amountUsd,
        expiresAt: grant.expiresAt,
      },
    });
  });

  // مرحلهٔ ۲ ارسال گزارش: تأیید نهایی و صدور لینک رهگیری
  app.post('/api/finance/reports/:id/send', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const finance = ensureFinance(db);
    const grant = finance.grants.find((g) => g.id === req.params.id);
    if (!grant) return res.status(404).json({ error: 'not_found' });
    const status = grantStatus(grant);
    if (status !== 'active') return res.status(409).json({ error: 'grant_not_active', status });
    if (req.body?.confirm !== true) return res.status(400).json({ error: 'final_confirmation_required' });
    const authorization = finance.authorizations.find(
      (a) => a.id === String(req.body?.authorizationId || '') && a.grantId === grant.id,
    );
    if (!authorization) return res.status(403).json({ error: 'authorization_required' });
    if (authorization.usedAt) return res.status(409).json({ error: 'authorization_used' });
    if (Date.parse(authorization.expiresAt) < Date.now()) return res.status(403).json({ error: 'authorization_expired' });

    const token = randomToken(24);
    grant.tokenHash = sha256(token);
    grant.sentAt = new Date().toISOString();
    authorization.usedAt = grant.sentAt;
    const recipient = decryptRecipient(grant);
    finance.sentReports.push({
      id: id(),
      trackingId: grant.trackingId,
      grantId: grant.id,
      sentAt: grant.sentAt,
      sentBy: req.user.id,
      recipientEncrypted: grant.recipientEncrypted,
      permissions: grant.permissions,
      fields: grant.fields,
      amountUsd: grantReport(db, grant).amountUsd,
      expiresAt: grant.expiresAt,
    });
    audit(db, {
      actorId: req.user.id, actorRole: req.user.role, action: 'report_sent',
      target: grant.trackingId, meta: { grantId: grant.id, recipient: recipient.name }, ip: req.ip,
    });
    saveDbSoon();
    res.status(201).json({
      trackingId: grant.trackingId,
      token,
      link: `/report/${token}`,
      sentAt: grant.sentAt,
      expiresAt: grant.expiresAt,
      permissions: grant.permissions,
    });
  });

  app.get('/api/finance/audit', requireOwner, financeLimiter, (req, res) => {
    const finance = ensureFinance(getDb());
    res.json({ events: finance.audit.slice(-200).reverse() });
  });

  app.get('/api/finance/export', requireOwner, financeLimiter, (req, res) => {
    const db = getDb();
    const format = String(req.query.format || 'csv');
    const q = {
      from: isDay(req.query.from),
      to: isDay(req.query.to),
      kind: req.query.kind || null,
      source: req.query.source || null,
      country: req.query.country || null,
      currency: req.query.currency || null,
      includeDemo: req.query.includeDemo === '1',
    };
    const rows = ensureFinance(db).entries.filter((entry) => matchesFilter(entry, q));
    audit(db, {
      actorId: req.user.id, actorRole: req.user.role, action: 'finance_exported',
      target: format, meta: { count: rows.length }, ip: req.ip,
    });
    saveDbSoon();
    if (format === 'csv') {
      res.setHeader('content-type', 'text/csv; charset=utf-8');
      res.setHeader('content-disposition', `attachment; filename="finance-ledger-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(entriesToCsv(rows));
    }
    return res.json({ summary: summarize(rows), series: groupSeries(rows, 'month'), entries: rows.length });
  });

  /* --------------------------- امنیت و تیم مدیریتی --------------------------- */

  app.get('/api/finance/security', requireOwner, financeLimiter, (req, res) => {
    const db = getDb();
    const finance = ensureFinance(db);
    res.json({
      twoFactor: {
        enabled: Boolean(req.user.totp?.enabled),
        enabledAt: req.user.totp?.enabledAt || null,
        requiredForReports: true,
      },
      encryption: { algorithm: 'aes-256-gcm', keySource: process.env.SESSION_SECRET ? 'env' : 'file' },
      failedTotp: Number(finance.security.failedTotp) || 0,
      lastFailedAt: finance.security.lastFailedAt || null,
      deniedAttempts: Number(finance.security.denied) || 0,
      chain: verifyChain(db),
      backup: {
        mode: 'aes-256-gcm',
        keySource: backupKeySource(),
        automated: Boolean(db.settings?.backup?.enabled),
        lastBackupAt: (Array.isArray(db.backupHistory) ? db.backupHistory.slice(-1)[0]?.createdAt : null) || null,
        count: Array.isArray(db.backupHistory) ? db.backupHistory.length : 0,
        requiresPersistentDisk: true,
      },
      paymentsEnabled: false,
      payoutEnabled: false,
    });
  });

  app.post('/api/finance/security/2fa/setup', requireOwner, reportLimiter, (req, res) => {
    const secret = newTotpSecret();
    req.user.totpPending = encryptJson({ secret, createdAt: new Date().toISOString() });
    saveDbSoon();
    res.json({
      secret,
      otpauth: otpauthUrl(secret, req.user.email || 'owner@bazaar', 'Smart Bazaar'),
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
    });
  });

  app.post('/api/finance/security/2fa/enable', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const pending = decryptJson(req.user.totpPending);
    if (!pending?.secret) return res.status(400).json({ error: 'setup_required' });
    if (!verifyTotp(pending.secret, req.body?.code)) {
      registerFailedTotp(db);
      saveDbSoon();
      return res.status(403).json({ error: 'totp_invalid' });
    }
    req.user.totp = { enabled: true, secret: encryptJson({ secret: pending.secret }), enabledAt: new Date().toISOString() };
    req.user.totpPending = null;
    resetFailedTotp(db);
    audit(db, { actorId: req.user.id, actorRole: req.user.role, action: 'totp_enabled', target: req.user.id, meta: {}, ip: req.ip });
    saveDbSoon();
    res.json({ twoFactor: { enabled: true, enabledAt: req.user.totp.enabledAt } });
  });

  app.post('/api/finance/security/2fa/disable', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const second = verifySecondFactor(req, db);
    if (!second.ok) return res.status(second.status).json({ error: second.error });
    req.user.totp = null;
    req.user.totpPending = null;
    audit(db, { actorId: req.user.id, actorRole: req.user.role, action: 'totp_disabled', target: req.user.id, meta: {}, ip: req.ip });
    saveDbSoon();
    res.json({ twoFactor: { enabled: false } });
  });

  app.post('/api/finance/security/logout-all', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const revoked = revokeAllSessions(db, req.user.id);
    req.user.sessionFrom = new Date().toISOString();
    setSessionCookie(res, req.user, req);
    audit(db, { actorId: req.user.id, actorRole: req.user.role, action: 'sessions_revoked', target: req.user.id, meta: { revoked }, ip: req.ip });
    saveDbSoon();
    res.json({ ok: true, sessionsRevokedAt: req.user.sessionFrom, revoked });
  });

  /* ============ فاز چهارم: پشتیبان‌گیری رمزگذاری‌شده و بازیابی ============ */

  const backupView = (row) => ({
    id: row.id,
    createdAt: row.createdAt,
    reason: row.reason,
    size: row.size,
    fingerprint: row.fingerprint,
    chain: row.chain,
    environment: row.environment,
    verifiedAt: row.verifiedAt || null,
    downloadUrl: `/api/finance/backup/${row.id}/download`,
  });
  const safeFingerprint = () => {
    try {
      return backupFingerprint();
    } catch {
      return null;
    }
  };
  const safeChainFingerprint = () => {
    try {
      return chainFingerprint();
    } catch {
      return null;
    }
  };
  const backupRowFor = (db, made, saved, reason, createdBy) => ({
    id: id(),
    createdAt: made.header.createdAt,
    reason,
    size: saved.size,
    fingerprint: made.header.fingerprint,
    chain: made.header.chain,
    environment: made.header.environment,
    counts: made.header.counts,
    file: saved.name,
    verifiedAt: made.header.createdAt,
    createdBy,
  });
  const findBackup = (db, backupId) => (Array.isArray(db.backupHistory) ? db.backupHistory : [])
    .find((row) => row.id === backupId) || null;
  const backupError = (res, err) => {
    if (err instanceof BackupError) return res.status(err.status).json({ error: err.code });
    throw err;
  };

  app.get('/api/finance/backup/status', requireOwner, financeLimiter, (req, res) => {
    const db = getDb();
    const history = (Array.isArray(db.backupHistory) ? db.backupHistory : []).slice(-20).reverse();
    const cfg = db.settings?.backup || {};
    res.json({
      encryption: { algorithm: 'aes-256-gcm', kdf: 'scrypt', keySource: backupKeySource(), keyIndependentFromSession: true },
      fingerprint: safeFingerprint(),
      schedule: {
        enabled: Boolean(cfg.enabled),
        intervalHours: Math.max(1, Number(cfg.intervalHours) || 24),
        retention: Math.max(1, Number(cfg.retention) || 7),
        updatedAt: cfg.updatedAt || null,
      },
      history: history.map(backupView),
      lastBackupAt: history[0]?.createdAt || null,
      count: history.length,
      storage: 'data/backups',
      persistentDisk: false,
      uploads: { ...uploadLimits(), storage: 'public/uploads', includedInBackup: true },
      chain: {
        hmac: 'sha256',
        keySource: chainKeySource(),
        fingerprint: safeChainFingerprint(),
        signed: Number(history[0]?.chain?.signed) || 0,
        legacy: Number(history[0]?.chain?.legacy) || 0,
      },
      durability: {
        guaranteed: false,
        method: 'download',
        note: 'در پلن رایگان دیسک پایدار وجود ندارد؛ برای ماندگاری، فایل .sbbak را دانلود کنید و پس از Redeploy با «بازیابی از فایل» برگردانید.',
      },
      limitation: 'در پلن رایگان دیسک پایدار وجود ندارد؛ فایل پشتیبان تا بازاستقرار بعدی روی همین نمونه می‌ماند. برای نگهداری بلندمدت، فایل را دانلود کنید.',
    });
  });

  app.post('/api/finance/backup/create', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const includeSecrets = req.body?.includeSecrets === true;
    if (includeSecrets) {
      const second = verifySecondFactor(req, db);
      if (!second.ok) return res.status(second.status).json({ error: second.error });
    }
    let made;
    try {
      made = createBackup(db, { reason: clean(req.body?.reason, 40) || 'manual', includeSecrets });
    } catch (err) {
      return backupError(res, err);
    }
    // بررسی صحت و قابلیت بازیابی پیش از ارائهٔ فایل به مالک
    let checked;
    try {
      checked = verifyBackup(made.buffer);
    } catch (err) {
      return backupError(res, err);
    }
    const saved = saveBackupFile(made.buffer, made.filename);
    const row = backupRowFor(db, made, saved, made.header.reason, req.user.id);
    db.backupHistory = [...(Array.isArray(db.backupHistory) ? db.backupHistory : []), row].slice(-50);
    audit(db, {
      actorId: req.user.id, actorRole: req.user.role, action: 'backup_created', target: row.id,
      meta: { size: row.size, reason: row.reason }, ip: req.ip,
    });
    saveDbSoon();
    res.status(201).json({
      backup: backupView(row),
      verification: {
        ok: true,
        chain: checked.chain,
        counts: checked.counts,
        uploads: checked.uploadsMeta,
        environment: checked.environment,
      },
    });
  });

  app.get('/api/finance/backup/:id/download', requireOwner, financeLimiter, (req, res) => {
    const db = getDb();
    const row = findBackup(db, req.params.id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    try {
      const buffer = readBackupFile(row.file);
      // فایل معیوب یا دست‌کاری‌شده هرگز تحویل داده نمی‌شود
      const checked = verifyBackup(buffer);
      audit(db, {
        actorId: req.user.id, actorRole: req.user.role, action: 'backup_downloaded', target: row.id,
        meta: { size: buffer.length, chainValid: checked.chain.valid, uploads: checked.uploads }, ip: req.ip,
      });
      saveDbSoon();
      res.setHeader('content-type', 'application/octet-stream');
      res.setHeader('content-disposition', `attachment; filename="${row.file}"`);
      return res.send(buffer);
    } catch (err) {
      return backupError(res, err);
    }
  });

  app.post('/api/finance/backup/verify', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const row = findBackup(db, req.body?.id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    try {
      const result = verifyBackup(readBackupFile(row.file));
      row.verifiedAt = new Date().toISOString();
      audit(db, {
        actorId: req.user.id, actorRole: req.user.role, action: 'backup_verified', target: row.id,
        meta: { chainValid: result.chain.valid }, ip: req.ip,
      });
      saveDbSoon();
      return res.json({ ok: true, backup: backupView(row), counts: result.counts, chain: result.chain, environment: result.environment });
    } catch (err) {
      return backupError(res, err);
    }
  });

  app.post('/api/finance/backup/restore', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const row = findBackup(db, req.body?.id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    let restored;
    try {
      restored = readBackupForRestore(readBackupFile(row.file));
    } catch (err) {
      return backupError(res, err);
    }
    const current = {
      counts: Object.fromEntries(Object.entries(db).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])),
      chain: verifyChain(db),
      environment: currentMode(db),
    };
    if (req.body?.mode !== 'apply') {
      audit(db, {
        actorId: req.user.id, actorRole: req.user.role, action: 'backup_restore_preview', target: row.id,
        meta: { entries: restored.chain.entries }, ip: req.ip,
      });
      saveDbSoon();
      return res.json({
        mode: 'dry-run',
        ok: true,
        backup: backupView(row),
        current,
        restored: {
          counts: restored.counts,
          chain: restored.chain,
          createdAt: restored.header.createdAt,
          environment: restored.environment,
        },
      });
    }
    if (String(req.body?.confirm || '') !== 'RESTORE') return res.status(400).json({ error: 'confirm_required' });
    const second = verifySecondFactor(req, db);
    if (!second.ok) return res.status(second.status).json({ error: second.error });

    // عکس فوری پیش از بازیابی تا امکان بازگشت وجود داشته باشد
    let snapshot = null;
    try {
      const made = createBackup(db, { reason: 'pre-restore' });
      const saved = saveBackupFile(made.buffer, `pre-restore-${Date.now()}.sbbak`);
      snapshot = backupRowFor(db, made, saved, 'pre-restore', req.user.id);
    } catch (err) {
      return backupError(res, err);
    }
    const historyBefore = Array.isArray(db.backupHistory) ? db.backupHistory.slice() : [];
    const next = restored.data;
    replaceDb(next);
    // بازگرداندن تصاویر و کلید زنجیره تا پس از Redeploy هم همهٔ اطلاعات کامل باشد
    const uploadsRestored = restoreUploads(restored.uploads);
    const keysRestored = restored.chainKeyHex ? installKeys({ chainKeyHex: restored.chainKeyHex }) : null;
    const dbAfter = getDb();
    dbAfter.backupHistory = [...historyBefore, snapshot].slice(-50);
    audit(dbAfter, {
      actorId: req.user.id, actorRole: req.user.role, action: 'backup_restored', target: row.id,
      meta: { preRestoreBackup: snapshot.id, entries: restored.chain.entries }, ip: req.ip,
    });
    recordSecurityEvent({
      type: 'backup_restored', severity: 'critical', ip: req.ip, identity: req.user.email,
      path: '/api/finance/backup/restore', detail: `backup=${row.id}`,
    });
    saveDb();
    return res.json({
      ok: true,
      mode: 'apply',
      restored: {
        counts: restored.counts, chain: restored.chain, environment: restored.environment,
        uploads: uploadsRestored, keys: keysRestored,
      },
      preRestoreBackup: snapshot.id,
    });
  });

  app.post('/api/finance/backup/schedule', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    if (!db.settings) db.settings = {};
    const current = db.settings.backup || {};
    const enabled = req.body?.enabled === undefined ? Boolean(current.enabled) : Boolean(req.body.enabled);
    const intervalHours = Math.max(1, Math.min(168, Number(req.body?.intervalHours ?? current.intervalHours ?? 24) || 24));
    const retention = Math.max(1, Math.min(30, Number(req.body?.retention ?? current.retention ?? 7) || 7));
    db.settings.backup = { enabled, intervalHours, retention, updatedAt: new Date().toISOString() };
    audit(db, {
      actorId: req.user.id, actorRole: req.user.role, action: 'backup_schedule_updated', target: 'settings',
      meta: { enabled, intervalHours, retention }, ip: req.ip,
    });
    saveDbSoon();
    startBackupScheduler();
    res.json({ schedule: { enabled, intervalHours, retention, updatedAt: db.settings.backup.updatedAt } });
  });

  app.post('/api/finance/backup/run-now', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    let row;
    try {
      row = runScheduledBackup(db, { force: true });
    } catch (err) {
      return backupError(res, err);
    }
    res.status(201).json({ backup: backupView(row) });
  });

  /* ---------- بازیابی از فایل دانلودشده (پس از Redeploy) ---------- */

  const importBody = (req) => {
    const raw = typeof req.body === 'string'
      ? req.body
      : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const text = raw.trim();
    if (!text) throw new BackupError('backup_corrupt', 400);
    if (text.length > 100 * 1024 * 1024) throw new BackupError('backup_too_large', 413);
    // فایل .sbbak متن ASCII با سرآغاز SBBAK1 است؛ ورودی base64 هم پذیرفته می‌شود
    const isEnvelope = text.startsWith('SBBAK') || text.includes('{');
    return Buffer.from(text, isEnvelope ? 'utf8' : 'base64');
  };

  app.post(
    '/api/finance/backup/import',
    requireOwner,
    express.text({ type: ['text/plain', 'application/octet-stream'], limit: '100mb' }),
    reportLimiter,
    (req, res) => {
      const db = getDb();
      let parsed;
      try {
        parsed = readBackupForRestore(importBody(req));
      } catch (err) {
        return backupError(res, err);
      }
      if (String(req.query.mode || 'preview') !== 'apply') {
        audit(db, {
          actorId: req.user.id, actorRole: req.user.role, action: 'backup_import_preview', target: 'file',
          meta: { entries: parsed.chain.entries }, ip: req.ip,
        });
        saveDbSoon();
        return res.json({
          ok: true,
          mode: 'preview',
          restored: {
            counts: parsed.counts, chain: parsed.chain, environment: parsed.environment,
            createdAt: parsed.header?.createdAt || null, uploads: parsed.uploadsMeta,
          },
        });
      }
      if (String(req.query.confirm || '') !== 'RESTORE') return res.status(400).json({ error: 'confirm_required' });
      const second = verifySecondFactor({
        body: { password: req.get('x-finance-password') || '', code: req.get('x-2fa-code') || '' },
        user: req.user, path: req.path, ip: req.ip,
      }, db);
      if (!second.ok) return res.status(second.status).json({ error: second.error });
      let snapshot = null;
      try {
        const made = createBackup(db, { reason: 'pre-restore' });
        const saved = saveBackupFile(made.buffer, `pre-restore-${Date.now()}.sbbak`);
        snapshot = backupRowFor(db, made, saved, 'pre-restore', req.user.id);
      } catch (err) {
        return backupError(res, err);
      }
      const historyBefore = Array.isArray(db.backupHistory) ? db.backupHistory.slice() : [];
      replaceDb(parsed.data);
      const uploadsRestored = restoreUploads(parsed.uploads);
      const keysRestored = parsed.chainKeyHex ? installKeys({ chainKeyHex: parsed.chainKeyHex }) : null;
      const dbAfter = getDb();
      dbAfter.backupHistory = [...historyBefore, snapshot].slice(-50);
      audit(dbAfter, {
        actorId: req.user.id, actorRole: req.user.role, action: 'backup_imported', target: 'file',
        meta: { preRestoreBackup: snapshot.id, entries: parsed.chain.entries, uploads: uploadsRestored.written },
        ip: req.ip,
      });
      recordSecurityEvent({
        type: 'backup_imported', severity: 'critical', ip: req.ip, identity: req.user.email,
        path: '/api/finance/backup/import', detail: 'upload',
      });
      saveDb();
      res.json({
        ok: true,
        mode: 'apply',
        restored: {
          counts: parsed.counts, chain: parsed.chain, environment: parsed.environment,
          uploads: uploadsRestored, keys: keysRestored,
        },
        preRestoreBackup: snapshot.id,
      });
    },
  );

  /* ---------- کیت بازیابی کلیدها (پس از Redeploy) ---------- */

  app.post('/api/finance/backup/recovery-kit', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const second = verifySecondFactor(req, db);
    if (!second.ok) return res.status(second.status).json({ error: second.error });
    let kit;
    try {
      kit = createRecoveryKit(String(req.body?.passphrase || ''));
    } catch (err) {
      return backupError(res, err);
    }
    audit(db, {
      actorId: req.user.id, actorRole: req.user.role, action: 'recovery_kit_created', target: 'keys',
      meta: { size: kit.size }, ip: req.ip,
    });
    recordSecurityEvent({
      type: 'recovery_kit_created', severity: 'critical', ip: req.ip, identity: req.user.email,
      path: '/api/finance/backup/recovery-kit', detail: 'keys',
    });
    saveDbSoon();
    res.setHeader('content-type', 'application/octet-stream');
    res.setHeader('content-disposition', `attachment; filename="${kit.filename}"`);
    res.send(kit.buffer);
  });

  app.post(
    '/api/finance/backup/recovery-kit/install',
    requireOwner,
    express.text({ type: ['text/plain', 'application/octet-stream'], limit: '256kb' }),
    reportLimiter,
    (req, res) => {
      const db = getDb();
      const second = verifySecondFactor({
        body: { password: req.get('x-finance-password') || '', code: req.get('x-2fa-code') || '' },
        user: req.user, path: req.path, ip: req.ip,
      }, db);
      if (!second.ok) return res.status(second.status).json({ error: second.error });
      let kit;
      try {
        kit = readRecoveryKit(
          typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body : '',
          req.get('x-kit-passphrase') || '',
        );
      } catch (err) {
        return backupError(res, err);
      }
      const installed = installKeys({ backupKeyHex: kit.backupKeyHex, chainKeyHex: kit.chainKeyHex });
      audit(db, {
        actorId: req.user.id, actorRole: req.user.role, action: 'recovery_kit_installed', target: 'keys',
        meta: { fingerprint: installed.fingerprint }, ip: req.ip,
      });
      recordSecurityEvent({
        type: 'recovery_kit_installed', severity: 'critical', ip: req.ip, identity: req.user.email,
        path: '/api/finance/backup/recovery-kit/install', detail: 'keys',
      });
      saveDbSoon();
      res.json({ ok: true, keys: installed });
    },
  );

  /* ================= فاز چهارم: نشست‌ها و کدهای بازیابی ================= */

  app.get('/api/finance/sessions', requireOwner, financeLimiter, (req, res) => {
    const db = getDb();
    const sid = currentSessionId(req);
    res.json({
      current: sid,
      sessions: listSessions(db, req.user.id).slice(0, 20).map((row) => sessionView(row, sid)),
    });
  });

  app.delete('/api/finance/sessions/:id', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const row = revokeSession(db, req.user.id, req.params.id, 'owner');
    if (!row) return res.status(404).json({ error: 'not_found' });
    audit(db, {
      actorId: req.user.id, actorRole: req.user.role, action: 'session_revoked', target: row.id,
      meta: { ip: row.ip }, ip: req.ip,
    });
    saveDbSoon();
    res.json({ ok: true, session: sessionView(row, currentSessionId(req)) });
  });

  app.post('/api/finance/sessions/revoke-others', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const sid = currentSessionId(req);
    const revoked = revokeOtherSessions(db, req.user.id, sid);
    audit(db, {
      actorId: req.user.id, actorRole: req.user.role, action: 'sessions_revoked', target: req.user.id,
      meta: { revoked, scope: 'others' }, ip: req.ip,
    });
    saveDbSoon();
    res.json({ ok: true, revoked });
  });

  app.get('/api/auth/sessions', requireAuth, (req, res) => {
    const db = getDb();
    const sid = currentSessionId(req);
    res.json({ sessions: listSessions(db, req.user.id).slice(0, 20).map((row) => sessionView(row, sid)) });
  });

  app.delete('/api/auth/sessions/:id', requireAuth, (req, res) => {
    const db = getDb();
    const row = revokeSession(db, req.user.id, req.params.id, 'user');
    if (!row) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, session: sessionView(row, currentSessionId(req)) });
  });

  app.post('/api/auth/sessions/revoke-others', requireAuth, (req, res) => {
    const db = getDb();
    const revoked = revokeOtherSessions(db, req.user.id, currentSessionId(req));
    res.json({ ok: true, revoked });
  });

  app.get('/api/finance/recovery/status', requireOwner, financeLimiter, (req, res) => {
    res.json({ recovery: recoveryCodeCount(req.user) });
  });

  app.post('/api/finance/recovery/generate', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const second = verifySecondFactor(req, db);
    if (!second.ok) return res.status(second.status).json({ error: second.error });
    const codes = generateRecoveryCodes(db, req.user);
    audit(db, {
      actorId: req.user.id, actorRole: req.user.role, action: 'recovery_codes_generated', target: req.user.id,
      meta: { count: codes.length }, ip: req.ip,
    });
    recordSecurityEvent({
      type: 'recovery_codes_generated', severity: 'warning', ip: req.ip, identity: req.user.email,
      path: req.path, detail: `count=${codes.length}`,
    });
    saveDbSoon();
    res.status(201).json({ codes, recovery: recoveryCodeCount(req.user), shownOnce: true });
  });

  app.post('/api/auth/recovery/login', authLimiter, (req, res) => {
    const db = getDb();
    const email = clean(req.body?.email, 120).toLowerCase();
    const code = String(req.body?.code || '');
    const attempt = loginStatus(req, email);
    if (attempt.blocked) {
      recordSecurityEvent({
        type: 'login_blocked', severity: 'warning', ip: req.ip, identity: email,
        path: '/api/auth/recovery/login', detail: 'recovery',
      });
      return res.status(429).json({ error: 'too_many_attempts' });
    }
    const user = db.users.find((item) => item.email === email);
    if (!user || !verifyRecoveryCode(db, user, code)) {
      registerLoginFailure(req, email);
      recordSecurityEvent({
        type: 'recovery_failed', severity: 'warning', ip: req.ip, identity: email,
        path: '/api/auth/recovery/login', detail: 'invalid_code',
      });
      return res.status(401).json({ error: 'invalid_recovery_code' });
    }
    if (user.status === 'blocked') return res.status(403).json({ error: 'account_blocked' });
    clearLoginFailures(req, email);
    user.lastLoginAt = new Date().toISOString();
    setSessionCookie(res, user, req);
    recordSecurityEvent({
      type: 'recovery_login', severity: 'critical', ip: req.ip, identity: email,
      path: '/api/auth/recovery/login', detail: `remaining=${recoveryCodeCount(user).remaining}`,
    });
    saveDbSoon();
    res.json({ user: publicUser(user), recovery: recoveryCodeCount(user) });
  });

  /* ==================== فاز چهارم: WebAuthn / Passkey ==================== */

  const requestOrigin = (req) => {
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim() || 'http';
    return `${proto}://${req.get('host') || 'localhost'}`;
  };
  const requestRpId = (req) => String(req.get('host') || 'localhost').split(':')[0];
  const webauthnError = (res, err) => {
    if (err instanceof WebAuthnError) return res.status(err.status).json({ error: err.code });
    throw err;
  };

  app.get('/api/finance/webauthn/credentials', requireOwner, financeLimiter, (req, res) => {
    const list = Array.isArray(req.user.passkeys) ? req.user.passkeys : [];
    res.json({ credentials: list.map(credentialView) });
  });

  app.post('/api/finance/webauthn/register/options', requireOwner, reportLimiter, (req, res) => {
    const challenge = issueChallenge('register');
    const existing = (Array.isArray(req.user.passkeys) ? req.user.passkeys : [])
      .map((cred) => ({ type: 'public-key', id: cred.id }));
    res.json({
      challenge,
      rp: { id: requestRpId(req), name: 'Smart Bazaar' },
      user: {
        id: Buffer.from(req.user.id).toString('base64url'),
        name: req.user.email || req.user.phone || req.user.id,
        displayName: req.user.name || req.user.email || 'Owner',
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      timeout: 60000,
      attestation: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      excludeCredentials: existing,
      origin: requestOrigin(req),
    });
  });

  app.post('/api/finance/webauthn/register/verify', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const credential = req.body?.credential || req.body || {};
    const response = credential.response || {};
    if (!consumeChallenge(req.body?.challenge, 'register')) return res.status(400).json({ error: 'challenge_invalid' });
    let result;
    try {
      result = verifyRegistration({
        clientDataJSON: response.clientDataJSON,
        attestationObject: response.attestationObject,
        expectedChallenge: req.body?.challenge,
        expectedOrigin: requestOrigin(req),
        rpId: requestRpId(req),
      });
    } catch (err) {
      return webauthnError(res, err);
    }
    if (!Array.isArray(req.user.passkeys)) req.user.passkeys = [];
    if (req.user.passkeys.some((item) => item.id === result.credentialId)) {
      return res.status(409).json({ error: 'credential_exists' });
    }
    const record = {
      id: result.credentialId,
      publicKeyJwk: result.publicKeyJwk,
      signCount: result.signCount,
      label: clean(req.body?.label, 40) || 'Passkey',
      transports: Array.isArray(credential.transports) ? credential.transports.slice(0, 5) : [],
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    };
    req.user.passkeys.push(record);
    audit(db, {
      actorId: req.user.id, actorRole: req.user.role, action: 'passkey_registered', target: record.id,
      meta: { label: record.label }, ip: req.ip,
    });
    recordSecurityEvent({
      type: 'passkey_registered', severity: 'warning', ip: req.ip, identity: req.user.email,
      path: req.path, detail: record.label,
    });
    saveDbSoon();
    res.status(201).json({ credential: credentialView(record), credentials: req.user.passkeys.map(credentialView) });
  });

  app.delete('/api/finance/webauthn/credentials/:id', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const list = Array.isArray(req.user.passkeys) ? req.user.passkeys : [];
    const index = list.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'not_found' });
    const [removed] = list.splice(index, 1);
    audit(db, {
      actorId: req.user.id, actorRole: req.user.role, action: 'passkey_removed', target: removed.id,
      meta: { label: removed.label }, ip: req.ip,
    });
    saveDbSoon();
    res.json({ ok: true, credentials: list.map(credentialView) });
  });

  app.post('/api/auth/webauthn/login/options', authLimiter, (req, res) => {
    const db = getDb();
    const email = clean(req.body?.email, 120).toLowerCase();
    const user = db.users.find((item) => item.email === email);
    const list = user && Array.isArray(user.passkeys) ? user.passkeys : [];
    if (!user || list.length === 0) return res.status(404).json({ error: 'passkey_not_available' });
    const challenge = issueChallenge('login');
    res.json({
      challenge,
      rpId: requestRpId(req),
      timeout: 60000,
      userVerification: 'preferred',
      allowCredentials: list.map((cred) => ({ type: 'public-key', id: cred.id })),
      origin: requestOrigin(req),
    });
  });

  app.post('/api/auth/webauthn/login/verify', authLimiter, (req, res) => {
    const db = getDb();
    const email = clean(req.body?.email, 120).toLowerCase();
    const user = db.users.find((item) => item.email === email);
    if (!user) return res.status(401).json({ error: 'passkey_invalid' });
    const credential = req.body?.credential || {};
    const response = credential.response || {};
    const stored = (Array.isArray(user.passkeys) ? user.passkeys : [])
      .find((item) => item.id === String(credential.id || credential.rawId || ''));
    if (!stored) return res.status(401).json({ error: 'passkey_invalid' });
    if (!consumeChallenge(req.body?.challenge, 'login')) return res.status(400).json({ error: 'challenge_invalid' });
    let result;
    try {
      result = verifyAssertion({
        clientDataJSON: response.clientDataJSON,
        authenticatorData: response.authenticatorData,
        signature: response.signature,
        expectedChallenge: req.body?.challenge,
        expectedOrigin: requestOrigin(req),
        rpId: requestRpId(req),
        publicKeyJwk: stored.publicKeyJwk,
        storedSignCount: stored.signCount,
      });
    } catch (err) {
      recordSecurityEvent({
        type: 'passkey_failed', severity: 'warning', ip: req.ip, identity: email,
        path: req.path, detail: err.code || 'invalid',
      });
      return webauthnError(res, err);
    }
    stored.signCount = Math.max(Number(stored.signCount) || 0, result.signCount);
    stored.lastUsedAt = new Date().toISOString();
    user.lastLoginAt = stored.lastUsedAt;
    setSessionCookie(res, user, req);
    recordSecurityEvent({
      type: 'passkey_login', severity: 'info', ip: req.ip, identity: email,
      path: req.path, detail: stored.label || 'passkey',
    });
    saveDbSoon();
    res.json({ user: publicUser(user) });
  });

  /* ================= فاز چهارم: محیط دمو/واقعی و نظارت ================= */

  app.get('/api/env', (req, res) => {
    res.json(envSummary(getDb()));
  });

  app.post('/api/finance/environment', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const mode = String(req.body?.mode || '');
    if (String(req.body?.confirm || '') !== 'SWITCH') return res.status(400).json({ error: 'confirm_required' });
    const second = verifySecondFactor(req, db);
    if (!second.ok) return res.status(second.status).json({ error: second.error });
    try {
      setMode(db, mode);
    } catch (err) {
      if (err instanceof EnvError) return res.status(err.status).json({ error: err.code });
      throw err;
    }
    audit(db, {
      actorId: req.user.id, actorRole: req.user.role, action: 'environment_changed', target: mode,
      meta: { previous: currentMode(db) }, ip: req.ip,
    });
    recordSecurityEvent({
      type: 'environment_changed', severity: 'critical', ip: req.ip, identity: req.user.email,
      path: req.path, detail: mode,
    });
    saveDb();
    res.json({ env: envSummary(db) });
  });

  app.get('/api/finance/monitor/overview', requireOwner, financeLimiter, (req, res) => {
    const db = getDb();
    res.json(monitorOverview(db, {
      from: req.query.from, to: req.query.to, type: req.query.type,
      severity: req.query.severity, q: req.query.q,
    }));
  });

  app.get('/api/finance/monitor/alerts', requireOwner, financeLimiter, (req, res) => {
    const db = getDb();
    res.json({ config: alertConfig(db), alerts: recentAlerts(db, 20) });
  });

  app.post('/api/finance/monitor/alerts', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    let config;
    try {
      config = setAlertConfig(db, {
        enabled: req.body?.enabled,
        webhookUrl: req.body?.webhookUrl,
        minSeverity: req.body?.minSeverity,
      });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.code || 'invalid_alert_config' });
    }
    audit(db, {
      actorId: req.user.id, actorRole: req.user.role, action: 'alert_config_updated', target: 'settings',
      meta: { enabled: config.enabled, minSeverity: config.minSeverity, hasWebhook: Boolean(config.webhookUrl) }, ip: req.ip,
    });
    saveDbSoon();
    res.json({ config });
  });

  app.post('/api/finance/monitor/test-alert', requireOwner, reportLimiter, async (req, res) => {
    const db = getDb();
    const alert = await dispatchAlert(db, {
      type: 'test',
      severity: 'warning',
      title: 'آزمون کانال هشدار بازار هوشمند',
      detail: 'این پیام آزمایشی است و هیچ اقدام مالی انجام نمی‌دهد.',
    });
    res.status(alert.delivered ? 200 : 409).json({ alert, config: alertConfig(db) });
  });

  app.get('/api/finance/team', requireOwner, financeLimiter, (req, res) => {
    const db = getDb();
    res.json({
      owner: { ...publicUser(req.user), owner: true, twoFactor: Boolean(req.user.totp?.enabled) },
      team: db.users
        .filter((user) => user.role === 'admin' && user.id !== req.user.id)
        .map((user) => ({
          ...publicUser(user), owner: user.owner === true, twoFactor: Boolean(user.totp?.enabled),
        })),
    });
  });

  app.post('/api/finance/team', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const name = clean(req.body?.name, 80);
    const email = clean(req.body?.email, 120).toLowerCase();
    const password = String(req.body?.password || '');
    if (name.length < 3) return res.status(400).json({ error: 'name_required' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'email_invalid' });
    if (password.length < 8) return res.status(400).json({ error: 'password_too_short' });
    if (db.users.some((user) => user.email === email)) return res.status(409).json({ error: 'email_taken' });
    const user = {
      id: id(),
      name,
      email,
      passwordHash: hashPassword(password),
      role: 'admin',
      owner: false,
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
    };
    db.users.push(user);
    audit(db, {
      actorId: req.user.id, actorRole: req.user.role, action: 'sub_admin_created',
      target: user.id, meta: { email }, ip: req.ip,
    });
    saveDbSoon();
    res.status(201).json({ user: { ...publicUser(user), owner: false } });
  });

  app.patch('/api/finance/team/:id', requireOwner, reportLimiter, (req, res) => {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'not_found' });
    if (user.owner === true) return res.status(409).json({ error: 'owner_protected' });
    if (req.body?.status) user.status = req.body.status === 'active' ? 'active' : 'blocked';
    user.updatedAt = new Date().toISOString();
    audit(db, {
      actorId: req.user.id, actorRole: req.user.role, action: 'sub_admin_updated',
      target: user.id, meta: { status: user.status }, ip: req.ip,
    });
    saveDbSoon();
    res.json({ user: { ...publicUser(user), owner: user.owner === true } });
  });

  /* ------------------- گزارش اشتراکی (توکن‌محور، بدون مالک) ------------------- */

  app.get('/api/finance/grants/:token', reportLimiter, (req, res) => {
    const db = getDb();
    const grant = findGrantByToken(db, req.params.token);
    if (!grant) return res.status(404).json({ error: 'not_found' });
    const status = grantStatus(grant);
    if (status !== 'active') return res.status(403).json({ error: `grant_${status}` });
    if (!grant.permissions.view) return res.status(403).json({ error: 'view_not_permitted' });
    grant.views = (Number(grant.views) || 0) + 1;
    audit(db, {
      actorId: null, actorRole: 'recipient', action: 'grant_viewed',
      target: grant.trackingId, meta: { views: grant.views }, ip: req.ip,
    });
    saveDbSoon();
    res.json({ grant: grantView(grant, db), report: grantReport(db, grant) });
  });

  app.get('/api/finance/grants/:token/export', reportLimiter, (req, res) => {
    const db = getDb();
    const grant = findGrantByToken(db, req.params.token);
    if (!grant) return res.status(404).json({ error: 'not_found' });
    const status = grantStatus(grant);
    if (status !== 'active') return res.status(403).json({ error: `grant_${status}` });
    const format = String(req.query.format || 'csv');
    const allowed = format === 'csv'
      ? (grant.permissions.excel || grant.permissions.copy)
      : grant.permissions.pdf;
    if (!allowed) return res.status(403).json({ error: 'download_not_permitted' });
    const report = grantReport(db, grant);
    grant.downloads = (Number(grant.downloads) || 0) + 1;
    audit(db, {
      actorId: null, actorRole: 'recipient', action: `grant_downloaded_${format}`,
      target: grant.trackingId, meta: { format, downloads: grant.downloads }, ip: req.ip,
    });
    saveDbSoon();
    if (format === 'csv') {
      const rows = [
        ['tracking_id', report.trackingId],
        ['report_type', report.type],
        ['base_income_usd', report.baseIncomeUsd],
        ['share_percent', report.basis.percent ?? ''],
        ['amount_usd', report.amountUsd],
        ['expires_at', report.expiresAt],
        ['disclaimer', report.disclaimer.en],
      ];
      const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')}\r\n`;
      res.setHeader('content-type', 'text/csv; charset=utf-8');
      res.setHeader('content-disposition', `attachment; filename="report-${report.trackingId}.csv"`);
      return res.send(csv);
    }
    res.setHeader('content-disposition', `attachment; filename="report-${report.trackingId}.json"`);
    return res.json(report);
  });

  app.post('/api/finance/grants/:token/events', reportLimiter, (req, res) => {
    const db = getDb();
    const grant = findGrantByToken(db, req.params.token);
    if (!grant) return res.status(404).json({ error: 'not_found' });
    const status = grantStatus(grant);
    if (status !== 'active') return res.status(403).json({ error: `grant_${status}` });
    const event = String(req.body?.event || '');
    if (!['copy', 'print'].includes(event)) return res.status(400).json({ error: 'event_invalid' });
    if (!grant.permissions[event]) return res.status(403).json({ error: `${event}_not_permitted` });
    if (event === 'copy') grant.copies = (Number(grant.copies) || 0) + 1;
    else grant.prints = (Number(grant.prints) || 0) + 1;
    audit(db, {
      actorId: null, actorRole: 'recipient', action: `grant_${event}`,
      target: grant.trackingId, meta: { [event]: grant[`${event}s`] }, ip: req.ip,
    });
    saveDbSoon();
    res.json({ ok: true, copies: grant.copies, prints: grant.prints });
  });

  /* ----------------------- فاز سوم: احراز هویت تلفنی ----------------------- */

  // سقف پیش‌فرض امن؛ در محیط تست از OTP_RATE_MAX بالا برده می‌شود
  const otpLimiter = createLimiter({ windowMs: 60000, max: Number(process.env.OTP_RATE_MAX) || 15 });
  const directoryLimiter = createLimiter({ windowMs: 60000, max: 150 });
  const directoryRoles = ['admin', 'agent'];
  const canSeeContacts = (user) => Boolean(user) && (user.role === 'admin' || user.contactAccess === true);
  const requireDirectory = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'auth_required' });
    if (!directoryRoles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    return next();
  };
  const requireAdminOnly = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'auth_required' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    return next();
  };
  const actorOf = (req) => ({ id: req.user?.id || null, role: req.user?.role || 'public', name: req.user?.name || '' });
  const uniqueStoreSlug = (db, base) => {
    const root = String(base || 'store').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'store';
    let slug = root;
    let n = 1;
    while (db.users.some((u) => u.storeSlug === slug)) slug = `${root}-${n++}`;
    return slug;
  };

  app.post('/api/auth/phone/request', otpLimiter, (req, res) => {
    const db = getDb();
    const mode = req.body?.mode === 'register' ? 'register' : 'login';
    const phone = normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).json({ error: 'phone_invalid' });
    const existing = db.users.find((u) => phoneKey(u.phone) === phoneKey(phone));
    if (mode === 'login' && !existing) return res.status(404).json({ error: 'account_not_found' });
    if (mode === 'register' && existing) return res.status(409).json({ error: 'phone_already_registered' });

    const payload = {};
    if (mode === 'register') {
      const role = req.body?.role === 'seller' ? 'seller' : 'customer';
      const name = clean(req.body?.name, 80);
      const storeName = clean(req.body?.storeName, 80);
      if (name.length < 3) return res.status(400).json({ error: 'name_required' });
      if (role === 'seller' && storeName.length < 2) return res.status(400).json({ error: 'store_name_required' });
      Object.assign(payload, {
        role,
        name,
        storeName,
        industry: isIndustry(req.body?.industry) ? req.body.industry : 'other',
        city: clean(req.body?.city, 60),
      });
    }

    const result = requestOtp(db, { phone, purpose: mode, payload, ip: req.ip });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    logAudit(db, { actor: actorOf(req), action: `otp_${mode}_request`, target: maskPhone(phone), ip: req.ip });
    saveDbSoon();
    res.json({
      ok: true,
      phone: result.phone,
      delivery: result.delivery,
      expiresAt: result.expiresAt,
      previewCode: result.previewCode,
      note: result.note,
    });
  });

  app.post('/api/auth/phone/verify', otpLimiter, (req, res) => {
    const db = getDb();
    const mode = req.body?.mode === 'register' ? 'register' : 'login';
    const phone = normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).json({ error: 'phone_invalid' });

    const result = verifyOtp(db, { phone, code: req.body?.code, purpose: mode });
    if (!result.ok) {
      logAudit(db, { actor: actorOf(req), action: 'otp_verify_failed', target: maskPhone(phone), meta: { error: result.error }, ip: req.ip });
      saveDbSoon();
      return res.status(result.status).json({ error: result.error, attemptsLeft: result.attemptsLeft });
    }

    let user = db.users.find((u) => phoneKey(u.phone) === phoneKey(phone));
    if (mode === 'register') {
      if (user) return res.status(409).json({ error: 'phone_already_registered' });
      const payload = result.challenge.payload || {};
      const isSeller = payload.role === 'seller';
      user = {
        id: id(),
        name: payload.name || 'کاربر',
        email: null,
        passwordHash: null,
        role: isSeller ? 'seller' : 'customer',
        storeName: isSeller ? payload.storeName : null,
        storeSlug: isSeller ? uniqueStoreSlug(db, payload.storeName || payload.name) : null,
        phone,
        phoneVerified: true,
        phoneVerifiedAt: new Date().toISOString(),
        status: 'active',
        city: payload.city || '',
        profile: isSeller
          ? {
            industry: payload.industry || 'other', country: 'IR', province: '', city: payload.city || '',
            address: '', whatsapp: null, telegram: null, instagram: null, website: null,
          }
          : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.users.push(user);
      logAudit(db, { actor: { id: user.id, role: user.role, name: user.name }, action: 'phone_register', target: user.id, meta: { role: user.role }, ip: req.ip });
    } else {
      if (!user) return res.status(404).json({ error: 'account_not_found' });
      user.phoneVerified = true;
      user.phoneVerifiedAt = user.phoneVerifiedAt || new Date().toISOString();
      user.lastLoginAt = new Date().toISOString();
      logAudit(db, { actor: { id: user.id, role: user.role, name: user.name }, action: 'phone_login', target: user.id, ip: req.ip });
    }

    if (user.status === 'blocked') return res.status(403).json({ error: 'account_blocked' });
    setSessionCookie(res, user, req);
    saveDbSoon();
    res.json({ user: publicUser(user), phoneVerified: true });
  });

  /* -------------------- پروفایل فروشنده و پنل مشتری -------------------- */

  app.get('/api/seller/profile', requireRole('seller'), (req, res) => {
    res.json({
      profile: {
        businessName: req.user.storeName || '',
        phone: req.user.phone || '',
        ...(req.user.profile || {}),
      },
    });
  });

  app.put('/api/seller/profile', requireRole('seller'), (req, res) => {
    const body = req.body || {};
    const errors = [];
    const businessName = clean(body.businessName, 80);
    if (businessName.length < 2) errors.push('store_name_required');
    if (!isIndustry(body.industry)) errors.push('industry_invalid');
    const country = String(body.country || 'IR').toUpperCase();
    if (!isCountry(country)) errors.push('country_invalid');
    const city = clean(body.city, 60);
    if (city.length < 2) errors.push('city_required');
    const website = clean(body.website, 200);
    if (website && !/^https?:\/\/[^\s]+$/i.test(website)) errors.push('website_invalid');
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    req.user.storeName = businessName;
    req.user.profile = {
      ...(req.user.profile || {}),
      industry: body.industry,
      country,
      province: clean(body.province, 60),
      city,
      address: cleanMultiline(body.address, 300),
      whatsapp: normalizePhone(body.whatsapp) || null,
      telegram: clean(body.telegram, 120) || null,
      instagram: clean(body.instagram, 120) || null,
      website: website || null,
      updatedAt: new Date().toISOString(),
    };
    req.user.updatedAt = new Date().toISOString();
    logAudit(getDb(), { actor: actorOf(req), action: 'seller_profile_update', target: req.user.id, ip: req.ip });
    saveDbSoon();
    res.json({ profile: { businessName: req.user.storeName, phone: req.user.phone, ...req.user.profile } });
  });

  app.get('/api/account/summary', requireAuth, (req, res) => {
    const db = getDb();
    const orders = db.orders.filter((o) => o.customerId === req.user.id);
    const paid = orders.filter((o) => o.status !== 'canceled' && o.status !== 'returned');
    res.json({
      user: { ...publicUser(req.user), phoneVerified: Boolean(req.user.phoneVerified), city: req.user.city || '' },
      stats: {
        orders: orders.length,
        open: orders.filter((o) => !['delivered', 'canceled', 'returned'].includes(o.status)).length,
        spent: paid.reduce((s, o) => s + Number(o.total || 0), 0),
      },
      recentOrders: orders
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 5)
        .map(orderView),
    });
  });

  app.patch('/api/account/profile', requireAuth, (req, res) => {
    const body = req.body || {};
    const name = clean(body.name, 80);
    if (name.length < 3) return res.status(400).json({ error: 'name_required' });
    if (body.phone && phoneKey(body.phone) !== phoneKey(req.user.phone)) {
      return res.status(400).json({ error: 'phone_change_requires_verification' });
    }
    req.user.name = name;
    req.user.city = clean(body.city, 60);
    req.user.address = cleanMultiline(body.address, 300);
    req.user.updatedAt = new Date().toISOString();
    saveDbSoon();
    res.json({ user: publicUser(req.user) });
  });

  /* ------------------- بانک اصناف، متقاضیان تبلیغات و CRM ------------------- */

  app.get('/api/directory/catalog', directoryLimiter, (_req, res) => {
    res.json(catalogPayload());
  });

  app.get('/api/directory/businesses', requireDirectory, directoryLimiter, (req, res) => {
    const db = getDb();
    const rows = filterBusinesses(db, req.query || {});
    const reveal = canSeeContacts(req.user);
    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 60));
    const list = rows.slice(0, limit).map((row) => businessView(row, { canSeeContacts: reveal }));
    if (reveal && list.length) {
      logAudit(db, { actor: actorOf(req), action: 'contacts_reveal', target: 'businesses', meta: { count: list.length }, ip: req.ip });
      saveDbSoon();
    }
    res.json({ businesses: list, total: rows.length, canSeeContacts: reveal, stats: directoryStats(db) });
  });

  app.post('/api/directory/businesses', requireDirectory, directoryLimiter, (req, res) => {
    const db = getDb();
    const { errors, value } = normalizeBusinessInput(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    const duplicate = findDuplicate(db, value);
    if (duplicate) {
      return res.status(409).json({ error: 'duplicate_business', duplicateOf: { id: duplicate.id, name: duplicate.name, city: duplicate.city } });
    }
    const consentStatus = CONSENT_STATUSES.includes(req.body?.consent?.status) ? req.body.consent.status : 'pending';
    const row = {
      id: id(),
      ...value,
      verifiedStatus: 'unverified',
      lastCheckedAt: new Date().toISOString(),
      consent: {
        status: consentStatus,
        at: new Date().toISOString(),
        source: value.sourceType,
        note: clean(req.body?.consent?.note, 200),
        revokedAt: null,
      },
      consentHistory: [],
      adLicense: consentStatus === 'granted',
      assignedTo: req.user.id,
      assignedName: req.user.name,
      dataset: 'live',
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.businesses.push(row);
    logAudit(db, { actor: actorOf(req), action: 'business_create', target: row.id, meta: { name: row.name }, ip: req.ip });
    saveDbSoon();
    res.status(201).json({ business: businessView(row, { canSeeContacts: canSeeContacts(req.user) }) });
  });

  app.get('/api/directory/businesses/export.csv', requireAdminOnly, directoryLimiter, (req, res) => {
    const db = getDb();
    const rows = filterBusinesses(db, req.query || {});
    logAudit(db, { actor: actorOf(req), action: 'directory_export', target: 'businesses', meta: { count: rows.length }, ip: req.ip });
    saveDbSoon();
    res.type('text/csv; charset=utf-8').send(csvForBusinesses(db, rows));
  });

  app.get('/api/directory/businesses/:id', requireDirectory, directoryLimiter, (req, res) => {
    const db = getDb();
    const row = db.businesses.find((b) => b.id === req.params.id && !b.deletedAt);
    if (!row) return res.status(404).json({ error: 'business_not_found' });
    const reveal = canSeeContacts(req.user);
    if (reveal) {
      logAudit(db, { actor: actorOf(req), action: 'business_view_contacts', target: row.id, ip: req.ip });
      saveDbSoon();
    }
    res.json({ business: businessView(row, { canSeeContacts: reveal }) });
  });

  app.put('/api/directory/businesses/:id', requireDirectory, directoryLimiter, (req, res) => {
    const db = getDb();
    const row = db.businesses.find((b) => b.id === req.params.id && !b.deletedAt);
    if (!row) return res.status(404).json({ error: 'business_not_found' });
    const { errors, value } = normalizeBusinessInput(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    const duplicate = findDuplicate(db, value, row.id);
    if (duplicate) {
      return res.status(409).json({ error: 'duplicate_business', duplicateOf: { id: duplicate.id, name: duplicate.name, city: duplicate.city } });
    }
    Object.assign(row, value, { updatedAt: new Date().toISOString(), lastCheckedAt: new Date().toISOString() });
    if (VERIFY_STATUSES.includes(req.body?.verifiedStatus)) row.verifiedStatus = req.body.verifiedStatus;
    if (req.body?.adLicense !== undefined) row.adLicense = Boolean(req.body.adLicense) && consentView(row.consent).status === 'granted';
    logAudit(db, { actor: actorOf(req), action: 'business_update', target: row.id, ip: req.ip });
    saveDbSoon();
    res.json({ business: businessView(row, { canSeeContacts: canSeeContacts(req.user) }) });
  });

  app.post('/api/directory/businesses/:id/consent', requireDirectory, directoryLimiter, (req, res) => {
    const db = getDb();
    const row = db.businesses.find((b) => b.id === req.params.id && !b.deletedAt);
    if (!row) return res.status(404).json({ error: 'business_not_found' });
    try {
      setConsent(row, { status: String(req.body?.status || ''), source: req.body?.source, note: req.body?.note }, actorOf(req));
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.code || 'consent_invalid' });
    }
    // ثبت رضایت صریح، مجوز تبلیغ را فعال می‌کند؛ فقط ارسال صریح adLicense:false آن را می‌بندد
    if (req.body?.status === 'granted') row.adLicense = req.body?.adLicense !== false;
    logAudit(db, { actor: actorOf(req), action: `consent_${row.consent.status}`, target: row.id, ip: req.ip });
    saveDbSoon();
    res.json({ business: businessView(row, { canSeeContacts: canSeeContacts(req.user) }) });
  });

  app.post('/api/directory/businesses/:id/assign', requireDirectory, directoryLimiter, (req, res) => {
    const db = getDb();
    const row = db.businesses.find((b) => b.id === req.params.id && !b.deletedAt);
    if (!row) return res.status(404).json({ error: 'business_not_found' });
    const target = db.users.find((u) => u.id === clean(req.body?.userId, 40));
    if (!target || !directoryRoles.includes(target.role)) return res.status(400).json({ error: 'assignee_invalid' });
    row.assignedTo = target.id;
    row.assignedName = target.name;
    row.updatedAt = new Date().toISOString();
    logAudit(db, { actor: actorOf(req), action: 'business_assign', target: row.id, meta: { to: target.id }, ip: req.ip });
    saveDbSoon();
    res.json({ business: businessView(row, { canSeeContacts: canSeeContacts(req.user) }) });
  });

  app.delete('/api/directory/businesses/:id', requireAdminOnly, directoryLimiter, (req, res) => {
    const db = getDb();
    const row = db.businesses.find((b) => b.id === req.params.id && !b.deletedAt);
    if (!row) return res.status(404).json({ error: 'business_not_found' });
    row.deletedAt = new Date().toISOString();
    row.deletedBy = req.user.id;
    setConsent(row, { status: 'revoked', source: 'admin_removal', note: 'حذف توسط مدیر' }, actorOf(req));
    logAudit(db, { actor: actorOf(req), action: 'business_delete', target: row.id, ip: req.ip });
    saveDbSoon();
    res.json({ ok: true });
  });

  app.get('/api/directory/leads', requireDirectory, directoryLimiter, (req, res) => {
    const db = getDb();
    const rows = filterLeads(db, req.query || {});
    const reveal = canSeeContacts(req.user);
    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 60));
    res.json({
      leads: rows.slice(0, limit).map((row) => leadView(row, { canSeeContacts: reveal })),
      total: rows.length,
      canSeeContacts: reveal,
    });
  });

  app.post('/api/directory/leads', requireDirectory, directoryLimiter, (req, res) => {
    const db = getDb();
    const { errors, value } = normalizeLeadInput(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    const duplicate = findLeadDuplicate(db, value);
    if (duplicate) {
      return res.status(409).json({ error: 'duplicate_lead', duplicateOf: { id: duplicate.id, name: duplicate.name } });
    }
    const consentStatus = CONSENT_STATUSES.includes(req.body?.consent?.status) ? req.body.consent.status : 'pending';
    const row = {
      id: id(),
      ...value,
      status: LEAD_STATUSES.includes(req.body?.status) ? req.body.status : 'new',
      consent: { status: consentStatus, at: new Date().toISOString(), source: 'self_registration', note: clean(req.body?.consent?.note, 200), revokedAt: null },
      consentHistory: [],
      adLicense: consentStatus === 'granted',
      assignedTo: req.user.id,
      assignedName: req.user.name,
      dataset: 'live',
      convertedUserId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.adLeads.push(row);
    logAudit(db, { actor: actorOf(req), action: 'lead_create', target: row.id, meta: { business: row.businessName }, ip: req.ip });
    saveDbSoon();
    res.status(201).json({ lead: leadView(row, { canSeeContacts: canSeeContacts(req.user) }) });
  });

  app.put('/api/directory/leads/:id', requireDirectory, directoryLimiter, (req, res) => {
    const db = getDb();
    const row = db.adLeads.find((l) => l.id === req.params.id && !l.deletedAt);
    if (!row) return res.status(404).json({ error: 'lead_not_found' });
    const { errors, value } = normalizeLeadInput({ ...row, ...req.body });
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    Object.assign(row, value, { updatedAt: new Date().toISOString() });
    if (LEAD_STATUSES.includes(req.body?.status)) row.status = req.body.status;
    logAudit(db, { actor: actorOf(req), action: 'lead_update', target: row.id, ip: req.ip });
    saveDbSoon();
    res.json({ lead: leadView(row, { canSeeContacts: canSeeContacts(req.user) }) });
  });

  app.post('/api/directory/leads/:id/status', requireDirectory, directoryLimiter, (req, res) => {
    const db = getDb();
    const row = db.adLeads.find((l) => l.id === req.params.id && !l.deletedAt);
    if (!row) return res.status(404).json({ error: 'lead_not_found' });
    const status = String(req.body?.status || '');
    if (!LEAD_STATUSES.includes(status)) return res.status(400).json({ error: 'status_invalid' });
    row.status = status;
    row.updatedAt = new Date().toISOString();
    logAudit(db, { actor: actorOf(req), action: `lead_${status}`, target: row.id, ip: req.ip });
    saveDbSoon();
    res.json({ lead: leadView(row, { canSeeContacts: canSeeContacts(req.user) }) });
  });

  app.post('/api/directory/leads/:id/convert', requireDirectory, directoryLimiter, (req, res) => {
    const db = getDb();
    const row = db.adLeads.find((l) => l.id === req.params.id && !l.deletedAt);
    if (!row) return res.status(404).json({ error: 'lead_not_found' });
    if (row.status === 'converted' && row.convertedUserId) {
      return res.json({ lead: leadView(row, { canSeeContacts: canSeeContacts(req.user) }), user: publicUser(db.users.find((u) => u.id === row.convertedUserId)) });
    }
    let user = db.users.find((u) => phoneKey(u.phone) === phoneKey(row.phone));
    if (!user) {
      user = {
        id: id(), name: row.name, email: null, passwordHash: null, role: 'customer',
        storeName: row.businessName, storeSlug: null, phone: row.phone, phoneVerified: false,
        status: 'active', city: row.city || '', profile: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      db.users.push(user);
    }
    row.status = 'converted';
    row.convertedUserId = user.id;
    row.convertedAt = new Date().toISOString();
    row.updatedAt = row.convertedAt;
    addActivity(db, {
      entityType: 'lead', entityId: row.id, type: 'note',
      summary: `تبدیل متقاضی به مشتری (${user.name})`, outcome: 'converted', actor: actorOf(req),
    });
    logAudit(db, { actor: actorOf(req), action: 'lead_convert', target: row.id, meta: { userId: user.id }, ip: req.ip });
    saveDbSoon();
    res.json({ lead: leadView(row, { canSeeContacts: canSeeContacts(req.user) }), user: publicUser(user) });
  });

  app.get('/api/directory/activities', requireDirectory, directoryLimiter, (req, res) => {
    const db = getDb();
    const entityType = clean(req.query?.entityType, 20);
    const entityId = clean(req.query?.entityId, 40);
    const rows = (db.crmActivities || [])
      .filter((a) => (entityType ? a.entityType === entityType : true))
      .filter((a) => (entityId ? a.entityId === entityId : true))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 100)
      .map(activityView);
    res.json({ activities: rows });
  });

  app.post('/api/directory/activities', requireDirectory, directoryLimiter, (req, res) => {
    const db = getDb();
    try {
      const activity = addActivity(db, {
        entityType: String(req.body?.entityType || ''),
        entityId: clean(req.body?.entityId, 40),
        type: String(req.body?.type || ''),
        summary: req.body?.summary,
        outcome: req.body?.outcome,
        nextCallAt: req.body?.nextCallAt || null,
        actor: actorOf(req),
      });
      logAudit(db, { actor: actorOf(req), action: 'crm_activity', target: `${activity.entityType}:${activity.entityId}`, ip: req.ip });
      saveDbSoon();
      res.status(201).json({ activity: activityView(activity) });
    } catch (err) {
      const status = err instanceof DirectoryError ? err.status : 400;
      return res.status(status).json({ error: err.code || 'activity_invalid' });
    }
  });

  app.post('/api/directory/activities/:id/done', requireDirectory, directoryLimiter, (req, res) => {
    const db = getDb();
    try {
      const activity = completeActivity(db, req.params.id, actorOf(req));
      logAudit(db, { actor: actorOf(req), action: 'crm_activity_done', target: activity.id, ip: req.ip });
      saveDbSoon();
      res.json({ activity: activityView(activity) });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.code || 'activity_not_found' });
    }
  });

  app.get('/api/directory/reminders', requireDirectory, directoryLimiter, (req, res) => {
    const db = getDb();
    const withinHours = Math.min(720, Math.max(1, Number(req.query?.withinHours) || 48));
    const mine = req.query?.mine === '1';
    res.json({ reminders: dueReminders(db, { withinHours, actorId: mine ? req.user.id : null }) });
  });

  app.get('/api/directory/stats', requireDirectory, directoryLimiter, (_req, res) => {
    const db = getDb();
    res.json({
      directory: directoryStats(db),
      crm: crmStats(db),
      datasets: {
        demo: {
          businesses: db.businesses.filter((b) => (b.dataset || 'live') === 'demo').length,
          leads: db.adLeads.filter((l) => (l.dataset || 'live') === 'demo').length,
        },
        live: {
          businesses: db.businesses.filter((b) => (b.dataset || 'live') === 'live').length,
          leads: db.adLeads.filter((l) => (l.dataset || 'live') === 'live').length,
        },
      },
    });
  });

  app.get('/api/directory/audit', requireAdminOnly, directoryLimiter, (req, res) => {
    const db = getDb();
    const limit = Math.min(500, Math.max(1, Number(req.query?.limit) || 100));
    const rows = [...(db.auditLog || [])].reverse().slice(0, limit);
    res.json({ entries: rows });
  });

  app.get('/api/directory/team', requireAdminOnly, directoryLimiter, (_req, res) => {
    const db = getDb();
    const users = db.users
      .filter((u) => directoryRoles.includes(u.role))
      .map((u) => ({
        id: u.id, name: u.name, role: u.role, phone: maskPhone(u.phone),
        contactAccess: Boolean(u.contactAccess), status: u.status, createdAt: u.createdAt,
      }));
    res.json({ users });
  });

  app.post('/api/directory/team', requireAdminOnly, directoryLimiter, (req, res) => {
    const db = getDb();
    const phone = normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).json({ error: 'phone_invalid' });
    const user = db.users.find((u) => phoneKey(u.phone) === phoneKey(phone));
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'admin_protected' });
    user.role = 'agent';
    user.contactAccess = Boolean(req.body?.contactAccess);
    user.updatedAt = new Date().toISOString();
    logAudit(db, { actor: actorOf(req), action: 'team_promote', target: user.id, meta: { contactAccess: user.contactAccess }, ip: req.ip });
    saveDbSoon();
    res.json({ user: { id: user.id, name: user.name, role: user.role, contactAccess: user.contactAccess } });
  });

  app.patch('/api/directory/team/:id', requireAdminOnly, directoryLimiter, (req, res) => {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'admin_protected' });
    if (req.body?.contactAccess !== undefined) user.contactAccess = Boolean(req.body.contactAccess);
    if (req.body?.revoke === true) {
      user.role = 'customer';
      user.contactAccess = false;
    }
    user.updatedAt = new Date().toISOString();
    logAudit(db, { actor: actorOf(req), action: 'team_update', target: user.id, meta: { contactAccess: Boolean(user.contactAccess) }, ip: req.ip });
    saveDbSoon();
    res.json({ user: { id: user.id, name: user.name, role: user.role, contactAccess: Boolean(user.contactAccess) } });
  });

  /* -------------------- حریم خصوصی: لغو رضایت و حذف داده -------------------- */

  app.post('/api/privacy/opt-out', otpLimiter, (req, res) => {
    const db = getDb();
    try {
      const { record, affected } = recordOptOut(db, {
        phone: req.body?.phone,
        channel: ['all', 'sms', 'whatsapp', 'telegram', 'instagram', 'call'].includes(String(req.body?.channel)) ? String(req.body.channel) : 'all',
        reason: req.body?.reason,
        source: 'public_form',
      });
      logAudit(db, { actor: actorOf(req), action: 'privacy_opt_out', target: maskPhone(record.phone), meta: { affected }, ip: req.ip });
      saveDbSoon();
      res.json({ ok: true, affected, at: record.at });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.code || 'phone_invalid' });
    }
  });

  app.post('/api/privacy/deletion-request', otpLimiter, (req, res) => {
    const db = getDb();
    try {
      const record = requestDeletion(db, {
        entityType: req.body?.entityType === 'lead' ? 'lead' : 'business',
        entityId: clean(req.body?.entityId, 40),
        phone: req.body?.phone,
        reason: req.body?.reason,
        actor: actorOf(req),
      });
      logAudit(db, { actor: actorOf(req), action: 'privacy_deletion_request', target: record.entityId, ip: req.ip });
      saveDbSoon();
      res.status(201).json({ request: { id: record.id, status: record.status, createdAt: record.createdAt } });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.code || 'request_invalid' });
    }
  });

  app.get('/api/directory/deletion-requests', requireAdminOnly, directoryLimiter, (_req, res) => {
    const db = getDb();
    res.json({ requests: [...(db.deletionRequests || [])].reverse() });
  });

  app.post('/api/directory/deletion-requests/:id/apply', requireAdminOnly, directoryLimiter, (req, res) => {
    const db = getDb();
    try {
      const record = applyDeletion(db, req.params.id, actorOf(req));
      logAudit(db, { actor: actorOf(req), action: 'privacy_deletion_applied', target: record.entityId, ip: req.ip });
      saveDbSoon();
      res.json({ request: record });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.code || 'request_not_found' });
    }
  });

  // فرم عمومی درخواست تبلیغ (ثبت متقاضی از سایت)
  app.post('/api/public/ad-request', otpLimiter, (req, res) => {
    const db = getDb();
    const { errors, value } = normalizeLeadInput({ ...req.body, networks: req.body?.networks, budgetUsd: req.body?.budgetUsd, durationDays: req.body?.durationDays });
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    if (req.body?.consent !== true) return res.status(400).json({ error: 'advertising_consent_required' });
    const duplicate = findLeadDuplicate(db, value);
    if (duplicate) return res.status(409).json({ error: 'duplicate_lead', duplicateOf: { id: duplicate.id } });
    const row = {
      id: id(),
      ...value,
      status: 'new',
      consent: { status: 'granted', at: new Date().toISOString(), source: 'self_registration', note: 'فرم عمومی درخواست تبلیغ', revokedAt: null },
      consentHistory: [],
      adLicense: true,
      assignedTo: null,
      assignedName: null,
      dataset: 'live',
      convertedUserId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.adLeads.push(row);
    logAudit(db, { actor: { id: null, role: 'public', name: 'form' }, action: 'lead_public_request', target: row.id, ip: req.ip });
    saveDbSoon();
    res.status(201).json({ ok: true, id: row.id });
  });

  /* ----------------------- پرداخت آزمایشی و پیگیری ارسال ----------------------- */

  app.post('/api/orders/:id/pay-test', requireAuth, (req, res) => {
    const db = getDb();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'order_not_found' });
    if (order.customerId !== req.user.id) return res.status(403).json({ error: 'forbidden' });
    if (order.payment?.status === 'paid') return res.json({ order: orderView(order), duplicate: true });
    if (['canceled', 'returned'].includes(order.status)) return res.status(409).json({ error: 'order_not_payable' });
    order.payment = { method: 'test', status: 'paid', at: new Date().toISOString(), reference: `TEST-${id().slice(0, 8).toUpperCase()}` };
    order.updatedAt = new Date().toISOString();
    order.history = [...(order.history || []), { status: order.status, at: order.updatedAt, by: req.user.name, note: 'پرداخت آزمایشی' }];
    logAudit(db, { actor: actorOf(req), action: 'order_test_payment', target: order.id, meta: { total: order.total }, ip: req.ip });
    saveDbSoon();
    res.json({ order: orderView(order) });
  });

  app.patch('/api/seller/orders/:id/tracking', requireRole('seller'), (req, res) => {
    const db = getDb();
    const order = db.orders.find((o) => o.id === req.params.id && o.sellerId === req.user.id);
    if (!order) return res.status(404).json({ error: 'order_not_found' });
    if (!['shipped', 'delivered'].includes(order.status)) return res.status(409).json({ error: 'order_not_shippable' });
    const carrier = clean(req.body?.carrier, 60);
    const trackingNumber = clean(req.body?.trackingNumber, 60);
    const trackingUrl = clean(req.body?.trackingUrl, 300);
    if (!carrier || !trackingNumber) return res.status(400).json({ error: 'tracking_required' });
    if (trackingUrl && !/^https?:\/\/[^\s]+$/i.test(trackingUrl)) return res.status(400).json({ error: 'tracking_url_invalid' });
    order.tracking = { carrier, trackingNumber, trackingUrl: trackingUrl || null, at: new Date().toISOString() };
    order.updatedAt = new Date().toISOString();
    logAudit(db, { actor: actorOf(req), action: 'order_tracking', target: order.id, ip: req.ip });
    saveDbSoon();
    res.json({ order: internalOrderView(order) });
  });

  /* --------------------------------- فایل‌ها --------------------------------- */

  // مرکز بررسی سه فاز — فقط شمارش و وضعیت؛ بدون مبلغ، موجودی یا اطلاعات تماس
  app.get('/api/phases', (_req, res) => {
    res.json(phaseCatalog(getDb()));
  });

  app.get('/api/phases/:id', (req, res) => {
    const phase = phaseById(getDb(), req.params.id);
    if (!phase) return res.status(404).json({ error: 'phase_not_found' });
    return res.json(phase);
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  // گارد پیش از فایل‌های استاتیک: /finance نباید با extensions استاتیک دور زده شود
  app.use(['/finance', '/finance.html', '/js/finance.js', '/css/finance.css'], (req, res, next) => {
    if (!req.user) return res.redirect('/?next=/finance');
    if (!isOwner(getDb(), req.user)) return res.status(403).type('html').send(deniedHtml);
    return next();
  });

  // گارد مرکز امنیت: فقط مدیر اصلی (پیش از سرو فایل استاتیک تا صفحه لو نرود)
  app.use(['/security', '/security.html', '/js/security.js'], (req, res, next) => {
    if (!req.user) return res.redirect('/?next=/security');
    if (!isOwner(getDb(), req.user)) return res.status(403).type('html').send(deniedHtml);
    return next();
  });

  // گارد پنل مدیریتی اصناف: دسترسی فقط برای مدیر و کارشناس مجاز
  app.use(['/business', '/business.html', '/js/business.js', '/css/business.css'], (req, res, next) => {
    if (!req.user) return res.redirect('/login?next=/business');
    if (!directoryRoles.includes(req.user.role)) return res.status(403).type('html').send(deniedHtml);
    return next();
  });

  app.use(express.static(PUBLIC_DIR, { maxAge: '1h', extensions: ['html'] }));
  app.get('/seller', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'seller.html')));
  app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
  app.get('/ads', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'ads.html')));
  app.get('/finance', (req, res) => {
    if (!req.user) return res.redirect('/?next=/finance');
    if (!isOwner(getDb(), req.user)) return res.status(403).type('html').send(deniedHtml);
    return res.sendFile(path.join(PUBLIC_DIR, 'finance.html'));
  });
  app.get('/security', (req, res) => {
    if (!req.user) return res.redirect('/?next=/security');
    if (!isOwner(getDb(), req.user)) return res.status(403).type('html').send(deniedHtml);
    return res.sendFile(path.join(PUBLIC_DIR, 'security.html'));
  });
  app.get('/report/:token', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'report.html')));
  app.get('/login', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));
  app.get('/account', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'account.html')));
  app.get('/privacy', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'privacy.html')));
  app.get('/business', (req, res) => {
    if (!req.user) return res.redirect('/login?next=/business');
    if (!directoryRoles.includes(req.user.role)) return res.status(403).type('html').send(deniedHtml);
    return res.sendFile(path.join(PUBLIC_DIR, 'business.html'));
  });

  // مرکز بررسی سه فاز — بخش مستقل مشاهده و آزمایش هر فاز
  app.get(['/review', '/review.html'], (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'review.html')));
  app.get('/phases', (_req, res) => res.redirect('/review'));
  app.get('/phases/:id', (req, res) => {
    if (!['1', '2', '3'].includes(String(req.params.id))) {
      return res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
    }
    return res.sendFile(path.join(PUBLIC_DIR, 'phase.html'));
  });

  app.use((req, res) => {
    if (req.accepts('html')) return res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
    return res.status(404).json({ error: 'not_found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'payload_too_large' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    console.error('server error', err?.message);
    return res.status(500).json({ error: 'server_error' });
  });

  return app;
}

/* --------------------------------- راه‌اندازی --------------------------------- */

export function bootstrap() {
  seedIfEmpty();
  ensureSeedImages();
  ensureUploadDir();
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`بازار هوشمند روی پورت ${port} در حال اجراست`);
  });
  const shutdown = () => {
    flushDb();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  return server;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) bootstrap();

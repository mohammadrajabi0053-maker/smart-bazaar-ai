// بازار هوشمند — سرور اصلی (Express 5)
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

import {
  CATEGORIES, LANGS, ORDER_STATUSES, STATUS_FLOW, categoryLabel, isValidCategory,
} from './src/catalog.js';
import {
  AdInputError, adOptions, adStats, buildQuote, campaignView, canTransition, invoiceFor, nextInvoiceNo,
} from './src/ads.js';
import {
  getDb, saveDb, saveDbSoon, flushDb, id, ensureUploadDir, UPLOAD_DIR,
} from './src/store.js';
import {
  attachUser, requireAuth, requireRole, setSessionCookie, clearSessionCookie,
  publicUser, hashPassword, verifyPassword, parseCookies,
} from './src/auth.js';
import { seedIfEmpty, ensureSeedImages } from './src/seed.js';
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
    shippingCost: order.shippingCost,
    total: order.total,
    shipping: order.shipping,
    note: order.note,
    storeName: order.storeName,
    customerName: order.customerName,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    history: order.history || [],
    allowedStatuses: STATUS_FLOW[order.status] || [],
  };
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

  app.use((req, _res, next) => {
    req.cookies = parseCookies(req.headers.cookie || '');
    next();
  });
  app.use(express.json({ limit: '4mb' }));
  app.use(attachUser);

  const authLimiter = createLimiter({ windowMs: 60000, max: 25 });
  const aiLimiter = createLimiter({ windowMs: 60000, max: 40 });

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
    setSessionCookie(res, user);
    res.status(201).json({ user: publicUser(user) });
  });

  app.post('/api/auth/login', authLimiter, (req, res) => {
    const db = getDb();
    const email = clean(req.body?.email, 120).toLowerCase();
    const password = String(req.body?.password || '');
    const user = db.users.find((u) => u.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    if (user.status === 'blocked') return res.status(403).json({ error: 'account_blocked' });
    setSessionCookie(res, user);
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
      const shippingCost = subtotal >= FREE_SHIPPING_FROM ? 0 : Number(db.settings?.shippingCost ?? 45000);
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
        shippingCost,
        total: subtotal + shippingCost,
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
    saveDbSoon();
    res.status(201).json({
      groupId,
      orders: created.map(orderView),
      total: created.reduce((s, o) => s + o.total, 0),
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
      .map(orderView);
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
      .map(orderView);
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

  /* --------------------------------- فایل‌ها --------------------------------- */

  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  app.use(express.static(PUBLIC_DIR, { maxAge: '1h', extensions: ['html'] }));
  app.get('/seller', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'seller.html')));
  app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
  app.get('/ads', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'ads.html')));

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

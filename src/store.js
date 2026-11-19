// ذخیره‌سازی سبک و پایدار روی فایل JSON (بدون وابستگی نیتیو)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
export const DB_FILE = path.join(DATA_DIR, 'db.json');
export const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

const EMPTY = () => ({
  users: [],
  products: [],
  orders: [],
  reviews: [],
  assistantLogs: [],
  adCampaigns: [],
  settings: { createdAt: new Date().toISOString() },
});

let db = null;
let writeTimer = null;

export function getDb() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = { ...EMPTY(), ...parsed };
    } catch {
      db = EMPTY();
    }
  } else {
    db = EMPTY();
  }
  return db;
}

export function saveDb() {
  const data = JSON.stringify(getDb(), null, 2);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, DB_FILE);
}

// نوشتن با تعویق کوتاه برای جلوگیری از I/O مکرر
export function saveDbSoon() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      saveDb();
    } catch (err) {
      console.error('db write failed', err.message);
    }
  }, 40);
  if (typeof writeTimer.unref === 'function') writeTimer.unref();
}

export function flushDb() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  saveDb();
}

export function id() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

export function resetDbForTests() {
  db = null;
}

export function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// بازار هوشمند — جداسازی محیط آزمایشی (demo) و واقعی (live)
// داده‌های آزمایشی با نشانگر demo ذخیره می‌شوند و در محیط واقعی نمایش/محاسبه نمی‌شوند.
export const MODES = ['demo', 'live'];

export class EnvError extends Error {
  constructor(code, status = 409) {
    super(code);
    this.name = 'EnvError';
    this.code = code;
    this.status = status;
  }
}

export function currentMode(db) {
  return db?.settings?.environment === 'live' ? 'live' : 'demo';
}

export function setMode(db, mode) {
  if (!MODES.includes(mode)) throw new EnvError('mode_invalid', 400);
  if (!db.settings) db.settings = {};
  db.settings.environment = mode;
  db.settings.environmentChangedAt = new Date().toISOString();
  return mode;
}

/** عملیات واقعی فقط در محیط live مجاز است */
export function assertLive(db, action = 'operation') {
  if (currentMode(db) !== 'live') {
    throw new EnvError('demo_mode', 409);
  }
  return true;
}

/** برچسب‌گذاری رکورد تازه با محیط جاری */
export function stampEnv(db, row) {
  if (row && typeof row === 'object') {
    row.demo = currentMode(db) === 'demo';
    row.environment = currentMode(db);
  }
  return row;
}

/** در محیط آزمایشی همهٔ داده‌ها دیده می‌شوند؛ در محیط واقعی فقط دادهٔ واقعی */
export function visibleInMode(db, row) {
  if (!row) return false;
  if (currentMode(db) === 'demo') return true;
  return row.demo === false;
}

export function filterVisible(db, rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => visibleInMode(db, row));
}

export function envSummary(db) {
  const mode = currentMode(db);
  return {
    mode,
    label: mode === 'demo' ? 'آزمایشی / Demo' : 'واقعی / Live',
    changedAt: db?.settings?.environmentChangedAt || null,
    paymentsEnabled: false,
    payoutsEnabled: false,
    bulkMessagingEnabled: false,
    realOperationsAllowed: mode === 'live',
    demoRows: (Array.isArray(db?.orders) ? db.orders : []).filter((row) => row.demo !== false).length,
  };
}

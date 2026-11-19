// بازار هوشمند — نظارت امنیتی، تحلیل تلاش‌های مشکوک و هشدارهای مالک
import { currentMode } from './envmode.js';
import { id, saveDbSoon } from './store.js';

export const SENSITIVE_ACTIONS = [
  'finance_access_denied', 'finance_exported', 'grant_created', 'grant_revoked',
  'withdrawal_created', 'withdrawal_advanced', 'sessions_revoked', 'totp_enabled',
  'totp_disabled', 'backup_created', 'backup_restored', 'backup_verified',
  'backup_schedule_updated', 'recovery_codes_generated', 'passkey_registered',
  'passkey_removed', 'environment_changed', 'alert_config_updated',
];

const SEVERITIES = ['info', 'warning', 'critical'];
const MAX_ALERTS = 200;

function dayKey(value) {
  return String(value || '').slice(0, 10);
}

export function monitorOverview(db, q = {}) {
  const from = q.from ? Date.parse(q.from) : 0;
  const to = q.to ? Date.parse(`${q.to}T23:59:59.999Z`) : Date.now();
  const search = String(q.q || '').trim().toLowerCase();
  const events = (Array.isArray(db.securityEvents) ? db.securityEvents : [])
    .filter((event) => {
      const at = Date.parse(event.at);
      return Number.isFinite(at) ? at >= from && at <= to : false;
    })
    .filter((event) => !q.type || event.type === q.type)
    .filter((event) => !q.severity || event.severity === q.severity)
    .filter((event) => !search || `${event.type} ${event.identity} ${event.ip} ${event.detail} ${event.path}`.toLowerCase().includes(search));

  const byType = {};
  const bySeverity = { info: 0, warning: 0, critical: 0 };
  const byDay = {};
  for (const event of events) {
    byType[event.type] = (byType[event.type] || 0) + 1;
    if (bySeverity[event.severity] !== undefined) bySeverity[event.severity] += 1;
    const day = dayKey(event.at);
    byDay[day] = (byDay[day] || 0) + 1;
  }

  const failures = new Map();
  for (const event of events) {
    if (event.type !== 'login_failed' && event.type !== 'login_blocked') continue;
    const keys = [];
    if (event.identity) keys.push(`id:${event.identity}`);
    if (event.ip) keys.push(`ip:${event.ip}`);
    for (const key of keys) failures.set(key, (failures.get(key) || 0) + 1);
  }
  const suspicious = [...failures.entries()]
    .filter(([, count]) => count >= 3)
    .map(([target, count]) => ({ target, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const auditRows = (Array.isArray(db.finance?.audit) ? db.finance.audit : [])
    .filter((row) => SENSITIVE_ACTIONS.includes(row.action))
    .slice(-25)
    .reverse();

  const sessions = (Array.isArray(db.sessions) ? db.sessions : []).filter((row) => !row.revokedAt);
  const passkeys = (Array.isArray(db.users) ? db.users : [])
    .reduce((sum, user) => sum + (Array.isArray(user.passkeys) ? user.passkeys.length : 0), 0);
  const twoFactorUsers = (Array.isArray(db.users) ? db.users : []).filter((user) => user.totp?.enabled).length;
  const history = Array.isArray(db.backupHistory) ? db.backupHistory : [];
  const lastBackup = history.slice(-1)[0] || null;

  return {
    environment: currentMode(db),
    range: { from: q.from || null, to: q.to || null },
    totals: { events: events.length, bySeverity, byType },
    byDay: Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count })),
    suspicious,
    sensitive: auditRows,
    events: events.slice(-100).reverse(),
    posture: {
      twoFactorUsers,
      passkeys,
      activeSessions: sessions.length,
      backup: {
        enabled: Boolean(db.settings?.backup?.enabled),
        intervalHours: Number(db.settings?.backup?.intervalHours) || 24,
        lastBackupAt: lastBackup?.createdAt || null,
        count: history.length,
        fingerprint: lastBackup?.fingerprint || null,
      },
      paymentsEnabled: false,
      payoutsEnabled: false,
      bulkMessagingEnabled: false,
    },
  };
}

export function alertConfig(db) {
  const cfg = db?.settings?.alerts || {};
  return {
    enabled: Boolean(cfg.enabled),
    webhookUrl: cfg.webhookUrl || '',
    minSeverity: SEVERITIES.includes(cfg.minSeverity) ? cfg.minSeverity : 'warning',
    updatedAt: cfg.updatedAt || null,
  };
}

export function setAlertConfig(db, patch = {}) {
  if (!db.settings) db.settings = {};
  const current = alertConfig(db);
  let webhookUrl = patch.webhookUrl === undefined ? current.webhookUrl : String(patch.webhookUrl || '').trim();
  if (webhookUrl && !/^https:\/\//i.test(webhookUrl)) {
    const err = new Error('webhook_must_be_https');
    err.code = 'webhook_must_be_https';
    err.status = 400;
    throw err;
  }
  webhookUrl = webhookUrl.slice(0, 300);
  const minSeverity = SEVERITIES.includes(patch.minSeverity) ? patch.minSeverity : current.minSeverity;
  db.settings.alerts = {
    enabled: patch.enabled === undefined ? current.enabled : Boolean(patch.enabled),
    webhookUrl,
    minSeverity,
    updatedAt: new Date().toISOString(),
  };
  saveDbSoon();
  return alertConfig(db);
}

/** ارسال هشدار به کانال تنظیم‌شده؛ بدون کانال، ارسال انجام نمی‌شود و وضعیت صادقانه گزارش می‌شود */
export async function dispatchAlert(db, { type = 'security', severity = 'warning', title = '', detail = '' } = {}) {
  const config = alertConfig(db);
  const row = {
    id: id(),
    at: new Date().toISOString(),
    type: String(type).slice(0, 60),
    severity: SEVERITIES.includes(severity) ? severity : 'warning',
    title: String(title).slice(0, 140),
    detail: String(detail).slice(0, 300),
    channel: 'none',
    delivered: false,
    status: 'not_configured',
  };
  if (config.enabled && config.webhookUrl) {
    row.channel = 'webhook';
    try {
      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: 'smart-bazaar', ...row }),
        signal: AbortSignal.timeout(5000),
      });
      row.delivered = res.ok;
      row.status = `http_${res.status}`;
    } catch (err) {
      row.status = 'delivery_failed';
      row.detail = `${row.detail} | ${String(err?.message || '').slice(0, 80)}`.slice(0, 300);
    }
  }
  if (!Array.isArray(db.alerts)) db.alerts = [];
  db.alerts.push(row);
  if (db.alerts.length > MAX_ALERTS) db.alerts.splice(0, db.alerts.length - MAX_ALERTS);
  saveDbSoon();
  return row;
}

export function recentAlerts(db, limit = 20) {
  const rows = Array.isArray(db.alerts) ? db.alerts : [];
  return rows.slice(-Math.max(1, Math.min(limit, MAX_ALERTS))).reverse();
}

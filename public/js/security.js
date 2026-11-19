// بازار هوشمند — مرکز امنیت هوشمند بازار (فقط مدیر اصلی)
import {
  applyDir, getLang, setLang, api, toast, esc, fmtDate,
} from './core.js';

const $ = (id) => document.getElementById(id);
const bytes = (n) => {
  const value = Number(n) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1048576).toFixed(2)} MB`;
};
const time = (iso) => (iso ? `${fmtDate(iso)} ${String(iso).slice(11, 16)}` : '—');

/* ------------------------------ تأیید دومرحله‌ای ------------------------------ */
function secondFactor() {
  return { password: $('sfPassword').value, code: $('sfCode').value.trim() };
}
function clearSecondFactor() {
  $('sfPassword').value = '';
  $('sfCode').value = '';
}
function requireSecondFactor() {
  const payload = secondFactor();
  if (!payload.password || !payload.code) {
    toast('رمز عبور و کد Authenticator لازم است', 'err');
    return null;
  }
  return payload;
}

/* -------------------------------- Passkey -------------------------------- */
const b64uToBuf = (value) => {
  const raw = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = raw.length % 4 === 0 ? '' : '='.repeat(4 - (raw.length % 4));
  const bin = atob(raw + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out.buffer;
};
const bufToB64u = (buffer) => {
  const arr = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const passkeySupported = () => typeof window.PublicKeyCredential !== 'undefined'
  && Boolean(navigator.credentials);

/* --------------------------------- وضعیت --------------------------------- */
async function loadPosture() {
  try {
    const [overview, env] = await Promise.all([
      api('/api/finance/monitor/overview'),
      api('/api/env'),
    ]);
    const posture = overview.posture || {};
    const set = (key, text) => {
      const node = document.querySelector(`[data-k="${key}"]`);
      if (node) node.textContent = text;
    };
    set('twoFactor', posture.twoFactorUsers ? `${posture.twoFactorUsers} کاربر` : 'غیرفعال');
    set('passkeys', String(posture.passkeys ?? 0));
    set('sessions', String(posture.activeSessions ?? 0));
    set('backup', posture.backup?.lastBackupAt ? time(posture.backup.lastBackupAt) : 'ندارد');
    set('events', String(overview.totals?.events ?? 0));
    set('critical', String(overview.totals?.bySeverity?.critical ?? 0));

    const badge = $('envBadge');
    if (badge) badge.textContent = env.mode === 'live' ? '🟢 محیط واقعی' : '🧪 محیط آزمایشی';
    const note = $('envNote');
    if (note) {
      note.textContent = `محیط فعال: ${env.label} — پرداخت: ${env.paymentsEnabled ? 'فعال' : 'غیرفعال'} — برداشت: ${env.payoutsEnabled ? 'فعال' : 'غیرفعال'} — رکوردهای آزمایشی سفارش: ${env.demoRows}`;
    }
    const select = $('envMode');
    if (select) select.value = env.mode;

    const body = $('sensitiveTable').querySelector('tbody');
    const rows = Array.isArray(overview.sensitive) ? overview.sensitive : [];
    body.innerHTML = rows.length
      ? rows.slice(0, 12).map((row) => `<tr><td>${esc(time(row.at))}</td><td>${esc(row.action)}</td><td>${esc(row.target || '—')}</td></tr>`).join('')
      : '<tr><td colspan="3">رویداد حساسی ثبت نشده است.</td></tr>';
  } catch (err) {
    toast(`خطا در بارگذاری وضعیت: ${err.message}`, 'err');
  }
}

/* --------------------------------- بکاپ --------------------------------- */
async function loadBackup() {
  try {
    const data = await api('/api/finance/backup/status');
    $('backupEncryption').textContent = `الگوریتم ${data.encryption.algorithm} • KDF ${data.encryption.kdf} • منبع کلید: ${data.encryption.keySource} • مستقل از SESSION_SECRET: ${data.encryption.keyIndependentFromSession ? 'بله' : 'خیر'}`;
    $('backupLimit').textContent = data.limitation;
    $('schedEnabled').checked = Boolean(data.schedule.enabled);
    $('schedInterval').value = data.schedule.intervalHours;
    $('schedRetention').value = data.schedule.retention;

    const body = $('backupTable').querySelector('tbody');
    const rows = Array.isArray(data.history) ? data.history : [];
    body.innerHTML = rows.length
      ? rows.map((row) => `<tr>
          <td>${esc(time(row.createdAt))}</td>
          <td>${esc(row.reason || '—')}</td>
          <td>${esc(bytes(row.size))}</td>
          <td><code>${esc(String(row.fingerprint || '').slice(0, 12))}</code></td>
          <td class="fin-actions">
            <button class="fin-mini" data-act="verify" data-id="${esc(row.id)}" type="button">بررسی صحت</button>
            <a class="fin-mini" href="${esc(row.downloadUrl)}">دانلود</a>
            <button class="fin-mini" data-act="restore" data-id="${esc(row.id)}" type="button">انتخاب برای بازیابی</button>
          </td>
        </tr>`).join('')
      : '<tr><td colspan="5">هنوز پشتیبانی ساخته نشده است.</td></tr>';
  } catch (err) {
    toast(`خطا در وضعیت پشتیبان: ${err.message}`, 'err');
  }
}

async function createBackup() {
  try {
    const includeSecrets = $('backupSecrets').checked;
    const body = { reason: $('backupReason').value || 'manual', includeSecrets };
    if (includeSecrets) {
      const second = requireSecondFactor();
      if (!second) return;
      Object.assign(body, second);
    }
    const data = await api('/api/finance/backup/create', { method: 'POST', body });
    toast('پشتیبان رمزگذاری‌شده ساخته شد', 'ok');
    $('restoreId').value = data.backup.id;
    await loadBackup();
    await loadPosture();
  } catch (err) {
    toast(`ساخت پشتیبان ناموفق: ${err.message}`, 'err');
  }
}

async function verifyBackupRow(id) {
  try {
    const data = await api('/api/finance/backup/verify', { method: 'POST', body: { id } });
    toast(data.chain?.valid ? 'صحت پشتیبان و زنجیره تراکنش‌ها تأیید شد' : 'پشتیبان خوانده شد اما زنجیره معتبر نیست', data.chain?.valid ? 'ok' : 'err');
    await loadBackup();
  } catch (err) {
    toast(`بررسی ناموفق: ${err.message}`, 'err');
  }
}

async function restorePreview() {
  const id = $('restoreId').value.trim();
  if (!id) return toast('شناسه پشتیبان را وارد کنید', 'err');
  try {
    const data = await api('/api/finance/backup/restore', { method: 'POST', body: { id } });
    $('restoreOut').textContent = JSON.stringify(data, null, 2);
    toast('پیش‌نمایش بازیابی آماده است (بدون تغییر داده)', 'ok');
  } catch (err) {
    toast(`پیش‌نمایش ناموفق: ${err.message}`, 'err');
  }
}

async function restoreApply() {
  const id = $('restoreId').value.trim();
  if (!id) return toast('شناسه پشتیبان را وارد کنید', 'err');
  const second = requireSecondFactor();
  if (!second) return;
  if (!window.confirm('بازیابی واقعی داده‌های فعلی را جای‌گزین می‌کند. ادامه می‌دهید؟')) return;
  try {
    const data = await api('/api/finance/backup/restore', {
      method: 'POST',
      body: { id, mode: 'apply', confirm: $('restoreConfirm').value.trim(), ...second },
    });
    $('restoreOut').textContent = JSON.stringify(data, null, 2);
    clearSecondFactor();
    toast('بازیابی انجام شد؛ پشتیبان ایمنی پیش از بازیابی ساخته شد', 'ok');
    await loadBackup();
    await loadPosture();
    await loadSessions();
  } catch (err) {
    toast(`بازیابی ناموفق: ${err.message}`, 'err');
  }
}

async function saveSchedule() {
  try {
    await api('/api/finance/backup/schedule', {
      method: 'POST',
      body: {
        enabled: $('schedEnabled').checked,
        intervalHours: Number($('schedInterval').value) || 24,
        retention: Number($('schedRetention').value) || 7,
      },
    });
    toast('زمان‌بندی پشتیبان ذخیره شد', 'ok');
    await loadBackup();
  } catch (err) {
    toast(`ذخیره زمان‌بندی ناموفق: ${err.message}`, 'err');
  }
}

async function runBackupNow() {
  try {
    await api('/api/finance/backup/run-now', { method: 'POST', body: {} });
    toast('پشتیبان زمان‌بندی‌شده اجرا شد', 'ok');
    await loadBackup();
  } catch (err) {
    toast(`اجرای پشتیبان ناموفق: ${err.message}`, 'err');
  }
}

/* -------------------------------- نشست‌ها -------------------------------- */
async function loadSessions() {
  try {
    const [data, recovery] = await Promise.all([
      api('/api/finance/sessions'),
      api('/api/finance/recovery/status'),
    ]);
    const body = $('sessionsTable').querySelector('tbody');
    const rows = Array.isArray(data.sessions) ? data.sessions : [];
    body.innerHTML = rows.length
      ? rows.map((row) => `<tr>
          <td>${esc(`${row.os} • ${row.browser}`)}${row.current ? ' <strong>(این دستگاه)</strong>' : ''}</td>
          <td>${esc(row.ip || '—')}</td>
          <td>${esc(time(row.createdAt))}</td>
          <td>${esc(time(row.lastSeenAt))}</td>
          <td>${row.active ? 'فعال' : 'باطل‌شده'}</td>
          <td>${row.active ? `<button class="fin-mini" data-revoke="${esc(row.id)}" type="button">ابطال</button>` : '—'}</td>
        </tr>`).join('')
      : '<tr><td colspan="6">نشستی ثبت نشده است.</td></tr>';

    const info = recovery.recovery || {};
    $('recoveryStatus').textContent = `کدهای باقی‌مانده: ${info.remaining ?? 0} از ${info.total ?? 0}${info.createdAt ? ` • ساخته‌شده در ${time(info.createdAt)}` : ''}`;
  } catch (err) {
    toast(`خطا در نشست‌ها: ${err.message}`, 'err');
  }
}

async function revokeSessionRow(id) {
  try {
    await api(`/api/finance/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast('نشست باطل شد', 'ok');
    await loadSessions();
  } catch (err) {
    toast(`ابطال ناموفق: ${err.message}`, 'err');
  }
}

async function revokeOthers() {
  try {
    const data = await api('/api/finance/sessions/revoke-others', { method: 'POST', body: {} });
    toast(`${data.revoked} نشست دیگر باطل شد`, 'ok');
    await loadSessions();
  } catch (err) {
    toast(`ابطال ناموفق: ${err.message}`, 'err');
  }
}

async function generateRecovery() {
  const second = requireSecondFactor();
  if (!second) return;
  try {
    const data = await api('/api/finance/recovery/generate', { method: 'POST', body: second });
    clearSecondFactor();
    $('recoveryCodes').innerHTML = data.codes
      .map((code) => `<code class="fin-code">${esc(code)}</code>`).join('');
    toast('کدهای بازیابی ساخته شد؛ همین حالا ذخیره کنید', 'ok');
    await loadSessions();
  } catch (err) {
    toast(`ساخت کد ناموفق: ${err.message}`, 'err');
  }
}

/* -------------------------------- Passkey -------------------------------- */
async function loadPasskeys() {
  try {
    const data = await api('/api/finance/webauthn/credentials');
    const body = $('passkeyTable').querySelector('tbody');
    const rows = Array.isArray(data.credentials) ? data.credentials : [];
    body.innerHTML = rows.length
      ? rows.map((row) => `<tr>
          <td>${esc(row.label)}</td>
          <td>${esc(time(row.createdAt))}</td>
          <td>${esc(time(row.lastUsedAt))}</td>
          <td>${esc(String(row.signCount ?? 0))}</td>
          <td><button class="fin-mini" data-passkey="${esc(row.id)}" type="button">حذف</button></td>
        </tr>`).join('')
      : '<tr><td colspan="5">کلید امنیتی ثبت نشده است.</td></tr>';
  } catch (err) {
    toast(`خطا در کلیدها: ${err.message}`, 'err');
  }
}

async function addPasskey() {
  if (!passkeySupported()) {
    return toast('مرورگر شما از Passkey پشتیبانی نمی‌کند', 'err');
  }
  try {
    const options = await api('/api/finance/webauthn/register/options', { method: 'POST', body: {} });
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: b64uToBuf(options.challenge),
        rp: options.rp,
        user: {
          id: b64uToBuf(options.user.id),
          name: options.user.name,
          displayName: options.user.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams,
        timeout: options.timeout,
        attestation: options.attestation || 'none',
        authenticatorSelection: options.authenticatorSelection,
        excludeCredentials: (options.excludeCredentials || []).map((item) => ({
          type: 'public-key',
          id: b64uToBuf(item.id),
        })),
      },
    });
    if (!credential) return toast('ثبت کلید لغو شد', 'err');
    const payload = {
      challenge: options.challenge,
      label: $('passkeyLabel').value || 'Passkey',
      credential: {
        id: credential.id,
        rawId: bufToB64u(credential.rawId),
        transports: credential.response.getTransports ? credential.response.getTransports() : [],
        response: {
          clientDataJSON: bufToB64u(credential.response.clientDataJSON),
          attestationObject: bufToB64u(credential.response.attestationObject),
        },
      },
    };
    await api('/api/finance/webauthn/register/verify', { method: 'POST', body: payload });
    toast('کلید امنیتی ثبت شد', 'ok');
    $('passkeyLabel').value = '';
    await loadPasskeys();
    await loadPosture();
  } catch (err) {
    toast(`ثبت کلید ناموفق: ${err.message}`, 'err');
  }
}

async function removePasskey(id) {
  try {
    await api(`/api/finance/webauthn/credentials/${encodeURIComponent(id)}`, { method: 'DELETE' });
    toast('کلید حذف شد', 'ok');
    await loadPasskeys();
  } catch (err) {
    toast(`حذف ناموفق: ${err.message}`, 'err');
  }
}

/* -------------------------------- نظارت -------------------------------- */
async function loadMonitor() {
  try {
    const params = new URLSearchParams();
    if ($('monFrom').value) params.set('from', $('monFrom').value);
    if ($('monTo').value) params.set('to', $('monTo').value);
    if ($('monSeverity').value) params.set('severity', $('monSeverity').value);
    if ($('monQ').value.trim()) params.set('q', $('monQ').value.trim());
    const query = params.toString();
    const data = await api(`/api/finance/monitor/overview${query ? `?${query}` : ''}`);

    const suspBody = $('suspiciousTable').querySelector('tbody');
    const susp = Array.isArray(data.suspicious) ? data.suspicious : [];
    suspBody.innerHTML = susp.length
      ? susp.map((row) => `<tr><td>${esc(row.target)}</td><td>${esc(String(row.count))}</td></tr>`).join('')
      : '<tr><td colspan="2">الگوی مشکوکی یافت نشد.</td></tr>';

    const evBody = $('eventsTable').querySelector('tbody');
    const events = Array.isArray(data.events) ? data.events : [];
    evBody.innerHTML = events.length
      ? events.slice(0, 40).map((row) => `<tr>
          <td>${esc(time(row.at))}</td>
          <td>${esc(row.type)}</td>
          <td>${esc(row.severity)}</td>
          <td>${esc(row.identity || '—')}</td>
          <td>${esc(row.ip || '—')}</td>
          <td>${esc(row.path || '—')}</td>
        </tr>`).join('')
      : '<tr><td colspan="6">رویدادی در این بازه ثبت نشده است.</td></tr>';
  } catch (err) {
    toast(`خطا در گزارش امنیتی: ${err.message}`, 'err');
  }
}

async function loadAlerts() {
  try {
    const data = await api('/api/finance/monitor/alerts');
    $('alertEnabled').checked = Boolean(data.config.enabled);
    $('alertSeverity').value = data.config.minSeverity || 'warning';
    $('alertWebhook').value = data.config.webhookUrl || '';
    const body = $('alertTable').querySelector('tbody');
    const rows = Array.isArray(data.alerts) ? data.alerts : [];
    body.innerHTML = rows.length
      ? rows.map((row) => `<tr>
          <td>${esc(time(row.at))}</td>
          <td>${esc(row.title || row.type || '—')}</td>
          <td>${esc(row.severity || '—')}</td>
          <td>${row.delivered ? 'ارسال شد' : esc(row.error || 'فقط داخلی')}</td>
        </tr>`).join('')
      : '<tr><td colspan="4">هشداری ثبت نشده است.</td></tr>';
  } catch (err) {
    toast(`خطا در هشدارها: ${err.message}`, 'err');
  }
}

async function saveAlerts() {
  try {
    await api('/api/finance/monitor/alerts', {
      method: 'POST',
      body: {
        enabled: $('alertEnabled').checked,
        minSeverity: $('alertSeverity').value,
        webhookUrl: $('alertWebhook').value.trim(),
      },
    });
    toast('تنظیمات هشدار ذخیره شد', 'ok');
    await loadAlerts();
  } catch (err) {
    toast(`ذخیره ناموفق: ${err.message}`, 'err');
  }
}

async function testAlert() {
  try {
    const data = await api('/api/finance/monitor/test-alert', { method: 'POST', body: {} });
    toast(data.alert?.delivered ? 'هشدار آزمایشی ارسال شد' : 'هشدار فقط در داشبورد ثبت شد (webhook فعال نیست)', data.alert?.delivered ? 'ok' : 'err');
    await loadAlerts();
  } catch (err) {
    toast(`آزمون هشدار: ${err.message}`, 'err');
  }
}

async function switchEnvironment() {
  const second = requireSecondFactor();
  if (!second) return;
  try {
    const data = await api('/api/finance/environment', {
      method: 'POST',
      body: { mode: $('envMode').value, confirm: 'SWITCH', ...second },
    });
    clearSecondFactor();
    toast(`محیط به ${data.env.label} تغییر کرد`, 'ok');
    await loadPosture();
    await loadMonitor();
  } catch (err) {
    toast(`تغییر محیط ناموفق: ${err.message}`, 'err');
  }
}

/* --------------------------------- رویدادها --------------------------------- */
function switchTab(name) {
  document.querySelectorAll('.fin-tab').forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.fin-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `panel-${name}`);
  });
  if (name === 'posture') loadPosture();
  if (name === 'backup') loadBackup();
  if (name === 'sessions') loadSessions();
  if (name === 'passkey') loadPasskeys();
  if (name === 'monitor') {
    loadMonitor();
    loadAlerts();
  }
}

document.addEventListener('click', (event) => {
  const tab = event.target.closest('.fin-tab');
  if (tab) return switchTab(tab.dataset.tab);
  const verify = event.target.closest('[data-act="verify"]');
  if (verify) return verifyBackupRow(verify.dataset.id);
  const pick = event.target.closest('[data-act="restore"]');
  if (pick) {
    $('restoreId').value = pick.dataset.id;
    return toast('پشتیبان انتخاب شد؛ پیش‌نمایش را اجرا کنید', 'ok');
  }
  const revoke = event.target.closest('[data-revoke]');
  if (revoke) return revokeSessionRow(revoke.dataset.revoke);
  const passkey = event.target.closest('[data-passkey]');
  if (passkey) return removePasskey(passkey.dataset.passkey);
  return undefined;
});

$('backupCreateBtn').addEventListener('click', createBackup);
$('schedSaveBtn').addEventListener('click', saveSchedule);
$('backupNowBtn').addEventListener('click', runBackupNow);
$('restorePreviewBtn').addEventListener('click', restorePreview);
$('restoreApplyBtn').addEventListener('click', restoreApply);
$('sessionsRefresh').addEventListener('click', loadSessions);
$('revokeOthersBtn').addEventListener('click', revokeOthers);
$('recoveryGenBtn').addEventListener('click', generateRecovery);
$('passkeyAddBtn').addEventListener('click', addPasskey);
$('monApply').addEventListener('click', loadMonitor);
$('alertSaveBtn').addEventListener('click', saveAlerts);
$('alertTestBtn').addEventListener('click', testAlert);
$('envSwitchBtn').addEventListener('click', switchEnvironment);
$('logoutBtn').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST', body: {} });
  } catch { /* خروج محلی */ }
  window.location.href = '/';
});

const langSelect = $('langSelect');
langSelect.value = getLang();
langSelect.addEventListener('change', () => {
  setLang(langSelect.value);
  applyDir();
});

applyDir();
loadPosture();

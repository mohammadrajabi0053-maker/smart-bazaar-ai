// آزمون‌های فاز چهارم — بکاپ رمزگذاری‌شده، بازیابی، جداسازی محیط، نشست‌ها، کدهای بازیابی، Passkey و نظارت
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-bazaar-sec4-'));
process.env.DATA_DIR = tmpDir;
process.env.SESSION_SECRET = 'test-security4-secret-value-1234567890';
process.env.NODE_ENV = 'test';
delete process.env.BACKUP_KEY;

const { createApp } = await import('../server.js');
const { seedIfEmpty } = await import('../src/seed.js');
const { totpCode } = await import('../src/secure.js');
const { getDb } = await import('../src/store.js');
const { resetBackupKeyCache } = await import('../src/backup.js');

seedIfEmpty();

const app = createApp();
const server = await new Promise((resolve) => {
  const instance = app.listen(0, '0.0.0.0', () => resolve(instance));
});
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function client() {
  let cookie = '';
  return async (pathname, { method = 'GET', body, headers = {} } = {}) => {
    const outHeaders = { ...headers };
    if (body !== undefined) outHeaders['content-type'] = 'application/json';
    if (cookie) outHeaders.cookie = cookie;
    const res = await fetch(base + pathname, {
      method,
      headers: outHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const raw of res.headers.getSetCookie?.() || []) {
      const [pair] = raw.split(';');
      if (pair.startsWith('sb_session=')) cookie = pair;
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* غیر JSON */ }
    return { status: res.status, json, text, headers: res.headers };
  };
}

const anon = client();

async function ownerSession() {
  const meta = (await anon('/api/meta')).json;
  const adminAccount = meta.demoAccounts.find((a) => a.role === 'admin');
  const owner = client();
  const login = await owner('/api/auth/login', {
    method: 'POST',
    body: { email: adminAccount.email, password: adminAccount.password },
  });
  assert.equal(login.status, 200, 'ورود مالک باید موفق باشد');
  return { owner, adminAccount };
}

async function ensureTotp(owner) {
  const setup = await owner('/api/finance/security/2fa/setup', { method: 'POST', body: {} });
  assert.equal(setup.status, 200);
  const enabled = await owner('/api/finance/security/2fa/enable', {
    method: 'POST', body: { code: totpCode(setup.json.secret) },
  });
  assert.equal(enabled.status, 200);
  return setup.json.secret;
}

/* ------------------------- شبیه‌ساز CBOR برای WebAuthn ------------------------- */
function cborHead(major, len) {
  if (len < 24) return Buffer.from([(major << 5) | len]);
  if (len < 256) return Buffer.from([(major << 5) | 24, len]);
  if (len < 65536) {
    const buf = Buffer.alloc(3);
    buf[0] = (major << 5) | 25;
    buf.writeUInt16BE(len, 1);
    return buf;
  }
  const buf = Buffer.alloc(5);
  buf[0] = (major << 5) | 26;
  buf.writeUInt32BE(len, 1);
  return buf;
}
const cborInt = (n) => (n >= 0 ? cborHead(0, n) : cborHead(1, -1 - n));
const cborBytes = (buf) => Buffer.concat([cborHead(2, buf.length), buf]);
const cborText = (text) => {
  const buf = Buffer.from(text, 'utf8');
  return Buffer.concat([cborHead(3, buf.length), buf]);
};
const cborMap = (pairs) => Buffer.concat([
  cborHead(5, pairs.length),
  ...pairs.flatMap(([key, value]) => [typeof key === 'string' ? cborText(key) : cborInt(key), value]),
]);

function makeAuthenticator() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const x = Buffer.from(jwk.x, 'base64url');
  const y = Buffer.from(jwk.y, 'base64url');
  const cose = cborMap([
    [1, cborInt(2)],
    [3, cborInt(-7)],
    [-1, cborInt(1)],
    [-2, cborBytes(x)],
    [-3, cborBytes(y)],
  ]);
  return { privateKey, cose, credentialId: crypto.randomBytes(16) };
}

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const clientData = (type, challenge) => b64u(JSON.stringify({ type, challenge, origin: base }));
const rpIdHash = () => crypto.createHash('sha256').update('127.0.0.1').digest();

/* ---------------------------------- آزمون‌ها ---------------------------------- */
let owner;
let adminAccount;
let totpSecret;
let backupId;
let backupFile;

test('بکاپ رمزگذاری‌شده: ساخت، فهرست، بررسی صحت و دانلود', async () => {
  ({ owner, adminAccount } = await ownerSession());
  totpSecret = await ensureTotp(owner);

  const status0 = await owner('/api/finance/backup/status');
  assert.equal(status0.status, 200);
  assert.equal(status0.json.encryption.algorithm, 'aes-256-gcm');
  assert.equal(status0.json.encryption.keyIndependentFromSession, true, 'کلید باید مستقل از SESSION_SECRET باشد');
  assert.equal(status0.json.persistentDisk, false, 'محدودیت پلن رایگان باید صریح گزارش شود');

  const created = await owner('/api/finance/backup/create', {
    method: 'POST', body: { reason: 'test-manual' },
  });
  assert.equal(created.status, 201);
  backupId = created.json.backup.id;
  assert.equal(typeof backupId, 'string');
  assert.ok(backupId.length >= 8, 'پشتیبان باید شناسهٔ یکتا داشته باشد');
  assert.ok(created.json.backup.size > 0);
  assert.equal(created.json.backup.environment, 'demo');

  const row = getDb().backupHistory.find((item) => item.id === backupId);
  assert.ok(row?.file, 'فایل پشتیبان باید روی دیسک ثبت شود');
  const expected = path.join(tmpDir, 'backups', row.file);
  const found = fs.existsSync(expected)
    ? expected
    : fs.readdirSync(tmpDir, { recursive: true })
      .map((entry) => path.join(tmpDir, String(entry)))
      .find((candidate) => candidate.endsWith(row.file));
  assert.ok(found, `فایل پشتیبان باید موجود باشد: ${row.file}`);
  backupFile = found;

  const raw = fs.readFileSync(backupFile);
  assert.equal(raw.subarray(0, 6).toString(), 'SBBAK1', 'فایل باید با جادوی فرمت شروع شود');
  assert.equal(raw.includes(Buffer.from('passwordHash')), false, 'محتوای حساس نباید متن‌آشکار باشد');
  assert.equal(raw.includes(Buffer.from(adminAccount.email)), false, 'ایمیل کاربران نباید متن‌آشکار باشد');

  const verified = await owner('/api/finance/backup/verify', { method: 'POST', body: { id: backupId } });
  assert.equal(verified.status, 200);
  assert.equal(verified.json.chain.valid, true, 'زنجیرهٔ تراکنش‌ها در پشتیبان باید معتبر باشد');
  assert.ok(verified.json.counts.users >= 1);

  const download = await owner(`/api/finance/backup/${backupId}/download`);
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition') || '', /attachment/);

  const status1 = await owner('/api/finance/backup/status');
  assert.equal(status1.json.count, 1);
  assert.equal(status1.json.lastBackupAt, created.json.backup.createdAt);

  const noSecond = await owner('/api/finance/backup/create', {
    method: 'POST', body: { reason: 'with-secrets', includeSecrets: true },
  });
  assert.equal(noSecond.status, 403, 'پشتیبان شامل رازها بدون تأیید دومرحله‌ای ممنوع است');
});

test('بکاپ: کلید اشتباه و فایل دستکاری‌شده رد می‌شوند', async () => {
  assert.ok(backupId && backupFile, 'پشتیبان آزمون قبلی باید موجود باشد');
  process.env.BACKUP_KEY = crypto.randomBytes(32).toString('hex');
  resetBackupKeyCache();
  const wrongKey = await owner('/api/finance/backup/verify', { method: 'POST', body: { id: backupId } });
  assert.equal(wrongKey.status, 400);
  assert.match(String(wrongKey.json.error), /key|corrupt|tamper/i, 'خطای کلید اشتباه باید صریح باشد');

  delete process.env.BACKUP_KEY;
  resetBackupKeyCache();

  const original = fs.readFileSync(backupFile);
  const tampered = Buffer.from(original);
  const offset = Math.floor(tampered.length / 2);
  tampered[offset] ^= 0xff;
  fs.writeFileSync(backupFile, tampered);

  const tamperedRes = await owner('/api/finance/backup/verify', { method: 'POST', body: { id: backupId } });
  assert.equal(tamperedRes.status, 400);
  assert.match(String(tamperedRes.json.error), /corrupt|tamper|mismatch|invalid/i);

  fs.writeFileSync(backupFile, original);
  const recovered = await owner('/api/finance/backup/verify', { method: 'POST', body: { id: backupId } });
  assert.equal(recovered.status, 200, 'پس از بازگرداندن فایل سالم، بررسی باید موفق شود');
});

test('جداسازی محیط آزمایشی و واقعی با تأیید دومرحله‌ای', async () => {
  const env = await anon('/api/env');
  assert.equal(env.status, 200);
  assert.equal(env.json.mode, 'demo');
  assert.equal(env.json.paymentsEnabled, false);
  assert.equal(env.json.payoutsEnabled, false);
  assert.equal(env.json.bulkMessagingEnabled, false);

  const noConfirm = await owner('/api/finance/environment', { method: 'POST', body: { mode: 'live' } });
  assert.equal(noConfirm.status, 400);
  assert.equal(noConfirm.json.error, 'confirm_required');

  const noSecond = await owner('/api/finance/environment', {
    method: 'POST', body: { mode: 'live', confirm: 'SWITCH' },
  });
  assert.equal(noSecond.status, 403);

  const badMode = await owner('/api/finance/environment', {
    method: 'POST', body: { mode: 'staging', confirm: 'SWITCH', password: adminAccount.password, code: totpCode(totpSecret) },
  });
  assert.equal(badMode.status, 400);
  assert.equal(badMode.json.error, 'mode_invalid');

  const ok = await owner('/api/finance/environment', {
    method: 'POST', body: { mode: 'live', confirm: 'SWITCH', password: adminAccount.password, code: totpCode(totpSecret) },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.env.mode, 'live');

  const back = await owner('/api/finance/environment', {
    method: 'POST', body: { mode: 'demo', confirm: 'SWITCH', password: adminAccount.password, code: totpCode(totpSecret) },
  });
  assert.equal(back.json.env.mode, 'demo');
});

test('نشست‌ها: فهرست، ابطال انتخابی و خروج از سایر دستگاه‌ها', async () => {
  const second = client();
  const login = await second('/api/auth/login', {
    method: 'POST', body: { email: adminAccount.email, password: adminAccount.password },
  });
  assert.equal(login.status, 200);

  const list = await owner('/api/finance/sessions');
  assert.equal(list.status, 200);
  assert.ok(list.json.sessions.length >= 2, 'باید حداقل دو نشست فعال باشد');
  assert.equal(list.json.sessions.filter((row) => row.current).length, 1, 'فقط یک نشست جاری است');
  const other = list.json.sessions.find((row) => !row.current);
  assert.ok(other?.id);
  assert.ok(other.os && other.browser, 'دستگاه و مرورگر باید نمایش داده شود');

  const revoked = await owner(`/api/finance/sessions/${other.id}`, { method: 'DELETE' });
  assert.equal(revoked.status, 200);

  const denied = await second('/api/finance/overview');
  assert.equal(denied.status, 401, 'نشست باطل‌شده نباید به API مالی دسترسی داشته باشد');

  const third = client();
  await third('/api/auth/login', { method: 'POST', body: { email: adminAccount.email, password: adminAccount.password } });
  const others = await owner('/api/finance/sessions/revoke-others', { method: 'POST', body: {} });
  assert.equal(others.status, 200);
  assert.ok(others.json.revoked >= 1);
  assert.equal((await third('/api/finance/overview')).status, 401);

  const stillMine = await owner('/api/finance/overview');
  assert.equal(stillMine.status, 200, 'نشست جاری نباید باطل شود');
});

test('کدهای بازیابی: ذخیرهٔ هش‌شده و ورود یک‌بارمصرف', async () => {
  const noSecond = await owner('/api/finance/recovery/generate', { method: 'POST', body: {} });
  assert.equal(noSecond.status, 403, 'ساخت کد بازیابی بدون تأیید دومرحله‌ای ممنوع است');

  const generated = await owner('/api/finance/recovery/generate', {
    method: 'POST', body: { password: adminAccount.password, code: totpCode(totpSecret) },
  });
  assert.equal(generated.status, 201);
  assert.equal(generated.json.codes.length, 10);
  assert.equal(generated.json.shownOnce, true);

  const stored = getDb().users.find((u) => u.email === adminAccount.email);
  const serialized = JSON.stringify(stored.recoveryCodes || []);
  assert.equal(serialized.includes(generated.json.codes[0]), false, 'کد بازیابی نباید متن‌آشکار ذخیره شود');

  const code = generated.json.codes[0];
  const recoveryClient = client();
  const login = await recoveryClient('/api/auth/recovery/login', {
    method: 'POST', body: { email: adminAccount.email, code },
  });
  assert.equal(login.status, 200);
  assert.equal(login.json.user.email, adminAccount.email);
  assert.equal(login.json.recovery.remaining, 9);

  const replay = await client()('/api/auth/recovery/login', {
    method: 'POST', body: { email: adminAccount.email, code },
  });
  assert.equal(replay.status, 401, 'کد بازیابی نباید دوباره قابل استفاده باشد');

  const status = await owner('/api/finance/recovery/status');
  assert.equal(status.json.recovery.remaining, 9);
});

test('Passkey: ثبت کلید و ورود کامل با امضای EC2', async () => {
  const authenticator = makeAuthenticator();

  const options = await owner('/api/finance/webauthn/register/options', { method: 'POST', body: {} });
  assert.equal(options.status, 200);
  assert.ok(options.json.challenge);
  assert.equal(options.json.rp.id, '127.0.0.1');
  assert.deepEqual(options.json.pubKeyCredParams, [{ type: 'public-key', alg: -7 }]);

  const authData = Buffer.concat([
    rpIdHash(),
    Buffer.from([0x41]),
    Buffer.from([0, 0, 0, 1]),
    Buffer.alloc(16),
    (() => {
      const len = Buffer.alloc(2);
      len.writeUInt16BE(authenticator.credentialId.length, 0);
      return len;
    })(),
    authenticator.credentialId,
    authenticator.cose,
  ]);
  const attestationObject = cborMap([
    ['fmt', cborText('none')],
    ['attStmt', cborMap([])],
    ['authData', cborBytes(authData)],
  ]);

  const badChallenge = await owner('/api/finance/webauthn/register/verify', {
    method: 'POST',
    body: {
      challenge: 'wrong-challenge',
      credential: {
        id: b64u(authenticator.credentialId),
        response: { clientDataJSON: clientData('webauthn.create', 'wrong-challenge'), attestationObject: b64u(attestationObject) },
      },
    },
  });
  assert.equal(badChallenge.status, 400, 'چالش نامعتبر باید رد شود');

  const retryOptions = await owner('/api/finance/webauthn/register/options', { method: 'POST', body: {} });
  const challenge = retryOptions.json.challenge;
  const registered = await owner('/api/finance/webauthn/register/verify', {
    method: 'POST',
    body: {
      challenge,
      label: 'کلید امنیتی',
      credential: {
        id: b64u(authenticator.credentialId),
        transports: ['internal'],
        response: {
          clientDataJSON: clientData('webauthn.create', challenge),
          attestationObject: b64u(attestationObject),
        },
      },
    },
  });
  assert.equal(registered.status, 201, `ثبت کلید باید موفق باشد: ${registered.text}`);
  assert.equal(registered.json.credentials.length, 1);
  assert.equal(registered.json.credential.label, 'کلید امنیتی');

  const list = await owner('/api/finance/webauthn/credentials');
  assert.equal(list.json.credentials.length, 1);
  assert.equal(list.json.credentials[0].signCount, 1);

  const loginOptions = await anon('/api/auth/webauthn/login/options', {
    method: 'POST', body: { email: adminAccount.email },
  });
  assert.equal(loginOptions.status, 200);
  assert.equal(loginOptions.json.allowCredentials.length, 1);

  const assertData = Buffer.concat([
    rpIdHash(),
    Buffer.from([0x01]),
    Buffer.from([0, 0, 0, 2]),
  ]);
  const loginChallenge = loginOptions.json.challenge;
  const assertionClientData = clientData('webauthn.get', loginChallenge);
  const signature = crypto.sign(
    'sha256',
    Buffer.concat([assertData, crypto.createHash('sha256').update(Buffer.from(assertionClientData, 'base64url')).digest()]),
    { key: authenticator.privateKey, dsaEncoding: 'der' },
  );

  const passkeyClient = client();
  const login = await passkeyClient('/api/auth/webauthn/login/verify', {
    method: 'POST',
    body: {
      email: adminAccount.email,
      challenge: loginChallenge,
      credential: {
        id: b64u(authenticator.credentialId),
        response: {
          clientDataJSON: assertionClientData,
          authenticatorData: b64u(assertData),
          signature: b64u(signature),
        },
      },
    },
  });
  assert.equal(login.status, 200, `ورود با Passkey باید موفق باشد: ${login.text}`);
  assert.equal(login.json.user.email, adminAccount.email);
  assert.equal((await passkeyClient('/api/finance/overview')).status, 200, 'نشست حاصل از Passkey باید معتبر باشد');

  const replayOptions = await anon('/api/auth/webauthn/login/options', {
    method: 'POST', body: { email: adminAccount.email },
  });
  const replay = await client()('/api/auth/webauthn/login/verify', {
    method: 'POST',
    body: {
      email: adminAccount.email,
      challenge: replayOptions.json.challenge,
      credential: {
        id: b64u(authenticator.credentialId),
        response: {
          clientDataJSON: assertionClientData,
          authenticatorData: b64u(assertData),
          signature: b64u(signature),
        },
      },
    },
  });
  assert.equal(replay.status, 400, 'امضای تکراری/چالش قدیمی باید رد شود');
});

test('نظارت امنیتی: رویدادها، تلاش مشکوک و کانال هشدار مالک', async () => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await anon('/api/auth/login', { method: 'POST', body: { email: 'suspicious@example.com', password: 'Wrong@12345' } });
  }

  const overview = await owner('/api/finance/monitor/overview');
  assert.equal(overview.status, 200);
  assert.ok(overview.json.totals.events > 0);
  assert.ok(overview.json.suspicious.some((row) => row.target.includes('suspicious@example.com')), 'تلاش تکراری باید مشکوک شناخته شود');
  assert.ok(overview.json.events.every((event) => event.password === undefined), 'هیچ رمزی در گزارش امنیتی نیست');
  assert.equal(overview.json.posture.paymentsEnabled, false);
  assert.equal(overview.json.posture.payoutsEnabled, false);

  const filtered = await owner('/api/finance/monitor/overview?severity=critical');
  assert.equal(filtered.status, 200);
  assert.ok(filtered.json.events.every((event) => event.severity === 'critical'));

  const saved = await owner('/api/finance/monitor/alerts', {
    method: 'POST', body: { enabled: true, minSeverity: 'critical', webhookUrl: '' },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.config.enabled, true);
  assert.equal(saved.json.config.minSeverity, 'critical');

  const test1 = await owner('/api/finance/monitor/test-alert', { method: 'POST', body: {} });
  assert.equal(test1.status, 409, 'بدون webhook، هشدار فقط داخلی ثبت می‌شود');
  assert.equal(test1.json.alert.delivered, false);

  const alerts = await owner('/api/finance/monitor/alerts');
  assert.ok(alerts.json.alerts.length >= 1);
  assert.ok(alerts.json.config);
});

test('بازیابی: پیش‌نمایش بدون تغییر داده و بازیابی واقعی با پیش‌باکاپ', async () => {
  const fresh = await owner('/api/finance/backup/create', { method: 'POST', body: { reason: 'before-restore-test' } });
  assert.equal(fresh.status, 201);
  const id = fresh.json.backup.id;
  const usersBefore = getDb().users.length;
  const productsBefore = getDb().products.length;

  const preview = await owner('/api/finance/backup/restore', { method: 'POST', body: { id } });
  assert.equal(preview.status, 200);
  assert.equal(preview.json.mode, 'dry-run');
  assert.equal(preview.json.restored.chain.valid, true);
  assert.equal(getDb().users.length, usersBefore, 'پیش‌نمایش نباید داده را تغییر دهد');

  const noConfirm = await owner('/api/finance/backup/restore', {
    method: 'POST', body: { id, mode: 'apply', password: adminAccount.password, code: totpCode(totpSecret) },
  });
  assert.equal(noConfirm.status, 400);
  assert.equal(noConfirm.json.error, 'confirm_required');

  const applied = await owner('/api/finance/backup/restore', {
    method: 'POST',
    body: { id, mode: 'apply', confirm: 'RESTORE', password: adminAccount.password, code: totpCode(totpSecret) },
  });
  assert.equal(applied.status, 200, `بازیابی باید موفق باشد: ${applied.text}`);
  assert.ok(applied.json.preRestoreBackup, 'پیش از بازیابی باید پشتیبان ایمنی ساخته شود');
  assert.equal(applied.json.restored.chain.valid, true);
  assert.equal(getDb().users.length, usersBefore);
  assert.equal(getDb().products.length, productsBefore);
  assert.ok(
    getDb().backupHistory.some((row) => row.id === applied.json.preRestoreBackup),
    'پشتیبان ایمنی باید در تاریخچه بماند',
  );

  const verifyAgain = await owner('/api/finance/backup/verify', { method: 'POST', body: { id } });
  assert.equal(verifyAgain.status, 200);
});

test('دسترسی غیرمالک به بخش‌های امنیتی و حفظ قابلیت‌های قبلی', async () => {
  const meta = (await anon('/api/meta')).json;
  const customer = meta.demoAccounts.find((a) => a.role === 'customer');
  const seller = meta.demoAccounts.find((a) => a.role === 'seller');

  for (const account of [customer, seller]) {
    const session = client();
    const login = await session('/api/auth/login', { method: 'POST', body: { email: account.email, password: account.password } });
    assert.equal(login.status, 200);
    for (const target of ['/api/finance/backup/status', '/api/finance/sessions', '/api/finance/monitor/overview', '/api/finance/webauthn/credentials']) {
      const res = await session(target);
      assert.equal(res.status, 403, `${account.role} نباید به ${target} دسترسی داشته باشد`);
    }
    assert.equal((await session('/security')).status, 403, 'صفحهٔ امنیت فقط برای مالک است');
    assert.equal((await session('/api/finance/backup/create', { method: 'POST', body: {} })).status, 403);
  }

  assert.equal((await anon('/api/finance/backup/status')).status, 401, 'بدون نشست باید ۴۰۱ باشد');
  assert.equal((await anon('/security')).status, 302, 'بدون نشست باید به ورود هدایت شود');

  const products = await anon('/api/products');
  assert.equal(products.status, 200);
  assert.ok(products.json.items.length > 0, 'فروشگاه باید سالم بماند');
  assert.equal(meta.languages.length, 4, 'چهار زبان باید حفظ شود');
  const ads = await anon('/api/ads/options');
  assert.equal(ads.status, 200);
  assert.equal(ads.json.publishing?.enabled, false, 'انتشار واقعی تبلیغات باید غیرفعال بماند');
  assert.equal(ads.json.payments?.enabled, false, 'پرداخت واقعی باید غیرفعال بماند');
  const businesses = await anon('/api/businesses');
  assert.equal(businesses.status, 200, 'بانک اطلاعات کسب‌وکارها باید سالم بماند');
  const ownerOverview = await owner('/api/finance/overview');
  assert.equal(ownerOverview.status, 200);
  assert.ok(ownerOverview.json.wallet, 'کیف پول مدیریتی باید سالم بماند');
  const page = await owner('/security');
  assert.equal(page.status, 200);
  assert.match(page.text, /مرکز امنیت هوشمند بازار/);
});

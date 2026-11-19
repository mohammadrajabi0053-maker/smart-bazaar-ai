// آزمون مراحل دوم تا چهارم فاز چهارم — ماندگاری پشتیبان، پوشش تصاویر و HMAC زنجیرهٔ مالی
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-bazaar-stages-'));
const uploadDir = path.join(tmpDir, 'uploads');
process.env.DATA_DIR = path.join(tmpDir, 'data');
process.env.UPLOAD_DIR = uploadDir;
process.env.NODE_ENV = 'test';
process.env.BACKUP_KEY = 'a'.repeat(64);
process.env.CHAIN_HMAC_KEY = 'b'.repeat(64);
fs.mkdirSync(uploadDir, { recursive: true });

const backup = await import('../src/backup.js');
const finance = await import('../src/finance.js');

const originalBackupKey = process.env.BACKUP_KEY;
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

test.after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function ledgerDb() {
  const db = { users: [], products: [], orders: [] };
  finance.appendEntry(db, {
    kind: 'income', source: 'storefront', amountUsd: 120, currency: 'USD', country: 'IR',
  });
  finance.appendEntry(db, {
    kind: 'income', source: 'ads', amountUsd: 60, currency: 'AED', country: 'AE',
  });
  return db;
}

/* ---------------------- مرحله ۴: HMAC زنجیرهٔ مالی ---------------------- */

test('زنجیرهٔ مالی با HMAC امضا می‌شود و دست‌کاری شناسایی می‌گردد', () => {
  const db = ledgerDb();
  const ok = finance.verifyChain(db);
  assert.equal(ok.valid, true);
  assert.equal(ok.signed, 2);
  assert.equal(ok.legacy, 0);
  assert.equal(db.finance.entries[0].mac, finance.entryMac(db.finance.entries[0], '0'.repeat(64)));

  const tampered = ledgerDb();
  tampered.finance.entries[0].mac = 'f'.repeat(64);
  const macFail = finance.verifyChain(tampered);
  assert.equal(macFail.valid, false);
  assert.equal(macFail.reason, 'mac_mismatch');

  const amountTampered = ledgerDb();
  amountTampered.finance.entries[1].amountUsd += 5;
  const hashFail = finance.verifyChain(amountTampered);
  assert.equal(hashFail.valid, false);
  assert.equal(hashFail.reason, 'hash_mismatch');
});

test('کلید HMAC مستقل از کلید پشتیبان است و اثر انگشت دارد', () => {
  assert.notEqual(finance.chainKey().toString('hex'), backup.backupKey().toString('hex'));
  assert.match(finance.chainFingerprint(), /^[0-9a-f]{8}$/);
  assert.equal(finance.chainKeySource(), 'env');
});

/* ------------------ مرحله ۳: پوشش تصاویر در پشتیبان ------------------ */

test('پشتیبان بایت تصاویر را در بر می‌گیرد و بازیابی آن‌ها را برمی‌گرداند', () => {
  const file = 'product-demo.png';
  const bytes = Buffer.from('89504e470d0a1a0a-fake-png-bytes', 'utf8');
  fs.writeFileSync(path.join(uploadDir, file), bytes);

  const db = ledgerDb();
  const made = backup.createBackup(db, { reason: 'test' });
  const checked = backup.verifyBackup(made.buffer);
  assert.equal(checked.chain.valid, true);
  assert.equal(checked.uploadsMeta.count >= 1, true);
  assert.equal(checked.uploadsMeta.totalBytes >= bytes.length, true);

  const restored = backup.readBackupForRestore(made.buffer);
  const entry = restored.uploads.find((item) => item.name === file);
  assert.ok(entry, 'فایل تصویری در بستهٔ پشتیبان نیست');
  assert.equal(entry.sha256, sha(bytes));

  fs.rmSync(path.join(uploadDir, file));
  const written = backup.restoreUploads(restored.uploads);
  assert.equal(written.written >= 1, true);
  const back = fs.readFileSync(path.join(uploadDir, file));
  assert.equal(sha(back), sha(bytes));
});

test('پشتیبان داده و زنجیره را کامل بازمی‌گرداند', () => {
  const db = ledgerDb();
  const made = backup.createBackup(db, { reason: 'test' });
  const restored = backup.readBackupForRestore(made.buffer);
  assert.equal(restored.data.finance.entries.length, 2);
  assert.equal(restored.chain.valid, true);
  assert.equal(restored.chain.signed, 2);
  assert.equal(restored.data.finance.entries.length, 2);
  assert.match(String(restored.chainKeyHex), /^[0-9a-f]{64}$/);
});

/* --------------- مرحله ۲: خرابی فایل، کلید اشتباه، دست‌کاری --------------- */

test('فایل خراب و دست‌کاری‌شده رد می‌شود', () => {
  const made = backup.createBackup(ledgerDb(), { reason: 'test' });
  const text = made.buffer.toString('utf8');

  assert.throws(() => backup.readBackupForRestore(Buffer.from('not-a-backup')), /backup_format_unknown|backup_corrupt/);
  assert.throws(() => backup.verifyBackup(Buffer.from('SBBAK1\n{}\n\n')), /backup_corrupt|backup_format_unknown/);

  const parts = text.split('\n');
  const body = parts[2];
  const flipped = `${body.slice(0, 10)}${body[10] === 'A' ? 'B' : 'A'}${body.slice(11)}`;
  const tampered = Buffer.from([parts[0], parts[1], flipped, parts[3]].join('\n'), 'utf8');
  assert.throws(() => backup.readBackupForRestore(tampered), /backup_tampered|backup_corrupt|backup_auth_failed/);
});

test('کلید اشتباه پشتیبان را باز نمی‌کند و کیت کلید این وضعیت را حل می‌کند', () => {
  const made = backup.createBackup(ledgerDb(), { reason: 'test' });
  const kit = backup.createRecoveryKit('owner-passphrase-1234');
  const read = backup.readRecoveryKit(kit.buffer, 'owner-passphrase-1234');

  process.env.BACKUP_KEY = 'c'.repeat(64);
  backup.resetBackupKeyCache();
  assert.throws(() => backup.readBackupForRestore(made.buffer), /backup_key_mismatch|backup_auth_failed|backup_corrupt/);

  const installed = backup.installKeys({ backupKeyHex: read.backupKeyHex, chainKeyHex: read.chainKeyHex });
  assert.equal(installed.backupKey, true);
  assert.equal(installed.chainKey, true);

  process.env.BACKUP_KEY = originalBackupKey;
  backup.resetBackupKeyCache();
  const reopened = backup.readBackupForRestore(made.buffer);
  assert.equal(reopened.data.finance.entries.length, 2);
  assert.equal(reopened.chain.valid, true);
});

/* ----------------------- کیت بازیابی: رمز و دست‌کاری ----------------------- */

test('کیت کلیدها با گذرواژهٔ اشتباه یا محتوای دست‌کاری‌شده باز نمی‌شود', () => {
  const kit = backup.createRecoveryKit('owner-passphrase-1234');
  assert.throws(() => backup.readRecoveryKit(kit.buffer, 'wrong-passphrase-1234'), /kit_passphrase_invalid/);
  assert.throws(() => backup.readRecoveryKit('garbage', 'owner-passphrase-1234'), /kit_format_unknown|kit_corrupt/);
  assert.throws(() => backup.createRecoveryKit('short'), /passphrase_weak/);

  const parts = kit.buffer.toString('utf8').split('\n');
  const tampered = Buffer.from([parts[0], parts[1], `${parts[2].slice(0, 8)}AAAA${parts[2].slice(12)}`, parts[3]].join('\n'), 'utf8');
  assert.throws(() => backup.readRecoveryKit(tampered, 'owner-passphrase-1234'), /kit_passphrase_invalid|kit_corrupt/);
});

/* ------------------------- بررسی صحت پیش از تحویل ------------------------- */

test('بررسی صحت پیش از ارائهٔ فایل، زنجیره و تصاویر را گزارش می‌کند', () => {
  const made = backup.createBackup(ledgerDb(), { reason: 'test' });
  const checked = backup.verifyBackup(made.buffer);
  assert.equal(checked.chain.valid, true);
  assert.equal(checked.environment, 'demo');
  assert.equal(typeof checked.uploads, 'number');
  assert.equal(typeof checked.counts.users, 'number');
});

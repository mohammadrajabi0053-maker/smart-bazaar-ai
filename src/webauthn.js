// بازار هوشمند — WebAuthn / Passkey (ES256) بدون وابستگی خارجی
// امضاها با crypto ماژول Node بررسی می‌شوند؛ چالش‌ها کوتاه‌عمر و یک‌بارمصرف‌اند.
import crypto from 'node:crypto';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_CHALLENGES = 500;

export class WebAuthnError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'WebAuthnError';
    this.code = code;
    this.status = status;
  }
}

const challenges = new Map();

export function issueChallenge(kind = 'login') {
  const challenge = crypto.randomBytes(32).toString('base64url');
  challenges.set(challenge, { kind, at: Date.now() });
  if (challenges.size > MAX_CHALLENGES) {
    for (const [key, value] of challenges) {
      if (Date.now() - value.at > CHALLENGE_TTL_MS) challenges.delete(key);
    }
  }
  return challenge;
}

export function consumeChallenge(challenge, kind = 'login') {
  const entry = challenges.get(String(challenge || ''));
  if (!entry) return false;
  challenges.delete(String(challenge));
  if (Date.now() - entry.at > CHALLENGE_TTL_MS) return false;
  return entry.kind === kind;
}

export function resetChallenges() {
  challenges.clear();
}

/* ------------------------------- CBOR ------------------------------- */

function readLength(buf, info, offset) {
  if (info < 24) return [info, offset];
  if (info === 24) return [buf.readUInt8(offset), offset + 1];
  if (info === 25) return [buf.readUInt16BE(offset), offset + 2];
  if (info === 26) return [buf.readUInt32BE(offset), offset + 4];
  if (info === 27) return [Number(buf.readBigUInt64BE(offset)), offset + 8];
  if (info === 31) return [-1, offset];
  throw new WebAuthnError('cbor_invalid');
}

export function decodeCbor(buf, offset = 0) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  if (offset >= buf.length) throw new WebAuthnError('cbor_invalid');
  const first = buf[offset];
  const major = first >> 5;
  const info = first & 0x1f;
  let [length, pos] = readLength(buf, info, offset + 1);
  switch (major) {
    case 0:
      return [length, pos];
    case 1:
      return [-1 - length, pos];
    case 2: {
      if (length < 0) throw new WebAuthnError('cbor_invalid');
      return [Buffer.from(buf.subarray(pos, pos + length)), pos + length];
    }
    case 3: {
      if (length < 0) throw new WebAuthnError('cbor_invalid');
      return [buf.subarray(pos, pos + length).toString('utf8'), pos + length];
    }
    case 4: {
      if (length < 0) throw new WebAuthnError('cbor_invalid');
      const arr = [];
      for (let i = 0; i < length; i += 1) {
        const [value, next] = decodeCbor(buf, pos);
        arr.push(value);
        pos = next;
      }
      return [arr, pos];
    }
    case 5: {
      if (length < 0) throw new WebAuthnError('cbor_invalid');
      const map = new Map();
      for (let i = 0; i < length; i += 1) {
        const [key, nextKey] = decodeCbor(buf, pos);
        const [value, nextValue] = decodeCbor(buf, nextKey);
        map.set(String(key), value);
        pos = nextValue;
      }
      return [map, pos];
    }
    case 7: {
      if (info === 20) return [false, pos];
      if (info === 21) return [true, pos];
      if (info === 22) return [null, pos];
      return [null, pos];
    }
    default:
      throw new WebAuthnError('cbor_unsupported');
  }
}

/* --------------------------- داده‌های احراز --------------------------- */

function coseToJwk(cose) {
  const get = (key) => (cose instanceof Map ? cose.get(String(key)) : cose?.[key]);
  if (get(1) !== 2) throw new WebAuthnError('unsupported_key_type');
  if (get(-1) !== 1) throw new WebAuthnError('unsupported_curve');
  const x = get(-2);
  const y = get(-3);
  if (!Buffer.isBuffer(x) || !Buffer.isBuffer(y)) throw new WebAuthnError('key_invalid');
  return { kty: 'EC', crv: 'P-256', x: x.toString('base64url'), y: y.toString('base64url'), ext: true };
}

export function parseAuthenticatorData(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input || []);
  if (buf.length < 37) throw new WebAuthnError('auth_data_invalid');
  const rpIdHash = buf.subarray(0, 32);
  const flags = buf.readUInt8(32);
  const signCount = buf.readUInt32BE(33);
  const out = { rpIdHash, flags, signCount, credentialId: null, publicKeyJwk: null, aaguid: null };
  if (flags & 0x40) {
    if (buf.length < 55) throw new WebAuthnError('auth_data_invalid');
    out.aaguid = buf.subarray(37, 53).toString('hex');
    const credLen = buf.readUInt16BE(53);
    out.credentialId = buf.subarray(55, 55 + credLen);
    const [cose] = decodeCbor(buf, 55 + credLen);
    out.publicKeyJwk = coseToJwk(cose);
  }
  return out;
}

function parseClientData(clientDataJSON, expectedType) {
  let data;
  try {
    data = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8'));
  } catch {
    throw new WebAuthnError('client_data_invalid');
  }
  if (data?.type !== expectedType) throw new WebAuthnError('client_data_type');
  return data;
}

function checkOriginAndChallenge(clientData, { expectedOrigin, expectedChallenge }) {
  if (String(clientData.origin || '') !== String(expectedOrigin)) throw new WebAuthnError('origin_mismatch');
  if (String(clientData.challenge || '') !== String(expectedChallenge)) throw new WebAuthnError('challenge_mismatch');
}

function publicKeyFromJwk(jwk) {
  try {
    return crypto.createPublicKey({ key: jwk, format: 'jwk' });
  } catch {
    throw new WebAuthnError('key_invalid');
  }
}

/** بررسی ثبت کلید جدید (attestation) */
export function verifyRegistration({
  clientDataJSON,
  attestationObject,
  expectedChallenge,
  expectedOrigin,
  rpId,
}) {
  const clientData = parseClientData(clientDataJSON, 'webauthn.create');
  checkOriginAndChallenge(clientData, { expectedOrigin, expectedChallenge });
  let att;
  try {
    [att] = decodeCbor(Buffer.from(attestationObject, 'base64url'));
  } catch {
    throw new WebAuthnError('attestation_invalid');
  }
  if (!(att instanceof Map)) throw new WebAuthnError('attestation_invalid');
  const fmt = att.get('fmt');
  const authData = att.get('authData');
  if (!Buffer.isBuffer(authData)) throw new WebAuthnError('attestation_invalid');
  const parsed = parseAuthenticatorData(authData);
  if (!parsed.credentialId || !parsed.publicKeyJwk) throw new WebAuthnError('credential_missing');
  const rpIdHash = crypto.createHash('sha256').update(String(rpId)).digest();
  if (!crypto.timingSafeEqual(rpIdHash, parsed.rpIdHash)) throw new WebAuthnError('rp_id_mismatch');

  if (fmt === 'packed') {
    const attStmt = att.get('attStmt');
    const sig = attStmt instanceof Map ? attStmt.get('sig') : null;
    if (Buffer.isBuffer(sig)) {
      const key = publicKeyFromJwk(parsed.publicKeyJwk);
      const signed = Buffer.concat([authData, crypto.createHash('sha256').update(Buffer.from(clientDataJSON, 'base64url')).digest()]);
      const ok = crypto.verify('sha256', signed, { key, dsaEncoding: 'der' }, sig);
      if (!ok) throw new WebAuthnError('attestation_signature_invalid');
    }
  } else if (fmt !== 'none') {
    throw new WebAuthnError('attestation_unsupported');
  }

  return {
    credentialId: parsed.credentialId.toString('base64url'),
    publicKeyJwk: parsed.publicKeyJwk,
    signCount: parsed.signCount,
    fmt,
  };
}

/** بررسی ورود با Passkey */
export function verifyAssertion({
  clientDataJSON,
  authenticatorData,
  signature,
  expectedChallenge,
  expectedOrigin,
  rpId,
  publicKeyJwk,
  storedSignCount = 0,
}) {
  const clientData = parseClientData(clientDataJSON, 'webauthn.get');
  checkOriginAndChallenge(clientData, { expectedOrigin, expectedChallenge });
  const authBuf = Buffer.from(authenticatorData, 'base64url');
  const parsed = parseAuthenticatorData(authBuf);
  const rpIdHash = crypto.createHash('sha256').update(String(rpId)).digest();
  if (!crypto.timingSafeEqual(rpIdHash, parsed.rpIdHash)) throw new WebAuthnError('rp_id_mismatch');
  const signed = Buffer.concat([
    authBuf,
    crypto.createHash('sha256').update(Buffer.from(clientDataJSON, 'base64url')).digest(),
  ]);
  const key = publicKeyFromJwk(publicKeyJwk);
  const ok = crypto.verify('sha256', signed, { key, dsaEncoding: 'der' }, Buffer.from(signature, 'base64url'));
  if (!ok) throw new WebAuthnError('signature_invalid');
  const stored = Number(storedSignCount) || 0;
  if (parsed.signCount > 0 && stored > 0 && parsed.signCount <= stored) {
    throw new WebAuthnError('sign_count_replay');
  }
  return { signCount: parsed.signCount, userVerified: Boolean(parsed.flags & 0x04) };
}

export function credentialView(credential) {
  return {
    id: credential.id,
    label: credential.label || 'Passkey',
    createdAt: credential.createdAt,
    lastUsedAt: credential.lastUsedAt || null,
    transports: credential.transports || [],
    signCount: Number(credential.signCount) || 0,
  };
}

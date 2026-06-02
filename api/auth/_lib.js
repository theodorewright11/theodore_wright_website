// Shared helpers for the /api/auth/* serverless functions (Vercel, Node runtime).
//
// These power the OAuth 2.0 authorization-code flow that replaced the broken
// browser-side silent refresh. The browser does a one-time interactive sign-in
// to obtain an auth code; `exchange` swaps it (with the client secret) for an
// access token + a long-lived refresh token; the refresh token is sealed in an
// HttpOnly cookie; `refresh` mints fresh access tokens from it with no popup.

import crypto from 'node:crypto';

const COOKIE_NAME = 'tw_grt'; // "google refresh token" — opaque, AES-GCM sealed
const COOKIE_PATH = '/api/auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

// --- env -----------------------------------------------------------------

export function env() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const encKey = process.env.TOKEN_ENC_KEY;
  if (!clientId || !clientSecret || !encKey) {
    throw new Error(
      'Missing env: need GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENC_KEY',
    );
  }
  return { clientId, clientSecret, encKey };
}

// --- AES-256-GCM seal/open ----------------------------------------------
// Key is a base64url-encoded 32-byte secret (see TOKEN_ENC_KEY). Output is
// base64url of iv(12) || tag(16) || ciphertext.

function keyBytes(encKey) {
  const k = Buffer.from(encKey, 'base64url');
  if (k.length !== 32) throw new Error('TOKEN_ENC_KEY must decode to 32 bytes');
  return k;
}

export function seal(plaintext, encKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(encKey), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64url');
}

export function open(sealed, encKey) {
  const buf = Buffer.from(sealed, 'base64url');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes(encKey), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

// --- cookies -------------------------------------------------------------

export function readCookie(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === COOKIE_NAME) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

function cookieAttrs() {
  const secure = process.env.NODE_ENV === 'production';
  return [
    `Path=${COOKIE_PATH}`,
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ].filter(Boolean);
}

export function setSessionCookie(res, sealedValue) {
  const cookie = [
    `${COOKIE_NAME}=${encodeURIComponent(sealedValue)}`,
    ...cookieAttrs(),
    `Max-Age=${COOKIE_MAX_AGE}`,
  ].join('; ');
  res.setHeader('Set-Cookie', cookie);
}

export function clearSessionCookie(res) {
  const cookie = [`${COOKIE_NAME}=`, ...cookieAttrs(), 'Max-Age=0'].join('; ');
  res.setHeader('Set-Cookie', cookie);
}

// --- misc ----------------------------------------------------------------

// Pull the email out of a Google ID token (JWT) without verifying the
// signature — it came straight from Google's token endpoint over TLS, so for
// the purpose of a display label that's sufficient.
export function emailFromIdToken(idToken) {
  if (!idToken) return undefined;
  try {
    const payload = idToken.split('.')[1];
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(json).email;
  } catch {
    return undefined;
  }
}

export async function readJsonBody(req) {
  if (req.body) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

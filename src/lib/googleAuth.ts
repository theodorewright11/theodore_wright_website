// Browser-side Google auth for the dashboards (Time Tracker, Qual Coding, and
// later Finance). Replaces the old per-dashboard GIS implicit-token flow whose
// silent refresh (prompt:'none') was permanently broken by COOP — see
// ARCHITECTURE.md "Google sign-in / COOP".
//
// Model: a ONE-TIME interactive sign-in (GIS code-client popup) yields an auth
// code; the /api/auth/exchange function swaps it for an access token + a
// long-lived refresh token sealed in an HttpOnly cookie. Every renewal after
// that is a popup-free POST to /api/auth/refresh. The access token lives only
// in memory + sessionStorage (short-lived cache for instant paint).
//
// Scopes are unified across dashboards so a single sign-in covers all of them:
// Sheets (time-tracker/finance) + Drive.file (qual-coding).

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE =
  'openid email profile ' +
  'https://www.googleapis.com/auth/spreadsheets ' +
  'https://www.googleapis.com/auth/drive.file';
const TOKEN_KEY = 'tw-google-token';

export type StoredToken = {
  access_token: string;
  expires_at: number; // ms epoch
  email?: string;
};

export class GoogleAuthError extends Error {
  constructor(public code: string, public detail?: unknown) {
    super(detail ? `${code}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : code);
    this.name = 'GoogleAuthError';
  }
}

// --- short-lived access-token cache (instant paint on reload) -------------

export function loadCachedToken(): StoredToken | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    if (!t.access_token || !t.expires_at || t.expires_at <= Date.now()) {
      window.sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return t;
  } catch {
    return null;
  }
}

function cache(t: StoredToken | null): void {
  if (typeof window === 'undefined') return;
  if (t) window.sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
  else window.sessionStorage.removeItem(TOKEN_KEY);
}

function toStored(data: { access_token: string; expires_in: number; email?: string }): StoredToken {
  return {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000, // -60s safety margin
    email: data.email,
  };
}

// --- GIS bootstrap (only needed for the one-time code-client popup) -------

declare global {
  interface Window {
    google?: any;
  }
}

let gisLoadPromise: Promise<void> | null = null;

export function loadGIS(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('GIS only loads in the browser'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => { gisLoadPromise = null; reject(new Error('Failed to load Google Identity Services')); };
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

// --- public API ----------------------------------------------------------

// One-time interactive sign-in. Opens the GIS consent popup, gets an auth code,
// and exchanges it server-side for a sealed refresh token. Returns the first
// access token. Subsequent renewals use refresh() — no popup.
export async function signIn(clientId: string): Promise<StoredToken> {
  await loadGIS();
  const google = window.google!;
  const code = await new Promise<string>((resolve, reject) => {
    const codeClient = google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: SCOPE,
      ux_mode: 'popup',
      callback: (resp: any) => {
        if (resp.error) reject(new GoogleAuthError(resp.error, resp.error_description));
        else if (!resp.code) reject(new GoogleAuthError('no_code'));
        else resolve(resp.code);
      },
      error_callback: (err: any) => reject(new GoogleAuthError(err?.type || 'signin_failed', err?.message)),
    });
    codeClient.requestCode();
  });

  const r = await fetch('/api/auth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new GoogleAuthError(data.error || 'exchange_failed', data.detail);
  const t = toStored(data);
  cache(t);
  return t;
}

// Popup-free token renewal from the sealed refresh-token cookie. Returns null
// when there is no valid session (caller should show interactive sign-in).
export async function refresh(): Promise<StoredToken | null> {
  const r = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
  if (r.status === 401) { cache(null); return null; }
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new GoogleAuthError(data.error || 'refresh_failed', data.detail);
  }
  const data = await r.json();
  const t = toStored(data);
  cache(t);
  return t;
}

export async function signOut(): Promise<void> {
  cache(null);
  try {
    await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    /* cookie clear is best-effort; local cache is already gone */
  }
}

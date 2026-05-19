// Google Sheets sync layer for the time-tracker. Browser-side OAuth via Google
// Identity Services (GIS); direct REST calls to the Sheets v4 API. No server,
// no service account, no client secret. The user signs in with the Google
// account that owns the sheet; the token lives in memory + sessionStorage.
//
// Mirrors the finance dashboard's sheets.ts. One difference: `ensureTabs`
// creates any missing tabs on a fresh sheet, so first-time setup only needs an
// empty spreadsheet, not hand-made tabs.

import type { Session, Pomodoro, RewardSpend, Break } from './types';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets email profile';
const TOKEN_KEY = 'tw-timetracker-google-token';

export const SHEET_TABS = {
  sessions: 'sessions',
  categories: 'categories',
  pomodoros: 'pomodoros',
  rewardSpends: 'reward_spends',
} as const;

// Canonical header order. Writes use this order; reads tolerate any order
// (matched by name). `breaks_json` holds the JSON-encoded Break[] for a
// session — breaks are a small 1-to-many list always loaded with their
// session, so a sub-tab would be overkill.
export const HEADERS = {
  sessions: ['id', 'category', 'clock_in', 'clock_out', 'breaks_json', 'notes',
             'mood', 'productivity', 'enjoyment',
             'activity1', 'activity2', 'activity1_pct', 'created_at', 'updated_at'] as const,
  categories: ['name'] as const,
  pomodoros: ['id', 'completed_at', 'length_min', 'reward_minutes', 'credited'] as const,
  rewardSpends: ['id', 'started_at', 'ended_at', 'minutes'] as const,
};

export type StoredToken = {
  access_token: string;
  expires_at: number;   // ms epoch
  email?: string;
};

// --- Token persistence ---------------------------------------------------

export function loadStoredToken(): StoredToken | null {
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

function saveToken(t: StoredToken): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
}

export function clearStoredToken(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(TOKEN_KEY);
}

// --- Google Identity Services bootstrap ----------------------------------

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

export type SignInOptions = {
  clientId: string;
  prompt?: 'consent' | '' | 'none';
};

export async function signIn(opts: SignInOptions): Promise<StoredToken> {
  await loadGIS();
  const google = window.google!;
  return new Promise<StoredToken>((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: opts.clientId,
      scope: SCOPE,
      callback: async (resp: any) => {
        if (resp.error) { reject(new Error(resp.error_description || resp.error)); return; }
        const expires_at = Date.now() + (resp.expires_in - 60) * 1000;  // -60s safety margin
        const t: StoredToken = { access_token: resp.access_token, expires_at };
        try {
          t.email = await fetchEmail(t.access_token);
        } catch { /* userinfo failure is non-fatal */ }
        saveToken(t);
        resolve(t);
      },
    });
    tokenClient.requestAccessToken({ prompt: opts.prompt ?? 'consent' });
  });
}

export function signOut(token?: string): void {
  if (typeof window === 'undefined') return;
  if (token && window.google?.accounts?.oauth2) {
    try { window.google.accounts.oauth2.revoke(token, () => {}); } catch { /* best-effort */ }
  }
  clearStoredToken();
}

async function fetchEmail(accessToken: string): Promise<string | undefined> {
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return undefined;
  const j = await r.json();
  return j.email;
}

// --- Sheets REST helpers --------------------------------------------------

function sheetsUrl(sheetId: string, path: string): string {
  return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}${path}`;
}

export class SheetsAuthError extends Error {
  constructor(public status: number, msg: string) { super(msg); this.name = 'SheetsAuthError'; }
}

async function api<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (r.status === 401 || r.status === 403) {
    throw new SheetsAuthError(r.status, `Sheets auth failed (${r.status}). Sign in again.`);
  }
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Sheets API ${r.status}: ${body || r.statusText}`);
  }
  return r.json() as Promise<T>;
}

async function readRange(token: string, sheetId: string, range: string): Promise<string[][]> {
  const r = await api<{ values?: string[][] }>(
    token,
    sheetsUrl(sheetId, `/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`),
  );
  return r.values ?? [];
}

async function replaceTab(
  token: string,
  sheetId: string,
  tab: string,
  headers: readonly string[],
  rows: (string | number)[][],
): Promise<void> {
  const clearRange = `${tab}!A1:ZZ100000`;
  await api(token, sheetsUrl(sheetId, `/values/${encodeURIComponent(clearRange)}:clear`), { method: 'POST', body: '{}' });
  const values = [headers as readonly string[], ...rows];
  await api(
    token,
    sheetsUrl(sheetId, `/values/${encodeURIComponent(`${tab}!A1`)}?valueInputOption=RAW`),
    { method: 'PUT', body: JSON.stringify({ range: `${tab}!A1`, majorDimension: 'ROWS', values }) },
  );
}

function rowsToObjects<K extends string>(
  rows: string[][],
  canonicalHeaders: readonly K[],
): Record<K, string>[] {
  if (rows.length === 0) return [];
  const headerRow = rows[0].map(h => String(h ?? '').trim());
  const colIdx = new Map<string, number>();
  headerRow.forEach((h, i) => colIdx.set(h, i));
  return rows.slice(1)
    .filter(r => r.some(c => String(c ?? '').trim() !== ''))
    .map(r => {
      const obj = {} as Record<K, string>;
      for (const k of canonicalHeaders) {
        const idx = colIdx.get(k);
        obj[k] = idx !== undefined ? String(r[idx] ?? '') : '';
      }
      return obj;
    });
}

// Create any of the four tabs that don't exist yet, so a brand-new empty
// spreadsheet works without manual tab setup. Safe to call on every pull.
export async function ensureTabs(token: string, sheetId: string): Promise<void> {
  const meta = await api<{ sheets?: { properties?: { title?: string } }[] }>(
    token, sheetsUrl(sheetId, '?fields=sheets.properties.title'),
  );
  const existing = new Set((meta.sheets ?? []).map(s => s.properties?.title).filter(Boolean) as string[]);
  const missing = Object.values(SHEET_TABS).filter(t => !existing.has(t));
  if (missing.length === 0) return;
  await api(token, sheetsUrl(sheetId, ':batchUpdate'), {
    method: 'POST',
    body: JSON.stringify({ requests: missing.map(title => ({ addSheet: { properties: { title } } })) }),
  });
}

// --- Entity-level CRUD wrappers ------------------------------------------
// Each writes the full tab (clear + replace) — no row-index tracking, and
// manual sheet edits can't desync. Well under 2s at <1000 rows.

function parseBreaks(json: string): Break[] {
  if (!json.trim()) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(b => b && typeof b.start === 'string')
      .map(b => ({ start: b.start, end: typeof b.end === 'string' ? b.end : null }));
  } catch {
    return [];
  }
}

// Parse a stored rating: a 1–5 integer, or 0 (unrated) for anything else.
function parseRating(v: string): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 0;
}

// Parse a 0–100 percentage, defaulting to 100.
function parsePct(v: string): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 100;
}

export async function readSessions(token: string, sheetId: string): Promise<Session[]> {
  const rows = await readRange(token, sheetId, `${SHEET_TABS.sessions}!A1:ZZ100000`);
  const objs = rowsToObjects(rows, HEADERS.sessions);
  const out: Session[] = [];
  for (const r of objs) {
    if (!r.id || !r.category || !r.clock_in) continue;
    out.push({
      id: r.id,
      category: r.category,
      clock_in: r.clock_in,
      clock_out: r.clock_out || null,
      breaks: parseBreaks(r.breaks_json),
      notes: r.notes || undefined,
      mood: parseRating(r.mood),
      productivity: parseRating(r.productivity),
      enjoyment: parseRating(r.enjoyment),
      activity1: r.activity1 || '',
      activity2: r.activity2 || '',
      activity1Pct: parsePct(r.activity1_pct),
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    });
  }
  return out;
}

export async function writeSessions(token: string, sheetId: string, sessions: Session[]): Promise<void> {
  const rows = sessions.map(s => [
    s.id, s.category, s.clock_in, s.clock_out ?? '',
    JSON.stringify(s.breaks ?? []), s.notes ?? '',
    s.mood ?? 0, s.productivity ?? 0, s.enjoyment ?? 0,
    s.activity1 ?? '', s.activity2 ?? '', s.activity1Pct ?? 100,
    s.created_at, s.updated_at,
  ]);
  await replaceTab(token, sheetId, SHEET_TABS.sessions, HEADERS.sessions, rows);
}

export async function readCategories(token: string, sheetId: string): Promise<string[]> {
  const rows = await readRange(token, sheetId, `${SHEET_TABS.categories}!A1:B100000`);
  const objs = rowsToObjects(rows, HEADERS.categories);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of objs) {
    const name = r.name.trim();
    if (name && !seen.has(name)) { seen.add(name); out.push(name); }
  }
  return out;
}

export async function writeCategories(token: string, sheetId: string, categories: string[]): Promise<void> {
  await replaceTab(token, sheetId, SHEET_TABS.categories, HEADERS.categories, categories.map(c => [c]));
}

export async function readPomodoros(token: string, sheetId: string): Promise<Pomodoro[]> {
  const rows = await readRange(token, sheetId, `${SHEET_TABS.pomodoros}!A1:Z100000`);
  const objs = rowsToObjects(rows, HEADERS.pomodoros);
  const out: Pomodoro[] = [];
  for (const r of objs) {
    if (!r.id || !r.completed_at) continue;
    const len = parseFloat(r.length_min);
    const rew = parseFloat(r.reward_minutes);
    out.push({
      id: r.id,
      completed_at: r.completed_at,
      length_min: Number.isFinite(len) ? len : 25,
      reward_minutes: Number.isFinite(rew) ? rew : 0,
      credited: r.credited === 'true' || r.credited === 'TRUE',
    });
  }
  return out;
}

export async function writePomodoros(token: string, sheetId: string, ps: Pomodoro[]): Promise<void> {
  const rows = ps.map(p => [
    p.id, p.completed_at, p.length_min, p.reward_minutes, p.credited ? 'true' : 'false',
  ]);
  await replaceTab(token, sheetId, SHEET_TABS.pomodoros, HEADERS.pomodoros, rows);
}

export async function readRewardSpends(token: string, sheetId: string): Promise<RewardSpend[]> {
  const rows = await readRange(token, sheetId, `${SHEET_TABS.rewardSpends}!A1:Z100000`);
  const objs = rowsToObjects(rows, HEADERS.rewardSpends);
  const out: RewardSpend[] = [];
  for (const r of objs) {
    if (!r.id || !r.started_at) continue;
    const mins = parseFloat(r.minutes);
    out.push({
      id: r.id,
      started_at: r.started_at,
      ended_at: r.ended_at || r.started_at,
      minutes: Number.isFinite(mins) ? mins : 0,
    });
  }
  return out;
}

export async function writeRewardSpends(token: string, sheetId: string, rs: RewardSpend[]): Promise<void> {
  const rows = rs.map(r => [r.id, r.started_at, r.ended_at, r.minutes]);
  await replaceTab(token, sheetId, SHEET_TABS.rewardSpends, HEADERS.rewardSpends, rows);
}

// --- Config ---------------------------------------------------------------

export type SheetsConfig = {
  clientId: string;
  sheetId: string;
} | null;

export function readConfig(): SheetsConfig {
  const clientId = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID as string | undefined;
  const sheetId = import.meta.env.PUBLIC_TIMETRACKER_SHEET_ID as string | undefined;
  if (!clientId || !sheetId) return null;
  return { clientId, sheetId };
}

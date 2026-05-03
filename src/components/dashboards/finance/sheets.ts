// Google Sheets sync layer. Browser-side OAuth via Google Identity Services
// (GIS); direct REST calls to the Sheets v4 API. No server, no service
// account, no client secret. The user signs in with the Google account that
// owns the sheet; the access token lives in memory + sessionStorage and is
// only ever sent to Google's own endpoints.

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets email profile';
const TOKEN_KEY = 'tw-finance-google-token';

export const SHEET_TABS = {
  transactions: 'transactions',
  budgets: 'budgets',
  incomes: 'incomes',
  spendingLog: 'Spending Log',  // legacy tab — read-only, used for one-time seeding
} as const;

// Canonical header order. Writes always use this order; reads tolerate
// columns in any order (matched by name).
export const HEADERS = {
  transactions: ['id','date','item','amount','account','category','notes','created_at','updated_at'] as const,
  budgets: ['category','monthly_amount','effective_from'] as const,
  incomes: ['id','source','monthly_amount','effective_from'] as const,
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
  prompt?: 'consent' | '' | 'none';   // '' = silent if possible, 'consent' = always show consent
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

// Read all rows from a tab. Returns 2D array of cell strings (header row + data).
export async function readRange(token: string, sheetId: string, range: string): Promise<string[][]> {
  const r = await api<{ values?: string[][] }>(
    token,
    sheetsUrl(sheetId, `/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`),
  );
  return r.values ?? [];
}

// Write all rows starting at A1, after clearing the tab. Header row is the
// canonical headers; data rows are passed in canonical column order.
export async function replaceTab(
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

// Map a 2D rows-from-sheet (first row = headers) into objects keyed by header
// name. Tolerant of column reorders and extra columns; missing canonical
// columns yield empty strings.
export function rowsToObjects<K extends string>(
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

// --- Entity-level CRUD wrappers ------------------------------------------
// Each writes the full tab (clear + replace). Simpler + safer than per-row
// edits: we don't have to track row indices, and manual sheet edits don't
// desync. With <1000 rows the round-trip is well under 2s.

import type { Transaction, Budget, Income } from './types';
import { ACCOUNTS, type Account } from './types';
import { isValidCategory } from './categories';

export async function readTransactions(token: string, sheetId: string): Promise<Transaction[]> {
  const rows = await readRange(token, sheetId, `${SHEET_TABS.transactions}!A1:ZZ100000`);
  const objs = rowsToObjects(rows, HEADERS.transactions);
  const out: Transaction[] = [];
  for (const r of objs) {
    if (!r.id || !r.date || !r.item) continue;
    const amount = parseFloat(r.amount);
    if (!Number.isFinite(amount)) continue;
    const account: Account = (ACCOUNTS as readonly string[]).includes(r.account) ? (r.account as Account) : 'Other';
    out.push({
      id: r.id,
      date: r.date,
      item: r.item,
      amount,
      account,
      category: r.category && isValidCategory(r.category) ? r.category : (r.category || ''),
      notes: r.notes || undefined,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    });
  }
  return out;
}

export async function writeTransactions(token: string, sheetId: string, txs: Transaction[]): Promise<void> {
  const rows = txs.map(t => [
    t.id, t.date, t.item, t.amount, t.account, t.category,
    t.notes ?? '', t.created_at, t.updated_at,
  ]);
  await replaceTab(token, sheetId, SHEET_TABS.transactions, HEADERS.transactions, rows);
}

export async function readBudgets(token: string, sheetId: string): Promise<Budget[]> {
  const rows = await readRange(token, sheetId, `${SHEET_TABS.budgets}!A1:Z100000`);
  const objs = rowsToObjects(rows, HEADERS.budgets);
  const out: Budget[] = [];
  for (const r of objs) {
    const amount = parseFloat(r.monthly_amount);
    if (!r.category || !r.effective_from || !Number.isFinite(amount)) continue;
    out.push({ category: r.category, monthly_amount: amount, effective_from: r.effective_from });
  }
  return out;
}

export async function writeBudgets(token: string, sheetId: string, budgets: Budget[]): Promise<void> {
  const rows = budgets.map(b => [b.category, b.monthly_amount, b.effective_from]);
  await replaceTab(token, sheetId, SHEET_TABS.budgets, HEADERS.budgets, rows);
}

export async function readIncomes(token: string, sheetId: string): Promise<Income[]> {
  const rows = await readRange(token, sheetId, `${SHEET_TABS.incomes}!A1:Z100000`);
  const objs = rowsToObjects(rows, HEADERS.incomes);
  const out: Income[] = [];
  for (const r of objs) {
    const amount = parseFloat(r.monthly_amount);
    if (!r.id || !r.source || !r.effective_from || !Number.isFinite(amount)) continue;
    out.push({ id: r.id, source: r.source, monthly_amount: amount, effective_from: r.effective_from });
  }
  return out;
}

export async function writeIncomes(token: string, sheetId: string, incomes: Income[]): Promise<void> {
  const rows = incomes.map(i => [i.id, i.source, i.monthly_amount, i.effective_from]);
  await replaceTab(token, sheetId, SHEET_TABS.incomes, HEADERS.incomes, rows);
}

// --- Config ---------------------------------------------------------------

export type SheetsConfig = {
  clientId: string;
  sheetId: string;
} | null;

export function readConfig(): SheetsConfig {
  const clientId = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID as string | undefined;
  const sheetId = import.meta.env.PUBLIC_FINANCE_SHEET_ID as string | undefined;
  if (!clientId || !sheetId) return null;
  return { clientId, sheetId };
}

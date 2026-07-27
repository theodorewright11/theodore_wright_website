// Google Sheets sync layer. Direct REST calls to the Sheets v4 API using an
// access token obtained via the shared OAuth code-flow (src/lib/googleAuth.ts).
// No auth logic lives here anymore — this module is purely the Sheets transport
// (read/write per entity) plus tab bootstrapping.

import type { Transaction, Budget, Income, CategoryEntry } from './types';
import { ACCOUNTS, type Account } from './types';
import { toIsoDate } from './compute';

export const SHEET_TABS = {
  transactions: 'transactions',
  budgets: 'budgets',
  incomes: 'incomes',
  categories: 'categories',
  spendingLog: 'Spending Log',  // legacy tab — read-only, used for one-time seeding
} as const;

// Tabs the dashboard owns and auto-creates. `Spending Log` is excluded — it's a
// pre-existing legacy tab we only ever read.
const OWNED_TABS: string[] = [
  SHEET_TABS.transactions, SHEET_TABS.budgets, SHEET_TABS.incomes, SHEET_TABS.categories,
];

// Canonical header order. Writes always use this order; reads tolerate
// columns in any order (matched by name).
export const HEADERS = {
  transactions: ['id','date','item','amount','account','category','notes','created_at','updated_at'] as const,
  budgets: ['category','monthly_amount','effective_from'] as const,
  incomes: ['id','source','monthly_amount','effective_from'] as const,
  categories: ['broad','mid','detailed'] as const,
};

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

// Write all rows starting at A1; clear any rows past the new data. Order is
// write-then-clear (not clear-then-write) so the sheet is never momentarily
// empty during a transition — a concurrent pull (e.g. on window focus during
// a delete) would otherwise read zero rows and wipe local state.
export async function replaceTab(
  token: string,
  sheetId: string,
  tab: string,
  headers: readonly string[],
  rows: (string | number)[][],
): Promise<void> {
  const values = [headers as readonly string[], ...rows];
  await api(
    token,
    sheetsUrl(sheetId, `/values/${encodeURIComponent(`${tab}!A1`)}?valueInputOption=RAW`),
    { method: 'PUT', body: JSON.stringify({ range: `${tab}!A1`, majorDimension: 'ROWS', values }) },
  );
  const clearStart = values.length + 1;   // 1-indexed row after the last written row
  const clearRange = `${tab}!A${clearStart}:ZZ100000`;
  await api(token, sheetsUrl(sheetId, `/values/${encodeURIComponent(clearRange)}:clear`), { method: 'POST', body: '{}' });
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

// Create any owned tab that doesn't exist yet, so a sheet missing the
// `categories` tab (or a brand-new empty spreadsheet) works without manual
// setup. Safe to call on every pull.
export async function ensureTabs(token: string, sheetId: string): Promise<void> {
  const meta = await api<{ sheets?: { properties?: { title?: string } }[] }>(
    token, sheetsUrl(sheetId, '?fields=sheets.properties.title'),
  );
  const existing = new Set((meta.sheets ?? []).map(s => s.properties?.title).filter(Boolean) as string[]);
  const missing = OWNED_TABS.filter(t => !existing.has(t));
  if (missing.length === 0) return;
  await api(token, sheetsUrl(sheetId, ':batchUpdate'), {
    method: 'POST',
    body: JSON.stringify({ requests: missing.map(title => ({ addSheet: { properties: { title } } })) }),
  });
}

// --- Entity-level CRUD wrappers ------------------------------------------
// Each writes the full tab (clear + replace). Simpler + safer than per-row
// edits: we don't have to track row indices, and manual sheet edits don't
// desync. With <1000 rows the round-trip is well under 2s.

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
      date: toIsoDate(r.date),
      item: r.item,
      amount,
      account,
      // Keep the raw category string; validation against the live taxonomy
      // happens at render time (unknown keys show as "Uncategorized").
      category: r.category || '',
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

export async function readCategories(token: string, sheetId: string): Promise<CategoryEntry[]> {
  const rows = await readRange(token, sheetId, `${SHEET_TABS.categories}!A1:Z100000`);
  const objs = rowsToObjects(rows, HEADERS.categories);
  const seen = new Set<string>();
  const out: CategoryEntry[] = [];
  for (const r of objs) {
    const detailed = r.detailed.trim();
    const broad = r.broad.trim();
    const mid = r.mid.trim();
    // `detailed` is the unique key. Skip blanks and duplicates.
    if (!detailed || !broad || !mid || seen.has(detailed)) continue;
    seen.add(detailed);
    out.push({ broad, mid, detailed });
  }
  return out;
}

export async function writeCategories(token: string, sheetId: string, categories: CategoryEntry[]): Promise<void> {
  const rows = categories.map(c => [c.broad, c.mid, c.detailed]);
  await replaceTab(token, sheetId, SHEET_TABS.categories, HEADERS.categories, rows);
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

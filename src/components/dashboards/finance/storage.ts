import { EMPTY_STATE, type DataState, type Transaction, type Budget, type Income, type Account, ACCOUNTS } from './types';
import { isValidCategory } from './categories';

const KEY = 'tw-finance-v1';

export function loadState(): DataState {
  if (typeof window === 'undefined') return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return EMPTY_STATE;
    return {
      version: 1,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
      incomes: Array.isArray(parsed.incomes) ? parsed.incomes : [],
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function saveState(state: DataState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearState(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}

// --- CSV helpers ----------------------------------------------------------
// One CSV per entity. Round-trips via the Import buttons. Header row is
// authoritative — column order doesn't matter on import, only header names.

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const head = headers.join(',');
  const body = rows.map(r => headers.map(h => csvEscape(r[h])).join(',')).join('\n');
  return body ? head + '\n' + body + '\n' : head + '\n';
}

// Minimal CSV parser: handles quoted fields, escaped quotes, and CRLF.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { cur.push(field); field = ''; }
      else if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else if (ch === '\r') { /* skip; \n handles row break */ }
      else field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.some(c => c !== '')).map(r => {
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim(); });
    return o;
  });
}

const TX_HEADERS = ['id', 'date', 'item', 'amount', 'account', 'category', 'notes', 'created_at', 'updated_at'];

export function transactionsToCsv(txs: Transaction[]): string {
  return toCsv(TX_HEADERS, txs.map(t => ({ ...t, notes: t.notes ?? '' })));
}

export function csvToTransactions(text: string): Transaction[] {
  const rows = parseCsv(text);
  const out: Transaction[] = [];
  for (const r of rows) {
    const amount = parseFloat(r.amount);
    if (!r.id || !r.date || !r.item || !Number.isFinite(amount)) continue;
    const account = (ACCOUNTS as string[]).includes(r.account) ? (r.account as Account) : 'Other';
    out.push({
      id: r.id,
      date: r.date,
      item: r.item,
      amount,
      account,
      category: r.category && isValidCategory(r.category) ? r.category : (r.category ?? ''),
      notes: r.notes || undefined,
      created_at: r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || new Date().toISOString(),
    });
  }
  return out;
}

const BUDGET_HEADERS = ['category', 'monthly_amount', 'effective_from'];

export function budgetsToCsv(bs: Budget[]): string {
  return toCsv(BUDGET_HEADERS, bs);
}

export function csvToBudgets(text: string): Budget[] {
  const rows = parseCsv(text);
  const out: Budget[] = [];
  for (const r of rows) {
    const amount = parseFloat(r.monthly_amount);
    if (!r.category || !r.effective_from || !Number.isFinite(amount)) continue;
    out.push({
      category: r.category,
      monthly_amount: amount,
      effective_from: r.effective_from,
    });
  }
  return out;
}

const INCOME_HEADERS = ['id', 'source', 'monthly_amount', 'effective_from'];

export function incomesToCsv(is: Income[]): string {
  return toCsv(INCOME_HEADERS, is);
}

export function csvToIncomes(text: string): Income[] {
  const rows = parseCsv(text);
  const out: Income[] = [];
  for (const r of rows) {
    const amount = parseFloat(r.monthly_amount);
    if (!r.source || !r.effective_from || !Number.isFinite(amount)) continue;
    out.push({
      id: r.id || crypto.randomUUID(),
      source: r.source,
      monthly_amount: amount,
      effective_from: r.effective_from,
    });
  }
  return out;
}

export function downloadFile(name: string, contents: string, mime = 'text/csv') {
  if (typeof window === 'undefined') return;
  const blob = new Blob([contents], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

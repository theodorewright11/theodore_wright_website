import type { Transaction, Budget, Income, CategoryEntry } from './types';
import { isValidCategory, UNCATEGORIZED } from './categories';

// All compute functions are pure. They take data + a target (year, month) and
// return derived values. No side effects, no hidden state. Date math is local
// to the user's timezone — month windows are inclusive of the first and last
// day of the calendar month.

export type YearMonth = { year: number; month: number };  // month is 1..12

export function todayYM(now: Date = new Date()): YearMonth {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function ymKey(ym: YearMonth): string {
  return `${ym.year}-${String(ym.month).padStart(2, '0')}`;
}

export function ymFromKey(key: string): YearMonth | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) };
}

export function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const idx = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

// Normalize a date cell to ISO 'YYYY-MM-DD'. Tolerates already-ISO strings,
// US-locale 'M/D/YYYY' (what Google Sheets produces when a CSV import
// auto-converts the date column), and Sheets serial numbers. Anything
// unparseable is returned unchanged.
export function toIsoDate(v: string): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (slash) return `${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + parseFloat(s) * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return s;
}

// ISO 'YYYY-MM-DD' parse without timezone surprises.
function parseIsoDate(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return { y: parseInt(m[1], 10), m: parseInt(m[2], 10), d: parseInt(m[3], 10) };
}

export function inMonth(dateIso: string, ym: YearMonth): boolean {
  const p = parseIsoDate(dateIso);
  if (!p) return false;
  return p.y === ym.year && p.m === ym.month;
}

export function txsInMonth(txs: Transaction[], ym: YearMonth): Transaction[] {
  return txs.filter(t => inMonth(t.date, ym));
}

export function totalSpend(txs: Transaction[]): number {
  return txs.reduce((sum, t) => sum + (Number.isFinite(t.amount) ? t.amount : 0), 0);
}

export function spendByCategory(txs: Transaction[], categories: CategoryEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of txs) {
    const key = isValidCategory(categories, t.category) ? t.category : UNCATEGORIZED;
    out.set(key, (out.get(key) ?? 0) + (Number.isFinite(t.amount) ? t.amount : 0));
  }
  return out;
}

// Returns the budget effective for the first day of the target month, per
// category. "Effective" = the most-recent budget row whose effective_from is
// on-or-before the first day of the target month.
export function currentBudgets(budgets: Budget[], ym: YearMonth): Map<string, number> {
  const monthFirst = `${ym.year}-${String(ym.month).padStart(2, '0')}-01`;
  const latest = new Map<string, Budget>();
  for (const b of budgets) {
    if (b.effective_from > monthFirst) continue;
    const prev = latest.get(b.category);
    if (!prev || b.effective_from > prev.effective_from) latest.set(b.category, b);
  }
  const out = new Map<string, number>();
  for (const [cat, b] of latest) out.set(cat, b.monthly_amount);
  return out;
}

export function totalBudget(budgets: Budget[], ym: YearMonth): number {
  let sum = 0;
  for (const v of currentBudgets(budgets, ym).values()) sum += v;
  return sum;
}

export function currentIncomes(incomes: Income[], ym: YearMonth): Map<string, number> {
  const monthFirst = `${ym.year}-${String(ym.month).padStart(2, '0')}-01`;
  const latest = new Map<string, Income>();
  for (const i of incomes) {
    if (i.effective_from > monthFirst) continue;
    const prev = latest.get(i.source);
    if (!prev || i.effective_from > prev.effective_from) latest.set(i.source, i);
  }
  const out = new Map<string, number>();
  for (const [src, i] of latest) out.set(src, i.monthly_amount);
  return out;
}

export function totalIncome(incomes: Income[], ym: YearMonth): number {
  let sum = 0;
  for (const v of currentIncomes(incomes, ym).values()) sum += v;
  return sum;
}

// --- Insights aggregation helpers (pure) ---------------------------------

// Inclusive list of months from `from` to `to` in chronological order.
export function monthsRange(from: YearMonth, to: YearMonth): YearMonth[] {
  const out: YearMonth[] = [];
  const toIdx = to.year * 12 + (to.month - 1);
  let cur = from;
  while (cur.year * 12 + (cur.month - 1) <= toIdx) { out.push(cur); cur = shiftMonth(cur, 1); }
  return out;
}

// The month of the earliest transaction (null if none).
export function earliestTxYM(txs: Transaction[]): YearMonth | null {
  let min: string | null = null;
  for (const t of txs) if (!min || t.date < min) min = t.date;
  return min ? ymFromKey(min.slice(0, 7)) : null;
}

export function spendByAccount(txs: Transaction[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of txs) out.set(t.account, (out.get(t.account) ?? 0) + (Number.isFinite(t.amount) ? t.amount : 0));
  return out;
}

// Spend grouped by broad category for a set of transactions. Unknown detailed
// keys roll into UNCATEGORIZED.
export function spendByBroad(txs: Transaction[], categories: import('./types').CategoryEntry[]): Map<string, number> {
  const broadOf = new Map<string, string>();
  for (const c of categories) broadOf.set(c.detailed, c.broad);
  const out = new Map<string, number>();
  for (const t of txs) {
    const broad = broadOf.get(t.category) ?? UNCATEGORIZED;
    out.set(broad, (out.get(broad) ?? 0) + (Number.isFinite(t.amount) ? t.amount : 0));
  }
  return out;
}

export function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Trailing rolling average of a numeric series (window inclusive of current).
// Returns null for positions with fewer than `window` prior points filled.
export function rollingAverage(series: number[], window: number): (number | null)[] {
  return series.map((_, i) => {
    if (i + 1 < window) return null;
    let s = 0;
    for (let j = i - window + 1; j <= i; j++) s += series[j];
    return s / window;
  });
}

export function daysInMonth(ym: YearMonth): number {
  return new Date(ym.year, ym.month, 0).getDate();
}

export type Variance = { dollars: number; percent: number | null };

// Variance: positive = under budget. Percent is null if budget is zero.
export function variance(spent: number, budget: number): Variance {
  return {
    dollars: budget - spent,
    percent: budget > 0 ? (budget - spent) / budget : null,
  };
}

// --- Display helpers ------------------------------------------------------

export type CurrencyDisplay = 'dollars' | 'cents';

export function formatMoney(n: number, mode: CurrencyDisplay = 'dollars'): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (mode === 'cents') {
    return sign + '$' + abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return sign + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPercent(p: number | null, decimals = 0): string {
  if (p === null || !Number.isFinite(p)) return '—';
  return (p * 100).toFixed(decimals) + '%';
}

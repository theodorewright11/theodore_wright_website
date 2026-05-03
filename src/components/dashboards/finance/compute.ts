import type { Transaction, Budget, Income } from './types';
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

export function spendByCategory(txs: Transaction[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of txs) {
    const key = isValidCategory(t.category) ? t.category : UNCATEGORIZED;
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

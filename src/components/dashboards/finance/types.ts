export type Account = 'Amex' | 'Debit' | 'Cash' | 'Other';

export const ACCOUNTS: Account[] = ['Amex', 'Debit', 'Cash', 'Other'];

export type Transaction = {
  id: string;
  date: string;        // ISO YYYY-MM-DD
  item: string;
  amount: number;      // positive USD, full precision in storage
  account: Account;
  category: string;    // detailed category key
  notes?: string;
  created_at: string;  // ISO datetime
  updated_at: string;
};

export type Budget = {
  category: string;        // detailed category key
  monthly_amount: number;
  effective_from: string;  // ISO YYYY-MM-DD; first month this budget applies to
};

export type Income = {
  id: string;
  source: string;          // human-readable, e.g. "Work", "Scholarship"
  monthly_amount: number;
  effective_from: string;  // ISO YYYY-MM-DD
};

// Three-level taxonomy entry. `detailed` is the unique key stored on a
// Transaction / Budget. The taxonomy is user-editable data (synced to the
// `categories` sheet tab), not a hardcoded list — DEFAULT_CATEGORIES in
// categories.ts is only the initial seed.
export type CategoryEntry = {
  broad: string;
  mid: string;
  detailed: string;
};

export type DataState = {
  version: 1;
  transactions: Transaction[];
  budgets: Budget[];
  incomes: Income[];
  categories: CategoryEntry[];
};

export const EMPTY_STATE: DataState = {
  version: 1,
  transactions: [],
  budgets: [],
  incomes: [],
  categories: [],
};

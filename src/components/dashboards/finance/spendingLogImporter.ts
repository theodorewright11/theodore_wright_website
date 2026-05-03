// One-time historical importer: read the legacy `Spending Log` tab from the
// same workbook and convert its rows into Transaction objects shaped for the
// new `transactions` tab. Mirrors the Python script at
// scripts/finance_import_xlsx.py — keep them in sync if the legacy schema
// changes.

import type { Transaction, Account } from './types';
import { isValidCategory } from './categories';
import { readRange, SHEET_TABS } from './sheets';

// Column layout of the legacy `Spending Log` tab (1-indexed):
//   col 1: Date
//   col 2: Item
//   col 3: Price
//   col 4: Account  (header row mislabels this as empty; data still has it)
//   col 5: Category
//
// In the rows array (0-indexed) those become indices 0..4.

const ACCOUNT_REMAP: Record<string, Account> = {
  amex: 'Amex',
  debt: 'Debit',     // legacy typo for Debit
  debit: 'Debit',
  cash: 'Cash',
  other: 'Other',
};

// Legacy category names → current canonical keys in src/.../categories.ts.
// Add a row here whenever you rename in one place but not the other.
const CATEGORY_REMAP: Record<string, string> = {
  ChatGPT: 'AI Subscription',
  OneDrive: 'One Drive',
  'Car Maintenence': 'Car Maintenance',
};

function isoDate(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number') {
    // Sheets serial date: days since 1899-12-30.
    const epochMs = (v - 25569) * 86400 * 1000;
    const d = new Date(epochMs);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Try Date parsing (handles "8/16/2025" etc).
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return '';
}

export type ImportSummary = {
  total: number;
  imported: Transaction[];
  skipped: number;
  unknownCategories: string[];
};

export async function fetchSpendingLog(token: string, sheetId: string): Promise<ImportSummary> {
  // Pull the whole tab — we don't know how many rows there are.
  const rows = await readRange(token, sheetId, `${SHEET_TABS.spendingLog}!A1:Z100000`);
  // First row is the header — skip it.
  const dataRows = rows.slice(1);
  const imported: Transaction[] = [];
  let skipped = 0;
  const unknownSet = new Set<string>();
  const now = new Date().toISOString();

  for (const r of dataRows) {
    const dateRaw = r[0];
    const item = String(r[1] ?? '').trim();
    const priceRaw = r[2];
    const accountRaw = String(r[3] ?? '').trim();
    const categoryRaw = String(r[4] ?? '').trim();

    if (!item) { skipped++; continue; }
    const amount = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw ?? ''));
    if (!Number.isFinite(amount) || amount <= 0) { skipped++; continue; }

    const date = isoDate(dateRaw);
    if (!date) { skipped++; continue; }

    const account: Account = ACCOUNT_REMAP[accountRaw.toLowerCase()] ?? 'Other';
    const category = CATEGORY_REMAP[categoryRaw] ?? categoryRaw;
    if (category && !isValidCategory(category)) unknownSet.add(category);

    imported.push({
      id: crypto.randomUUID(),
      date,
      item,
      amount,
      account,
      category,
      created_at: now,
      updated_at: now,
    });
  }

  return {
    total: dataRows.length,
    imported,
    skipped,
    unknownCategories: [...unknownSet].sort(),
  };
}

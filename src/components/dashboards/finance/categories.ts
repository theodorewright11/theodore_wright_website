import type { CategoryEntry } from './types';

export type { CategoryEntry };

// Initial seed for the three-level taxonomy. This is ONLY the default — the
// live taxonomy is user-editable data on `DataState.categories` (synced to the
// `categories` sheet tab). A brand-new / empty sheet gets seeded with this
// list; after that, edits in the Manage-categories UI are the source of truth.
// `detailed` is the persistent key stored on a Transaction / Budget.
export const DEFAULT_CATEGORIES: CategoryEntry[] = [
  // Living Expenses
  { broad: 'Living Expenses', mid: 'Food', detailed: 'Groceries' },
  { broad: 'Living Expenses', mid: 'Food', detailed: 'Eating Out' },
  { broad: 'Living Expenses', mid: 'Living Expenses Misc', detailed: 'Laundry' },
  { broad: 'Living Expenses', mid: 'Living Expenses Misc', detailed: 'Hair Cut' },
  { broad: 'Living Expenses', mid: 'Housing', detailed: 'Rent' },

  // Auto & Transport
  { broad: 'Auto & Transport', mid: 'Auto', detailed: 'Car Payment' },
  { broad: 'Auto & Transport', mid: 'Auto', detailed: 'Car Insurance' },
  { broad: 'Auto & Transport', mid: 'Auto', detailed: 'Car Maintenance' },
  { broad: 'Auto & Transport', mid: 'Auto', detailed: 'Gas' },

  // Social & Fun
  { broad: 'Social & Fun', mid: 'Friends', detailed: 'Friends Fun' },
  { broad: 'Social & Fun', mid: 'Friends', detailed: 'Friends Food & Drink' },
  { broad: 'Social & Fun', mid: 'Friends', detailed: 'Dates Fun' },
  { broad: 'Social & Fun', mid: 'Friends', detailed: 'Dates Food & Drink' },
  { broad: 'Social & Fun', mid: 'Friends', detailed: 'Personal Fun' },
  { broad: 'Social & Fun', mid: 'Friends', detailed: 'Gifts' },

  // Obligations
  { broad: 'Obligations', mid: 'Subscriptions', detailed: 'Spotify' },
  { broad: 'Obligations', mid: 'Subscriptions', detailed: 'AI Subscription' },
  { broad: 'Obligations', mid: 'Subscriptions', detailed: 'iCloud' },
  { broad: 'Obligations', mid: 'Subscriptions', detailed: 'One Drive' },
  { broad: 'Obligations', mid: 'Subscriptions', detailed: 'Therapy' },
  { broad: 'Obligations', mid: 'Subscriptions', detailed: 'Amazon Subscription' },
  { broad: 'Obligations', mid: 'Subscriptions', detailed: 'Railway' },
  { broad: 'Obligations', mid: 'Subscriptions', detailed: 'Hulu' },
  { broad: 'Obligations', mid: 'Subscriptions', detailed: 'Singing Lessons' },
  { broad: 'Obligations', mid: 'Obligations Misc', detailed: 'College' },
  { broad: 'Obligations', mid: 'Obligations Misc', detailed: 'Phone Bill' },
  { broad: 'Obligations', mid: 'Obligations Misc', detailed: 'Health Insurance' },

  // Other
  { broad: 'Other', mid: 'Item Purchases', detailed: 'Personal Care & Grooming' },
  { broad: 'Other', mid: 'Item Purchases', detailed: 'Tech & Electronics' },
  { broad: 'Other', mid: 'Item Purchases', detailed: 'Transportation & Gear' },
  { broad: 'Other', mid: 'Item Purchases', detailed: 'Home & Environment' },
  { broad: 'Other', mid: 'Item Purchases', detailed: 'Clothing & Accessories' },
  { broad: 'Other', mid: 'Item Purchases', detailed: 'Books' },
  { broad: 'Other', mid: 'Item Purchases', detailed: 'Health & Wellness' },
  { broad: 'Other', mid: 'Other Misc', detailed: 'Other' },
  { broad: 'Other', mid: 'Other Misc', detailed: 'Travel' },
  { broad: 'Other', mid: 'Other Misc', detailed: 'Charity' },
  { broad: 'Other', mid: 'Other Misc', detailed: 'Taxes' },
  { broad: 'Other', mid: 'Other Misc', detailed: 'Savings' },

  // Big Expenses Savings
  { broad: 'Big Expenses Savings', mid: 'Big Expenses Savings', detailed: 'Car' },
];

export const UNCATEGORIZED = 'Uncategorized';

// The taxonomy is passed in (from DataState.categories) so every consumer sees
// the user's current, edited list rather than a compile-time constant.

export function detailedKeys(categories: CategoryEntry[]): string[] {
  return categories.map(c => c.detailed);
}

export function isValidCategory(categories: CategoryEntry[], key: string): boolean {
  return categories.some(c => c.detailed === key);
}

export function lookupCategory(categories: CategoryEntry[], key: string): CategoryEntry | null {
  return categories.find(c => c.detailed === key) ?? null;
}

// Returns Map<broad, Map<mid, CategoryEntry[]>> in source order.
export function groupByBroadMid(categories: CategoryEntry[]): Map<string, Map<string, CategoryEntry[]>> {
  const out = new Map<string, Map<string, CategoryEntry[]>>();
  for (const c of categories) {
    let broadMap = out.get(c.broad);
    if (!broadMap) {
      broadMap = new Map();
      out.set(c.broad, broadMap);
    }
    let midList = broadMap.get(c.mid);
    if (!midList) {
      midList = [];
      broadMap.set(c.mid, midList);
    }
    midList.push(c);
  }
  return out;
}

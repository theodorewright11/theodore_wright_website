export type CategoryEntry = {
  broad: string;
  mid: string;
  detailed: string;   // unique key — also the value stored on a Transaction
};

// Three-level taxonomy. Edit this list to add/rename categories; nothing else
// in the codebase hardcodes these strings. `detailed` is the persistent key
// (renaming it leaves historical transactions pointing at a missing category,
// which the dashboard surfaces as "Uncategorized").
export const CATEGORIES: CategoryEntry[] = [
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

export const DETAILED_KEYS: string[] = CATEGORIES.map(c => c.detailed);

export const UNCATEGORIZED = 'Uncategorized';

export function isValidCategory(key: string): boolean {
  return DETAILED_KEYS.includes(key);
}

export function lookupCategory(key: string): CategoryEntry | null {
  return CATEGORIES.find(c => c.detailed === key) ?? null;
}

// Returns Map<broad, Map<mid, CategoryEntry[]>> in source order.
export function groupByBroadMid(): Map<string, Map<string, CategoryEntry[]>> {
  const out = new Map<string, Map<string, CategoryEntry[]>>();
  for (const c of CATEGORIES) {
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

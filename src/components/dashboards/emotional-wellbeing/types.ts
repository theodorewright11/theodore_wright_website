export const DOMAINS = [
  'Purpose / Contribution',
  'Relational / Social',
  'Cognitive / Intellectual',
  'Emotional',
  'Creative',
  'Physical',
  'Spiritual / Existential',
  'Autonomy / Agency',
] as const;
export type Domain = typeof DOMAINS[number];

export const SOURCES = ['self', 'friends', 'romantic', 'activities', 'career', 'other'] as const;
export type Source = typeof SOURCES[number];

export const SOURCE_LABEL: Record<Source, string> = {
  self: 'Self',
  friends: 'Friends',
  romantic: 'Romantic',
  activities: 'Activities',
  career: 'Career',
  other: 'Other',
};

export const PRIORITY_LABEL: Record<number, string> = {
  0: '—',
  1: 'Not relevant',
  2: 'Minimal',
  3: 'Nice to have',
  4: 'Important',
  5: 'Core',
};

export const MET_LABEL: Record<number, string> = {
  0: '—',
  1: 'Not at all',
  2: 'Barely',
  3: 'Rarely',
  4: 'Sometimes',
  5: 'Somewhat',
  6: 'Frequently',
  7: 'Fully',
};

export type SourceAlloc = { actual: number; ideal: number };

export type Need = {
  id: string;
  name: string;
  domain: Domain;
  priority: number;       // 0 = unset, 1-5 = scale
  currentlyMet: number;   // 0 = unset, 1-7 = scale
  sources: Record<Source, SourceAlloc>;
};

export type DataState = {
  version: 1;
  needs: Need[];
};

export const EMPTY_SOURCES: Record<Source, SourceAlloc> = {
  self: { actual: 0, ideal: 0 },
  friends: { actual: 0, ideal: 0 },
  romantic: { actual: 0, ideal: 0 },
  activities: { actual: 0, ideal: 0 },
  career: { actual: 0, ideal: 0 },
  other: { actual: 0, ideal: 0 },
};

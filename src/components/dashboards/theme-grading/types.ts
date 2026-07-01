export type SchemaVersion = 1;

// A rating axis value: 1–5, or 'na' when the axis genuinely doesn't apply to
// this theme/run (e.g. positionality influence on a neutral run). `undefined`
// (absent) means "not rated yet" — the two are distinct on purpose.
export type AxisScore = 1 | 2 | 3 | 4 | 5 | 'na';

export type AxisKey =
  | 'grounding'
  | 'researchQuestionFit'
  | 'interpretationLevel'
  | 'aiPriorNovelty'
  | 'analyticalNovelty'
  | 'positionalityInfluence';

export type ThemeRating = Partial<Record<AxisKey, AxisScore>> & {
  notes?: string;
};

// One row of the uploaded data CSV. The document's [D{n}] number is its
// position in Corpus.docs (idx = position + 1) — same convention as the
// qual-coding corpus.md export, so AI theme JSON quotes anchor the same way.
export type CorpusDoc = {
  // The `id` column from the CSV (external identifier, e.g. a comment id).
  extId: string;
  text: string;
};

export type Corpus = {
  id: string;
  name: string;
  docs: CorpusDoc[];
  created_at: string;
};

// Where a verbatim quote was located inside a corpus document.
export type QuoteAnchor = {
  docIdx: number; // 0-based index into Corpus.docs
  start: number;
  end: number;
};

export type ThemeQuote = {
  text: string;
  source?: string; // the raw source tag from the JSON, e.g. "[D4]"
  role?: 'core' | 'supporting';
  // Present when the quote text was found verbatim in the resolved document.
  anchor?: QuoteAnchor;
  // For non-anchored quotes (paraphrases / bad source tags): documents that
  // plausibly contain the quote, scored 0..1 at import time.
  possibleSources?: { source: string; score: number }[];
};

export type RatedTheme = {
  id: string;
  name: string;
  definition?: string;
  reasoning?: string;
  quotes: ThemeQuote[];
  rating: ThemeRating;
};

// One AI thematic-analysis output plus the study dimensions it was run under.
// The dimension fields are free strings (with autocomplete from prior runs) so
// Explore can group/filter by exact value.
export type Run = {
  id: string;
  corpusId: string | null;
  model: string;
  positionality: string;
  researchQuestion: string;
  condition: string;
  repeat?: string; // repeat # for stochasticity checks
  notes?: string;
  themes: RatedTheme[];
  // Top-level prose from the import that didn't map to a theme.
  additionalText?: string;
  created_at: string;
  updated_at: string;
};

// A pairwise theme-similarity rating (the Theme Similarity rubric axis).
// Themes are addressed by id; theme ids are globally unique so the pair can
// span two different runs (e.g. same positionality across models). Stored once
// per unordered pair.
export type SimilarityPair = {
  id: string;
  themeA: string; // theme id
  themeB: string; // theme id
  similarity?: AxisScore;
  notes?: string;
  created_at: string;
};

export type DriveLink = {
  folderId: string;
  stateFileId: string;
  modifiedTime?: string;
};

export type View = 'runs' | 'rate' | 'explore';

export type AppState = {
  version: SchemaVersion;
  corpora: Corpus[];
  runs: Run[];
  similarities: SimilarityPair[];
  activeRunId: string | null;
  view?: View;
  // Rate-view display toggles
  showDefinition?: boolean;
  showReasoning?: boolean;
  showQuotes?: boolean;
  showQuoteSources?: boolean;
  showRubricHints?: boolean;
  rateColumns?: 1 | 2 | 3;
  // Tombstones so a Drive pull doesn't resurrect deleted entities.
  deletedRunIds?: string[];
  deletedCorpusIds?: string[];
  drive?: DriveLink;
  updated_at?: string;
};

export const AXIS_KEYS: AxisKey[] = [
  'grounding',
  'researchQuestionFit',
  'interpretationLevel',
  'aiPriorNovelty',
  'analyticalNovelty',
  'positionalityInfluence',
];

// Suggested values for the run-condition field (free text; these seed the
// autocomplete before any runs exist).
export const CONDITION_SUGGESTIONS = [
  'no-data engineered',
  'with-data non-engineered',
  'with-data engineered',
];

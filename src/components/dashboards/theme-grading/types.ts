export type SchemaVersion = 1;

// A rating axis value: 1–5, or 'na' when the axis genuinely doesn't apply to
// this theme/run (e.g. positionality influence on a neutral run). `undefined`
// (absent) means "not rated yet" — the two are distinct on purpose.
export type AxisScore = 1 | 2 | 3 | 4 | 5 | 'na';

export type AxisKey =
  | 'grounding'
  | 'researchQuestionFit'
  | 'interpretationLevel'
  | 'novelty'
  | 'dataContribution'
  | 'positionalityContribution';

export type ThemeRating = Partial<Record<AxisKey, AxisScore>> & {
  notes?: string;
};

// One row of the uploaded data CSV. The document's [D{n}] number is `dnum`
// when the CSV's id column carried an explicit D-tag (D35 stays D35 no matter
// what row it sits on), otherwise its position (idx + 1).
export type CorpusDoc = {
  // The `id` column from the CSV (external identifier, e.g. a comment id).
  extId: string;
  text: string;
  // Explicit D-number parsed from an id like "D35" / "[D35]". Authoritative
  // for quote anchoring when present.
  dnum?: number;
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
  // The import's `all_supporting_data` list — every data item the AI says
  // supports this theme, as [D{n}]-style tags (broader than the quoted ones).
  supportingData?: string[];
  rating: ThemeRating;
};

// One AI thematic-analysis output plus the study dimensions it was run under.
// The dimension fields are free strings (with autocomplete from prior runs) so
// Explore can group/filter by exact value. They follow the study's run-naming
// convention — {model}_{promptVariant}-v{version}_{dataSource}_{rq}_{positionality}_run{n}
// — and a full name pasted into the New-run form autofills them (runName.ts).
export type Run = {
  id: string;
  corpusId: string | null;
  model: string; // chatgpt5.5 | claude | gemini | human-teddy | …
  promptVariant: string; // engineered-data | engineered-no-data | not-engineered-data | na
  version: string; // the -v{n} token attached to the prompt variant
  dataSource: string; // e.g. 20-als-comments, 160-als-comments, na
  rq: string; // research-question shorthand (rq1, rq2, …)
  positionality: string; // p1, p2, …
  runN?: string; // consistency-measurement repeat, the run{n} token
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
  // Runs shown side by side in the Rate view (one column each, max 4;
  // duplicates allowed so a run can be compared against itself).
  rateRunIds?: string[];
  view?: View;
  // Rate-view display toggles
  showDefinition?: boolean;
  showReasoning?: boolean;
  showQuotes?: boolean;
  showQuoteSources?: boolean;
  showSupportingData?: boolean;
  showRubricHints?: boolean;
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
  'novelty',
  'dataContribution',
  'positionalityContribution',
];

// Known prompt-variant values (free text; these seed the autocomplete). The
// version rides in the run name attached with a hyphen (engineered-data-v2);
// `na` is the human reference set (no prompt).
export const PROMPT_VARIANTS = [
  'engineered-data',
  'engineered-no-data',
  'not-engineered-data',
  'na',
];

// Data-source suggestions (free text; grows as transcripts etc. come in).
// `na` for no-data runs.
export const DATA_SOURCE_SUGGESTIONS = ['20-als-comments', '160-als-comments', 'na'];

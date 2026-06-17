export type SchemaVersion = 1;

export type MetadataFieldType = 'text' | 'number' | 'date' | 'enum';

export type MetadataField = {
  key: string;
  label: string;
  type: MetadataFieldType;
  options?: string[];
};

export type MetadataValue = string | number | null;

export type DocumentKind = 'document' | 'note';

export type Document = {
  id: string;
  title: string;
  text: string;
  kind?: DocumentKind;
  notes?: string;
  folder?: string;
  metadata: Record<string, MetadataValue>;
  created_at: string;
  updated_at: string;
};

export type Code = {
  id: string;
  name: string;
  // A code can live under multiple parents at once (multi-parent DAG). An
  // empty array means it's a top-level / root code. Legacy projects with the
  // single `parentId` field are migrated on load (see storage.ts).
  parentIds: string[];
  color: string | null;
  description?: string;
  order?: number;
  // Rubric-based rating: how appropriately precise the code's level of detail
  // is. Per code (intrinsic to how it's defined). 1–5 scale.
  specificity?: 1 | 2 | 3 | 4 | 5;
  specificityNotes?: string;
  created_at: string;
};

export type AnnotationRange = {
  start: number;
  end: number;
};

export type Annotation = {
  id: string;
  docId: string;
  // One annotation can cover multiple disjoint spans of the document — e.g.
  // two paragraphs that say similar things, grouped under one annotation
  // entry. Legacy single-range annotations (with top-level start/end) are
  // migrated to ranges: [{start, end}] on load (see storage.ts).
  ranges: AnnotationRange[];
  codeId: string;
  note?: string;
  // Rubric-based rating: how accurately the code label captures THIS text
  // segment. Per annotation (instance-level). 1–5 scale.
  accuracy?: 1 | 2 | 3 | 4 | 5;
  accuracyNotes?: string;
  created_at: string;
};

export type DriveLink = {
  folderId: string;
  projectJsonId: string;
  modifiedTime?: string;
};

// A theme is an analyst-level grouping of evidence (annotations) under a
// short label + interpretive narrative. Themes nest like codes (parentIds
// can be empty for top-level). Each annotation link carries a `weight`:
//   'core'       — the annotation directly demonstrates the theme.
//   'supporting' — the annotation supports / illustrates the theme adjacently.
export type ThemeAnnotationLink = {
  annotationId: string;
  weight: 'core' | 'supporting';
};

// Raw text span attached to a theme that's NOT routed through an annotation
// (so it carries no code). Used when an analyst highlights text in a doc and
// chooses "Add to theme" — if no existing annotations are fully contained
// within the selection, the text is stored here as evidence with no code.
// If annotations WERE fully contained, those are linked individually instead
// and no uncoded highlight is created.
export type ThemeUncodedHighlight = {
  id: string;
  docId: string;
  ranges: AnnotationRange[];
  weight: 'core' | 'supporting';
  note?: string;
  created_at: string;
};

// A quote attached to a theme that could NOT be anchored to a document span —
// either a paraphrase (not verbatim) or one with no usable [D{n}] source. Only
// kept on low-effort imports; shown as plain text under the theme, not as an
// on-text highlight.
export type ThemeExtraQuote = {
  text: string;
  source?: string;
  role?: 'core' | 'supporting';
  // Documents whose text plausibly contains this quote (near-verbatim or high
  // word-overlap), found at import time. Lets a paraphrase suggest its origin.
  possibleSources?: { source: string; score: number }[];
};

export type ThemeRating = {
  grounding?: 1 | 2 | 3 | 4 | 5;
  usefulness?: 1 | 2 | 3 | 4 | 5;
  independence?: 1 | 2 | 3 | 4 | 5;
  interpretationLevel?: 1 | 2 | 3 | 4 | 5;
  prevalence?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
};

export type Theme = {
  id: string;
  name: string;
  // Structured narrative, kept as two separate fields so they can be embedded /
  // exported independently (the AI-TA comparison workflow). `definition` = what
  // the theme captures + its boundaries; `reasoning` = the analyst/model's
  // thinking about the pattern. Both Markdown.
  definition?: string;
  reasoning?: string;
  // Legacy single freeform narrative. Migrated into `definition` on load when
  // `definition` is absent (see storage.coerceTheme). Retained for back-compat.
  description?: string;
  parentIds: string[];
  color: string | null;
  order?: number;
  // Direct annotation links with core/supporting weight. One annotation can
  // appear in multiple themes (and across themes via this list).
  annotationLinks: ThemeAnnotationLink[];
  // Codes whose annotations are auto-included as 'supporting' evidence.
  // The Themes view shows all annotations of these codes alongside the
  // direct links, deduped by annotation id (direct links win).
  includeCodeIds: string[];
  // Raw highlighted text added to the theme without an annotation backing it.
  uncodedHighlights?: ThemeUncodedHighlight[];
  // Quotes that couldn't be anchored to a doc span (paraphrases / no source) —
  // kept on low-effort imports so the evidence text isn't lost.
  extraQuotes?: ThemeExtraQuote[];
  rating?: ThemeRating;
  created_at: string;
};

export type Project = {
  version: SchemaVersion;
  id: string;
  name: string;
  description?: string;
  about?: string;
  metadataSchema: MetadataField[];
  documents: Document[];
  codes: Code[];
  annotations: Annotation[];
  themes?: Theme[];
  folders?: string[];
  // Low-effort import mode: when on, AI-theme import keeps non-anchored quotes
  // (paraphrases / no source) as theme `extraQuotes` and captures the import's
  // `additional_text` into `additionalText` instead of discarding them.
  lowEffort?: boolean;
  // Leftover prose from an AI-theme import that didn't map to any theme
  // (intro/summary/frequency tables, etc.). Surfaced in the Info view.
  additionalText?: string;
  created_at: string;
  updated_at: string;
  drive?: DriveLink;
};

export type View = 'documents' | 'explore' | 'about' | 'codebook' | 'themes' | 'grading';

export type AppState = {
  version: SchemaVersion;
  projects: Project[];
  activeProjectId: string | null;
  exploreProjectIds?: string[];
  view?: View;
  showCodeDefinitions?: boolean;
  sidebarCollapsed?: boolean;
  sidebarWidth?: number;
  notesWidth?: number;
  codebookWidth?: number;
  annotationsPanelHeight?: number;
  annotationsPanelCollapsed?: boolean;
  metadataCollapsed?: boolean;
  exploreFiltersCollapsed?: boolean;
  exploreCoOccurrenceCollapsed?: boolean;
  lineView?: boolean;
  linesMode?: 'sentence' | 'chars';
  linesCharsN?: number;
  deletedProjectIds?: string[];
  openDocIds?: string[];
  collapsedCodeIds?: string[];
  exploreViewMode?: 'flat' | 'by-code';
  exploreShowMeta?: boolean;
  exploreShowNotes?: boolean;
  exploreShowFullDoc?: boolean;
  // When false, the "Add this selection to themes" block at the top of the
  // selection popover is hidden. Defaults to true.
  popoverShowThemeAdd?: boolean;
  docShowCodes?: boolean;
  docShowThemes?: boolean;
  activeThemeId?: string | null;
};

export const PALETTE = [
  '#2563eb',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#7c3aed',
  '#db2777',
  '#4d7c0f',
  '#0f766e',
  '#b45309',
  '#be123c',
] as const;

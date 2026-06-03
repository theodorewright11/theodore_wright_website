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
  created_at: string;
};

export type DriveLink = {
  folderId: string;
  projectJsonId: string;
  modifiedTime?: string;
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
  folders?: string[];
  created_at: string;
  updated_at: string;
  drive?: DriveLink;
};

export type View = 'documents' | 'explore' | 'about' | 'codebook';

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

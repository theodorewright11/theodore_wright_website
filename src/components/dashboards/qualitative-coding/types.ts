export type SchemaVersion = 1;

export type MetadataFieldType = 'text' | 'number' | 'date' | 'enum';

export type MetadataField = {
  key: string;
  label: string;
  type: MetadataFieldType;
  options?: string[];
};

export type MetadataValue = string | number | null;

export type Document = {
  id: string;
  title: string;
  text: string;
  metadata: Record<string, MetadataValue>;
  created_at: string;
  updated_at: string;
};

export type Code = {
  id: string;
  name: string;
  parentId: string | null;
  color: string | null;
  description?: string;
  created_at: string;
};

export type Annotation = {
  id: string;
  docId: string;
  start: number;
  end: number;
  codeId: string;
  note?: string;
  created_at: string;
};

export type Project = {
  version: SchemaVersion;
  id: string;
  name: string;
  description?: string;
  metadataSchema: MetadataField[];
  documents: Document[];
  codes: Code[];
  annotations: Annotation[];
  created_at: string;
  updated_at: string;
};

export type AppState = {
  version: SchemaVersion;
  projects: Project[];
  activeProjectId: string | null;
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

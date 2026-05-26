import type { Annotation, Code, Document, Project } from './types';
import { PALETTE } from './types';

export type CodeNode = {
  code: Code;
  depth: number;
  children: CodeNode[];
};

export function buildCodeTree(codes: Code[]): CodeNode[] {
  const byParent = new Map<string | null, Code[]>();
  for (const c of codes) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  const build = (parentId: string | null, depth: number): CodeNode[] =>
    (byParent.get(parentId) ?? []).map((code) => ({
      code,
      depth,
      children: build(code.id, depth + 1),
    }));
  return build(null, 0);
}

export function flattenTree(nodes: CodeNode[]): CodeNode[] {
  const out: CodeNode[] = [];
  const walk = (ns: CodeNode[]) => {
    for (const n of ns) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function codePath(codes: Code[], codeId: string): Code[] {
  const byId = new Map(codes.map((c) => [c.id, c]));
  const path: Code[] = [];
  let cur: Code | undefined = byId.get(codeId);
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

export function codePathString(codes: Code[], codeId: string, sep = ' / '): string {
  return codePath(codes, codeId)
    .map((c) => c.name)
    .join(sep);
}

export function descendantIds(codes: Code[], codeId: string): Set<string> {
  const out = new Set<string>([codeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of codes) {
      if (c.parentId && out.has(c.parentId) && !out.has(c.id)) {
        out.add(c.id);
        changed = true;
      }
    }
  }
  return out;
}

export function resolveColor(codes: Code[], codeId: string): string {
  const byId = new Map(codes.map((c) => [c.id, c]));
  let cur: Code | undefined = byId.get(codeId);
  while (cur) {
    if (cur.color) return cur.color;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return '#64748b';
}

export function nextPaletteColor(codes: Code[]): string {
  const used = new Set(
    codes
      .filter((c) => c.parentId === null && c.color)
      .map((c) => c.color as string),
  );
  for (const c of PALETTE) {
    if (!used.has(c)) return c;
  }
  return PALETTE[codes.length % PALETTE.length];
}

export type Segment = {
  start: number;
  end: number;
  text: string;
  annotations: Annotation[];
};

export function segmentText(text: string, annotations: Annotation[]): Segment[] {
  if (annotations.length === 0) {
    return [{ start: 0, end: text.length, text, annotations: [] }];
  }
  const boundaries = new Set<number>([0, text.length]);
  for (const a of annotations) {
    boundaries.add(Math.max(0, Math.min(text.length, a.start)));
    boundaries.add(Math.max(0, Math.min(text.length, a.end)));
  }
  const sorted = [...boundaries].sort((a, b) => a - b);
  const segs: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (end <= start) continue;
    const covering = annotations.filter((a) => a.start <= start && a.end >= end);
    segs.push({ start, end, text: text.slice(start, end), annotations: covering });
  }
  return segs;
}

export function annotationsForDoc(annotations: Annotation[], docId: string): Annotation[] {
  return annotations
    .filter((a) => a.docId === docId)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

export function annotationsByCode(annotations: Annotation[], codeIds: Set<string>): Annotation[] {
  return annotations.filter((a) => codeIds.has(a.codeId));
}

export function codeCounts(project: Project): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of project.annotations) {
    m.set(a.codeId, (m.get(a.codeId) ?? 0) + 1);
  }
  return m;
}

export function deepCodeCounts(project: Project): Map<string, number> {
  const own = codeCounts(project);
  const out = new Map<string, number>();
  for (const c of project.codes) {
    let total = 0;
    for (const id of descendantIds(project.codes, c.id)) {
      total += own.get(id) ?? 0;
    }
    out.set(c.id, total);
  }
  return out;
}

export function findDoc(project: Project, docId: string | null): Document | null {
  if (!docId) return null;
  return project.documents.find((d) => d.id === docId) ?? null;
}

export type FolderNode = {
  path: string;
  name: string;
  depth: number;
  docs: Document[];
  children: FolderNode[];
};

export function buildFolderTree(
  docs: Document[],
  explicitFolders: string[] = [],
): { rootDocs: Document[]; folders: FolderNode[] } {
  const rootDocs: Document[] = [];
  const folderMap = new Map<string, FolderNode>();
  const ensureFolder = (path: string) => {
    const parts = path.split('/').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    let cur = '';
    for (let i = 0; i < parts.length; i++) {
      cur = cur ? `${cur}/${parts[i]}` : parts[i];
      if (!folderMap.has(cur)) {
        folderMap.set(cur, {
          path: cur,
          name: parts[i],
          depth: i,
          docs: [],
          children: [],
        });
      }
    }
    return folderMap.get(cur)!;
  };
  for (const ef of explicitFolders) {
    ensureFolder(ef.trim());
  }
  for (const d of docs) {
    const path = (d.folder ?? '').trim();
    if (!path) {
      rootDocs.push(d);
      continue;
    }
    const node = ensureFolder(path);
    if (!node) {
      rootDocs.push(d);
      continue;
    }
    node.docs.push(d);
  }
  const allPaths = [...folderMap.keys()].sort();
  const roots: FolderNode[] = [];
  for (const p of allPaths) {
    const node = folderMap.get(p)!;
    const slash = p.lastIndexOf('/');
    if (slash === -1) {
      roots.push(node);
    } else {
      const parent = folderMap.get(p.slice(0, slash));
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }
  rootDocs.sort((a, b) => a.title.localeCompare(b.title));
  for (const node of folderMap.values()) {
    node.docs.sort((a, b) => a.title.localeCompare(b.title));
  }
  return { rootDocs, folders: roots };
}

export function folderDocCount(node: FolderNode): number {
  return (
    node.docs.length +
    node.children.reduce((sum, c) => sum + folderDocCount(c), 0)
  );
}

export type FieldFilter = {
  // text
  contains?: string;
  // number
  numOp?: '=' | '>' | '<' | 'between';
  numValue?: number;
  numMin?: number;
  numMax?: number;
  // date
  dateFrom?: string;
  dateTo?: string;
  // enum
  enumEquals?: string;
};

export type ExploreFilter = {
  codeIds: Set<string> | null;
  textQuery: string;
  metadataFilters: Record<string, FieldFilter>;
  folder?: string | null;
};

export type SortKey =
  | 'created-desc'
  | 'created-asc'
  | 'code'
  | 'doc'
  | 'span-length'
  | `meta:${string}`;

export type ExploreRow = {
  projectId: string;
  projectName: string;
  doc: Document;
  annotation: Annotation;
  codePath: string;
  codeColor: string;
  span: string;
};

function matchesFieldFilter(value: unknown, filter: FieldFilter): boolean {
  const hasAny =
    !!filter.contains ||
    filter.numOp ||
    filter.dateFrom ||
    filter.dateTo ||
    filter.enumEquals;
  if (!hasAny) return true;
  if (value === null || value === undefined || value === '') return false;
  if (filter.contains) {
    if (!String(value).toLowerCase().includes(filter.contains.toLowerCase())) return false;
  }
  if (filter.numOp) {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    if (Number.isNaN(n)) return false;
    if (filter.numOp === '=' && filter.numValue !== undefined && n !== filter.numValue) return false;
    if (filter.numOp === '>' && filter.numValue !== undefined && !(n > filter.numValue)) return false;
    if (filter.numOp === '<' && filter.numValue !== undefined && !(n < filter.numValue)) return false;
    if (
      filter.numOp === 'between' &&
      ((filter.numMin !== undefined && n < filter.numMin) ||
        (filter.numMax !== undefined && n > filter.numMax))
    ) {
      return false;
    }
  }
  if (filter.dateFrom || filter.dateTo) {
    const s = String(value);
    if (filter.dateFrom && s < filter.dateFrom) return false;
    if (filter.dateTo && s > filter.dateTo) return false;
  }
  if (filter.enumEquals && String(value) !== filter.enumEquals) return false;
  return true;
}

export function exploreRows(
  projects: Project[],
  filter: ExploreFilter,
  sort: SortKey = 'created-desc',
): ExploreRow[] {
  const out: ExploreRow[] = [];
  const q = filter.textQuery.trim().toLowerCase();
  for (const p of projects) {
    const docById = new Map(p.documents.map((d) => [d.id, d]));
    for (const a of p.annotations) {
      const doc = docById.get(a.docId);
      if (!doc) continue;
      if (filter.codeIds && !filter.codeIds.has(a.codeId)) continue;
      if (filter.folder !== undefined && filter.folder !== null) {
        const f = doc.folder ?? '';
        if (filter.folder === '' && f !== '') continue;
        if (filter.folder !== '' && !f.startsWith(filter.folder)) continue;
      }
      let metaOk = true;
      for (const [k, ff] of Object.entries(filter.metadataFilters)) {
        if (!ff) continue;
        if (!matchesFieldFilter(doc.metadata[k], ff)) {
          metaOk = false;
          break;
        }
      }
      if (!metaOk) continue;
      const span = doc.text.slice(a.start, a.end);
      const note = a.note ?? '';
      if (q && !span.toLowerCase().includes(q) && !note.toLowerCase().includes(q)) continue;
      out.push({
        projectId: p.id,
        projectName: p.name,
        doc,
        annotation: a,
        codePath: codePathString(p.codes, a.codeId),
        codeColor: resolveColor(p.codes, a.codeId),
        span,
      });
    }
  }
  return sortRows(out, sort);
}

function sortRows(rows: ExploreRow[], sort: SortKey): ExploreRow[] {
  const arr = [...rows];
  if (sort === 'created-desc') {
    arr.sort((a, b) => b.annotation.created_at.localeCompare(a.annotation.created_at));
  } else if (sort === 'created-asc') {
    arr.sort((a, b) => a.annotation.created_at.localeCompare(b.annotation.created_at));
  } else if (sort === 'code') {
    arr.sort((a, b) => a.codePath.localeCompare(b.codePath));
  } else if (sort === 'doc') {
    arr.sort((a, b) => a.doc.title.localeCompare(b.doc.title));
  } else if (sort === 'span-length') {
    arr.sort((a, b) => b.span.length - a.span.length);
  } else if (sort.startsWith('meta:')) {
    const key = sort.slice('meta:'.length);
    arr.sort((a, b) => {
      const av = a.doc.metadata[key];
      const bv = b.doc.metadata[key];
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      return String(av).localeCompare(String(bv));
    });
  }
  return arr;
}

export function exploreCodeUniverse(projects: Project[]): {
  projectId: string;
  projectName: string;
  codes: Code[];
}[] {
  return projects.map((p) => ({
    projectId: p.id,
    projectName: p.name,
    codes: p.codes,
  }));
}

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
    list.sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return a.created_at.localeCompare(b.created_at);
    });
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
  pending?: boolean;
};

export function segmentText(
  text: string,
  annotations: Annotation[],
  pendingRange?: { start: number; end: number },
): Segment[] {
  const boundaries = new Set<number>([0, text.length]);
  for (const a of annotations) {
    boundaries.add(Math.max(0, Math.min(text.length, a.start)));
    boundaries.add(Math.max(0, Math.min(text.length, a.end)));
  }
  if (pendingRange) {
    boundaries.add(Math.max(0, Math.min(text.length, pendingRange.start)));
    boundaries.add(Math.max(0, Math.min(text.length, pendingRange.end)));
  }
  const sorted = [...boundaries].sort((a, b) => a - b);
  const segs: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (end <= start) continue;
    const covering = annotations.filter((a) => a.start <= start && a.end >= end);
    const isPending = !!(
      pendingRange && start >= pendingRange.start && end <= pendingRange.end
    );
    segs.push({
      start,
      end,
      text: text.slice(start, end),
      annotations: covering,
      pending: isPending,
    });
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

export function countWords(text: string): number {
  if (!text) return 0;
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

export function docAnnotationCount(project: Project, docId: string): number {
  let n = 0;
  for (const a of project.annotations) if (a.docId === docId) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Co-occurrence: for each project, find docs containing any focal annotation,
// then count which OTHER codes appear in those docs.
// ---------------------------------------------------------------------------

export type CoOccurrenceResult = {
  projectId: string;
  projectName: string;
  codeId: string;
  codePath: string;
  color: string;
  annotationCount: number; // total annotations of this code inside focal docs
  docCount: number; // distinct docs containing both focal and this code
};

export type CoOccurrenceFilter = {
  folder?: string | null;
  metadataFilters?: Record<string, FieldFilter>;
  docCharsFilter?: FieldFilter;
  docWordsFilter?: FieldFilter;
  docAnnotsFilter?: FieldFilter;
};

function docPassesFilter(
  doc: Document,
  annotCount: number,
  filter: CoOccurrenceFilter,
): boolean {
  if (filter.folder !== undefined && filter.folder !== null) {
    const f = doc.folder ?? '';
    if (filter.folder === '' && f !== '') return false;
    if (filter.folder !== '' && !f.startsWith(filter.folder)) return false;
  }
  if (filter.docCharsFilter && !matchesFieldFilter(doc.text.length, filter.docCharsFilter)) {
    return false;
  }
  if (filter.docWordsFilter && !matchesFieldFilter(countWords(doc.text), filter.docWordsFilter)) {
    return false;
  }
  if (filter.docAnnotsFilter && !matchesFieldFilter(annotCount, filter.docAnnotsFilter)) {
    return false;
  }
  if (filter.metadataFilters) {
    for (const [k, ff] of Object.entries(filter.metadataFilters)) {
      if (!ff) continue;
      if (!matchesFieldFilter(doc.metadata[k], ff)) return false;
    }
  }
  return true;
}

export function coOccurringCodes(
  projects: Project[],
  focalCodeIds: Set<string>,
  filter?: CoOccurrenceFilter,
): {
  focalDocCount: number;
  results: CoOccurrenceResult[];
} {
  const allResults: CoOccurrenceResult[] = [];
  let focalDocCount = 0;

  for (const p of projects) {
    // Pre-compute per-doc annotation counts (used by both the doc filter
    // and by counting below).
    const annotCountByDoc = new Map<string, number>();
    for (const a of p.annotations) {
      annotCountByDoc.set(a.docId, (annotCountByDoc.get(a.docId) ?? 0) + 1);
    }
    // Allowed docs = docs that pass the doc-level filter (metadata, folder,
    // doc stats). If no filter, all docs are allowed.
    const allowedDocs = new Set<string>();
    for (const d of p.documents) {
      if (!filter || docPassesFilter(d, annotCountByDoc.get(d.id) ?? 0, filter)) {
        allowedDocs.add(d.id);
      }
    }
    if (allowedDocs.size === 0) continue;
    // Build one "match group" per originally-selected code, each containing
    // that code id plus all its descendants. A doc is focal iff it has at
    // least one annotation in EVERY group (intersection across selected
    // codes, not union). "Other" codes shown afterwards are anything not
    // in any focal group.
    const groups: Set<string>[] = [];
    const allFocalIds = new Set<string>();
    for (const id of focalCodeIds) {
      if (p.codes.some((c) => c.id === id)) {
        const g = new Set<string>();
        for (const d of descendantIds(p.codes, id)) {
          g.add(d);
          allFocalIds.add(d);
        }
        groups.push(g);
      }
    }
    if (groups.length === 0) continue;

    // For each doc, track which groups it has hit. Skip annotations in
    // docs the filter excluded — those docs can't be focal.
    const groupsHitByDoc = new Map<string, Set<number>>();
    for (const a of p.annotations) {
      if (!allowedDocs.has(a.docId)) continue;
      for (let gi = 0; gi < groups.length; gi++) {
        if (groups[gi].has(a.codeId)) {
          let s = groupsHitByDoc.get(a.docId);
          if (!s) {
            s = new Set<number>();
            groupsHitByDoc.set(a.docId, s);
          }
          s.add(gi);
        }
      }
    }
    const focalDocs = new Set<string>();
    for (const [docId, hit] of groupsHitByDoc) {
      if (hit.size === groups.length) focalDocs.add(docId);
    }
    if (focalDocs.size === 0) continue;
    focalDocCount += focalDocs.size;

    const counts = new Map<string, { ann: number; docs: Set<string> }>();
    for (const a of p.annotations) {
      if (!focalDocs.has(a.docId)) continue;
      if (allFocalIds.has(a.codeId)) continue;
      const cur = counts.get(a.codeId) ?? { ann: 0, docs: new Set() };
      cur.ann += 1;
      cur.docs.add(a.docId);
      counts.set(a.codeId, cur);
    }

    for (const [codeId, { ann, docs }] of counts) {
      allResults.push({
        projectId: p.id,
        projectName: p.name,
        codeId,
        codePath: codePathString(p.codes, codeId),
        color: resolveColor(p.codes, codeId),
        annotationCount: ann,
        docCount: docs.size,
      });
    }
  }

  allResults.sort(
    (a, b) => b.docCount - a.docCount || b.annotationCount - a.annotationCount,
  );
  return { focalDocCount, results: allResults };
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

export type CodeFilterMode = 'or' | 'and';

export type ExploreFilter = {
  codeIds: Set<string> | null;
  codeFilterMode?: CodeFilterMode;
  textQuery: string;
  metadataFilters: Record<string, FieldFilter>;
  folder?: string | null;
  docCharsFilter?: FieldFilter;
  docWordsFilter?: FieldFilter;
  docAnnotsFilter?: FieldFilter;
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
  const mode = filter.codeFilterMode ?? 'or';
  const hasCodeFilter = !!filter.codeIds && filter.codeIds.size > 0;

  // Per-project, precompute the structures we need:
  //  - expanded: union of descendants of every selected code id that exists
  //    in this project (used for OR-mode annotation matching)
  //  - focalDocs: docs containing an annotation from EACH selected code's
  //    descendant group (used for AND-mode doc filtering)
  const expandedByProject = new Map<string, Set<string>>();
  const focalDocsByProject = new Map<string, Set<string>>();
  if (hasCodeFilter) {
    for (const p of projects) {
      const groups: Set<string>[] = [];
      const expanded = new Set<string>();
      for (const id of filter.codeIds!) {
        if (p.codes.some((c) => c.id === id)) {
          const g = new Set<string>();
          for (const d of descendantIds(p.codes, id)) {
            g.add(d);
            expanded.add(d);
          }
          groups.push(g);
        }
      }
      expandedByProject.set(p.id, expanded);
      if (mode === 'and') {
        if (groups.length === 0) {
          focalDocsByProject.set(p.id, new Set());
        } else {
          const hits = new Map<string, Set<number>>();
          for (const a of p.annotations) {
            for (let gi = 0; gi < groups.length; gi++) {
              if (groups[gi].has(a.codeId)) {
                let s = hits.get(a.docId);
                if (!s) {
                  s = new Set<number>();
                  hits.set(a.docId, s);
                }
                s.add(gi);
              }
            }
          }
          const focal = new Set<string>();
          for (const [docId, h] of hits) {
            if (h.size === groups.length) focal.add(docId);
          }
          focalDocsByProject.set(p.id, focal);
        }
      }
    }
  }

  for (const p of projects) {
    const docById = new Map(p.documents.map((d) => [d.id, d]));
    const annotCountByDoc = new Map<string, number>();
    for (const a of p.annotations) {
      annotCountByDoc.set(a.docId, (annotCountByDoc.get(a.docId) ?? 0) + 1);
    }
    const expanded = expandedByProject.get(p.id);
    const focalDocs = focalDocsByProject.get(p.id);
    for (const a of p.annotations) {
      const doc = docById.get(a.docId);
      if (!doc) continue;
      // Code filter: in OR mode, annotation's own code (or a descendant of a
      // selected parent) must be in scope. In AND mode, instead require that
      // its doc be a focal doc (one that contains an annotation from every
      // selected code group). All annotations in those docs are shown.
      if (hasCodeFilter) {
        if (mode === 'and') {
          if (!focalDocs || !focalDocs.has(a.docId)) continue;
        } else {
          if (!expanded || !expanded.has(a.codeId)) continue;
        }
      }
      if (filter.folder !== undefined && filter.folder !== null) {
        const f = doc.folder ?? '';
        if (filter.folder === '' && f !== '') continue;
        if (filter.folder !== '' && !f.startsWith(filter.folder)) continue;
      }
      if (filter.docCharsFilter && !matchesFieldFilter(doc.text.length, filter.docCharsFilter)) {
        continue;
      }
      if (filter.docWordsFilter && !matchesFieldFilter(countWords(doc.text), filter.docWordsFilter)) {
        continue;
      }
      if (
        filter.docAnnotsFilter &&
        !matchesFieldFilter(annotCountByDoc.get(doc.id) ?? 0, filter.docAnnotsFilter)
      ) {
        continue;
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

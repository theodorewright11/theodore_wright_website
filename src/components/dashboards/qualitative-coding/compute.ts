import type { Annotation, Code, Document, Project } from './types';
import { PALETTE } from './types';

// A code can have multiple parents, so the codebook view is a DAG flattened
// into a tree by *duplicating* the code under each of its parents. Each
// CodeNode records the parent context it's rendered under (parentId) and a
// pathKey unique across instances, for stable React keys.
export type CodeNode = {
  code: Code;
  depth: number;
  parentId: string | null;
  pathKey: string;
  children: CodeNode[];
};

const sortCodes = (a: Code, b: Code) => {
  const ao = a.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.created_at.localeCompare(b.created_at);
};

export function buildCodeTree(codes: Code[]): CodeNode[] {
  // childrenByParent[X] = codes that list X in their parentIds, OR — if X is
  // null — codes whose parentIds is empty (top-level / roots).
  const byParent = new Map<string | null, Code[]>();
  for (const c of codes) {
    if (c.parentIds.length === 0) {
      const list = byParent.get(null) ?? [];
      list.push(c);
      byParent.set(null, list);
    } else {
      for (const pid of c.parentIds) {
        const list = byParent.get(pid) ?? [];
        list.push(c);
        byParent.set(pid, list);
      }
    }
  }
  for (const list of byParent.values()) list.sort(sortCodes);
  const build = (
    parentId: string | null,
    depth: number,
    seen: Set<string>,
    pathPrefix: string,
  ): CodeNode[] =>
    (byParent.get(parentId) ?? []).map((code) => {
      const pathKey = pathPrefix + '>' + code.id;
      // Guard against accidental cycles in the DAG so we don't recurse forever.
      const nextSeen = new Set(seen);
      if (nextSeen.has(code.id)) {
        return { code, depth, parentId, pathKey, children: [] };
      }
      nextSeen.add(code.id);
      return {
        code,
        depth,
        parentId,
        pathKey,
        children: build(code.id, depth + 1, nextSeen, pathKey),
      };
    });
  return build(null, 0, new Set(), '');
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

// First-parent path to the root. With multi-parent codes a code can have many
// paths to root; this returns just the first one for display purposes
// (annotations, popovers, breadcrumbs).
export function codePath(codes: Code[], codeId: string): Code[] {
  const byId = new Map(codes.map((c) => [c.id, c]));
  const path: Code[] = [];
  const seen = new Set<string>();
  let cur: Code | undefined = byId.get(codeId);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    const firstParent = cur.parentIds[0];
    cur = firstParent ? byId.get(firstParent) : undefined;
  }
  return path;
}

export function codePathString(codes: Code[], codeId: string, sep = ' / '): string {
  return codePath(codes, codeId)
    .map((c) => c.name)
    .join(sep);
}

// All codes reachable downward from codeId via parentIds → id edges. Includes
// codeId itself. DAG-aware: a code reachable through multiple parents is only
// counted once.
export function descendantIds(codes: Code[], codeId: string): Set<string> {
  const out = new Set<string>([codeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of codes) {
      if (out.has(c.id)) continue;
      if (c.parentIds.some((p) => out.has(p))) {
        out.add(c.id);
        changed = true;
      }
    }
  }
  return out;
}

// Resolve a code's display color, walking up first-parent chain when the
// code's own color is unset.
export function resolveColor(codes: Code[], codeId: string): string {
  const byId = new Map(codes.map((c) => [c.id, c]));
  const seen = new Set<string>();
  let cur: Code | undefined = byId.get(codeId);
  while (cur && !seen.has(cur.id)) {
    if (cur.color) return cur.color;
    seen.add(cur.id);
    const firstParent = cur.parentIds[0];
    cur = firstParent ? byId.get(firstParent) : undefined;
  }
  return '#64748b';
}

// Mean accuracy score across all annotations for a code id. Returns null if
// no annotations have an accuracy rating yet. Includes ONLY annotations
// directly using this code id (not descendants — specificity is per code).
export function meanAccuracyForCode(
  annotations: Annotation[],
  codeId: string,
): { mean: number; count: number } | null {
  let sum = 0;
  let n = 0;
  for (const a of annotations) {
    if (a.codeId !== codeId) continue;
    if (typeof a.accuracy !== 'number') continue;
    sum += a.accuracy;
    n += 1;
  }
  if (n === 0) return null;
  return { mean: sum / n, count: n };
}

export function nextPaletteColor(codes: Code[]): string {
  const used = new Set(
    codes
      .filter((c) => c.parentIds.length === 0 && c.color)
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

// Returns the annotation's ranges, defensively tolerating missing data.
// Some in-memory annotations could lack ranges briefly (e.g. mid-migration);
// helpers treat that as zero ranges.
export function annRanges(a: Annotation): { start: number; end: number }[] {
  return Array.isArray(a.ranges) ? a.ranges : [];
}

// Smallest start across an annotation's ranges. Useful for sort/position.
export function annStart(a: Annotation): number {
  const rs = annRanges(a);
  if (rs.length === 0) return 0;
  let m = rs[0].start;
  for (const r of rs) if (r.start < m) m = r.start;
  return m;
}

// Largest end across an annotation's ranges.
export function annEnd(a: Annotation): number {
  const rs = annRanges(a);
  if (rs.length === 0) return 0;
  let m = rs[0].end;
  for (const r of rs) if (r.end > m) m = r.end;
  return m;
}

// Concatenate every range's slice with " … " between, for compact preview.
export function annText(a: Annotation, docText: string): string {
  return annRanges(a)
    .map((r) => docText.slice(r.start, r.end))
    .filter((s) => s.length > 0)
    .join(' … ');
}

export function segmentText(
  text: string,
  annotations: Annotation[],
  pendingRange?: { start: number; end: number },
): Segment[] {
  const boundaries = new Set<number>([0, text.length]);
  for (const a of annotations) {
    for (const r of annRanges(a)) {
      boundaries.add(Math.max(0, Math.min(text.length, r.start)));
      boundaries.add(Math.max(0, Math.min(text.length, r.end)));
    }
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
    // An annotation covers this segment if ANY of its ranges contains it.
    const covering = annotations.filter((a) =>
      annRanges(a).some((r) => r.start <= start && r.end >= end),
    );
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
    .sort((a, b) => annStart(a) - annStart(b) || annEnd(a) - annEnd(b));
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

// ---------------------------------------------------------------------------
// Line splitting for line-by-line view.
// ---------------------------------------------------------------------------

export type LinesMode = 'sentence' | 'chars';

export type LineEntry = {
  number: number;
  start: number;
  end: number;
  text: string;
  isBlank: boolean;
};

// Common English abbreviations that look like sentence enders but aren't.
// Lowercased; matched against the word immediately preceding the period.
const SENTENCE_ABBREVIATIONS = new Set([
  'dr', 'mr', 'mrs', 'ms', 'jr', 'sr', 'prof', 'st', 'mt',
  'inc', 'ltd', 'co', 'corp',
  'etc', 'eg', 'ie', 'vs', 'no', 'cf', 'al', 'approx', 'ca',
  'rev', 'hon', 'gen', 'col', 'capt', 'lt', 'sgt', 'cmdr', 'maj',
  'rep', 'sen', 'gov', 'pres', 'sec',
  'phd', 'md', 'ba', 'ma', 'bsc', 'msc', 'dds', 'do',
  'fig', 'vol', 'pg', 'pp', 'ed', 'eds',
  'am', 'pm',
]);

// Inside a single paragraph (no \n), find the END positions (exclusive) of
// each sentence, where trailing inter-sentence whitespace is attached to the
// sentence that just ended. So a sentence "owns" its trailing space.
function findSentenceEnds(paragraph: string): number[] {
  const ends: number[] = [];
  let i = 0;
  while (i < paragraph.length) {
    const ch = paragraph[i];
    if (ch === '.' || ch === '!' || ch === '?') {
      // Skip duplicate punctuation (e.g., "!!!")
      let punctEnd = i + 1;
      while (
        punctEnd < paragraph.length &&
        (paragraph[punctEnd] === '.' ||
          paragraph[punctEnd] === '!' ||
          paragraph[punctEnd] === '?')
      ) {
        punctEnd++;
      }
      // Treat the punctuation run as a single sentence terminator.
      const isLast = punctEnd >= paragraph.length;
      let nextNonWs = punctEnd;
      while (nextNonWs < paragraph.length && /\s/.test(paragraph[nextNonWs])) {
        nextNonWs++;
      }
      const followsWithCap =
        nextNonWs < paragraph.length &&
        /[A-Z0-9"'(\[]/.test(paragraph[nextNonWs]);

      if (!isLast && !followsWithCap) {
        i = punctEnd;
        continue;
      }
      // Abbreviation check (only meaningful for '.')
      if (ch === '.' && punctEnd - i === 1) {
        let wstart = i - 1;
        while (wstart >= 0 && /[a-zA-Z]/.test(paragraph[wstart])) wstart--;
        const word = paragraph.slice(wstart + 1, i).toLowerCase();
        if (SENTENCE_ABBREVIATIONS.has(word)) {
          i = punctEnd;
          continue;
        }
        // Single-letter "initial" pattern: " J." in "T. J. Wright" — treat as
        // abbreviation if word is a single uppercase letter.
        if (word.length === 1 && /[A-Z]/.test(paragraph[wstart + 1])) {
          i = punctEnd;
          continue;
        }
      }
      ends.push(nextNonWs);
      i = nextNonWs;
      continue;
    }
    i++;
  }
  return ends;
}

export function buildLines(
  text: string,
  mode: LinesMode,
  charsPerLine = 100,
): LineEntry[] {
  const out: LineEntry[] = [];
  let lineNum = 1;
  let pos = 0;
  const paragraphs = text.split('\n');
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const para = paragraphs[pi];
    const paraStart = pos;

    if (para.length === 0) {
      out.push({
        number: lineNum++,
        start: pos,
        end: pos,
        text: '',
        isBlank: true,
      });
    } else if (mode === 'sentence') {
      const ends = findSentenceEnds(para);
      let prev = 0;
      for (const e of ends) {
        if (e <= prev) continue;
        out.push({
          number: lineNum++,
          start: paraStart + prev,
          end: paraStart + e,
          text: para.slice(prev, e),
          isBlank: false,
        });
        prev = e;
      }
      if (prev < para.length) {
        out.push({
          number: lineNum++,
          start: paraStart + prev,
          end: paraStart + para.length,
          text: para.slice(prev),
          isBlank: false,
        });
      }
    } else {
      // chars
      for (let off = 0; off < para.length; off += charsPerLine) {
        const end = Math.min(off + charsPerLine, para.length);
        out.push({
          number: lineNum++,
          start: paraStart + off,
          end: paraStart + end,
          text: para.slice(off, end),
          isBlank: false,
        });
      }
    }
    pos += para.length + 1; // +1 for the \n separator (not present after last paragraph)
  }
  return out;
}

// ---------------------------------------------------------------------------
// Color helpers — convert hex ↔ HSL and generate a shade ramp from a base
// color. Used by the code colour picker to expand each palette swatch into
// a lighter→darker gradient.
// ---------------------------------------------------------------------------

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m || m.length < 3) return { h: 0, s: 0, l: 50 };
  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => {
    const c = lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Generate `count` shades for a base hex color, from lightest to darkest.
// The base color is approximately at the middle index when count is odd.
export function getShades(hex: string, count = 5): string[] {
  const { h, s } = hexToHsl(hex);
  const sat = Math.max(s, 45);
  // 5-shade target lightness curve: very-light, light, base-ish, dark, very-dark
  const lights = count === 5 ? [86, 70, 52, 36, 22] : null;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const l =
      lights && i < lights.length
        ? lights[i]
        : count === 1
          ? 50
          : 85 - (i / (count - 1)) * 65;
    out.push(hslToHex(h, sat, l));
  }
  return out;
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
  // 'and' = focal docs must contain ALL selected codes (intersection).
  // 'or'  = focal docs contain ANY selected code (union). Defaults to 'and'
  // to preserve the original behavior.
  mode: CodeFilterMode = 'and',
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
      // AND: must hit every group. OR: hitting at least one group is enough.
      if (mode === 'and' ? hit.size === groups.length : hit.size > 0) {
        focalDocs.add(docId);
      }
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
  // Natural sort: "comment 2" comes before "comment 11" instead of after it.
  const cmp = (a: Document, b: Document) =>
    a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
  rootDocs.sort(cmp);
  for (const node of folderMap.values()) {
    node.docs.sort(cmp);
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
  // Phase 4a rating + theme filters. All optional.
  // Sets of allowed score values: empty/undefined = no filter.
  codeSpecificityValues?: Set<number>;
  annotationAccuracyValues?: Set<number>;
  themeId?: string;
  themeWeight?: 'all' | 'core' | 'supporting';
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
    const codeById = new Map(p.codes.map((c) => [c.id, c]));
    const annotCountByDoc = new Map<string, number>();
    for (const a of p.annotations) {
      annotCountByDoc.set(a.docId, (annotCountByDoc.get(a.docId) ?? 0) + 1);
    }
    const expanded = expandedByProject.get(p.id);
    const focalDocs = focalDocsByProject.get(p.id);
    // Phase 4a: precompute the theme link map for the selected theme.
    // themeLinks[annotationId] => weight, or undefined if not in theme.
    const themeLinks = new Map<string, 'core' | 'supporting'>();
    if (filter.themeId) {
      const theme = (p.themes ?? []).find((t) => t.id === filter.themeId);
      if (theme) {
        for (const link of theme.annotationLinks) {
          themeLinks.set(link.annotationId, link.weight);
        }
        // Auto-include codes contribute 'supporting' weight implicitly.
        if (theme.includeCodeIds.length > 0) {
          const codeIdSet = new Set<string>();
          for (const cid of theme.includeCodeIds) {
            for (const d of descendantIds(p.codes, cid)) codeIdSet.add(d);
          }
          for (const a of p.annotations) {
            if (themeLinks.has(a.id)) continue;
            if (codeIdSet.has(a.codeId)) themeLinks.set(a.id, 'supporting');
          }
        }
      }
    }
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
      // Phase 4a: rating filters (allowed value sets).
      if (filter.codeSpecificityValues && filter.codeSpecificityValues.size > 0) {
        const c = codeById.get(a.codeId);
        if (!c || !c.specificity || !filter.codeSpecificityValues.has(c.specificity)) continue;
      }
      if (filter.annotationAccuracyValues && filter.annotationAccuracyValues.size > 0) {
        if (!a.accuracy || !filter.annotationAccuracyValues.has(a.accuracy)) continue;
      }
      // Phase 4a: theme filter.
      if (filter.themeId) {
        const w = themeLinks.get(a.id);
        if (!w) continue;
        if (filter.themeWeight && filter.themeWeight !== 'all' && w !== filter.themeWeight) continue;
      }
      const span = annText(a, doc.text);
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

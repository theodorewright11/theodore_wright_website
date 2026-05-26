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

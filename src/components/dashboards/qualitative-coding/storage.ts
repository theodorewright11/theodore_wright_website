import type { AppState, Project } from './types';

const KEY = 'tw-qual-coding-v1';

const empty: AppState = {
  version: 1,
  projects: [],
  activeProjectId: null,
  exploreProjectIds: [],
  view: 'documents',
  showCodeDefinitions: false,
  sidebarCollapsed: false,
  deletedProjectIds: [],
};

export function loadState(): AppState {
  if (typeof window === 'undefined') return empty;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && Array.isArray(parsed.projects)) {
      return {
        version: 1,
        projects: parsed.projects.map(coerceProject),
        activeProjectId: parsed.activeProjectId ?? null,
        exploreProjectIds: Array.isArray(parsed.exploreProjectIds) ? parsed.exploreProjectIds : [],
        view:
          parsed.view === 'explore' ||
          parsed.view === 'about' ||
          parsed.view === 'codebook' ||
          parsed.view === 'themes' ||
          parsed.view === 'grading'
            ? parsed.view
            : 'documents',
        showCodeDefinitions: !!parsed.showCodeDefinitions,
        sidebarCollapsed: !!parsed.sidebarCollapsed,
        sidebarWidth: typeof parsed.sidebarWidth === 'number' ? parsed.sidebarWidth : undefined,
        notesWidth: typeof parsed.notesWidth === 'number' ? parsed.notesWidth : undefined,
        codebookWidth: typeof parsed.codebookWidth === 'number' ? parsed.codebookWidth : undefined,
        annotationsPanelHeight:
          typeof parsed.annotationsPanelHeight === 'number'
            ? parsed.annotationsPanelHeight
            : undefined,
        annotationsPanelCollapsed: !!parsed.annotationsPanelCollapsed,
        metadataCollapsed: !!parsed.metadataCollapsed,
        exploreFiltersCollapsed: !!parsed.exploreFiltersCollapsed,
        exploreCoOccurrenceCollapsed: !!parsed.exploreCoOccurrenceCollapsed,
        lineView: !!parsed.lineView,
        linesMode: parsed.linesMode === 'chars' ? 'chars' : 'sentence',
        linesCharsN:
          typeof parsed.linesCharsN === 'number' && parsed.linesCharsN > 0
            ? parsed.linesCharsN
            : undefined,
        deletedProjectIds: Array.isArray(parsed.deletedProjectIds)
          ? parsed.deletedProjectIds.filter((s: any) => typeof s === 'string')
          : [],
        openDocIds: Array.isArray(parsed.openDocIds)
          ? parsed.openDocIds.filter((s: any) => typeof s === 'string')
          : [],
        collapsedCodeIds: Array.isArray(parsed.collapsedCodeIds)
          ? parsed.collapsedCodeIds.filter((s: any) => typeof s === 'string')
          : [],
        exploreViewMode:
          parsed.exploreViewMode === 'by-code' ? 'by-code' : 'flat',
        exploreShowMeta: parsed.exploreShowMeta !== false,
        exploreShowNotes: parsed.exploreShowNotes !== false,
        exploreShowFullDoc: !!parsed.exploreShowFullDoc,
        popoverShowThemeAdd: parsed.popoverShowThemeAdd !== false,
        docShowCodes: parsed.docShowCodes !== false,
        docShowThemes: !!parsed.docShowThemes,
        activeThemeId:
          typeof parsed.activeThemeId === 'string' ? parsed.activeThemeId : null,
      };
    }
  } catch {
    // fall through
  }
  return empty;
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function coerceProject(p: any): Project {
  const docs = Array.isArray(p.documents) ? p.documents : [];
  return {
    version: 1,
    id: String(p.id ?? cryptoRandomId()),
    name: String(p.name ?? 'Untitled project'),
    description: p.description ?? undefined,
    about: typeof p.about === 'string' ? p.about : undefined,
    metadataSchema: Array.isArray(p.metadataSchema) ? p.metadataSchema : [],
    documents: docs.map((d: any) => ({
      ...d,
      kind: d.kind === 'note' ? 'note' : 'document',
      folder: typeof d.folder === 'string' && d.folder.trim() ? d.folder : undefined,
      notes: typeof d.notes === 'string' ? d.notes : undefined,
      metadata: d.metadata && typeof d.metadata === 'object' ? d.metadata : {},
    })),
    codes: Array.isArray(p.codes) ? p.codes.map(coerceCode) : [],
    annotations: Array.isArray(p.annotations) ? p.annotations.map(coerceAnnotation) : [],
    themes: Array.isArray(p.themes) ? p.themes.map(coerceTheme) : [],
    folders: Array.isArray(p.folders) ? p.folders.filter((f: any) => typeof f === 'string') : [],
    lowEffort: !!p.lowEffort,
    additionalText: typeof p.additionalText === 'string' ? p.additionalText : undefined,
    created_at: p.created_at ?? new Date().toISOString(),
    updated_at: p.updated_at ?? new Date().toISOString(),
    drive:
      p.drive && typeof p.drive === 'object' && (p.drive.folderId || p.drive.fileId)
        ? p.drive
        : undefined,
  };
}

// Migrate legacy { parentId: string|null } codes to the multi-parent shape
// { parentIds: string[] }. Idempotent — already-migrated codes pass through.
function coerceCode(c: any) {
  if (Array.isArray(c?.parentIds)) {
    return {
      ...c,
      parentIds: c.parentIds.filter((p: any) => typeof p === 'string'),
    };
  }
  const legacy = c?.parentId;
  const parentIds = typeof legacy === 'string' && legacy.length > 0 ? [legacy] : [];
  const { parentId: _unused, ...rest } = c ?? {};
  return { ...rest, parentIds };
}

// Migrate legacy single-range annotations `{ start, end }` to the new shape
// `{ ranges: [{ start, end }] }`. Idempotent.
function coerceAnnotation(a: any) {
  if (Array.isArray(a?.ranges) && a.ranges.length > 0) {
    return {
      ...a,
      ranges: a.ranges
        .filter(
          (r: any) =>
            r && typeof r.start === 'number' && typeof r.end === 'number',
        )
        .map((r: any) => ({ start: r.start, end: r.end })),
    };
  }
  const { start, end, ...rest } = a ?? {};
  if (typeof start === 'number' && typeof end === 'number') {
    return { ...rest, ranges: [{ start, end }] };
  }
  return { ...rest, ranges: [] };
}

// Tolerant theme migration. Empty arrays for missing collections; weights
// constrained to 'core' | 'supporting' with 'supporting' as the default.
function coerceTheme(t: any) {
  const links = Array.isArray(t?.annotationLinks) ? t.annotationLinks : [];
  const definition = typeof t?.definition === 'string' ? t.definition : undefined;
  const legacyDescription = typeof t?.description === 'string' ? t.description : undefined;
  return {
    id: typeof t?.id === 'string' ? t.id : cryptoRandomId(),
    name: typeof t?.name === 'string' ? t.name : 'Untitled theme',
    // Migrate a legacy single `description` narrative into `definition` when no
    // definition is set, so old themes surface (and stay editable) in the new
    // two-field UI. Once `definition` exists this is a no-op.
    definition: definition ?? legacyDescription,
    reasoning: typeof t?.reasoning === 'string' ? t.reasoning : undefined,
    description: definition ? legacyDescription : undefined,
    parentIds: Array.isArray(t?.parentIds)
      ? t.parentIds.filter((s: any) => typeof s === 'string')
      : [],
    color: typeof t?.color === 'string' ? t.color : null,
    order: typeof t?.order === 'number' ? t.order : undefined,
    annotationLinks: links
      .filter((l: any) => l && typeof l.annotationId === 'string')
      .map((l: any) => ({
        annotationId: l.annotationId,
        weight: l.weight === 'core' ? 'core' : 'supporting',
      })),
    includeCodeIds: Array.isArray(t?.includeCodeIds)
      ? t.includeCodeIds.filter((s: any) => typeof s === 'string')
      : [],
    similarThemeIds: Array.isArray(t?.similarThemeIds)
      ? t.similarThemeIds.filter((s: any) => typeof s === 'string')
      : undefined,
    extraQuotes: Array.isArray(t?.extraQuotes)
      ? t.extraQuotes
          .filter((q: any) => q && typeof q.text === 'string')
          .map((q: any) => ({
            text: q.text,
            source: typeof q.source === 'string' ? q.source : undefined,
            role: q.role === 'core' || q.role === 'supporting' ? q.role : undefined,
            possibleSources: Array.isArray(q.possibleSources)
              ? q.possibleSources
                  .filter(
                    (p: any) => p && typeof p.source === 'string' && typeof p.score === 'number',
                  )
                  .map((p: any) => ({ source: p.source, score: p.score }))
              : undefined,
          }))
      : undefined,
    uncodedHighlights: Array.isArray(t?.uncodedHighlights)
      ? t.uncodedHighlights
          .filter(
            (h: any) =>
              h &&
              typeof h.docId === 'string' &&
              Array.isArray(h.ranges) &&
              h.ranges.length > 0,
          )
          .map((h: any) => ({
            id: typeof h.id === 'string' ? h.id : cryptoRandomId(),
            docId: h.docId,
            ranges: h.ranges
              .filter(
                (r: any) =>
                  r && typeof r.start === 'number' && typeof r.end === 'number',
              )
              .map((r: any) => ({ start: r.start, end: r.end })),
            weight: h.weight === 'core' ? 'core' : 'supporting',
            note: typeof h.note === 'string' ? h.note : undefined,
            created_at:
              typeof h.created_at === 'string'
                ? h.created_at
                : new Date().toISOString(),
          }))
      : [],
    rating:
      t?.rating && typeof t.rating === 'object'
        ? {
            grounding: clampRating(t.rating.grounding),
            usefulness: clampRating(t.rating.usefulness),
            independence: clampRating(t.rating.independence),
            interpretationLevel: clampRating(t.rating.interpretationLevel),
            prevalence: clampRating(t.rating.prevalence),
            novelty: clampRating(t.rating.novelty),
            notes:
              typeof t.rating.notes === 'string' ? t.rating.notes : undefined,
          }
        : undefined,
    created_at:
      typeof t?.created_at === 'string'
        ? t.created_at
        : new Date().toISOString(),
  };
}

function clampRating(v: any): 1 | 2 | 3 | 4 | 5 | undefined {
  if (v === 1 || v === 2 || v === 3 || v === 4 || v === 5) return v;
  return undefined;
}

export function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function newProject(name: string): Project {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: cryptoRandomId(),
    name,
    metadataSchema: [],
    documents: [],
    codes: [],
    annotations: [],
    created_at: now,
    updated_at: now,
  };
}

export function downloadJSON(filename: string, data: unknown): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(filename, blob);
}

export function downloadText(filename: string, text: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(filename, blob);
}

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Auto-converts double-hyphen to em-dash. Safe for prose fields where character
// offsets don't carry semantic meaning. Do NOT apply to Document.text — that
// would shift annotation offsets.
export function emDash(s: string): string {
  return s.replace(/--/g, '—');
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

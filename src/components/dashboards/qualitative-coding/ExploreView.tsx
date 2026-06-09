import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCodeTree,
  codePathString,
  coOccurringCodes,
  exploreRows,
  flattenTree,
  resolveColor,
  type CodeFilterMode,
  type ExploreRow,
  type FieldFilter,
  type SortKey,
} from './compute';
import type { MetadataField, Project } from './types';

export type ExploreFilterState = {
  textQuery: string;
  selectedCodeIds: Set<string>;
  codeFilterMode: CodeFilterMode;
  metaFilters: Record<string, FieldFilter>;
  folderFilter: string;
  sort: SortKey;
  docCharsFilter: FieldFilter;
  docWordsFilter: FieldFilter;
  docAnnotsFilter: FieldFilter;
  // Rating filters: set of allowed scores. Empty/undefined = any; otherwise
  // the code/annotation's score must be IN the set. Lets you express both
  // "≥ 4" ({4,5}) and "exactly 3" ({3}).
  codeSpecificityValues?: Set<number>;
  annotationAccuracyValues?: Set<number>;
  // Theme filter: limit rows to annotations linked to this theme. Optional
  // weightFilter restricts to a single weight.
  themeId?: string;
  themeWeight?: 'all' | 'core' | 'supporting';
};

export const defaultExploreFilterState = (): ExploreFilterState => ({
  textQuery: '',
  selectedCodeIds: new Set(),
  codeFilterMode: 'or',
  metaFilters: {},
  folderFilter: '',
  sort: 'created-desc',
  docCharsFilter: {},
  docWordsFilter: {},
  docAnnotsFilter: {},
});

type Props = {
  projects: Project[];
  filtersCollapsed: boolean;
  coOccurrenceCollapsed: boolean;
  filterState: ExploreFilterState;
  onChangeFilter: (patch: Partial<ExploreFilterState>) => void;
  onToggleFilters: () => void;
  onToggleCoOccurrence: () => void;
  viewMode?: 'flat' | 'by-code';
  showMeta?: boolean;
  showNotes?: boolean;
  onSetViewMode?: (m: 'flat' | 'by-code') => void;
  onToggleShowMeta?: () => void;
  onToggleShowNotes?: () => void;
  onJumpToAnnotation: (projectId: string, docId: string, annotationId: string) => void;
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'created-desc', label: 'Newest first' },
  { value: 'created-asc', label: 'Oldest first' },
  { value: 'code', label: 'By code' },
  { value: 'doc', label: 'By document' },
  { value: 'span-length', label: 'Longest span' },
];

export default function ExploreView({
  projects,
  filtersCollapsed,
  coOccurrenceCollapsed,
  filterState,
  onChangeFilter,
  onToggleFilters,
  onToggleCoOccurrence,
  viewMode = 'flat',
  showMeta = true,
  showNotes = true,
  onSetViewMode,
  onToggleShowMeta,
  onToggleShowNotes,
  onJumpToAnnotation,
}: Props) {
  const {
    textQuery,
    selectedCodeIds,
    codeFilterMode,
    metaFilters,
    folderFilter,
    sort,
    docCharsFilter,
    docWordsFilter,
    docAnnotsFilter,
    codeSpecificityValues,
    annotationAccuracyValues,
    themeId,
    themeWeight,
  } = filterState;
  const setTextQuery = (v: string) => onChangeFilter({ textQuery: v });
  const setSelectedCodeIds = (
    v: Set<string> | ((prev: Set<string>) => Set<string>),
  ) =>
    onChangeFilter({
      selectedCodeIds:
        typeof v === 'function' ? (v as any)(filterState.selectedCodeIds) : v,
    });
  const setCodeFilterMode = (v: CodeFilterMode) => onChangeFilter({ codeFilterMode: v });
  const setMetaFilters = (
    v:
      | Record<string, FieldFilter>
      | ((prev: Record<string, FieldFilter>) => Record<string, FieldFilter>),
  ) =>
    onChangeFilter({
      metaFilters:
        typeof v === 'function' ? (v as any)(filterState.metaFilters) : v,
    });
  const setFolderFilter = (v: string) => onChangeFilter({ folderFilter: v });
  const setSort = (v: SortKey) => onChangeFilter({ sort: v });
  const setDocCharsFilter = (v: FieldFilter) => onChangeFilter({ docCharsFilter: v });
  const setDocWordsFilter = (v: FieldFilter) => onChangeFilter({ docWordsFilter: v });
  const setDocAnnotsFilter = (v: FieldFilter) => onChangeFilter({ docAnnotsFilter: v });
  const setCodeSpecificityValues = (v?: Set<number>) =>
    onChangeFilter({ codeSpecificityValues: v && v.size > 0 ? v : undefined });
  const setAnnotationAccuracyValues = (v?: Set<number>) =>
    onChangeFilter({ annotationAccuracyValues: v && v.size > 0 ? v : undefined });
  const setThemeId = (v?: string) => onChangeFilter({ themeId: v });
  const setThemeWeight = (v?: 'all' | 'core' | 'supporting') => onChangeFilter({ themeWeight: v });

  const [codePickerOpen, setCodePickerOpen] = useState(false);
  const [codePickerQuery, setCodePickerQuery] = useState('');
  const codePickerRef = useRef<HTMLDivElement>(null);

  const metadataFields = useMemo<MetadataField[]>(() => {
    const m = new Map<string, MetadataField>();
    for (const p of projects) {
      for (const f of p.metadataSchema) {
        if (!m.has(f.key)) m.set(f.key, f);
      }
    }
    return [...m.values()];
  }, [projects]);

  const allFolders = useMemo(() => {
    const s = new Set<string>();
    for (const p of projects) {
      for (const d of p.documents) {
        if (d.folder) s.add(d.folder);
      }
    }
    return [...s].sort();
  }, [projects]);

  const rows = useMemo<ExploreRow[]>(() => {
    return exploreRows(
      projects,
      {
        codeIds: selectedCodeIds.size > 0 ? selectedCodeIds : null,
        codeFilterMode,
        textQuery,
        metadataFilters: metaFilters,
        folder: folderFilter ? folderFilter : undefined,
        docCharsFilter,
        docWordsFilter,
        docAnnotsFilter,
        codeSpecificityValues,
        annotationAccuracyValues,
        themeId,
        themeWeight,
      },
      sort,
    );
  }, [projects, selectedCodeIds, codeFilterMode, textQuery, metaFilters, folderFilter, sort, docCharsFilter, docWordsFilter, docAnnotsFilter, codeSpecificityValues, annotationAccuracyValues, themeId, themeWeight]);

  useEffect(() => {
    if (!codePickerOpen) {
      setCodePickerQuery('');
      return;
    }
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (codePickerRef.current && !codePickerRef.current.contains(t)) {
        setCodePickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCodePickerOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [codePickerOpen]);

  const coOccurrence = useMemo(() => {
    if (selectedCodeIds.size === 0) return null;
    return coOccurringCodes(
      projects,
      selectedCodeIds,
      {
        folder: folderFilter ? folderFilter : undefined,
        metadataFilters: metaFilters,
        docCharsFilter,
        docWordsFilter,
        docAnnotsFilter,
      },
      codeFilterMode,
    );
  }, [
    projects,
    selectedCodeIds,
    codeFilterMode,
    folderFilter,
    metaFilters,
    docCharsFilter,
    docWordsFilter,
    docAnnotsFilter,
  ]);

  const stats = useMemo(() => {
    const uniqueCodes = new Set(rows.map((r) => r.annotation.codeId));
    const uniqueDocs = new Set(rows.map((r) => `${r.projectId}::${r.doc.id}`));
    const byCode = new Map<string, { count: number; color: string; path: string }>();
    for (const r of rows) {
      const key = `${r.projectId}::${r.annotation.codeId}`;
      const cur = byCode.get(key);
      if (cur) cur.count++;
      else byCode.set(key, { count: 1, color: r.codeColor, path: r.codePath });
    }
    const topCodes = [...byCode.values()].sort((a, b) => b.count - a.count).slice(0, 6);
    return {
      total: rows.length,
      uniqueCodes: uniqueCodes.size,
      uniqueDocs: uniqueDocs.size,
      topCodes,
    };
  }, [rows]);

  const toggleCode = (codeId: string) => {
    setSelectedCodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(codeId)) next.delete(codeId);
      else next.add(codeId);
      return next;
    });
  };

  const clearAllFilters = () => {
    onChangeFilter({
      textQuery: '',
      selectedCodeIds: new Set(),
      metaFilters: {},
      folderFilter: '',
      docCharsFilter: {},
      docWordsFilter: {},
      docAnnotsFilter: {},
      codeSpecificityValues: undefined,
      annotationAccuracyValues: undefined,
      themeId: undefined,
      themeWeight: undefined,
    });
  };

  const hasFilters =
    textQuery.length > 0 ||
    selectedCodeIds.size > 0 ||
    folderFilter.length > 0 ||
    Object.values(metaFilters).some(hasAnyFilter) ||
    hasAnyFilter(docCharsFilter) ||
    hasAnyFilter(docWordsFilter) ||
    hasAnyFilter(docAnnotsFilter) ||
    (codeSpecificityValues?.size ?? 0) > 0 ||
    (annotationAccuracyValues?.size ?? 0) > 0 ||
    !!themeId;

  // Themes across all projects in view, for the theme-filter picker.
  const allThemes = useMemo(() => {
    const out: { projectId: string; projectName: string; id: string; name: string }[] = [];
    for (const p of projects) {
      for (const t of p.themes ?? []) {
        out.push({ projectId: p.id, projectName: p.name, id: t.id, name: t.name });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const showProjectChips = projects.length > 1;

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white">
      <div className="px-8 py-2.5 border-b border-slate-200 bg-white">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-baseline gap-3 min-w-0">
              <h1
                className="font-bold text-[20px] text-slate-900 leading-tight truncate"
                style={{ letterSpacing: '-0.02em' }}
              >
                {projects.length === 1
                  ? `Explore · ${projects[0].name}`
                  : `Explore · ${projects.length} projects`}
              </h1>
              {showProjectChips && (
                <span className="text-[11px] text-slate-500 truncate">
                  {projects.map((p) => p.name).join(' · ')}
                </span>
              )}
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[12px] font-medium text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded hover:bg-slate-100 transition-colors"
              >
                Clear filters ×
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-slate-50">
        <div className="max-w-[1200px] mx-auto px-8 py-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleFilters}
            className="flex items-center gap-1.5 text-[11px] uppercase font-semibold tracking-[0.12em] text-slate-600 hover:text-slate-900 transition-colors px-1 py-1 rounded hover:bg-white"
            title={filtersCollapsed ? 'show filters' : 'hide filters'}
          >
            <span className="text-[10px] text-slate-400 w-3">
              {filtersCollapsed ? '▸' : '▾'}
            </span>
            <span>Filters</span>
            {hasFilters && (
              <span className="ml-1 text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded normal-case tracking-normal">
                active
              </span>
            )}
          </button>
        </div>
        {!filtersCollapsed && (
        <div className="max-w-[1200px] mx-auto px-8 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              value={textQuery}
              onChange={(e) => setTextQuery(e.target.value)}
              placeholder="Search span text or notes..."
              className="flex-1 min-w-[200px] px-3 py-2 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
            <div className="relative" ref={codePickerRef}>
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => setCodePickerOpen((v) => !v)}
                  className={`px-3 py-2 text-[13px] font-medium border transition-colors ${
                    selectedCodeIds.size > 1 ? 'rounded-l-lg' : 'rounded-lg'
                  } ${
                    selectedCodeIds.size > 0
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Codes
                  {selectedCodeIds.size > 0 ? ` · ${selectedCodeIds.size}` : ''}
                </button>
                {selectedCodeIds.size > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setCodeFilterMode(codeFilterMode === 'or' ? 'and' : 'or')
                    }
                    title={
                      codeFilterMode === 'or'
                        ? 'OR — annotations whose code matches any selection. Click for AND mode.'
                        : 'AND — annotations from docs that contain every selected code. Click for OR mode.'
                    }
                    className={`px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider border border-l-0 rounded-r-lg transition-colors ${
                      codeFilterMode === 'and'
                        ? 'bg-blue-700 text-white border-blue-700 hover:bg-blue-800'
                        : 'bg-white text-blue-700 border-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {codeFilterMode}
                  </button>
                )}
              </div>
              {codePickerOpen && (
                <div className="absolute left-0 top-full mt-1 w-[320px] max-h-[440px] bg-white border border-slate-200 rounded-lg shadow-xl z-30 flex flex-col">
                  <div className="flex items-center px-3 py-2 border-b border-slate-100 bg-slate-50">
                    <div className="flex-1 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                      Select codes
                      {selectedCodeIds.size > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCodeIds(new Set());
                          }}
                          className="ml-2 text-[10px] font-medium text-blue-600 hover:text-blue-800 normal-case tracking-normal"
                        >
                          clear ({selectedCodeIds.size})
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCodePickerOpen(false)}
                      className="w-7 h-7 rounded text-slate-400 hover:text-slate-900 hover:bg-white flex items-center justify-center text-[16px] transition-colors"
                      title="close (Esc)"
                    >
                      ×
                    </button>
                  </div>
                  <div className="px-2 py-2 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <input
                      type="text"
                      autoFocus
                      value={codePickerQuery}
                      onChange={(e) => setCodePickerQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          if (codePickerQuery) {
                            setCodePickerQuery('');
                          } else {
                            setCodePickerOpen(false);
                          }
                        }
                      }}
                      placeholder="Search codes…"
                      className="w-full px-2.5 py-1.5 text-[12px] border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto">
                  {(() => {
                    const q = codePickerQuery.trim().toLowerCase();
                    let anyMatches = false;
                    const rendered = projects.map((p) => {
                      const seen = new Set<string>();
                      const nodes = flattenTree(buildCodeTree(p.codes)).filter((n) => {
                        if (seen.has(n.code.id)) return false;
                        seen.add(n.code.id);
                        if (!q) return true;
                        return n.code.name.toLowerCase().includes(q);
                      });
                      if (nodes.length === 0) return null;
                      anyMatches = true;
                      return (
                        <div key={p.id}>
                          {showProjectChips && (
                            <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-100">
                              {p.name}
                            </div>
                          )}
                          {nodes.map((n) => {
                            const checked = selectedCodeIds.has(n.code.id);
                            const color = resolveColor(p.codes, n.code.id);
                            return (
                              <label
                                key={`${p.id}-${n.code.id}`}
                                className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-blue-50"
                                style={{ paddingLeft: `${12 + (q ? 0 : n.depth * 12)}px` }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleCode(n.code.id)}
                                  className="accent-blue-600"
                                />
                                <span
                                  className="w-2.5 h-2.5 rounded-sm ring-1 ring-black/5 flex-shrink-0"
                                  style={{ background: color }}
                                />
                                <span className="text-[13px] text-slate-700 leading-snug break-words">
                                  {n.code.name}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      );
                    });
                    if (q && !anyMatches) {
                      return (
                        <div className="px-3 py-4 text-[12px] text-slate-400 italic text-center">
                          No codes match "{codePickerQuery}".
                        </div>
                      );
                    }
                    return rendered;
                  })()}
                  {projects.every((p) => p.codes.length === 0) && (
                    <div className="px-3 py-3 text-[12px] text-slate-400 italic text-center">
                      No codes in any project yet.
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>
            {allFolders.length > 0 && (
              <select
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                className="px-3 py-2 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              >
                <option value="">All folders</option>
                {allFolders.map((f) => (
                  <option key={f} value={f}>
                    📁 {f}
                  </option>
                ))}
              </select>
            )}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="px-3 py-2 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                {metadataFields.map((f) => (
                  <option key={`meta:${f.key}`} value={`meta:${f.key}`}>
                    By {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
              Doc stats
            </span>
            <MetadataFilterInput
              field={{ key: '__chars', label: 'Chars', type: 'number' }}
              value={docCharsFilter}
              onChange={setDocCharsFilter}
            />
            <MetadataFilterInput
              field={{ key: '__words', label: 'Words', type: 'number' }}
              value={docWordsFilter}
              onChange={setDocWordsFilter}
            />
            <MetadataFilterInput
              field={{ key: '__annots', label: 'Annotations', type: 'number' }}
              value={docAnnotsFilter}
              onChange={setDocAnnotsFilter}
            />
          </div>
          {metadataFields.length > 0 && (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                Metadata
              </span>
              {metadataFields.map((f) => (
                <MetadataFilterInput
                  key={f.key}
                  field={f}
                  value={metaFilters[f.key] ?? {}}
                  onChange={(next) =>
                    setMetaFilters((p) => ({
                      ...p,
                      [f.key]: next,
                    }))
                  }
                />
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
              Ratings
            </span>
            <RatingPicker
              label="Specificity"
              values={codeSpecificityValues}
              onChange={setCodeSpecificityValues}
            />
            <RatingPicker
              label="Accuracy"
              values={annotationAccuracyValues}
              onChange={setAnnotationAccuracyValues}
            />
          </div>

          {allThemes.length > 0 && (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                Theme
              </span>
              <select
                value={themeId ?? ''}
                onChange={(e) => {
                  setThemeId(e.target.value || undefined);
                  if (!e.target.value) setThemeWeight(undefined);
                }}
                className="pl-2 pr-7 py-1 text-[11px] border border-slate-200 rounded bg-white text-slate-700 min-w-[160px] max-w-[300px] truncate"
              >
                <option value="">(Any)</option>
                {allThemes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {showProjectChips ? `${t.projectName} · ${t.name}` : t.name}
                  </option>
                ))}
              </select>
              {themeId && (
                <div className="inline-flex rounded border border-slate-300 overflow-hidden text-[11px]">
                  {(['all', 'core', 'supporting'] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setThemeWeight(w)}
                      className={`px-2 py-1 font-semibold capitalize ${
                        (themeWeight ?? 'all') === w
                          ? 'bg-violet-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100 border-l border-slate-200 first:border-l-0'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-8 py-5">
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatCard label="Annotations" value={stats.total} accent="blue" />
            <StatCard label="Unique codes" value={stats.uniqueCodes} />
            <StatCard label="Documents" value={stats.uniqueDocs} />
          </div>

          {stats.topCodes.length > 0 && (
            <div className="mb-5">
              <div className="text-[11px] uppercase font-semibold tracking-[0.12em] text-slate-500 mb-2">
                Top codes in current view
              </div>
              <div className="flex flex-wrap gap-2">
                {stats.topCodes.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm ring-1 ring-black/5"
                      style={{ background: c.color }}
                    />
                    <span className="text-[12px] text-slate-700">{c.path}</span>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {c.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {coOccurrence && coOccurrence.focalDocCount > 0 && (
            <div className="mb-6 border border-amber-200 bg-amber-50/40 rounded-lg">
              <button
                type="button"
                onClick={onToggleCoOccurrence}
                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-amber-50 transition-colors rounded-lg"
                title={
                  coOccurrenceCollapsed
                    ? 'show co-occurrence list'
                    : 'hide co-occurrence list'
                }
              >
                <span className="text-[10px] text-amber-700 w-3">
                  {coOccurrenceCollapsed ? '▸' : '▾'}
                </span>
                <span className="text-[11px] uppercase font-semibold tracking-[0.12em] text-amber-800">
                  Codes that co-occur with your selection
                </span>
                <span className="ml-auto text-[11px] text-amber-700 font-mono tabular-nums">
                  {coOccurrence.focalDocCount} doc
                  {coOccurrence.focalDocCount === 1 ? '' : 's'} ·{' '}
                  {coOccurrence.results.length} other code
                  {coOccurrence.results.length === 1 ? '' : 's'}
                </span>
              </button>
              {!coOccurrenceCollapsed && (
              <div className="px-4 pb-4">
              <p className="text-[12px] text-slate-600 mb-3">
                {coOccurrence.focalDocCount} doc
                {coOccurrence.focalDocCount === 1 ? '' : 's'} contain
                {coOccurrence.focalDocCount === 1 ? 's' : ''}{' '}
                {selectedCodeIds.size === 1
                  ? 'the selected code'
                  : codeFilterMode === 'and'
                    ? `all ${selectedCodeIds.size} selected codes`
                    : `any of the ${selectedCodeIds.size} selected codes`}
                . Other codes ranked by how many of those docs they also show up in:
              </p>
              {coOccurrence.results.length === 0 ? (
                <div className="text-[12px] text-slate-500 italic">
                  No other codes appear in those docs.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {coOccurrence.results.slice(0, 20).map((r) => {
                    const pct =
                      coOccurrence.focalDocCount > 0
                        ? Math.round((r.docCount / coOccurrence.focalDocCount) * 100)
                        : 0;
                    const showProject =
                      projects.length > 1 ||
                      coOccurrence.results.some((x) => x.projectId !== r.projectId);
                    return (
                      <li
                        key={`${r.projectId}::${r.codeId}`}
                        onClick={() => toggleCode(r.codeId)}
                        className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-md hover:border-amber-300 cursor-pointer transition-colors"
                        title="click to add/remove from filter"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-sm ring-1 ring-black/5 flex-shrink-0"
                          style={{ background: r.color }}
                        />
                        <span className="text-[13px] text-slate-800 truncate flex-1 min-w-0">
                          {r.codePath}
                        </span>
                        {showProject && (
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-blue-600 px-1.5 py-0.5 rounded bg-blue-50 flex-shrink-0">
                            {r.projectName}
                          </span>
                        )}
                        <div
                          className="hidden sm:block w-[80px] h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0"
                          title={`${r.docCount} of ${coOccurrence.focalDocCount} docs`}
                        >
                          <div
                            className="h-full bg-amber-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 tabular-nums w-[44px] text-right flex-shrink-0">
                          {pct}%
                        </span>
                        <span
                          className="text-[11px] font-mono text-slate-400 tabular-nums w-[60px] text-right flex-shrink-0"
                          title="docs · annotations"
                        >
                          {r.docCount}d · {r.annotationCount}a
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
            <div className="text-[11px] uppercase font-semibold tracking-[0.12em] text-slate-500">
              {viewMode === 'by-code' ? 'Codes' : 'Annotations'} · {rows.length}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {onSetViewMode && (
                <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => onSetViewMode('flat')}
                    className={`px-2.5 py-1 text-[11px] font-semibold ${
                      viewMode === 'flat'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Flat
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetViewMode('by-code')}
                    className={`px-2.5 py-1 text-[11px] font-semibold border-l border-slate-300 ${
                      viewMode === 'by-code'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title="group quotes under their code"
                  >
                    By code
                  </button>
                </div>
              )}
              {onToggleShowNotes && (
                <button
                  type="button"
                  onClick={onToggleShowNotes}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border ${
                    showNotes
                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                      : 'border-slate-300 text-slate-500 hover:bg-slate-100'
                  }`}
                  title={showNotes ? 'hide notes' : 'show notes'}
                >
                  Notes {showNotes ? 'on' : 'off'}
                </button>
              )}
              {onToggleShowMeta && (
                <button
                  type="button"
                  onClick={onToggleShowMeta}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border ${
                    showMeta
                      ? 'border-blue-300 bg-blue-50 text-blue-800'
                      : 'border-slate-300 text-slate-500 hover:bg-slate-100'
                  }`}
                  title={showMeta ? 'hide doc metadata' : 'show doc metadata'}
                >
                  Metadata {showMeta ? 'on' : 'off'}
                </button>
              )}
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="text-[13px] text-slate-400 italic border border-slate-200 rounded-lg p-8 text-center">
              {hasFilters
                ? 'No annotations match these filters.'
                : 'No annotations yet. Code some text in Documents view to populate this.'}
            </div>
          ) : viewMode === 'by-code' ? (
            <ByCodeView
              rows={rows}
              showProjectChips={showProjectChips}
              showMeta={showMeta}
              showNotes={showNotes}
              onJump={onJumpToAnnotation}
            />
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li
                  key={`${r.projectId}::${r.annotation.id}`}
                  className="border border-slate-200 rounded-lg p-4 bg-white hover:border-slate-400 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() =>
                    onJumpToAnnotation(r.projectId, r.doc.id, r.annotation.id)
                  }
                >
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm ring-1 ring-black/5 flex-shrink-0"
                      style={{ background: r.codeColor }}
                    />
                    <span className="text-[13px] font-semibold text-slate-800 leading-snug">
                      {r.codePath}
                    </span>
                    {showProjectChips && (
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-blue-600 px-1.5 py-0.5 rounded bg-blue-50">
                        {r.projectName}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500 leading-snug ml-auto">
                      {r.doc.folder ? `${r.doc.folder} / ` : ''}
                      {r.doc.title}
                    </span>
                  </div>
                  <blockquote
                    className="text-[15px] text-slate-800 leading-relaxed border-l-2 border-slate-300 pl-3 whitespace-pre-wrap break-words"
                    style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
                  >
                    {r.span}
                  </blockquote>
                  {showNotes && r.annotation.note && (
                    <div className="mt-2 text-[12px] text-amber-900 bg-amber-50 border-l-2 border-amber-300 pl-3 py-1.5 leading-snug whitespace-pre-wrap">
                      {r.annotation.note}
                    </div>
                  )}
                  {showMeta && Object.keys(r.doc.metadata).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500 font-mono">
                      {Object.entries(r.doc.metadata)
                        .filter(([_, v]) => v !== null && v !== undefined && v !== '')
                        .map(([k, v]) => (
                          <span key={k}>
                            <span className="text-slate-400">{k}:</span> {String(v)}
                          </span>
                        ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function hasAnyFilter(ff: FieldFilter): boolean {
  return !!(
    ff.contains ||
    ff.numOp ||
    ff.dateFrom ||
    ff.dateTo ||
    ff.enumEquals
  );
}

function MetadataFilterInput({
  field,
  value,
  onChange,
}: {
  field: MetadataField;
  value: FieldFilter;
  onChange: (v: FieldFilter) => void;
}) {
  const active = hasAnyFilter(value);
  const label = field.label;
  const baseInput =
    'px-2 py-1 text-[12px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500';

  if (field.type === 'enum') {
    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded border ${active ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
        <span className="text-[11px] font-medium text-slate-600">{label}:</span>
        <select
          value={value.enumEquals ?? ''}
          onChange={(e) => onChange({ enumEquals: e.target.value || undefined })}
          className="px-1 py-0.5 text-[12px] bg-transparent border-none focus:outline-none"
        >
          <option value="">any</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {active && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-slate-400 hover:text-red-600 text-[12px]"
            title="clear"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded border ${active ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
        <span className="text-[11px] font-medium text-slate-600">{label}</span>
        <select
          value={value.numOp ?? '='}
          onChange={(e) => onChange({ ...value, numOp: e.target.value as FieldFilter['numOp'] })}
          className="px-1 py-0.5 text-[12px] bg-transparent border-none focus:outline-none"
        >
          <option value="=">=</option>
          <option value=">">&gt;</option>
          <option value="<">&lt;</option>
          <option value="between">between</option>
        </select>
        {value.numOp === 'between' ? (
          <>
            <input
              type="number"
              value={value.numMin ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  numOp: 'between',
                  numMin: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              placeholder="min"
              className={`${baseInput} w-[70px]`}
            />
            <span className="text-[11px] text-slate-400">–</span>
            <input
              type="number"
              value={value.numMax ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  numOp: 'between',
                  numMax: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              placeholder="max"
              className={`${baseInput} w-[70px]`}
            />
          </>
        ) : (
          <input
            type="number"
            value={value.numValue ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                numOp: value.numOp ?? '=',
                numValue: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            placeholder="value"
            className={`${baseInput} w-[90px]`}
          />
        )}
        {active && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-slate-400 hover:text-red-600 text-[12px]"
            title="clear"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded border ${active ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
        <span className="text-[11px] font-medium text-slate-600">{label}</span>
        <input
          type="date"
          value={value.dateFrom ?? ''}
          onChange={(e) => onChange({ ...value, dateFrom: e.target.value || undefined })}
          className={baseInput}
        />
        <span className="text-[11px] text-slate-400">–</span>
        <input
          type="date"
          value={value.dateTo ?? ''}
          onChange={(e) => onChange({ ...value, dateTo: e.target.value || undefined })}
          className={baseInput}
        />
        {active && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-slate-400 hover:text-red-600 text-[12px]"
            title="clear"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  // text
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded border ${active ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
      <span className="text-[11px] font-medium text-slate-600">{label}:</span>
      <input
        type="text"
        value={value.contains ?? ''}
        onChange={(e) => onChange({ contains: e.target.value || undefined })}
        placeholder="contains..."
        className="px-1 py-0.5 text-[12px] bg-transparent border-none focus:outline-none w-[120px]"
      />
      {active && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="text-slate-400 hover:text-red-600 text-[12px]"
          title="clear"
        >
          ×
        </button>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'blue';
}) {
  return (
    <div
      className={`border rounded-lg p-3.5 ${
        accent === 'blue'
          ? 'border-blue-200 bg-blue-50/60'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div
        className={`text-[26px] font-bold leading-tight tabular-nums mt-1 ${
          accent === 'blue' ? 'text-blue-700' : 'text-slate-900'
        }`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

// "By code" view: collect rows by their codeId, render one section per code
// with all quotes underneath. Sections are collapsible.
function ByCodeView({
  rows,
  showProjectChips,
  showMeta,
  showNotes,
  onJump,
}: {
  rows: ExploreRow[];
  showProjectChips: boolean;
  showMeta: boolean;
  showNotes: boolean;
  onJump: (projectId: string, docId: string, annotationId: string) => void;
}) {
  type Group = {
    key: string;
    codePath: string;
    color: string;
    projectName: string;
    rows: ExploreRow[];
  };
  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, Group>();
    for (const r of rows) {
      const key = `${r.projectId}::${r.annotation.codeId}`;
      let g = m.get(key);
      if (!g) {
        g = {
          key,
          codePath: r.codePath,
          color: r.codeColor,
          projectName: r.projectName,
          rows: [],
        };
        m.set(key, g);
      }
      g.rows.push(r);
    }
    return [...m.values()].sort(
      (a, b) =>
        b.rows.length - a.rows.length || a.codePath.localeCompare(b.codePath),
    );
  }, [rows]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.key);
        return (
          <section key={g.key} className="border border-slate-200 rounded-lg bg-white overflow-hidden">
            <header
              onClick={() => toggle(g.key)}
              className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100 sticky top-0 bg-white z-10"
              style={{ boxShadow: `inset 4px 0 0 0 ${g.color}` }}
            >
              <span className="text-[11px] text-slate-400 w-3">
                {isCollapsed ? '▸' : '▾'}
              </span>
              <span
                className="w-3 h-3 rounded-sm ring-1 ring-black/5 flex-shrink-0"
                style={{ background: g.color }}
              />
              <h2 className="text-[15px] font-semibold text-slate-900 leading-snug flex-1 min-w-0">
                {g.codePath}
              </h2>
              {showProjectChips && (
                <span className="text-[10px] uppercase font-semibold tracking-wider text-blue-600 px-1.5 py-0.5 rounded bg-blue-50 flex-shrink-0">
                  {g.projectName}
                </span>
              )}
              <span className="text-[11px] font-mono tabular-nums text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">
                {g.rows.length} quote{g.rows.length === 1 ? '' : 's'}
              </span>
            </header>
            {!isCollapsed && (
              <ol className="divide-y divide-slate-100">
                {g.rows.map((r, i) => (
                  <li
                    key={`${r.projectId}::${r.annotation.id}`}
                    className="px-4 py-3 hover:bg-slate-50/60 transition-colors cursor-pointer"
                    onClick={() => onJump(r.projectId, r.doc.id, r.annotation.id)}
                  >
                    <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-mono text-slate-400 tabular-nums w-6 flex-shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[11px] font-medium text-slate-600">
                        {r.doc.folder ? `${r.doc.folder} / ` : ''}
                        <span className="text-slate-800">{r.doc.title}</span>
                      </span>
                    </div>
                    <blockquote
                      className="text-[15px] text-slate-800 leading-relaxed border-l-2 border-slate-300 pl-3 ml-8 whitespace-pre-wrap break-words"
                      style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
                    >
                      {r.span}
                    </blockquote>
                    {showNotes && r.annotation.note && (
                      <div className="mt-2 ml-8 text-[12px] text-amber-900 bg-amber-50 border-l-2 border-amber-300 pl-3 py-1.5 leading-snug whitespace-pre-wrap">
                        {r.annotation.note}
                      </div>
                    )}
                    {showMeta && Object.keys(r.doc.metadata).length > 0 && (
                      <div className="mt-2 ml-8 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500 font-mono">
                        {Object.entries(r.doc.metadata)
                          .filter(([_, v]) => v !== null && v !== undefined && v !== '')
                          .map(([k, v]) => (
                            <span key={k}>
                              <span className="text-slate-400">{k}:</span>{' '}
                              {String(v)}
                            </span>
                          ))}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Multi-select 1–5 rating filter. Click numbers to toggle them. "Any" clears.
// Renders compactly inline next to the other filters.
function RatingPicker({
  label,
  values,
  onChange,
}: {
  label: string;
  values: Set<number> | undefined;
  onChange: (v: Set<number> | undefined) => void;
}) {
  const set = values ?? new Set<number>();
  const toggle = (n: number) => {
    const next = new Set(set);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    onChange(next.size > 0 ? next : undefined);
  };
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
      <span className="font-medium">{label}</span>
      <button
        type="button"
        onClick={() => onChange(undefined)}
        className={`px-2 py-1 rounded border text-[11px] font-semibold ${
          set.size === 0
            ? 'bg-slate-800 border-slate-800 text-white'
            : 'border-slate-300 text-slate-500 hover:bg-slate-100'
        }`}
      >
        Any
      </button>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => toggle(n)}
          className={`w-6 h-6 rounded border text-[11px] font-semibold ${
            set.has(n)
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-slate-300 text-slate-600 hover:bg-slate-100'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

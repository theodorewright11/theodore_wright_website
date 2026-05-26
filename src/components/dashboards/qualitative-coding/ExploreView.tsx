import { useMemo, useState } from 'react';
import {
  buildCodeTree,
  codePathString,
  descendantIds,
  exploreRows,
  flattenTree,
  resolveColor,
  type ExploreRow,
  type FieldFilter,
  type SortKey,
} from './compute';
import type { MetadataField, Project } from './types';

type Props = {
  projects: Project[];
  onJumpToAnnotation: (projectId: string, docId: string, annotationId: string) => void;
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'created-desc', label: 'Newest first' },
  { value: 'created-asc', label: 'Oldest first' },
  { value: 'code', label: 'By code' },
  { value: 'doc', label: 'By document' },
  { value: 'span-length', label: 'Longest span' },
];

export default function ExploreView({ projects, onJumpToAnnotation }: Props) {
  const [textQuery, setTextQuery] = useState('');
  const [selectedCodeIds, setSelectedCodeIds] = useState<Set<string>>(new Set());
  const [codePickerOpen, setCodePickerOpen] = useState(false);
  const [metaFilters, setMetaFilters] = useState<Record<string, FieldFilter>>({});
  const [folderFilter, setFolderFilter] = useState<string>('');
  const [sort, setSort] = useState<SortKey>('created-desc');

  const expandedCodeIds = useMemo(() => {
    if (selectedCodeIds.size === 0) return null;
    const out = new Set<string>();
    for (const p of projects) {
      for (const codeId of selectedCodeIds) {
        if (p.codes.some((c) => c.id === codeId)) {
          for (const d of descendantIds(p.codes, codeId)) out.add(d);
        }
      }
    }
    return out;
  }, [projects, selectedCodeIds]);

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
        codeIds: expandedCodeIds,
        textQuery,
        metadataFilters: metaFilters,
        folder: folderFilter ? folderFilter : undefined,
      },
      sort,
    );
  }, [projects, expandedCodeIds, textQuery, metaFilters, folderFilter, sort]);

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
    setTextQuery('');
    setSelectedCodeIds(new Set());
    setMetaFilters({});
    setFolderFilter('');
  };

  const hasFilters =
    textQuery.length > 0 ||
    selectedCodeIds.size > 0 ||
    folderFilter.length > 0 ||
    Object.values(metaFilters).some(hasAnyFilter);

  const showProjectChips = projects.length > 1;

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-white">
      <div className="px-8 pt-6 pb-3 border-b border-slate-200 bg-white">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-blue-600 mb-1">
                Explore
              </div>
              <h1
                className="font-bold text-[32px] text-slate-900 leading-tight"
                style={{ letterSpacing: '-0.025em' }}
              >
                {projects.length === 1
                  ? `Annotations · ${projects[0].name}`
                  : `Annotations across ${projects.length} projects`}
              </h1>
              {showProjectChips && (
                <div className="text-[12px] text-slate-500 mt-1">
                  {projects.map((p) => p.name).join(' · ')}
                </div>
              )}
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[12px] font-medium text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded hover:bg-slate-100 transition-colors"
              >
                clear filters ×
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-4 border-b border-slate-200 bg-slate-50">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              value={textQuery}
              onChange={(e) => setTextQuery(e.target.value)}
              placeholder="Search span text or notes..."
              className="flex-1 min-w-[200px] px-3 py-2 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => setCodePickerOpen((v) => !v)}
                className={`px-3 py-2 text-[13px] font-medium rounded-lg border transition-colors ${
                  selectedCodeIds.size > 0
                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Codes
                {selectedCodeIds.size > 0 ? ` · ${selectedCodeIds.size}` : ''}
              </button>
              {codePickerOpen && (
                <div className="absolute left-0 top-full mt-1 w-[300px] max-h-[400px] overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-30">
                  {projects.map((p) => (
                    <div key={p.id}>
                      {showProjectChips && (
                        <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-100 sticky top-0">
                          {p.name}
                        </div>
                      )}
                      {flattenTree(buildCodeTree(p.codes)).map((n) => {
                        const checked = selectedCodeIds.has(n.code.id);
                        const color = resolveColor(p.codes, n.code.id);
                        return (
                          <label
                            key={`${p.id}-${n.code.id}`}
                            className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-blue-50"
                            style={{ paddingLeft: `${12 + n.depth * 12}px` }}
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
                            <span className="text-[13px] text-slate-700 truncate">
                              {n.code.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ))}
                  {projects.every((p) => p.codes.length === 0) && (
                    <div className="px-3 py-3 text-[12px] text-slate-400 italic text-center">
                      No codes in any project yet.
                    </div>
                  )}
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
        </div>
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

          <div className="text-[11px] uppercase font-semibold tracking-[0.12em] text-slate-500 mb-2">
            Annotations · {rows.length}
          </div>
          {rows.length === 0 ? (
            <div className="text-[13px] text-slate-400 italic border border-slate-200 rounded-lg p-8 text-center">
              {hasFilters
                ? 'No annotations match these filters.'
                : 'No annotations yet. Code some text in Documents view to populate this.'}
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li
                  key={`${r.projectId}::${r.annotation.id}`}
                  className="border border-slate-200 rounded-lg p-3 bg-white hover:border-slate-400 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() =>
                    onJumpToAnnotation(r.projectId, r.doc.id, r.annotation.id)
                  }
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="w-2.5 h-2.5 rounded-sm ring-1 ring-black/5 flex-shrink-0"
                      style={{ background: r.codeColor }}
                    />
                    <span className="text-[12px] font-semibold text-slate-700">
                      {r.codePath}
                    </span>
                    {showProjectChips && (
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-blue-600 px-1.5 py-0.5 rounded bg-blue-50">
                        {r.projectName}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500 truncate">
                      {r.doc.folder ? `${r.doc.folder} / ` : ''}
                      {r.doc.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 tabular-nums ml-auto">
                      {r.annotation.start}–{r.annotation.end}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[13px] text-slate-700 italic leading-snug">
                    “{r.span.slice(0, 240)}
                    {r.span.length > 240 ? '…' : ''}”
                  </div>
                  {r.annotation.note && (
                    <div className="mt-1.5 text-[12px] text-slate-600 border-l-2 border-amber-300 pl-2">
                      {r.annotation.note}
                    </div>
                  )}
                  {Object.keys(r.doc.metadata).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500 font-mono">
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

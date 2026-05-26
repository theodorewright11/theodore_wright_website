import { useMemo, useState } from 'react';
import {
  buildCodeTree,
  codePathString,
  descendantIds,
  exploreRows,
  flattenTree,
  resolveColor,
  type ExploreRow,
} from './compute';
import type { Project } from './types';

type Props = {
  projects: Project[];
  onJumpToAnnotation: (projectId: string, docId: string, annotationId: string) => void;
};

export default function ExploreView({ projects, onJumpToAnnotation }: Props) {
  const [textQuery, setTextQuery] = useState('');
  const [selectedCodeIds, setSelectedCodeIds] = useState<Set<string>>(new Set());
  const [metaFilters, setMetaFilters] = useState<Record<string, string>>({});
  const [folderFilter, setFolderFilter] = useState<string>('');

  const allCodes = useMemo(() => {
    const flat: { projectId: string; projectName: string; node: ReturnType<typeof flattenTree>[number] }[] = [];
    for (const p of projects) {
      const tree = flattenTree(buildCodeTree(p.codes));
      for (const node of tree) {
        flat.push({ projectId: p.id, projectName: p.name, node });
      }
    }
    return flat;
  }, [projects]);

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

  const metadataKeys = useMemo(() => {
    const m = new Map<string, { label: string; projectName: string }>();
    for (const p of projects) {
      for (const f of p.metadataSchema) {
        if (!m.has(f.key)) m.set(f.key, { label: f.label, projectName: p.name });
      }
    }
    return [...m.entries()].map(([key, v]) => ({ key, label: v.label }));
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
    return exploreRows(projects, {
      codeIds: expandedCodeIds,
      textQuery,
      metadataFilters: metaFilters,
      folder: folderFilter ? folderFilter : undefined,
    });
  }, [projects, expandedCodeIds, textQuery, metaFilters, folderFilter]);

  const stats = useMemo(() => {
    const uniqueCodes = new Set(rows.map((r) => r.annotation.codeId));
    const uniqueDocs = new Set(rows.map((r) => `${r.projectId}::${r.doc.id}`));
    const uniqueProjects = new Set(rows.map((r) => r.projectId));
    const byCode = new Map<string, { count: number; color: string; path: string }>();
    for (const r of rows) {
      const key = `${r.projectId}::${r.annotation.codeId}`;
      const cur = byCode.get(key);
      if (cur) cur.count++;
      else byCode.set(key, { count: 1, color: r.codeColor, path: r.codePath });
    }
    const topCodes = [...byCode.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([_, v]) => v);
    return {
      total: rows.length,
      uniqueCodes: uniqueCodes.size,
      uniqueDocs: uniqueDocs.size,
      uniqueProjects: uniqueProjects.size,
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
    Object.values(metaFilters).some((v) => v.length > 0);

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-white">
      <div className="px-8 pt-6 pb-3 border-b border-slate-200 bg-white">
        <div className="max-w-[1200px] mx-auto flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-blue-600 mb-1">
              Explore
            </div>
            <h1
              className="font-bold text-[32px] text-slate-900 leading-tight"
              style={{ letterSpacing: '-0.025em' }}
            >
              All annotations across {projects.length} project
              {projects.length === 1 ? '' : 's'}
            </h1>
            <div className="text-[12px] text-slate-500 mt-1">
              {projects.map((p) => p.name).join(' · ')}
            </div>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[12px] font-medium text-slate-500 hover:text-slate-900 px-2 py-1"
            >
              clear filters ×
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-8 py-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <aside className="space-y-5">
            <FilterSection title="Search">
              <input
                value={textQuery}
                onChange={(e) => setTextQuery(e.target.value)}
                placeholder="Search span text or notes"
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </FilterSection>

            <FilterSection title={`Codes${selectedCodeIds.size ? ` · ${selectedCodeIds.size}` : ''}`}>
              {allCodes.length === 0 ? (
                <div className="text-[12px] text-slate-400 italic">No codes yet.</div>
              ) : (
                <div className="max-h-[280px] overflow-y-auto border border-slate-200 rounded bg-slate-50">
                  {projects.map((p) => (
                    <div key={p.id}>
                      {projects.length > 1 && (
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-100 sticky top-0">
                          {p.name}
                        </div>
                      )}
                      {flattenTree(buildCodeTree(p.codes)).map((n) => {
                        const checked = selectedCodeIds.has(n.code.id);
                        const color = resolveColor(p.codes, n.code.id);
                        return (
                          <label
                            key={`${p.id}-${n.code.id}`}
                            className="flex items-center gap-1.5 px-2 py-1 cursor-pointer hover:bg-white"
                            style={{ paddingLeft: `${8 + n.depth * 12}px` }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCode(n.code.id)}
                              className="accent-blue-600"
                            />
                            <span
                              className="w-2 h-2 rounded-sm ring-1 ring-black/5"
                              style={{ background: color }}
                            />
                            <span className="text-[12px] text-slate-700 truncate">
                              {n.code.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </FilterSection>

            {allFolders.length > 0 && (
              <FilterSection title="Folder">
                <select
                  value={folderFilter}
                  onChange={(e) => setFolderFilter(e.target.value)}
                  className="w-full px-2 py-1.5 text-[13px] border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-white"
                >
                  <option value="">— any —</option>
                  <option value="">— no folder —</option>
                  {allFolders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </FilterSection>
            )}

            {metadataKeys.length > 0 && (
              <FilterSection title="Metadata">
                <div className="space-y-2">
                  {metadataKeys.map((m) => (
                    <div key={m.key}>
                      <label className="block text-[10px] uppercase font-semibold tracking-wider text-slate-500 mb-0.5">
                        {m.label}
                      </label>
                      <input
                        value={metaFilters[m.key] ?? ''}
                        onChange={(e) =>
                          setMetaFilters((p) => ({ ...p, [m.key]: e.target.value }))
                        }
                        placeholder="contains..."
                        className="w-full px-2 py-1 text-[12px] border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </FilterSection>
            )}
          </aside>

          <section className="min-w-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <StatCard label="Annotations" value={stats.total} accent="blue" />
              <StatCard label="Unique codes" value={stats.uniqueCodes} />
              <StatCard label="Documents" value={stats.uniqueDocs} />
              <StatCard label="Projects" value={stats.uniqueProjects} />
            </div>

            {stats.topCodes.length > 0 && (
              <div className="mb-6">
                <div className="text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-500 mb-2">
                  Top codes in current view
                </div>
                <div className="flex flex-wrap gap-2">
                  {stats.topCodes.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-2 py-1 rounded border border-slate-200 bg-white"
                    >
                      <span
                        className="w-2 h-2 rounded-sm ring-1 ring-black/5"
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

            <div className="text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-500 mb-2">
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
                    className="border border-slate-200 rounded-lg p-3 bg-white hover:border-slate-400 transition-colors cursor-pointer"
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
                      {projects.length > 1 && (
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
          </section>
        </div>
      </div>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-500 mb-1.5">
        {title}
      </div>
      {children}
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
      className={`border rounded-lg p-3 ${
        accent === 'blue'
          ? 'border-blue-200 bg-blue-50/60'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div
        className={`text-[24px] font-bold leading-tight tabular-nums mt-1 ${
          accent === 'blue' ? 'text-blue-700' : 'text-slate-900'
        }`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

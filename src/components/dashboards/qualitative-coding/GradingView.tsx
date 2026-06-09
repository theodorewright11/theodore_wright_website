import { useMemo, useState } from 'react';
import { codePathString, meanAccuracyForCode, resolveColor } from './compute';
import type { Annotation, Code, Project, Theme, ThemeRating } from './types';

type Props = {
  project: Project;
  onSetSpecificity: (codeId: string, score: 1 | 2 | 3 | 4 | 5 | undefined) => void;
  onSetAccuracy: (annotationId: string, score: 1 | 2 | 3 | 4 | 5 | undefined) => void;
  onSetThemeRating: (themeId: string, patch: Partial<ThemeRating>) => void;
  onJumpToAnnotation: (
    projectId: string,
    docId: string,
    annotationId: string,
  ) => void;
  onJumpToTheme: (themeId: string) => void;
};

type CodeSortKey = 'name' | 'count' | 'specificity' | 'accuracy';
type ThemeSortKey = 'name' | 'count' | 'grounding' | 'usefulness' | 'independence' | 'interpretationLevel' | 'prevalence';

export default function GradingView({
  project,
  onSetSpecificity,
  onSetAccuracy,
  onSetThemeRating,
  onJumpToAnnotation,
  onJumpToTheme,
}: Props) {
  const [tab, setTab] = useState<'codes' | 'themes' | 'annotations'>('codes');

  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-white">
      <div className="max-w-[1200px] mx-auto px-6 py-3">
        <div className="flex items-center gap-2 mb-3">
          <h1
            className="font-bold text-[20px] text-slate-900 leading-tight"
            style={{ letterSpacing: '-0.015em' }}
          >
            Grading · {project.name}
          </h1>
          <div className="ml-auto inline-flex rounded-md border border-slate-300 overflow-hidden">
            {(['codes', 'themes', 'annotations'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-1 text-[11px] font-semibold capitalize ${
                  tab === t
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 border-l border-slate-200 first:border-l-0'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {tab === 'codes' && (
          <CodesTable
            project={project}
            onSetSpecificity={onSetSpecificity}
          />
        )}
        {tab === 'themes' && (
          <ThemesTable
            themes={project.themes ?? []}
            project={project}
            onSetThemeRating={onSetThemeRating}
            onJumpToTheme={onJumpToTheme}
          />
        )}
        {tab === 'annotations' && (
          <AnnotationsTable
            project={project}
            onSetAccuracy={onSetAccuracy}
            onJumpToAnnotation={onJumpToAnnotation}
          />
        )}
      </div>
    </div>
  );
}

function CodesTable({
  project,
  onSetSpecificity,
}: {
  project: Project;
  onSetSpecificity: (codeId: string, s: 1 | 2 | 3 | 4 | 5 | undefined) => void;
}) {
  const [sortKey, setSortKey] = useState<CodeSortKey>('count');
  const [sortDesc, setSortDesc] = useState(true);

  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of project.annotations) {
      counts.set(a.codeId, (counts.get(a.codeId) ?? 0) + 1);
    }
    return project.codes.map((c) => {
      const acc = meanAccuracyForCode(project.annotations, c.id);
      return {
        code: c,
        count: counts.get(c.id) ?? 0,
        specificity: c.specificity ?? null,
        meanAccuracy: acc?.mean ?? null,
        ratedAccCount: acc?.count ?? 0,
      };
    });
  }, [project.codes, project.annotations]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    const dir = sortDesc ? -1 : 1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return dir * a.code.name.localeCompare(b.code.name);
        case 'count':
          return dir * (a.count - b.count);
        case 'specificity':
          return dir * ((a.specificity ?? -1) - (b.specificity ?? -1));
        case 'accuracy':
          return dir * ((a.meanAccuracy ?? -1) - (b.meanAccuracy ?? -1));
      }
    });
    return arr;
  }, [rows, sortKey, sortDesc]);

  const headers: { key: CodeSortKey; label: string; width?: string; align?: 'left' | 'right' }[] = [
    { key: 'name', label: 'Code', width: 'w-[260px]', align: 'left' },
    { key: 'count', label: 'Annotations', width: 'w-[110px]', align: 'right' },
    { key: 'specificity', label: 'Specificity', width: 'w-[280px]', align: 'left' },
    { key: 'accuracy', label: 'Mean accuracy', width: 'w-[150px]', align: 'right' },
  ];

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {headers.map((h) => (
              <th
                key={h.key}
                onClick={() => {
                  if (sortKey === h.key) setSortDesc((d) => !d);
                  else {
                    setSortKey(h.key);
                    setSortDesc(h.key !== 'name');
                  }
                }}
                className={`px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 ${
                  h.align === 'right' ? 'text-right' : 'text-left'
                } ${h.width ?? ''}`}
              >
                {h.label}
                {sortKey === h.key && (
                  <span className="ml-1 text-slate-400">{sortDesc ? '▾' : '▴'}</span>
                )}
              </th>
            ))}
            <th className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-slate-600 text-left">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.code.id} className="border-t border-slate-100 hover:bg-slate-50/60">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-sm ring-1 ring-black/5 flex-shrink-0"
                    style={{ background: resolveColor(project.codes, r.code.id) }}
                  />
                  <span className="text-slate-800 break-words">{r.code.name}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-right font-mono text-slate-500">{r.count}</td>
              <td className="px-3 py-2">
                <RatingButtons
                  value={r.specificity ?? null}
                  onChange={(v) => onSetSpecificity(r.code.id, v as 1 | 2 | 3 | 4 | 5 | undefined)}
                />
              </td>
              <td className="px-3 py-2 text-right font-mono text-slate-500">
                {r.meanAccuracy !== null ? `${r.meanAccuracy.toFixed(2)} (${r.ratedAccCount})` : '—'}
              </td>
              <td className="px-3 py-2 text-[12px] text-slate-500 break-words">
                {r.code.description || <span className="italic text-slate-300">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ThemesTable({
  themes,
  project,
  onSetThemeRating,
  onJumpToTheme,
}: {
  themes: Theme[];
  project: Project;
  onSetThemeRating: (themeId: string, patch: Partial<ThemeRating>) => void;
  onJumpToTheme: (themeId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<ThemeSortKey>('count');
  const [sortDesc, setSortDesc] = useState(true);

  const rows = useMemo(() => {
    return themes.map((t) => {
      // Count direct + auto
      const direct = new Set(t.annotationLinks.map((l) => l.annotationId));
      let auto = 0;
      if (t.includeCodeIds.length > 0) {
        const set = new Set(t.includeCodeIds);
        for (const a of project.annotations) {
          if (!direct.has(a.id) && set.has(a.codeId)) auto += 1;
        }
      }
      return {
        theme: t,
        evidenceCount: direct.size + auto,
        coreCount: t.annotationLinks.filter((l) => l.weight === 'core').length,
      };
    });
  }, [themes, project.annotations]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    const dir = sortDesc ? -1 : 1;
    arr.sort((a, b) => {
      if (sortKey === 'name') return dir * a.theme.name.localeCompare(b.theme.name);
      if (sortKey === 'count') return dir * (a.evidenceCount - b.evidenceCount);
      const av = a.theme.rating?.[sortKey] ?? -1;
      const bv = b.theme.rating?.[sortKey] ?? -1;
      return dir * (av - bv);
    });
    return arr;
  }, [rows, sortKey, sortDesc]);

  const ratingHeaders: { key: ThemeSortKey; short: string; long: string }[] = [
    { key: 'grounding', short: 'G', long: 'Grounding' },
    { key: 'usefulness', short: 'U', long: 'Usefulness' },
    { key: 'independence', short: 'I', long: 'Independence' },
    { key: 'interpretationLevel', short: 'IL', long: 'Interpretation' },
    { key: 'prevalence', short: 'P', long: 'Prevalence' },
  ];

  if (themes.length === 0) {
    return (
      <div className="text-[13px] text-slate-400 italic border border-dashed border-slate-200 rounded-lg p-8 text-center">
        No themes yet. Build one in the Themes tab.
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th
              onClick={() => {
                if (sortKey === 'name') setSortDesc((d) => !d);
                else {
                  setSortKey('name');
                  setSortDesc(false);
                }
              }}
              className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 w-[280px]"
            >
              Theme {sortKey === 'name' && <span className="text-slate-400">{sortDesc ? '▾' : '▴'}</span>}
            </th>
            <th
              onClick={() => {
                if (sortKey === 'count') setSortDesc((d) => !d);
                else {
                  setSortKey('count');
                  setSortDesc(true);
                }
              }}
              className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 w-[100px]"
            >
              Evidence {sortKey === 'count' && <span className="text-slate-400">{sortDesc ? '▾' : '▴'}</span>}
            </th>
            {ratingHeaders.map((h) => (
              <th
                key={h.key}
                onClick={() => {
                  if (sortKey === h.key) setSortDesc((d) => !d);
                  else {
                    setSortKey(h.key);
                    setSortDesc(true);
                  }
                }}
                title={h.long}
                className="px-2 py-2 text-center text-[10px] uppercase tracking-wider font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 w-[150px]"
              >
                {h.short} {sortKey === h.key && <span className="text-slate-400">{sortDesc ? '▾' : '▴'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ theme: t, evidenceCount, coreCount }) => (
            <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/60">
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onJumpToTheme(t.id)}
                  className="text-slate-800 font-semibold hover:underline text-left break-words"
                >
                  {t.name}
                </button>
              </td>
              <td className="px-3 py-2 text-right font-mono text-slate-500">
                {evidenceCount}
                {coreCount > 0 && <span className="text-amber-700 ml-1">({coreCount} core)</span>}
              </td>
              {ratingHeaders.map((h) => (
                <td key={h.key} className="px-1 py-2">
                  <RatingButtons
                    compact
                    value={t.rating?.[h.key] ?? null}
                    onChange={(v) =>
                      onSetThemeRating(t.id, { [h.key]: v } as Partial<ThemeRating>)
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnnotationsTable({
  project,
  onSetAccuracy,
  onJumpToAnnotation,
}: {
  project: Project;
  onSetAccuracy: (id: string, s: 1 | 2 | 3 | 4 | 5 | undefined) => void;
  onJumpToAnnotation: (projectId: string, docId: string, annotationId: string) => void;
}) {
  const [showRatedOnly, setShowRatedOnly] = useState(false);
  const [showUnratedOnly, setShowUnratedOnly] = useState(false);
  const [filterCodeId, setFilterCodeId] = useState<string>('');

  const rows = useMemo(() => {
    let arr: Annotation[] = project.annotations;
    if (filterCodeId) arr = arr.filter((a) => a.codeId === filterCodeId);
    if (showRatedOnly) arr = arr.filter((a) => !!a.accuracy);
    if (showUnratedOnly) arr = arr.filter((a) => !a.accuracy);
    return arr;
  }, [project.annotations, filterCodeId, showRatedOnly, showUnratedOnly]);

  const docById = useMemo(
    () => new Map(project.documents.map((d) => [d.id, d])),
    [project.documents],
  );
  const codeById = useMemo(
    () => new Map(project.codes.map((c) => [c.id, c])),
    [project.codes],
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <select
          value={filterCodeId}
          onChange={(e) => setFilterCodeId(e.target.value)}
          className="px-2 py-1 text-[12px] border border-slate-300 rounded bg-white"
        >
          <option value="">All codes</option>
          {[...codeById.values()]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showUnratedOnly}
            onChange={(e) => {
              setShowUnratedOnly(e.target.checked);
              if (e.target.checked) setShowRatedOnly(false);
            }}
          />
          Unrated only
        </label>
        <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showRatedOnly}
            onChange={(e) => {
              setShowRatedOnly(e.target.checked);
              if (e.target.checked) setShowUnratedOnly(false);
            }}
          />
          Rated only
        </label>
        <span className="text-[11px] text-slate-500 ml-auto">
          {rows.length} of {project.annotations.length}
        </span>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-600 w-[200px]">
                Code
              </th>
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-600 w-[160px]">
                Doc
              </th>
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-600">
                Quote
              </th>
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-600 w-[200px]">
                Accuracy
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const doc = docById.get(a.docId);
              const code = codeById.get(a.codeId);
              const span = doc?.text
                ? (a.ranges ?? [])
                    .map((r) => doc.text.slice(r.start, r.end))
                    .join(' … ')
                : '';
              return (
                <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50/60 align-top">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm ring-1 ring-black/5 flex-shrink-0"
                        style={{ background: resolveColor(project.codes, a.codeId) }}
                      />
                      <span className="text-slate-800 text-[12px] break-words">
                        {code?.name ?? a.codeId}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-500 break-words">
                    {doc?.folder ? `${doc.folder} / ` : ''}
                    <button
                      type="button"
                      onClick={() => onJumpToAnnotation(project.id, a.docId, a.id)}
                      className="text-slate-700 hover:underline"
                    >
                      {doc?.title ?? '?'}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-[12px] text-slate-700 italic break-words">
                    “{span.slice(0, 240)}
                    {span.length > 240 ? '…' : ''}”
                  </td>
                  <td className="px-3 py-2">
                    <RatingButtons
                      value={a.accuracy ?? null}
                      onChange={(v) => onSetAccuracy(a.id, v as 1 | 2 | 3 | 4 | 5 | undefined)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RatingButtons({
  value,
  onChange,
  compact = false,
}: {
  value: number | null;
  onChange: (v: number | undefined) => void;
  compact?: boolean;
}) {
  const size = compact ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-[11px]';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? undefined : n)}
          className={`${size} rounded border font-semibold transition-colors ${
            value === n
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

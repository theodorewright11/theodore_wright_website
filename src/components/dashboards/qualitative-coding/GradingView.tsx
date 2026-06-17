import { useMemo, useState } from 'react';
import {
  codePathString,
  descendantIds,
  meanAccuracyForCode,
  resolveColor,
} from './compute';
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
type ThemeSortKey = 'name' | 'count' | 'grounding' | 'usefulness' | 'independence' | 'interpretationLevel' | 'prevalence' | 'novelty';

export default function GradingView({
  project,
  onSetSpecificity,
  onSetAccuracy,
  onSetThemeRating,
  onJumpToAnnotation,
  onJumpToTheme,
}: Props) {
  const [tab, setTab] = useState<'codes' | 'themes' | 'annotations'>('codes');
  // When the user clicks a code's name in the Codes table, drill into the
  // grade-by-code workflow for that code.
  const [gradeByCodeId, setGradeByCodeId] = useState<string | null>(null);

  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-white">
      <div className="max-w-[1200px] mx-auto px-6 py-3">
        <div className="flex items-center gap-2 mb-3">
          {gradeByCodeId ? (
            <>
              <button
                type="button"
                onClick={() => setGradeByCodeId(null)}
                className="text-[12px] text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100"
              >
                ← Codes
              </button>
              <h1
                className="font-bold text-[20px] text-slate-900 leading-tight"
                style={{ letterSpacing: '-0.015em' }}
              >
                Grade by code · {codePathString(project.codes, gradeByCodeId)}
              </h1>
            </>
          ) : (
            <>
              <h1
                className="font-bold text-[20px] text-slate-900 leading-tight"
                style={{ letterSpacing: '-0.015em' }}
              >
                Code grading · {project.name}
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
            </>
          )}
        </div>

        {gradeByCodeId ? (
          <GradeByCodeView
            codeId={gradeByCodeId}
            project={project}
            onSetAccuracy={onSetAccuracy}
            onJumpToAnnotation={onJumpToAnnotation}
          />
        ) : (
          <>
            {tab === 'codes' && (
              <CodesTable
                project={project}
                onSetSpecificity={onSetSpecificity}
                onPickCode={(codeId) => setGradeByCodeId(codeId)}
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
          </>
        )}
      </div>
    </div>
  );
}

function CodesTable({
  project,
  onSetSpecificity,
  onPickCode,
}: {
  project: Project;
  onSetSpecificity: (codeId: string, s: 1 | 2 | 3 | 4 | 5 | undefined) => void;
  onPickCode: (codeId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<CodeSortKey>('count');
  const [sortDesc, setSortDesc] = useState(true);
  const [includeSubcodes, setIncludeSubcodes] = useState(false);

  const rows = useMemo(() => {
    const directCounts = new Map<string, number>();
    for (const a of project.annotations) {
      directCounts.set(a.codeId, (directCounts.get(a.codeId) ?? 0) + 1);
    }
    return project.codes.map((c) => {
      const direct = directCounts.get(c.id) ?? 0;
      let count = direct;
      let meanAcc: number | null = null;
      let ratedCount = 0;
      if (includeSubcodes) {
        // Aggregate every descendant's direct annotations.
        const ids = descendantIds(project.codes, c.id);
        let sum = 0;
        let n = 0;
        let total = 0;
        for (const a of project.annotations) {
          if (!ids.has(a.codeId)) continue;
          total += 1;
          if (typeof a.accuracy === 'number') {
            sum += a.accuracy;
            n += 1;
          }
        }
        count = total;
        if (n > 0) {
          meanAcc = sum / n;
          ratedCount = n;
        }
      } else {
        const acc = meanAccuracyForCode(project.annotations, c.id);
        meanAcc = acc?.mean ?? null;
        ratedCount = acc?.count ?? 0;
      }
      return {
        code: c,
        count,
        specificity: c.specificity ?? null,
        meanAccuracy: meanAcc,
        ratedAccCount: ratedCount,
      };
    });
  }, [project.codes, project.annotations, includeSubcodes]);

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
    { key: 'name', label: 'Code', width: 'w-[320px]', align: 'left' },
    { key: 'count', label: 'Annotations', width: 'w-[110px]', align: 'right' },
    { key: 'specificity', label: 'Specificity', width: 'w-[300px]', align: 'left' },
    { key: 'accuracy', label: 'Mean accuracy', width: 'w-[150px]', align: 'right' },
  ];

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-2 text-[11px]">
        <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={includeSubcodes}
            onChange={(e) => setIncludeSubcodes(e.target.checked)}
          />
          Include subcodes in counts
        </label>
      </div>
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
                  <button
                    type="button"
                    onClick={() => onPickCode(r.code.id)}
                    className="text-slate-800 break-words text-left hover:underline"
                    title="grade annotations for this code"
                  >
                    {r.code.name}
                  </button>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

  // Only the hand-rated axes. Independence/Prevalence are computed downstream.
  const ratingHeaders: { key: ThemeSortKey; short: string; long: string }[] = [
    { key: 'grounding', short: 'G', long: 'Grounding' },
    { key: 'usefulness', short: 'U', long: 'Usefulness' },
    { key: 'independence', short: 'I', long: 'Independence' },
    { key: 'interpretationLevel', short: 'IL', long: 'Interpretation' },
    { key: 'novelty', short: 'N', long: 'Novelty' },
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

// Drill-in view: list every annotation of a single code, with the full doc
// text and the annotation highlighted, plus an inline 1-5 accuracy strip.
// Built for fast, focused grading.
function GradeByCodeView({
  codeId,
  project,
  onSetAccuracy,
  onJumpToAnnotation,
}: {
  codeId: string;
  project: Project;
  onSetAccuracy: (id: string, s: 1 | 2 | 3 | 4 | 5 | undefined) => void;
  onJumpToAnnotation: (projectId: string, docId: string, annotationId: string) => void;
}) {
  const [includeSubcodes, setIncludeSubcodes] = useState(false);
  const [showFullDoc, setShowFullDoc] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unrated' | 'rated'>('all');

  const items = useMemo(() => {
    const ids = includeSubcodes
      ? descendantIds(project.codes, codeId)
      : new Set([codeId]);
    return project.annotations.filter((a) => ids.has(a.codeId));
  }, [project.annotations, project.codes, codeId, includeSubcodes]);

  const filtered = useMemo(() => {
    if (filter === 'unrated') return items.filter((a) => !a.accuracy);
    if (filter === 'rated') return items.filter((a) => !!a.accuracy);
    return items;
  }, [items, filter]);

  const code = project.codes.find((c) => c.id === codeId);
  const color = resolveColor(project.codes, codeId);
  const rated = items.filter((a) => !!a.accuracy).length;
  const mean = (() => {
    const r = items.filter((a) => typeof a.accuracy === 'number');
    if (r.length === 0) return null;
    return r.reduce((s, a) => s + (a.accuracy ?? 0), 0) / r.length;
  })();

  return (
    <div className="space-y-4">
      <div className="border border-slate-200 rounded-lg bg-slate-50 p-3 flex items-center gap-3 flex-wrap">
        <span
          className="w-3 h-3 rounded-sm ring-1 ring-black/5"
          style={{ background: color }}
        />
        <div className="text-[14px] font-semibold text-slate-800">{code?.name}</div>
        <div className="text-[11px] text-slate-500 font-mono">
          {items.length} annotation{items.length === 1 ? '' : 's'} ·{' '}
          {rated} rated{mean !== null ? ` · mean ${mean.toFixed(2)}` : ''}
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap text-[11px]">
          <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSubcodes}
              onChange={(e) => setIncludeSubcodes(e.target.checked)}
            />
            Include subcodes
          </label>
          <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showFullDoc}
              onChange={(e) => setShowFullDoc(e.target.checked)}
            />
            Full doc
          </label>
          <div className="inline-flex rounded border border-slate-300 overflow-hidden">
            {(['all', 'unrated', 'rated'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 font-semibold capitalize ${
                  filter === f
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 border-l border-slate-200 first:border-l-0'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-[13px] text-slate-400 italic border border-dashed border-slate-200 rounded-lg p-8 text-center">
          {items.length === 0
            ? 'No annotations use this code yet.'
            : filter === 'unrated'
              ? 'All annotations rated.'
              : 'No rated annotations.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => {
            const doc = project.documents.find((d) => d.id === a.docId);
            const ranges = a.ranges ?? [];
            return (
              <li
                key={a.id}
                className="border border-slate-200 rounded-lg bg-white overflow-hidden"
              >
                <div className="px-3 py-2 flex items-center gap-2 flex-wrap border-b border-slate-100 bg-slate-50">
                  <span className="text-[11px] text-slate-500">
                    {doc?.folder ? `${doc.folder} / ` : ''}
                    <button
                      type="button"
                      onClick={() => onJumpToAnnotation(project.id, a.docId, a.id)}
                      className="text-slate-700 hover:underline font-medium"
                    >
                      {doc?.title}
                    </button>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 ml-auto">
                    {ranges.map((r) => `${r.start}–${r.end}`).join(', ')}
                  </span>
                </div>
                <div className="px-3 py-2">
                  {showFullDoc && doc ? (
                    <FullDocBlock
                      docText={doc.text}
                      ranges={ranges}
                      color={color}
                    />
                  ) : (
                    <blockquote
                      className="text-[14px] text-slate-800 leading-relaxed border-l-2 border-slate-300 pl-3 whitespace-pre-wrap break-words"
                      style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
                    >
                      {ranges
                        .map((r) => (doc?.text ?? '').slice(r.start, r.end))
                        .join(' … ')}
                    </blockquote>
                  )}
                  {a.note && (
                    <div className="mt-2 text-[12px] text-amber-900 bg-amber-50 border-l-2 border-amber-300 pl-3 py-1.5 leading-snug whitespace-pre-wrap">
                      {a.note}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">
                      Accuracy
                    </span>
                    <RatingButtons
                      value={a.accuracy ?? null}
                      onChange={(v) => onSetAccuracy(a.id, v as 1 | 2 | 3 | 4 | 5 | undefined)}
                    />
                    {a.accuracyNotes && (
                      <span className="text-[11px] text-slate-500 italic ml-1">
                        — {a.accuracyNotes}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FullDocBlock({
  docText,
  ranges,
  color,
}: {
  docText: string;
  ranges: { start: number; end: number }[];
  color: string;
}) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  const h = color.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const rgba = `rgba(${r}, ${g}, ${b}, 0.35)`;
  for (const rng of sorted) {
    const s = Math.max(0, Math.min(docText.length, rng.start));
    const e = Math.max(s, Math.min(docText.length, rng.end));
    if (s > cursor) {
      pieces.push(<span key={key++}>{docText.slice(cursor, s)}</span>);
    }
    pieces.push(
      <mark
        key={key++}
        className="rounded-sm px-0.5"
        style={{
          backgroundColor: rgba,
          boxShadow: `inset 0 -2px 0 ${color}`,
          color: '#0f172a',
        }}
      >
        {docText.slice(s, e)}
      </mark>,
    );
    cursor = e;
  }
  if (cursor < docText.length) {
    pieces.push(<span key={key++}>{docText.slice(cursor)}</span>);
  }
  return (
    <blockquote
      className="text-[13px] text-slate-700 leading-relaxed border-l-2 border-slate-300 pl-3 whitespace-pre-wrap break-words max-h-[360px] overflow-y-auto"
      style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
    >
      {pieces}
    </blockquote>
  );
}

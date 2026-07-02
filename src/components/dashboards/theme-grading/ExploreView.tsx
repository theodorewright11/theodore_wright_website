import { useMemo, useState } from 'react';
import { buildRunName } from './runName';
import { AXES } from './rubric';
import { scoreDisplay } from './shared';
import type { AppState, AxisKey, AxisScore, RatedTheme, Run } from './types';

type Props = {
  state: AppState;
  onJumpToTheme: (runId: string, themeId: string) => void;
  onExportRatingsCSV: () => void;
  onExportSimilaritiesCSV: () => void;
  onExportJSON: () => void;
};

type Dimension = 'model' | 'promptVariant' | 'version' | 'dataSource' | 'rq' | 'positionality';
const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: 'model', label: 'Model' },
  { key: 'promptVariant', label: 'Prompt variant' },
  { key: 'version', label: 'Version' },
  { key: 'dataSource', label: 'Data source' },
  { key: 'rq', label: 'RQ' },
  { key: 'positionality', label: 'Positionality' },
];

// Axis-score filter values: '' = any, '1'..'5', 'na', 'unrated'.
type ScoreFilter = '' | '1' | '2' | '3' | '4' | '5' | 'na' | 'unrated';

function matchesScoreFilter(v: AxisScore | undefined, f: ScoreFilter): boolean {
  if (f === '') return true;
  if (f === 'unrated') return v === undefined;
  if (f === 'na') return v === 'na';
  return v === Number(f);
}

export default function ExploreView({
  state,
  onJumpToTheme,
  onExportRatingsCSV,
  onExportSimilaritiesCSV,
  onExportJSON,
}: Props) {
  // Per-dimension selected values (empty set = all).
  const [dimFilters, setDimFilters] = useState<Record<Dimension, Set<string>>>({
    model: new Set(),
    promptVariant: new Set(),
    version: new Set(),
    dataSource: new Set(),
    rq: new Set(),
    positionality: new Set(),
  });
  const [axisFilters, setAxisFilters] = useState<Partial<Record<AxisKey, ScoreFilter>>>({});
  const [groupBy, setGroupBy] = useState<Dimension>('positionality');

  const dimValues = useMemo(() => {
    const out: Record<Dimension, string[]> = {
      model: [],
      promptVariant: [],
      version: [],
      dataSource: [],
      rq: [],
      positionality: [],
    };
    for (const d of DIMENSIONS) {
      out[d.key] = [
        ...new Set(state.runs.map((r) => r[d.key]).filter((v) => v.trim().length > 0)),
      ].sort();
    }
    return out;
  }, [state.runs]);

  const toggleDim = (dim: Dimension, value: string) => {
    setDimFilters((f) => {
      const next = new Set(f[dim]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...f, [dim]: next };
    });
  };

  // Filtered (run, theme) rows.
  const rows = useMemo(() => {
    const out: { run: Run; theme: RatedTheme }[] = [];
    for (const run of state.runs) {
      let runOk = true;
      for (const d of DIMENSIONS) {
        const sel = dimFilters[d.key];
        if (sel.size > 0 && !sel.has(run[d.key])) {
          runOk = false;
          break;
        }
      }
      if (!runOk) continue;
      for (const theme of run.themes) {
        let ok = true;
        for (const a of AXES) {
          const f = axisFilters[a.key] ?? '';
          if (!matchesScoreFilter(theme.rating[a.key], f)) {
            ok = false;
            break;
          }
        }
        if (ok) out.push({ run, theme });
      }
    }
    return out;
  }, [state.runs, dimFilters, axisFilters]);

  // Aggregate: group value → axis → { sum, n, naCount }
  const aggregate = useMemo(() => {
    const groups = new Map<string, Record<AxisKey, { sum: number; n: number; na: number }>>();
    for (const { run, theme } of rows) {
      const g = run[groupBy].trim() || '(blank)';
      if (!groups.has(g)) {
        const init = {} as Record<AxisKey, { sum: number; n: number; na: number }>;
        for (const a of AXES) init[a.key] = { sum: 0, n: 0, na: 0 };
        groups.set(g, init);
      }
      const rec = groups.get(g)!;
      for (const a of AXES) {
        const v = theme.rating[a.key];
        if (typeof v === 'number') {
          rec[a.key].sum += v;
          rec[a.key].n += 1;
        } else if (v === 'na') {
          rec[a.key].na += 1;
        }
      }
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, groupBy]);

  const anyFilter =
    DIMENSIONS.some((d) => dimFilters[d.key].size > 0) ||
    AXES.some((a) => (axisFilters[a.key] ?? '') !== '');

  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-white">
      <div className="max-w-[1200px] mx-auto px-6 py-4 space-y-5">
        {/* Filters */}
        <section className="border border-slate-200 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-[12px] uppercase tracking-wider font-semibold text-slate-500">
              Filters
            </h2>
            {anyFilter && (
              <button
                type="button"
                onClick={() => {
                  setDimFilters({
                    model: new Set(),
                    promptVariant: new Set(),
                    version: new Set(),
                    dataSource: new Set(),
                    rq: new Set(),
                    positionality: new Set(),
                  });
                  setAxisFilters({});
                }}
                className="text-[11px] text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-100"
              >
                clear all
              </button>
            )}
            <span className="ml-auto text-[11px] text-slate-500 font-mono">
              {rows.length} theme{rows.length === 1 ? '' : 's'}
            </span>
          </div>
          {DIMENSIONS.map((d) =>
            dimValues[d.key].length > 0 ? (
              <div key={d.key} className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[11px] font-medium text-slate-500 w-[130px] flex-shrink-0">
                  {d.label}
                </span>
                {dimValues[d.key].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleDim(d.key, v)}
                    className={`px-2 py-0.5 rounded border text-[11px] font-medium transition-colors max-w-[340px] truncate ${
                      dimFilters[d.key].has(v)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                    title={v}
                  >
                    {v}
                  </button>
                ))}
              </div>
            ) : null,
          )}
          <div className="flex items-baseline gap-2 flex-wrap pt-1 border-t border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 w-[130px] flex-shrink-0">
              Scores
            </span>
            {AXES.map((a) => (
              <label key={a.key} className="flex items-center gap-1 text-[11px] text-slate-600">
                <span title={a.question}>{a.short}</span>
                <select
                  value={axisFilters[a.key] ?? ''}
                  onChange={(e) =>
                    setAxisFilters((f) => ({ ...f, [a.key]: e.target.value as ScoreFilter }))
                  }
                  className="px-1 py-0.5 text-[11px] border border-slate-300 rounded bg-white outline-none"
                >
                  <option value="">any</option>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                  <option value="na">N/A</option>
                  <option value="unrated">unrated</option>
                </select>
              </label>
            ))}
          </div>
        </section>

        {/* Aggregates */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-bold text-[15px] text-slate-900">Mean scores</h2>
            <span className="text-[11px] text-slate-500">by</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as Dimension)}
              className="px-2 py-1 text-[12px] border border-slate-300 rounded bg-white outline-none"
            >
              {DIMENSIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400">
              means over 1–5 scores only; N/A counted separately
            </span>
          </div>
          {aggregate.length === 0 ? (
            <div className="text-[13px] text-slate-400 italic border border-dashed border-slate-200 rounded-lg p-6 text-center">
              Nothing to aggregate yet.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-600">
                      {DIMENSIONS.find((d) => d.key === groupBy)?.label}
                    </th>
                    {AXES.map((a) => (
                      <th
                        key={a.key}
                        title={a.label}
                        className="px-2 py-2 text-center text-[10px] uppercase tracking-wider font-semibold text-slate-600"
                      >
                        {a.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aggregate.map(([g, rec]) => (
                    <tr key={g} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-800 break-words max-w-[320px]">{g}</td>
                      {AXES.map((a) => {
                        const { sum, n, na } = rec[a.key];
                        return (
                          <td key={a.key} className="px-2 py-2 text-center font-mono text-slate-600">
                            {n > 0 ? (
                              <>
                                <span className="font-semibold text-slate-800">
                                  {(sum / n).toFixed(2)}
                                </span>{' '}
                                <span className="text-[10px] text-slate-400">({n})</span>
                              </>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                            {na > 0 && (
                              <span className="block text-[9px] text-slate-400">{na} N/A</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Theme list */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-bold text-[15px] text-slate-900">Themes</h2>
            <div className="ml-auto flex items-center gap-2">
              <ExportBtn label="ratings.csv" onClick={onExportRatingsCSV} />
              <ExportBtn label="similarities.csv" onClick={onExportSimilaritiesCSV} />
              <ExportBtn label="full .json" onClick={onExportJSON} />
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="text-[13px] text-slate-400 italic border border-dashed border-slate-200 rounded-lg p-6 text-center">
              No themes match the filters.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-600">
                      Theme
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-600 w-[260px]">
                      Run
                    </th>
                    {AXES.map((a) => (
                      <th
                        key={a.key}
                        title={a.label}
                        className="px-1.5 py-2 text-center text-[10px] uppercase tracking-wider font-semibold text-slate-600 w-[44px]"
                      >
                        {a.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ run, theme }) => (
                    <tr key={theme.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => onJumpToTheme(run.id, theme.id)}
                          className="text-left text-slate-800 font-medium hover:underline break-words"
                        >
                          {theme.name}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[10px] text-slate-500 break-all">
                          {buildRunName(run)}
                        </span>
                      </td>
                      {AXES.map((a) => {
                        const v = theme.rating[a.key];
                        return (
                          <td
                            key={a.key}
                            className={`px-1.5 py-2 text-center font-mono ${
                              v === undefined
                                ? 'text-slate-300'
                                : v === 'na'
                                  ? 'text-slate-400'
                                  : 'text-slate-800 font-semibold'
                            }`}
                          >
                            {scoreDisplay(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ExportBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
    >
      {label} ↓
    </button>
  );
}

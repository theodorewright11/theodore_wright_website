import { useEffect, useMemo, useRef, useState } from 'react';
import { buildRunName } from './runName';
import { AXES } from './rubric';
import { scoreDisplay } from './shared';
import type { AppState, AxisKey, RatedTheme, Run } from './types';

type Props = {
  state: AppState;
  onJumpToTheme: (runId: string, themeId: string) => void;
  onExportRatingsCSV: () => void;
  onExportSimilaritiesCSV: () => void;
  onExportJSON: () => void;
};

type Dimension =
  | 'model'
  | 'promptVariant'
  | 'version'
  | 'dataSource'
  | 'rq'
  | 'positionality'
  | 'runN';
const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: 'model', label: 'Model' },
  { key: 'promptVariant', label: 'Prompt variant' },
  { key: 'version', label: 'Version' },
  { key: 'dataSource', label: 'Data source' },
  { key: 'rq', label: 'RQ' },
  { key: 'positionality', label: 'Positionality' },
  { key: 'runN', label: 'Run #' },
];

const emptyDimFilters = (): Record<Dimension, Set<string>> => ({
  model: new Set(),
  promptVariant: new Set(),
  version: new Set(),
  dataSource: new Set(),
  rq: new Set(),
  positionality: new Set(),
  runN: new Set(),
});

const dimValue = (run: Run, d: Dimension): string => (run[d] ?? '').trim();

// A [lo, hi] score range per axis. [1, 5] (or absent) = inactive; a narrowed
// range keeps only themes whose numeric score falls inside it (N/A and
// unrated are excluded once a range is active).
type AxisRanges = Partial<Record<AxisKey, [number, number]>>;

function rangeActive(r: [number, number] | undefined): r is [number, number] {
  return !!r && (r[0] > 1 || r[1] < 5);
}

export default function ExploreView({
  state,
  onJumpToTheme,
  onExportRatingsCSV,
  onExportSimilaritiesCSV,
  onExportJSON,
}: Props) {
  const [dimFilters, setDimFilters] = useState<Record<Dimension, Set<string>>>(emptyDimFilters);
  // Per-selected-prompt-variant version selection (versions only mean
  // something within their variant, so they're picked per variant, not
  // globally). Key = variant value, set = selected versions for it.
  const [variantVersions, setVariantVersions] = useState<Record<string, Set<string>>>({});
  const [runFilter, setRunFilter] = useState<Set<string>>(new Set());
  const [axisRanges, setAxisRanges] = useState<AxisRanges>({});
  const [groupBy, setGroupBy] = useState<Dimension>('positionality');
  const [collapsed, setCollapsed] = useState({
    filters: false,
    byDim: false,
    byRun: false,
    themes: false,
  });
  const toggleSection = (k: keyof typeof collapsed) =>
    setCollapsed((c) => ({ ...c, [k]: !c[k] }));

  const dimValues = useMemo(() => {
    const out = {} as Record<Dimension, string[]>;
    for (const d of DIMENSIONS) {
      out[d.key] = [
        ...new Set(state.runs.map((r) => dimValue(r, d.key)).filter((v) => v.length > 0)),
      ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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
    // Deselecting a prompt variant drops its per-variant version picks.
    if (dim === 'promptVariant') {
      setVariantVersions((m) => {
        if (!(value in m)) return m;
        const { [value]: _gone, ...rest } = m;
        return rest;
      });
    }
  };

  const toggleVariantVersion = (variant: string, version: string) => {
    setVariantVersions((m) => {
      const next = new Set(m[variant] ?? []);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return { ...m, [variant]: next };
    });
  };

  // Versions observed per prompt variant, for the per-variant sub-rows.
  const versionsByVariant = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of state.runs) {
      const pv = dimValue(r, 'promptVariant');
      const v = dimValue(r, 'version');
      if (!pv || !v) continue;
      if (!m.has(pv)) m.set(pv, []);
      if (!m.get(pv)!.includes(v)) m.get(pv)!.push(v);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return m;
  }, [state.runs]);

  // Filtered (run, theme) rows.
  const rows = useMemo(() => {
    const out: { run: Run; theme: RatedTheme }[] = [];
    for (const run of state.runs) {
      if (runFilter.size > 0 && !runFilter.has(run.id)) continue;
      let runOk = true;
      for (const d of DIMENSIONS) {
        if (d.key === 'version') continue; // versions are filtered per variant below
        const sel = dimFilters[d.key];
        if (sel.size > 0 && !sel.has(dimValue(run, d.key))) {
          runOk = false;
          break;
        }
      }
      if (!runOk) continue;
      const vv = variantVersions[dimValue(run, 'promptVariant')];
      if (vv && vv.size > 0 && !vv.has(dimValue(run, 'version'))) continue;
      for (const theme of run.themes) {
        let ok = true;
        for (const a of AXES) {
          const r = axisRanges[a.key];
          if (!rangeActive(r)) continue;
          const v = theme.rating[a.key];
          if (typeof v !== 'number' || v < r[0] || v > r[1]) {
            ok = false;
            break;
          }
        }
        if (ok) out.push({ run, theme });
      }
    }
    return out;
  }, [state.runs, dimFilters, variantVersions, runFilter, axisRanges]);

  type AggRec = Record<AxisKey, { sum: number; n: number; na: number; fives: number }>;
  const newAggRec = (): AggRec => {
    const init = {} as AggRec;
    for (const a of AXES) init[a.key] = { sum: 0, n: 0, na: 0, fives: 0 };
    return init;
  };
  const addToAgg = (rec: AggRec, theme: RatedTheme) => {
    for (const a of AXES) {
      const v = theme.rating[a.key];
      if (typeof v === 'number') {
        rec[a.key].sum += v;
        rec[a.key].n += 1;
        if (v === 5) rec[a.key].fives += 1;
      } else if (v === 'na') {
        rec[a.key].na += 1;
      }
    }
  };

  // Aggregate by the chosen dimension.
  const aggregate = useMemo(() => {
    const groups = new Map<string, AggRec>();
    for (const { run, theme } of rows) {
      const g = dimValue(run, groupBy) || '(blank)';
      if (!groups.has(g)) groups.set(g, newAggRec());
      addToAgg(groups.get(g)!, theme);
    }
    return [...groups.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, groupBy]);

  // Aggregate per run.
  const aggregateByRun = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; rec: AggRec }>();
    for (const { run, theme } of rows) {
      if (!groups.has(run.id))
        groups.set(run.id, { key: run.id, label: buildRunName(run), rec: newAggRec() });
      addToAgg(groups.get(run.id)!.rec, theme);
    }
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const anyFilter =
    runFilter.size > 0 ||
    DIMENSIONS.some((d) => dimFilters[d.key].size > 0) ||
    Object.values(variantVersions).some((s) => s.size > 0) ||
    AXES.some((a) => rangeActive(axisRanges[a.key]));

  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-white">
      <div className="max-w-[1200px] mx-auto px-6 py-4 space-y-5">
        {/* Filters */}
        <section className="border border-slate-200 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleSection('filters')}
              className="flex items-center gap-1.5 text-[12px] uppercase tracking-wider font-semibold text-slate-500 hover:text-slate-800"
            >
              <span className="text-[9px]">{collapsed.filters ? '▸' : '▾'}</span> Filters
            </button>
            {anyFilter && (
              <button
                type="button"
                onClick={() => {
                  setDimFilters(emptyDimFilters());
                  setVariantVersions({});
                  setRunFilter(new Set());
                  setAxisRanges({});
                }}
                className="text-[11px] text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-100"
              >
                Clear all
              </button>
            )}
            <span className="ml-auto text-[11px] text-slate-500 font-mono">
              {rows.length} theme{rows.length === 1 ? '' : 's'}
            </span>
          </div>

          {!collapsed.filters && (<>
          {/* Run multiselect */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-slate-500 w-[130px] flex-shrink-0">
              Runs
            </span>
            <RunMultiSelect
              runs={state.runs}
              selected={runFilter}
              onChange={setRunFilter}
            />
          </div>

          {DIMENSIONS.map((d) => {
            // Versions are picked per selected prompt variant (sub-rows below),
            // not as a global row.
            if (d.key === 'version') return null;
            if (dimValues[d.key].length === 0) return null;
            return (
              <div key={d.key}>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span
                    className={`text-[11px] font-medium w-[130px] flex-shrink-0 ${
                      dimFilters[d.key].size > 0 ? 'text-blue-700 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {d.label}
                    {dimFilters[d.key].size > 0 && (
                      <span className="ml-1 font-normal">({dimFilters[d.key].size})</span>
                    )}
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
                {/* Per-variant version pickers for each selected prompt variant */}
                {d.key === 'promptVariant' &&
                  [...dimFilters.promptVariant]
                    .sort()
                    .map((variant) => {
                      const versions = versionsByVariant.get(variant) ?? [];
                      if (versions.length === 0) return null;
                      const sel = variantVersions[variant] ?? new Set<string>();
                      return (
                        <div
                          key={variant}
                          className="flex items-baseline gap-2 flex-wrap mt-1.5 ml-[130px]"
                        >
                          <span
                            className={`text-[11px] font-medium flex-shrink-0 ${
                              sel.size > 0 ? 'text-blue-700 font-semibold' : 'text-slate-400'
                            }`}
                          >
                            {variant} versions{sel.size > 0 ? ` (${sel.size})` : ''}
                          </span>
                          {versions.map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => toggleVariantVersion(variant, v)}
                              className={`px-2 py-0.5 rounded border text-[11px] font-medium transition-colors ${
                                sel.has(v)
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              v{v}
                            </button>
                          ))}
                        </div>
                      );
                    })}
              </div>
            );
          })}

          {/* Score ranges */}
          <div className="flex items-start gap-2 flex-wrap pt-1 border-t border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 w-[130px] flex-shrink-0 pt-1">
              Scores
            </span>
            <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap">
              {AXES.map((a) => {
                const r = axisRanges[a.key] ?? ([1, 5] as [number, number]);
                const active = rangeActive(axisRanges[a.key]);
                return (
                  <div key={a.key} className="flex items-center gap-1.5">
                    <span
                      title={a.label}
                      className={`text-[11px] w-[30px] text-right ${active ? 'text-blue-700 font-semibold' : 'text-slate-600'}`}
                    >
                      {a.short}
                    </span>
                    <RangeSlider
                      value={r}
                      onChange={(nv) =>
                        setAxisRanges((f) => ({ ...f, [a.key]: nv }))
                      }
                    />
                    <span
                      className={`text-[10px] font-mono w-[26px] ${active ? 'text-blue-700 font-semibold' : 'text-slate-400'}`}
                    >
                      {r[0]}–{r[1]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          </>)}
        </section>

        {/* Aggregates by dimension */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => toggleSection('byDim')}
              className="flex items-center gap-1.5 font-bold text-[15px] text-slate-900 hover:text-slate-600"
            >
              <span className="text-[10px] text-slate-400">{collapsed.byDim ? '▸' : '▾'}</span> Mean
              scores
            </button>
            {!collapsed.byDim && (
              <>
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
              </>
            )}
          </div>
          {!collapsed.byDim && (
            <AggTable
              rows={aggregate.map(([g, rec]) => ({ key: `${groupBy}:${g}`, label: g, rec }))}
              firstColLabel={DIMENSIONS.find((d) => d.key === groupBy)?.label ?? ''}
            />
          )}
        </section>

        {/* Aggregates by run */}
        <section>
          <button
            type="button"
            onClick={() => toggleSection('byRun')}
            className="flex items-center gap-1.5 font-bold text-[15px] text-slate-900 hover:text-slate-600 mb-2"
          >
            <span className="text-[10px] text-slate-400">{collapsed.byRun ? '▸' : '▾'}</span> Mean
            scores by run
          </button>
          {!collapsed.byRun && (
            <AggTable
              rows={aggregateByRun.map((g) => ({ key: g.key, label: g.label, rec: g.rec }))}
              firstColLabel="Run"
              mono
            />
          )}
        </section>

        {/* Theme list */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => toggleSection('themes')}
              className="flex items-center gap-1.5 font-bold text-[15px] text-slate-900 hover:text-slate-600"
            >
              <span className="text-[10px] text-slate-400">{collapsed.themes ? '▸' : '▾'}</span>{' '}
              Themes
            </button>
            <div className="ml-auto flex items-center gap-2">
              <ExportBtn label="Ratings .csv" onClick={onExportRatingsCSV} />
              <ExportBtn label="Similarities .csv" onClick={onExportSimilaritiesCSV} />
              <ExportBtn label="Full .json" onClick={onExportJSON} />
            </div>
          </div>
          {collapsed.themes ? null : rows.length === 0 ? (
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
                    <tr
                      key={`${run.id}:${theme.id}`}
                      className="border-t border-slate-100 hover:bg-slate-50/60"
                    >
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

// --- Run multiselect dropdown --------------------------------------------------

function RunMultiSelect({
  runs,
  selected,
  onChange,
}: {
  runs: Run[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const sorted = [...runs].sort((a, b) => buildRunName(a).localeCompare(buildRunName(b)));

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`px-2 py-0.5 rounded border text-[11px] font-medium transition-colors ${
          selected.size > 0
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
        }`}
      >
        {selected.size > 0 ? `${selected.size} selected` : 'All runs'} ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-md shadow-lg max-h-[320px] w-max max-w-[560px] overflow-auto py-1">
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="block w-full text-left px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-50 border-b border-slate-100"
            >
              Clear selection
            </button>
          )}
          {sorted.map((r) => {
            const on = selected.has(r.id);
            return (
              <label
                key={r.id}
                className="flex items-center gap-2 px-2.5 py-1 text-[11px] font-mono text-slate-700 whitespace-nowrap hover:bg-blue-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    const next = new Set(selected);
                    if (on) next.delete(r.id);
                    else next.add(r.id);
                    onChange(next);
                  }}
                />
                {buildRunName(r)}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Dual-thumb 1–5 range slider -------------------------------------------------

function RangeSlider({
  value,
  onChange,
}: {
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  const [lo, hi] = value;
  const pct = (n: number) => ((n - 1) / 4) * 100;
  // When both thumbs sit on the same value, put the one that can still move on
  // top (at the high end only the low thumb can move, and vice versa).
  const loOnTop = lo === hi && lo > 3;
  return (
    <div className="relative w-[110px] h-5">
      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-slate-200 rounded" />
      <div
        className="absolute top-1/2 -translate-y-1/2 h-1 bg-blue-500 rounded"
        style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
      />
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={lo}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange([Math.min(n, hi), hi]);
        }}
        className="tg-range absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
        style={{ zIndex: loOnTop ? 4 : 3 }}
      />
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={hi}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange([lo, Math.max(n, lo)]);
        }}
        className="tg-range absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
        style={{ zIndex: loOnTop ? 3 : 4 }}
      />
    </div>
  );
}

// --- Aggregate table -------------------------------------------------------------

function AggTable({
  rows,
  firstColLabel,
  mono = false,
}: {
  rows: {
    // Stable unique key (run id / group value) — labels can collide when two
    // runs share a composed name, and duplicate React keys leave ghost rows.
    key: string;
    label: string;
    rec: Record<AxisKey, { sum: number; n: number; na: number; fives: number }>;
  }[];
  firstColLabel: string;
  mono?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-[13px] text-slate-400 italic border border-dashed border-slate-200 rounded-lg p-6 text-center">
        Nothing to aggregate yet.
      </div>
    );
  }
  return (
    <div className="border border-slate-200 rounded-lg overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-600">
              {firstColLabel}
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
          {rows.map(({ key, label, rec }) => (
            <tr key={key} className="border-t border-slate-100">
              <td
                className={`px-3 py-2 text-slate-800 break-all max-w-[360px] ${mono ? 'font-mono text-[10px] text-slate-600' : 'break-words'}`}
              >
                {label}
              </td>
              {AXES.map((a) => {
                const { sum, n, na, fives } = rec[a.key];
                return (
                  <td key={a.key} className="px-2 py-2 text-center font-mono text-slate-600">
                    {n > 0 ? (
                      <>
                        <span className="font-semibold text-slate-800">{(sum / n).toFixed(2)}</span>{' '}
                        <span className="text-[10px] text-slate-400">({n})</span>
                        <span
                          className={`block text-[9px] ${fives > 0 ? 'text-blue-600' : 'text-slate-300'}`}
                          title={`${fives} of ${n} scored 5`}
                        >
                          {fives}× 5
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                    {na > 0 && <span className="block text-[9px] text-slate-400">{na} N/A</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
      {label}
    </button>
  );
}

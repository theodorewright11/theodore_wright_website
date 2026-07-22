import { useEffect, useMemo, useRef, useState } from 'react';
import { buildRunName } from './runName';
import { AXES, SIMILARITY_RUBRIC, type AxisDef } from './rubric';
import { Chip, ScoreButtons, isFullyRated, ratedAxisCount } from './shared';
import { docIndexForNumber, docNumber } from './storage';
import type { AppState, AxisScore, Corpus, RatedTheme, Run, ThemeQuote } from './types';

type Props = {
  state: AppState;
  shownRuns: Run[];
  focusThemeId: string | null;
  onSetRateRuns: (ids: string[]) => void;
  onSetScore: (runId: string, themeId: string, axis: AxisDef['key'], v: AxisScore | undefined) => void;
  onSetRatingNotes: (runId: string, themeId: string, notes: string) => void;
  onAddSimilarity: (themeA: string, themeB: string) => void;
  onSetSimilarity: (themeA: string, themeB: string, v: AxisScore | undefined) => void;
  onSetSimilarityNotes: (themeA: string, themeB: string, notes: string) => void;
  onRemoveSimilarity: (themeA: string, themeB: string) => void;
  onToggleDisplay: (
    key:
      | 'showDefinition'
      | 'showReasoning'
      | 'showQuotes'
      | 'showQuoteSources'
      | 'showSupportingData'
      | 'showRubricHints',
  ) => void;
  onFocusHandled: () => void;
};

export default function RateView({
  state,
  shownRuns,
  focusThemeId,
  onSetRateRuns,
  onSetScore,
  onSetRatingNotes,
  onAddSimilarity,
  onSetSimilarity,
  onSetSimilarityNotes,
  onRemoveSimilarity,
  onToggleDisplay,
  onFocusHandled,
}: Props) {
  const [rubricOpen, setRubricOpen] = useState(false);
  // Index of the run chip being dragged (chips reorder the run columns).
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [docModal, setDocModal] = useState<{
    corpus: Corpus;
    docIdx: number;
    highlight?: { start: number; end: number };
  } | null>(null);

  const corpusById = useMemo(() => new Map(state.corpora.map((c) => [c.id, c])), [state.corpora]);
  // theme id → run + theme, across every run (similarity links can span runs).
  const themeById = useMemo(() => {
    const m = new Map<string, { run: Run; theme: RatedTheme }>();
    for (const run of state.runs) for (const t of run.themes) m.set(t.id, { run, theme: t });
    return m;
  }, [state.runs]);

  const openQuoteDoc = (run: Run, q: ThemeQuote) => {
    const corpus = run.corpusId ? corpusById.get(run.corpusId) : undefined;
    if (!corpus || !q.anchor) return;
    setDocModal({
      corpus,
      docIdx: q.anchor.docIdx,
      highlight: { start: q.anchor.start, end: q.anchor.end },
    });
  };

  // Open a document by its D-number (supporting-data tags, possible sources).
  const openDocByNumber = (run: Run, n: number) => {
    const corpus = run.corpusId ? corpusById.get(run.corpusId) : undefined;
    if (!corpus) return;
    const docIdx = docIndexForNumber(corpus, n);
    if (docIdx === null) return;
    setDocModal({ corpus, docIdx });
  };

  const shownIds = shownRuns.map((r) => r.id);

  const singleRun = shownRuns.length === 1;
  const runGridCls =
    shownRuns.length <= 1
      ? 'grid-cols-1'
      : shownRuns.length === 2
        ? 'grid-cols-1 lg:grid-cols-2'
        : shownRuns.length === 3
          ? 'grid-cols-1 lg:grid-cols-3'
          : 'grid-cols-1 lg:grid-cols-4';

  const cardProps = {
    state,
    themeById,
    onSetScore,
    onSetRatingNotes,
    onAddSimilarity,
    onSetSimilarity,
    onSetSimilarityNotes,
    onRemoveSimilarity,
    onQuoteClick: openQuoteDoc,
    onOpenDocNumber: openDocByNumber,
    focusThemeId,
    onFocusHandled,
    shownRuns,
  };

  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-slate-50/60">
      <div className="max-w-[1500px] mx-auto px-6 py-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
            Runs
          </span>
          {shownRuns.map((r, i) => (
            <span
              key={`${r.id}:${i}`}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragEnd={() => setDragIdx(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== i) {
                  const next = [...shownIds];
                  const [moved] = next.splice(dragIdx, 1);
                  next.splice(i, 0, moved);
                  onSetRateRuns(next);
                }
                setDragIdx(null);
              }}
              title="Drag to reorder columns"
              className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-white border rounded-md text-[11px] font-mono text-slate-700 max-w-[380px] cursor-grab active:cursor-grabbing ${
                dragIdx === i ? 'border-blue-400 opacity-60' : 'border-slate-300'
              }`}
            >
              <span className="truncate">{buildRunName(r)}</span>
              <button
                type="button"
                onClick={() => onSetRateRuns(shownIds.filter((_, j) => j !== i))}
                className="text-slate-400 hover:text-red-600 font-sans font-semibold px-0.5"
                title="Remove from view"
              >
                ×
              </button>
            </span>
          ))}
          {shownRuns.length < 4 && state.runs.length > 0 && (
            <AddRunPicker
              runs={state.runs}
              onPick={(id) => onSetRateRuns([...shownIds, id])}
            />
          )}

          <div className="flex items-center gap-2.5 text-[11px] text-slate-600 flex-wrap ml-auto">
            <Toggle label="Definition" on={state.showDefinition !== false} onClick={() => onToggleDisplay('showDefinition')} />
            <Toggle label="Reasoning" on={state.showReasoning !== false} onClick={() => onToggleDisplay('showReasoning')} />
            <Toggle label="Quotes" on={state.showQuotes !== false} onClick={() => onToggleDisplay('showQuotes')} />
            <Toggle label="Sources" on={state.showQuoteSources !== false} onClick={() => onToggleDisplay('showQuoteSources')} />
            <Toggle label="Supporting data" on={state.showSupportingData !== false} onClick={() => onToggleDisplay('showSupportingData')} />
            <Toggle label="Score hints" on={!!state.showRubricHints} onClick={() => onToggleDisplay('showRubricHints')} />
            <button
              type="button"
              onClick={() => setRubricOpen((v) => !v)}
              className={`px-3 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                rubricOpen
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'text-slate-600 border-slate-300 hover:bg-slate-100'
              }`}
            >
              Rubric
            </button>
          </div>
        </div>

        {rubricOpen && <RubricPanel />}

        {shownRuns.length === 0 ? (
          <div className="text-[13px] text-slate-400 italic border border-dashed border-slate-300 rounded-lg p-10 text-center bg-white">
            No run shown. Pick one with “+ Show run…” above, or create one in the Runs tab.
          </div>
        ) : (
          <div className={`grid gap-4 ${runGridCls} items-start`}>
            {shownRuns.map((run, i) => (
              <div key={`${run.id}:${i}`} className="min-w-0">
                <RunHeader run={run} corpusName={run.corpusId ? corpusById.get(run.corpusId)?.name : undefined} />
                <div className={`grid gap-3 ${singleRun ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                  {run.themes.map((t, ti) => (
                    <ThemeCard key={t.id} theme={t} run={run} index={ti + 1} {...cardProps} />
                  ))}
                  {run.themes.length === 0 && (
                    <div className="text-[12px] text-slate-400 italic border border-dashed border-slate-300 rounded-lg p-6 text-center bg-white">
                      This run has no themes.
                    </div>
                  )}
                </div>
                {run.additionalText && (
                  <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
                      Additional text from import
                    </div>
                    <div className="text-[12px] text-slate-600 whitespace-pre-wrap leading-snug">
                      {run.additionalText}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {docModal && (
        <DocModal
          corpus={docModal.corpus}
          docIdx={docModal.docIdx}
          highlight={docModal.highlight}
          onClose={() => setDocModal(null)}
        />
      )}
    </div>
  );
}

// --- Run column header --------------------------------------------------------

function RunHeader({ run, corpusName }: { run: Run; corpusName?: string }) {
  const rated = run.themes.filter(isFullyRated).length;
  return (
    <div className="mb-2.5 bg-white border border-slate-300 rounded-lg px-3 py-2 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[12px] font-bold text-slate-800 break-all leading-snug">
          {buildRunName(run)}
        </span>
        <span
          className={`ml-auto flex-shrink-0 text-[11px] font-mono ${
            rated === run.themes.length && run.themes.length > 0
              ? 'text-emerald-600 font-semibold'
              : 'text-slate-500'
          }`}
        >
          {rated}/{run.themes.length} Rated
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
        {run.model && <Chip label={run.model} tone="blue" />}
        {run.promptVariant && <Chip label={run.promptVariant} />}
        {run.version && <Chip label={`v${run.version}`} />}
        {run.dataSource && <Chip label={run.dataSource} tone="amber" />}
        {run.rq && <Chip label={run.rq} />}
        {run.positionality && <Chip label={run.positionality} />}
        {run.runN && <Chip label={`run${run.runN}`} />}
        {corpusName && <Chip label={corpusName} tone="amber" />}
      </div>
    </div>
  );
}

// Alphabetized run picker with its own scrollable panel (long run names scroll
// sideways; long lists scroll vertically) — a native <select> can do neither.
function AddRunPicker({ runs, onPick }: { runs: Run[]; onPick: (id: string) => void }) {
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
        className="px-2 py-1 text-[11px] border border-dashed border-slate-300 rounded-md bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
      >
        + Show run…
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-md shadow-lg max-h-[320px] w-max max-w-[560px] overflow-auto py-1">
          {sorted.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onPick(r.id);
                setOpen(false);
              }}
              className="block w-full text-left px-2.5 py-1 text-[11px] font-mono text-slate-700 whitespace-nowrap hover:bg-blue-50"
            >
              {buildRunName(r)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded border text-[11px] font-medium transition-colors ${
        on
          ? 'bg-blue-50 text-blue-700 border-blue-300'
          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  );
}

// --- Rubric panel --------------------------------------------------------------

function RubricPanel() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  return (
    <div className="mb-4 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
      {AXES.map((a) => (
        <div key={a.key}>
          <button
            type="button"
            onClick={() => setOpenKey(openKey === a.key ? null : a.key)}
            className="w-full text-left px-3 py-2 flex items-baseline gap-2 hover:bg-slate-50"
          >
            <span className="text-[12px] font-semibold text-slate-800">
              {a.label}
              {a.wip && <span className="ml-1.5 text-[9px] uppercase text-amber-600 font-bold">wip</span>}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">{a.kind}</span>
            <span className="text-[11px] text-slate-500 truncate flex-1">{a.question}</span>
            <span className="text-slate-400 text-[10px]">{openKey === a.key ? '▴' : '▾'}</span>
          </button>
          {openKey === a.key && (
            <div className="px-3 pb-3">
              <p className="text-[12px] text-slate-600 leading-snug mb-2">{a.question}</p>
              <table className="w-full text-[11px]">
                <tbody>
                  {a.levels.map((lvl, i) => (
                    <tr key={i} className="align-top">
                      <td className="py-1 pr-2 font-mono font-bold text-slate-700 w-6">{5 - i}</td>
                      <td className="py-1 text-slate-600 leading-snug">{lvl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
      <div>
        <button
          type="button"
          onClick={() => setOpenKey(openKey === 'similarity' ? null : 'similarity')}
          className="w-full text-left px-3 py-2 flex items-baseline gap-2 hover:bg-slate-50"
        >
          <span className="text-[12px] font-semibold text-slate-800">{SIMILARITY_RUBRIC.label}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">pairwise</span>
          <span className="text-[11px] text-slate-500 truncate flex-1">
            {SIMILARITY_RUBRIC.question}
          </span>
          <span className="text-slate-400 text-[10px]">{openKey === 'similarity' ? '▴' : '▾'}</span>
        </button>
        {openKey === 'similarity' && (
          <div className="px-3 pb-3">
            <table className="w-full text-[11px]">
              <tbody>
                {SIMILARITY_RUBRIC.levels.map((lvl, i) => (
                  <tr key={i} className="align-top">
                    <td className="py-1 pr-2 font-mono font-bold text-slate-700 w-6">{5 - i}</td>
                    <td className="py-1 text-slate-600 leading-snug">{lvl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Theme card ----------------------------------------------------------------

function ThemeCard({
  theme,
  run,
  index,
  state,
  themeById,
  shownRuns,
  focusThemeId,
  onFocusHandled,
  onSetScore,
  onSetRatingNotes,
  onAddSimilarity,
  onSetSimilarity,
  onSetSimilarityNotes,
  onRemoveSimilarity,
  onQuoteClick,
  onOpenDocNumber,
}: {
  theme: RatedTheme;
  run: Run;
  index: number;
  state: AppState;
  themeById: Map<string, { run: Run; theme: RatedTheme }>;
  shownRuns: Run[];
  focusThemeId: string | null;
  onFocusHandled: () => void;
  onSetScore: Props['onSetScore'];
  onSetRatingNotes: Props['onSetRatingNotes'];
  onAddSimilarity: Props['onAddSimilarity'];
  onSetSimilarity: Props['onSetSimilarity'];
  onSetSimilarityNotes: Props['onSetSimilarityNotes'];
  onRemoveSimilarity: Props['onRemoveSimilarity'];
  onQuoteClick: (run: Run, q: ThemeQuote) => void;
  onOpenDocNumber: (run: Run, n: number) => void;
}) {
  const focus = focusThemeId === theme.id;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onFocusHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // Existing similarity links involving this theme.
  const links = state.similarities
    .filter((s) => s.themeA === theme.id || s.themeB === theme.id)
    .map((s) => {
      const otherId = s.themeA === theme.id ? s.themeB : s.themeA;
      const other = themeById.get(otherId);
      return other ? { pair: s, otherId, other } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const linkedIds = new Set(links.map((l) => l.otherId));

  // Candidates for a new link: same run's themes first, then other shown runs
  // — each group alphabetical by theme name.
  const candidates: { id: string; label: string }[] = [];
  for (const r of [run, ...shownRuns.filter((r) => r.id !== run.id)]) {
    const themes = [...r.themes].sort((a, b) => a.name.localeCompare(b.name));
    for (const t of themes) {
      if (t.id === theme.id || linkedIds.has(t.id)) continue;
      candidates.push({
        id: t.id,
        label: r.id === run.id ? t.name : `[${buildRunName(r)}] ${t.name}`,
      });
    }
  }

  const rated = ratedAxisCount(theme);
  return (
    <div
      ref={ref}
      className={`bg-white border rounded-lg p-3 flex flex-col ${
        focus ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start gap-2">
        <h3 className="text-[14px] font-bold text-slate-900 leading-snug break-words flex-1">
          {theme.name}
        </h3>
        <span
          className="flex-shrink-0 font-mono text-[10px] text-slate-400 border border-slate-200 rounded px-1 py-0.5 leading-none"
          title={`Theme ${index} of ${run.themes.length} in this run`}
        >
          {index}
        </span>
      </div>

      {state.showDefinition !== false && theme.definition && (
        <Section label="Definition" text={theme.definition} />
      )}
      {state.showReasoning !== false && theme.reasoning && (
        <Section label="Reasoning" text={theme.reasoning} />
      )}

      {state.showQuotes !== false && theme.quotes.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
            Quotes ({theme.quotes.filter((q) => q.anchor).length}/{theme.quotes.length} in data)
          </div>
          <ul className="space-y-1">
            {theme.quotes.map((q, i) => (
              <li key={i} className="text-[12px] text-slate-700 leading-snug">
                <button
                  type="button"
                  disabled={!q.anchor}
                  onClick={() => onQuoteClick(run, q)}
                  className={`text-left italic break-words ${
                    q.anchor ? 'hover:bg-blue-50 rounded cursor-pointer' : 'cursor-default'
                  }`}
                  title={q.anchor ? 'Open source document' : 'Not found in the data'}
                >
                  “{q.text}”
                </button>
                {state.showQuoteSources !== false && (
                  <span className="ml-1 whitespace-nowrap">
                    {q.source && (
                      <span
                        className={`font-mono text-[10px] ${q.anchor ? 'text-emerald-600' : 'text-slate-400'}`}
                        title={
                          q.anchor
                            ? 'Found in this document'
                            : 'Not found in this document (✗) — paraphrase or wrong source tag'
                        }
                      >
                        {q.source}
                        {q.anchor ? '' : ' ✗'}
                      </span>
                    )}
                    {q.role && <span className="ml-1 text-[10px] text-amber-700">{q.role}</span>}
                    {!q.anchor &&
                      q.possibleSources?.map((p) => (
                        <button
                          key={p.source}
                          type="button"
                          onClick={() => {
                            const m = p.source.match(/(\d+)/);
                            if (m) onOpenDocNumber(run, parseInt(m[1], 10));
                          }}
                          className="ml-1 text-[10px] text-blue-600 hover:underline"
                          title={`possible source (score ${p.score})`}
                        >
                          {p.source}?
                        </button>
                      ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.showSupportingData !== false && theme.supportingData && theme.supportingData.length > 0 && (
        <div className="mt-2 text-[11px] leading-snug">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
            Supporting data ({theme.supportingData.length}):
          </span>{' '}
          {theme.supportingData.map((tag, i) => {
            const m = tag.match(/(\d+)/);
            return (
              <button
                key={`${tag}:${i}`}
                type="button"
                disabled={!m}
                onClick={() => {
                  if (m) onOpenDocNumber(run, parseInt(m[1], 10));
                }}
                className="font-mono text-[10px] text-blue-600 hover:underline mr-1.5"
                title={`Open ${tag}`}
              >
                {tag.replace(/^\[|\]$/g, '')}
              </button>
            );
          })}
        </div>
      )}

      {/* Rating strips */}
      <div className="mt-3 pt-2 border-t border-slate-100 space-y-1.5">
        {AXES.map((a) => {
          const v = theme.rating[a.key];
          return (
            <div key={a.key}>
              <div className="flex items-center gap-2">
                <span
                  title={a.question}
                  className={`text-[11px] font-medium w-[150px] flex-shrink-0 ${
                    a.wip ? 'text-amber-700' : 'text-slate-600'
                  }`}
                >
                  {a.label}
                  {a.wip && <span className="ml-1 text-[8px] uppercase font-bold">wip</span>}
                </span>
                <ScoreButtons
                  compact
                  value={v ?? null}
                  levels={a.levels}
                  onChange={(nv) => onSetScore(run.id, theme.id, a.key, nv)}
                />
              </div>
              {state.showRubricHints && (
                <div className="mt-0.5 ml-[150px] text-[10px] leading-snug">
                  {typeof v === 'number' ? (
                    <span className="text-slate-600">
                      <span className="font-semibold">{v}:</span> {a.levels[5 - v]}
                    </span>
                  ) : v === 'na' ? (
                    <span className="text-slate-400 italic">Marked not applicable.</span>
                  ) : (
                    <span className="text-slate-400 italic">{a.question}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">{rated}/6</span>
          <input
            value={theme.rating.notes ?? ''}
            onChange={(e) => onSetRatingNotes(run.id, theme.id, e.target.value)}
            placeholder="Rating notes"
            className="flex-1 px-1.5 py-0.5 text-[11px] border border-slate-200 rounded outline-none focus:border-blue-400 min-w-0"
          />
        </div>
      </div>

      {/* Theme similarity */}
      <div className="mt-2 pt-2 border-t border-slate-100">
        <div
          className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1"
          title={SIMILARITY_RUBRIC.question}
        >
          Theme similarity
        </div>
        {links.map(({ pair, otherId, other }) => (
          <div key={otherId} className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span
              className="text-[11px] text-slate-700 break-words min-w-0 flex-1"
              title={other.run.id === run.id ? undefined : buildRunName(other.run)}
            >
              {other.theme.name}
              {other.run.id !== run.id && (
                <span className="ml-1 font-mono text-[9px] text-slate-400">
                  [{buildRunName(other.run)}]
                </span>
              )}
            </span>
            <ScoreButtons
              compact
              value={pair.similarity ?? null}
              levels={SIMILARITY_RUBRIC.levels}
              onChange={(v) => onSetSimilarity(theme.id, otherId, v)}
            />
            <input
              value={pair.notes ?? ''}
              onChange={(e) => onSetSimilarityNotes(theme.id, otherId, e.target.value)}
              placeholder="Notes"
              className="px-1.5 py-0.5 text-[10px] border border-slate-200 rounded w-[90px] outline-none focus:border-blue-400"
            />
            <button
              type="button"
              onClick={() => onRemoveSimilarity(theme.id, otherId)}
              className="text-slate-300 hover:text-red-600 text-[12px] leading-none px-0.5"
              title="Remove similarity link"
            >
              ×
            </button>
          </div>
        ))}
        {candidates.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onAddSimilarity(theme.id, e.target.value);
            }}
            className="w-full px-1.5 py-1 text-[11px] border border-dashed border-slate-300 rounded bg-white text-slate-500 outline-none"
          >
            <option value="">+ Compare with…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

function Section({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-0.5">
        {label}
      </div>
      <p className="text-[12px] text-slate-700 leading-snug whitespace-pre-wrap break-words">
        {text}
      </p>
    </div>
  );
}

// --- Source-document modal --------------------------------------------------

function DocModal({
  corpus,
  docIdx,
  highlight,
  onClose,
}: {
  corpus: Corpus;
  docIdx: number;
  highlight?: { start: number; end: number };
  onClose: () => void;
}) {
  const doc = corpus.docs[docIdx];
  const markRef = useRef<HTMLElement>(null);
  useEffect(() => {
    markRef.current?.scrollIntoView({ block: 'center' });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!doc) return null;
  const pieces: React.ReactNode[] = [];
  if (highlight) {
    const s = Math.max(0, Math.min(doc.text.length, highlight.start));
    const e = Math.max(s, Math.min(doc.text.length, highlight.end));
    if (s > 0) pieces.push(<span key="a">{doc.text.slice(0, s)}</span>);
    pieces.push(
      <mark key="b" ref={markRef} className="bg-yellow-200 rounded-sm px-0.5">
        {doc.text.slice(s, e)}
      </mark>,
    );
    if (e < doc.text.length) pieces.push(<span key="c">{doc.text.slice(e)}</span>);
  } else {
    pieces.push(<span key="all">{doc.text}</span>);
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-[720px] w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
          <span className="font-mono text-[12px] font-bold text-slate-700">
            D{docNumber(corpus, docIdx)}
          </span>
          {doc.extId && doc.extId !== `D${docNumber(corpus, docIdx)}` && (
            <span className="text-[11px] text-slate-400">id: {doc.extId}</span>
          )}
          <span className="text-[11px] text-slate-400">· {corpus.name}</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-slate-400 hover:text-slate-700 text-[16px] leading-none px-1"
          >
            ×
          </button>
        </div>
        <div
          className="p-4 overflow-y-auto text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words"
          style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
        >
          {pieces}
        </div>
      </div>
    </div>
  );
}

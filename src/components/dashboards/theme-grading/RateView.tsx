import { useEffect, useMemo, useRef, useState } from 'react';
import { AXES, SIMILARITY_RUBRIC, type AxisDef } from './rubric';
import { Chip, ScoreButtons, isFullyRated, ratedAxisCount, runLabel } from './shared';
import type { AppState, AxisScore, Corpus, RatedTheme, Run, ThemeQuote } from './types';

type Props = {
  state: AppState;
  activeRun: Run | null;
  pinnedIds: string[];
  focusThemeId: string | null;
  onSelectRun: (id: string) => void;
  onSetScore: (runId: string, themeId: string, axis: AxisDef['key'], v: AxisScore | undefined) => void;
  onSetRatingNotes: (runId: string, themeId: string, notes: string) => void;
  onTogglePin: (themeId: string) => void;
  onClearPins: () => void;
  onSetSimilarity: (themeA: string, themeB: string, v: AxisScore | undefined) => void;
  onSetSimilarityNotes: (themeA: string, themeB: string, notes: string) => void;
  onToggleDisplay: (key: 'showDefinition' | 'showReasoning' | 'showQuotes' | 'showQuoteSources' | 'showRubricHints') => void;
  onSetColumns: (n: 1 | 2 | 3) => void;
  onFocusHandled: () => void;
};

// theme id → its run + theme, across every run (pins can span runs).
function themeIndex(runs: Run[]): Map<string, { run: Run; theme: RatedTheme }> {
  const m = new Map<string, { run: Run; theme: RatedTheme }>();
  for (const run of runs) for (const t of run.themes) m.set(t.id, { run, theme: t });
  return m;
}

export default function RateView({
  state,
  activeRun,
  pinnedIds,
  focusThemeId,
  onSelectRun,
  onSetScore,
  onSetRatingNotes,
  onTogglePin,
  onClearPins,
  onSetSimilarity,
  onSetSimilarityNotes,
  onToggleDisplay,
  onSetColumns,
  onFocusHandled,
}: Props) {
  const [rubricOpen, setRubricOpen] = useState(false);
  const [docModal, setDocModal] = useState<{
    corpus: Corpus;
    docIdx: number;
    highlight?: { start: number; end: number };
  } | null>(null);

  const index = useMemo(() => themeIndex(state.runs), [state.runs]);
  const corpusById = useMemo(() => new Map(state.corpora.map((c) => [c.id, c])), [state.corpora]);

  const openQuoteDoc = (run: Run, q: ThemeQuote, docIdxOverride?: number) => {
    const corpus = run.corpusId ? corpusById.get(run.corpusId) : undefined;
    if (!corpus) return;
    if (q.anchor && docIdxOverride === undefined) {
      setDocModal({
        corpus,
        docIdx: q.anchor.docIdx,
        highlight: { start: q.anchor.start, end: q.anchor.end },
      });
    } else if (docIdxOverride !== undefined && corpus.docs[docIdxOverride]) {
      setDocModal({ corpus, docIdx: docIdxOverride });
    }
  };

  const cols = state.rateColumns ?? 2;
  const gridCls =
    cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-3';

  const pinned = pinnedIds
    .map((id) => index.get(id))
    .filter((x): x is { run: Run; theme: RatedTheme } => !!x);

  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-slate-50/60">
      <div className="max-w-[1400px] mx-auto px-6 py-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <select
            value={activeRun?.id ?? ''}
            onChange={(e) => onSelectRun(e.target.value)}
            className="px-2 py-1.5 text-[12px] border border-slate-300 rounded-md bg-white max-w-[440px] outline-none focus:border-blue-400"
          >
            {state.runs.length === 0 && <option value="">— no runs yet —</option>}
            {state.runs.map((r) => (
              <option key={r.id} value={r.id}>
                {runLabel(r, state.corpora)}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onSetColumns(n)}
                title={`${n} column${n === 1 ? '' : 's'}`}
                className={`px-2.5 py-1 text-[11px] font-semibold ${
                  cols === n
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 border-l border-slate-200 first:border-l-0'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 text-[11px] text-slate-600 flex-wrap">
            <Toggle label="definition" on={state.showDefinition !== false} onClick={() => onToggleDisplay('showDefinition')} />
            <Toggle label="reasoning" on={state.showReasoning !== false} onClick={() => onToggleDisplay('showReasoning')} />
            <Toggle label="quotes" on={state.showQuotes !== false} onClick={() => onToggleDisplay('showQuotes')} />
            <Toggle label="sources" on={state.showQuoteSources !== false} onClick={() => onToggleDisplay('showQuoteSources')} />
            <Toggle label="score hints" on={!!state.showRubricHints} onClick={() => onToggleDisplay('showRubricHints')} />
          </div>

          <button
            type="button"
            onClick={() => setRubricOpen((v) => !v)}
            className={`ml-auto px-3 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
              rubricOpen
                ? 'bg-slate-900 text-white border-slate-900'
                : 'text-slate-600 border-slate-300 hover:bg-slate-100'
            }`}
          >
            rubric
          </button>
        </div>

        {rubricOpen && <RubricPanel />}

        {/* Pinned compare strip */}
        {pinned.length > 0 && (
          <div className="mb-4 border border-amber-300 bg-amber-50/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-800">
                Compare ({pinned.length}/3)
              </span>
              <span className="text-[11px] text-amber-700">
                pins persist across runs — pin themes from two runs to rate cross-run similarity
              </span>
              <button
                type="button"
                onClick={onClearPins}
                className="ml-auto text-[11px] text-amber-800 hover:text-amber-950 px-1.5 py-0.5 rounded hover:bg-amber-100"
              >
                clear pins
              </button>
            </div>
            <div
              className={`grid gap-3 ${
                pinned.length === 1 ? 'grid-cols-1' : pinned.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-3'
              }`}
            >
              {pinned.map(({ run, theme }) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  run={run}
                  state={state}
                  pinned
                  showRunChips
                  onSetScore={onSetScore}
                  onSetRatingNotes={onSetRatingNotes}
                  onTogglePin={onTogglePin}
                  onQuoteClick={openQuoteDoc}
                />
              ))}
            </div>
            {/* Pairwise similarity */}
            {pinned.length >= 2 && (
              <div className="mt-3 space-y-2">
                {pairs(pinned).map(([a, b]) => {
                  const sim = state.similarities.find(
                    (s) =>
                      (s.themeA === a.theme.id && s.themeB === b.theme.id) ||
                      (s.themeA === b.theme.id && s.themeB === a.theme.id),
                  );
                  return (
                    <div
                      key={`${a.theme.id}|${b.theme.id}`}
                      className="flex items-center gap-3 flex-wrap bg-white border border-amber-200 rounded-md px-3 py-2"
                    >
                      <span className="text-[11px] font-semibold text-slate-700 break-words min-w-0">
                        {a.theme.name} <span className="text-slate-400 font-normal">×</span>{' '}
                        {b.theme.name}
                      </span>
                      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                        <span
                          className="text-[10px] uppercase tracking-wider font-semibold text-slate-500"
                          title={SIMILARITY_RUBRIC.question}
                        >
                          similarity
                        </span>
                        <ScoreButtons
                          compact
                          value={sim?.similarity ?? null}
                          levels={SIMILARITY_RUBRIC.levels}
                          onChange={(v) => onSetSimilarity(a.theme.id, b.theme.id, v)}
                        />
                        <input
                          value={sim?.notes ?? ''}
                          onChange={(e) =>
                            onSetSimilarityNotes(a.theme.id, b.theme.id, e.target.value)
                          }
                          placeholder="notes"
                          className="px-1.5 py-0.5 text-[11px] border border-slate-200 rounded w-[160px] outline-none focus:border-blue-400"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Theme grid */}
        {!activeRun ? (
          <div className="text-[13px] text-slate-400 italic border border-dashed border-slate-300 rounded-lg p-10 text-center bg-white">
            No run selected. Create one in the Runs tab.
          </div>
        ) : activeRun.themes.length === 0 ? (
          <div className="text-[13px] text-slate-400 italic border border-dashed border-slate-300 rounded-lg p-10 text-center bg-white">
            This run has no themes.
          </div>
        ) : (
          <>
            <div className="mb-2 text-[11px] text-slate-500 font-mono">
              {activeRun.themes.filter(isFullyRated).length}/{activeRun.themes.length} themes fully
              rated
            </div>
            <div className={`grid gap-3 ${gridCls}`}>
              {activeRun.themes.map((t) => (
                <ThemeCard
                  key={t.id}
                  theme={t}
                  run={activeRun}
                  state={state}
                  pinned={pinnedIds.includes(t.id)}
                  focus={focusThemeId === t.id}
                  onFocusHandled={onFocusHandled}
                  onSetScore={onSetScore}
                  onSetRatingNotes={onSetRatingNotes}
                  onTogglePin={onTogglePin}
                  onQuoteClick={openQuoteDoc}
                />
              ))}
            </div>
            {activeRun.additionalText && (
              <div className="mt-4 bg-white border border-slate-200 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
                  Additional text from import
                </div>
                <div className="text-[12px] text-slate-600 whitespace-pre-wrap leading-snug">
                  {activeRun.additionalText}
                </div>
              </div>
            )}
          </>
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

function pairs<T>(arr: T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < arr.length; i++)
    for (let j = i + 1; j < arr.length; j++) out.push([arr[i], arr[j]]);
  return out;
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
  state,
  pinned,
  showRunChips = false,
  focus = false,
  onFocusHandled,
  onSetScore,
  onSetRatingNotes,
  onTogglePin,
  onQuoteClick,
}: {
  theme: RatedTheme;
  run: Run;
  state: AppState;
  pinned: boolean;
  showRunChips?: boolean;
  focus?: boolean;
  onFocusHandled?: () => void;
  onSetScore: Props['onSetScore'];
  onSetRatingNotes: Props['onSetRatingNotes'];
  onTogglePin: (themeId: string) => void;
  onQuoteClick: (run: Run, q: ThemeQuote, docIdxOverride?: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onFocusHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

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
        <button
          type="button"
          onClick={() => onTogglePin(theme.id)}
          title={pinned ? 'unpin from compare' : 'pin to compare (up to 3)'}
          className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
            pinned
              ? 'bg-amber-100 text-amber-800 border-amber-300'
              : 'text-slate-400 border-slate-200 hover:border-amber-300 hover:text-amber-700'
          }`}
        >
          {pinned ? 'pinned' : 'pin'}
        </button>
      </div>
      {showRunChips && (
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          {run.model && <Chip label={run.model} tone="blue" />}
          {run.positionality && <Chip label={run.positionality} />}
          {run.condition && <Chip label={run.condition} />}
        </div>
      )}

      {state.showDefinition !== false && theme.definition && (
        <Section label="Definition" text={theme.definition} />
      )}
      {state.showReasoning !== false && theme.reasoning && (
        <Section label="Reasoning" text={theme.reasoning} />
      )}

      {state.showQuotes !== false && theme.quotes.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
            Quotes ({theme.quotes.filter((q) => q.anchor).length}/{theme.quotes.length} anchored)
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
                  title={q.anchor ? 'open source document' : 'not found verbatim in the data'}
                >
                  “{q.text}”
                </button>
                {state.showQuoteSources !== false && (
                  <span className="ml-1 whitespace-nowrap">
                    {q.source && (
                      <span
                        className={`font-mono text-[10px] ${q.anchor ? 'text-emerald-600' : 'text-slate-400'}`}
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
                            if (m) onQuoteClick(run, q, parseInt(m[1], 10) - 1);
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

      {/* Rating strips */}
      <div className="mt-3 pt-2 border-t border-slate-100 space-y-1.5">
        {AXES.map((a) => {
          const v = theme.rating[a.key];
          return (
            <div key={a.key} className="flex items-center gap-2">
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
                levels={state.showRubricHints ? a.levels : undefined}
                onChange={(nv) => onSetScore(run.id, theme.id, a.key, nv)}
              />
              {state.showRubricHints && typeof v === 'number' && (
                <span className="text-[10px] text-slate-400 leading-tight line-clamp-2 min-w-0">
                  {a.levels[5 - v]}
                </span>
              )}
            </div>
          );
        })}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">{rated}/6</span>
          <input
            value={theme.rating.notes ?? ''}
            onChange={(e) => onSetRatingNotes(run.id, theme.id, e.target.value)}
            placeholder="rating notes"
            className="flex-1 px-1.5 py-0.5 text-[11px] border border-slate-200 rounded outline-none focus:border-blue-400 min-w-0"
          />
        </div>
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
          <span className="font-mono text-[12px] font-bold text-slate-700">D{docIdx + 1}</span>
          {doc.extId && <span className="text-[11px] text-slate-400">id: {doc.extId}</span>}
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

import type { AxisScore, Corpus, RatedTheme, Run } from './types';
import { AXIS_KEYS } from './types';

// 1–5 + N/A score strip. Clicking the current value clears it (back to
// unrated). `levels` (ordered 5→1) feeds button tooltips when provided.
export function ScoreButtons({
  value,
  onChange,
  compact = false,
  levels,
}: {
  value: AxisScore | null | undefined;
  onChange: (v: AxisScore | undefined) => void;
  compact?: boolean;
  levels?: readonly string[];
}) {
  const size = compact ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-[11px]';
  return (
    <div className="flex items-center gap-0.5">
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <button
          key={n}
          type="button"
          title={levels ? levels[5 - n] : undefined}
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
      <button
        type="button"
        title="Not applicable to this theme/run"
        onClick={() => onChange(value === 'na' ? undefined : 'na')}
        className={`${compact ? 'h-5 px-1 text-[9px]' : 'h-6 px-1.5 text-[10px]'} rounded border font-semibold transition-colors ml-1 ${
          value === 'na'
            ? 'bg-slate-600 border-slate-600 text-white'
            : 'border-slate-300 text-slate-400 hover:bg-slate-100'
        }`}
      >
        N/A
      </button>
    </div>
  );
}

export function scoreDisplay(v: AxisScore | undefined): string {
  if (v === undefined) return '—';
  return v === 'na' ? 'NA' : String(v);
}

// Mean of the numeric scores only (N/A excluded). Null when nothing numeric.
export function meanScore(values: (AxisScore | undefined)[]): number | null {
  const nums = values.filter((v): v is 1 | 2 | 3 | 4 | 5 => typeof v === 'number');
  if (nums.length === 0) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

// A theme counts as fully rated when every axis has a value (1–5 or N/A).
export function isFullyRated(t: RatedTheme): boolean {
  return AXIS_KEYS.every((k) => t.rating[k] !== undefined);
}

export function ratedAxisCount(t: RatedTheme): number {
  return AXIS_KEYS.filter((k) => t.rating[k] !== undefined).length;
}

// Compact one-line descriptor for a run, used in selectors and chips.
export function runLabel(run: Run, corpora: Corpus[]): string {
  const parts = [run.model, run.positionality, run.condition].filter(Boolean);
  const rq = run.researchQuestion
    ? run.researchQuestion.length > 48
      ? run.researchQuestion.slice(0, 48) + '…'
      : run.researchQuestion
    : '';
  if (rq) parts.push(rq);
  if (run.repeat) parts.push(`rep ${run.repeat}`);
  const corpus = run.corpusId ? corpora.find((c) => c.id === run.corpusId)?.name : undefined;
  if (corpus) parts.push(corpus);
  return parts.join(' · ') || 'untitled run';
}

export function Chip({ label, tone = 'slate' }: { label: string; tone?: 'slate' | 'blue' | 'amber' }) {
  const cls =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

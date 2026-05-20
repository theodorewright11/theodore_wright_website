import { RATING_ANCHORS } from './types';

// A labelled 1–5 rating scale. `value` 0 means unrated (no segments filled).
// Tapping the current value clears it back to 0. When the label has entries
// in RATING_ANCHORS, the 1 and 5 ends are annotated with what they mean.
// Shared by the clock-out rating panel and the Log edit form.
export default function RatingRow({ label, value, onChange }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const anchor = RATING_ANCHORS[label];
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted
                       w-24 shrink-0">{label}</span>
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(value === n ? 0 : n)}
              aria-label={`${label} ${n}`}
              className={'w-8 h-8 rounded-sm font-mono text-[12px] border transition-colors ' +
                (value === n
                  ? 'border-accent bg-accent text-paper'
                  : 'border-rule text-muted hover:border-accent hover:text-accent')}>
              {n}
            </button>
          ))}
        </div>
        {anchor && (
          <div className="flex justify-between font-mono text-[9px] text-muted px-0.5">
            <span>1 · {anchor.low}</span>
            <span>{anchor.high} · 5</span>
          </div>
        )}
      </div>
    </div>
  );
}

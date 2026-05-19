import { ACTIVITY_TYPES, ACTIVITY_DEFINITIONS } from './types';

// Picks what kind of work a session was: the top one or two activity types.
// Each gets its own slider for what share of the whole session it was — the
// two are independent (a session can be 40% coding, 25% reading, the rest
// untracked), so they need not sum to 100. A slider shows as soon as its
// activity is picked.
export default function ActivityPicker({
  activity1, activity2, activity1Pct, activity2Pct, onChange,
}: {
  activity1: string;
  activity2: string;
  activity1Pct: number;
  activity2Pct: number;
  onChange: (a1: string, a2: string, pct1: number, pct2: number) => void;
}) {
  const clamp = (p: number) => Math.max(0, Math.min(100, p));

  const setPrimary = (v: string) => {
    if (!v) { onChange('', '', 100, 50); return; }            // clearing primary clears all
    onChange(v, v === activity2 ? '' : activity2, activity1Pct, activity2Pct);
  };
  const setSecondary = (v: string) => onChange(activity1, v, activity1Pct, activity2Pct);

  const sel = 'font-serif text-[14px] bg-paper border border-rule rounded-sm px-2.5 py-2 ' +
    'text-ink focus:border-accent outline-none disabled:opacity-40';

  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted m-0">
        Activity — top 1–2 kinds of work, and how much of the session each was
      </p>
      <div className="flex gap-2 flex-wrap">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Main</span>
          <select value={activity1} onChange={e => setPrimary(e.target.value)} className={sel}>
            <option value="">—</option>
            {ACTIVITY_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Second <span className="normal-case tracking-normal">(optional)</span>
          </span>
          <select value={activity2} disabled={!activity1}
                  onChange={e => setSecondary(e.target.value)} className={sel}>
            <option value="">—</option>
            {ACTIVITY_TYPES.filter(a => a !== activity1).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>

      {activity1 && (
        <ActivitySlider name={activity1} pct={activity1Pct}
                        onChange={p => onChange(activity1, activity2, clamp(p), activity2Pct)} />
      )}
      {activity1 && activity2 && (
        <ActivitySlider name={activity2} pct={activity2Pct}
                        onChange={p => onChange(activity1, activity2, activity1Pct, clamp(p))} />
      )}

      <details className="mt-1">
        <summary className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted
                            cursor-pointer hover:text-accent transition-colors">
          What the activities mean
        </summary>
        <dl className="mt-2 space-y-1">
          {ACTIVITY_TYPES.map(a => (
            <div key={a} className="flex gap-2">
              <dt className="font-mono text-[11px] text-ink-soft w-20 shrink-0">{a}</dt>
              <dd className="font-serif text-[12px] text-muted m-0">{ACTIVITY_DEFINITIONS[a]}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

function ActivitySlider({ name, pct, onChange }: {
  name: string;
  pct: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] text-ink-soft w-20 shrink-0 truncate" title={name}>
        {name}
      </span>
      <input type="range" min={0} max={100} step={5} value={pct}
             onChange={e => onChange(Number(e.target.value))}
             className="flex-1 accent-accent" />
      <span className="font-mono text-[11px] text-muted tabular-nums w-9 text-right">{pct}%</span>
    </div>
  );
}

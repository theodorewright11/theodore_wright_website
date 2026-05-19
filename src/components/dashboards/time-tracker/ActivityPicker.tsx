import { ACTIVITY_TYPES } from './types';

// Picks what kind of work a session was: a primary activity, an optional
// secondary, and a split between them. The two share sliders are coupled —
// they always sum to 100. With only a primary set, it's implicitly 100%.
export default function ActivityPicker({
  activity1, activity2, activity1Pct, onChange,
}: {
  activity1: string;
  activity2: string;
  activity1Pct: number;
  onChange: (a1: string, a2: string, pct: number) => void;
}) {
  const setPrimary = (v: string) => {
    if (!v) { onChange('', '', 100); return; }            // clearing primary clears all
    onChange(v, v === activity2 ? '' : activity2, activity1Pct || 100);
  };
  const setSecondary = (v: string) => {
    if (!v) { onChange(activity1, '', 100); return; }     // clearing secondary → primary 100%
    onChange(activity1, v, activity1Pct >= 100 ? 70 : activity1Pct);
  };
  const setPct = (p: number) => onChange(activity1, activity2, Math.max(0, Math.min(100, p)));

  const sel = 'font-serif text-[14px] bg-paper border border-rule rounded-sm px-2.5 py-2 ' +
    'text-ink focus:border-accent outline-none disabled:opacity-40';

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Activity</span>
          <select value={activity1} onChange={e => setPrimary(e.target.value)} className={sel}>
            <option value="">—</option>
            {ACTIVITY_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            + Second <span className="normal-case tracking-normal">(optional)</span>
          </span>
          <select value={activity2} disabled={!activity1}
                  onChange={e => setSecondary(e.target.value)} className={sel}>
            <option value="">—</option>
            {ACTIVITY_TYPES.filter(a => a !== activity1).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>
      {activity1 && activity2 && (
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted m-0">
            Split — how much of the session
          </p>
          <SplitSlider label={activity1} pct={activity1Pct} onChange={setPct} />
          <SplitSlider label={activity2} pct={100 - activity1Pct} onChange={v => setPct(100 - v)} />
        </div>
      )}
    </div>
  );
}

function SplitSlider({ label, pct, onChange }: {
  label: string;
  pct: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] text-ink-soft w-20 shrink-0 truncate" title={label}>
        {label}
      </span>
      <input type="range" min={0} max={100} step={5} value={pct}
             onChange={e => onChange(Number(e.target.value))}
             className="flex-1 accent-accent" />
      <span className="font-mono text-[11px] text-muted tabular-nums w-9 text-right">{pct}%</span>
    </div>
  );
}

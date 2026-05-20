// HH:MM picker as two native `<select>`s — click to open a scrollable list
// with every hour (00–23) and every minute (00–59). Native scrolling on every
// platform, no custom wheel logic, no typing, no stepping.

const pad2 = (n: number) => String(n).padStart(2, '0');

type Parsed = { h: number; m: number; set: boolean };
function parse(v: string): Parsed {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return { h: 0, m: 0, set: false };
  return { h: parseInt(m[1], 10), m: parseInt(m[2], 10), set: true };
}
const fmt = (h: number, m: number) => `${pad2(h)}:${pad2(m)}`;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export default function TimeStepper({ value, onChange }: {
  value: string;
  onChange: (v: string) => void;
}) {
  const p = parse(value);

  // Picking the `—` placeholder on either dropdown clears the whole time
  // back to unset (matters for the clock-out "still active" state).
  const onH = (raw: string) => {
    if (raw === '') { onChange(''); return; }
    onChange(fmt(parseInt(raw, 10), p.set ? p.m : 0));
  };
  const onM = (raw: string) => {
    if (raw === '') { onChange(''); return; }
    onChange(fmt(p.set ? p.h : 0, parseInt(raw, 10)));
  };

  const sel = 'font-mono text-[14px] tabular-nums bg-paper border border-rule rounded-sm ' +
              'px-2 py-2 text-ink focus:border-accent outline-none';

  return (
    <div className="inline-flex items-center gap-1">
      <select value={p.set ? String(p.h) : ''} onChange={e => onH(e.target.value)}
              className={sel} aria-label="Hour">
        <option value="">—</option>
        {HOURS.map(i => <option key={i} value={i}>{pad2(i)}</option>)}
      </select>
      <span className="font-mono text-[13px] text-muted">:</span>
      <select value={p.set ? String(p.m) : ''} onChange={e => onM(e.target.value)}
              className={sel} aria-label="Minute">
        <option value="">—</option>
        {MINUTES.map(i => <option key={i} value={i}>{pad2(i)}</option>)}
      </select>
    </div>
  );
}

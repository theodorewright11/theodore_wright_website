import { useEffect, useRef } from 'react';
import { isoToLocalInput } from './compute';

// Button-based HH:MM picker. Click ± to step the hour by 1 or the minute by
// 1; hold a button to repeat ~10 steps/second after a 400ms delay. Minute
// overflow rolls into the hour (9:59 + 1 = 10:00). Wraps 24h.

const pad2 = (n: number) => String(n).padStart(2, '0');

function parse(v: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return [-1, -1];   // -1 sentinel = "no value yet"
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

function fmt(totalMin: number): string {
  const w = ((totalMin % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(w / 60))}:${pad2(w % 60)}`;
}

function nowHHMM(): string {
  return isoToLocalInput(new Date().toISOString()).split('T')[1] || '00:00';
}

export default function TimeStepper({ value, onChange }: {
  value: string;
  onChange: (v: string) => void;
}) {
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  // Each press steps the *currently committed* value (read from the ref, not
  // the captured prop) so hold-to-repeat doesn't accumulate against a stale
  // closure. The ref also picks up the result immediately, before React
  // re-renders, so the next interval tick sees the new value.
  const step = (deltaMin: number) => {
    let base = valueRef.current;
    let [h, m] = parse(base);
    if (h < 0) { base = nowHHMM(); [h, m] = parse(base); }
    const next = fmt(h * 60 + m + deltaMin);
    valueRef.current = next;
    onChange(next);
  };

  const timeout = useRef<number | null>(null);
  const interval = useRef<number | null>(null);
  const stopHold = () => {
    if (timeout.current !== null) { clearTimeout(timeout.current); timeout.current = null; }
    if (interval.current !== null) { clearInterval(interval.current); interval.current = null; }
  };
  useEffect(() => stopHold, []);
  const startHold = (action: () => void) => {
    stopHold();
    action();
    timeout.current = window.setTimeout(() => {
      interval.current = window.setInterval(action, 80);
    }, 400);
  };

  // Bind both mouse and touch — pointer events would be cleaner but mouse +
  // touch covers every browser this dashboard sees and avoids the pointer
  // capture quirks on some Android Chromes.
  const holdProps = (action: () => void) => ({
    onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); startHold(action); },
    onMouseUp: stopHold,
    onMouseLeave: stopHold,
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); startHold(action); },
    onTouchEnd: stopHold,
    onTouchCancel: stopHold,
  });

  const [dispH, dispM] = (() => { const [h, m] = parse(value); return h < 0 ? [0, 0] : [h, m]; })();
  const unset = parse(value)[0] < 0;

  const btn = 'font-mono text-[13px] text-ink-soft hover:text-accent hover:bg-paper-edge ' +
    'transition-colors w-7 h-9 select-none';
  const num = 'font-mono text-[15px] tabular-nums text-center w-9 h-9 leading-[2.25rem] ' +
    'border-x border-rule select-none ' + (unset ? 'text-muted' : 'text-ink');

  return (
    <div className="inline-flex items-stretch border border-rule rounded-sm bg-paper overflow-hidden">
      <button type="button" aria-label="Hour −" className={btn} {...holdProps(() => step(-60))}>−</button>
      <span className={num} aria-label="Hour">{pad2(dispH)}</span>
      <button type="button" aria-label="Hour +" className={btn} {...holdProps(() => step(60))}>+</button>
      <span className="self-center px-1 font-mono text-[13px] text-muted select-none">:</span>
      <button type="button" aria-label="Minute −" className={btn} {...holdProps(() => step(-1))}>−</button>
      <span className={num} aria-label="Minute">{pad2(dispM)}</span>
      <button type="button" aria-label="Minute +" className={btn} {...holdProps(() => step(1))}>+</button>
    </div>
  );
}

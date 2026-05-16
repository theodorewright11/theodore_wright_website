import { useState } from 'react';
import type { Session } from './types';
import {
  activeSession, isOnBreak, sessionNetMs, sessionGrossMs, sessionBreakMs, breakMs,
  fmtClock, fmtHM, fmtTimeOfDay,
} from './compute';

type Props = {
  sessions: Session[];
  categories: string[];
  now: number;
  onClockIn: (category: string) => void;
  onClockOut: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onAddCategory: (name: string) => void;
  onRemoveCategory: (name: string) => void;
};

const btnAccent = 'font-mono text-[12px] uppercase tracking-[0.1em] border border-accent text-accent ' +
  'hover:bg-accent hover:text-paper rounded-sm px-4 py-2.5 transition-colors disabled:opacity-40 ' +
  'disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-accent';
const btnMuted = 'font-mono text-[12px] uppercase tracking-[0.1em] border border-rule text-ink-soft ' +
  'hover:border-accent hover:text-accent rounded-sm px-4 py-2.5 transition-colors';

export default function ClockTab({
  sessions, categories, now,
  onClockIn, onClockOut, onStartBreak, onEndBreak, onAddCategory, onRemoveCategory,
}: Props) {
  const active = activeSession(sessions);
  const [pick, setPick] = useState('');
  const [newCat, setNewCat] = useState('');

  const selected = pick || categories[0] || '';

  // --- Clocked in -----------------------------------------------------------
  if (active) {
    const onBreak = isOnBreak(active);
    const curBreak = onBreak ? active.breaks[active.breaks.length - 1] : null;

    return (
      <div className="space-y-6">
        <div className={'rounded-lg border p-6 ' +
          (onBreak ? 'border-rule bg-paper' : 'border-accent/40 bg-paper')}>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
              {active.category}
            </span>
            <span className="font-mono text-[11px] text-muted">
              in at {fmtTimeOfDay(active.clock_in)}
            </span>
          </div>

          {onBreak ? (
            <>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted m-0 mt-3 mb-1">
                On break
              </p>
              <p className="font-display text-[44px] leading-none text-ink-soft m-0 tabular-nums">
                {fmtClock(breakMs(curBreak!, now))}
              </p>
              <p className="font-serif text-[13px] text-muted m-0 mt-2">
                Worked time is paused. Net so far: {fmtHM(sessionNetMs(active, now))}.
              </p>
            </>
          ) : (
            <>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted m-0 mt-3 mb-1">
                Worked time
              </p>
              <p className="font-display text-[44px] leading-none text-ink m-0 tabular-nums">
                {fmtClock(sessionNetMs(active, now))}
              </p>
              <p className="font-serif text-[13px] text-muted m-0 mt-2">
                {fmtHM(sessionGrossMs(active, now))} elapsed
                {sessionBreakMs(active, now) > 0
                  ? ` · ${fmtHM(sessionBreakMs(active, now))} on breaks`
                  : ''}
              </p>
            </>
          )}

          <div className="flex gap-2.5 flex-wrap mt-5">
            {onBreak ? (
              <button className={btnAccent} onClick={onEndBreak}>End break</button>
            ) : (
              <button className={btnMuted} onClick={onStartBreak}>Take a break</button>
            )}
            <button className={btnAccent} onClick={onClockOut}>Clock out</button>
          </div>
        </div>

        <p className="font-serif text-[13px] text-muted m-0">
          A break is a pseudo clock-out — for a meal or an errand. It pauses worked time
          without ending the session.
        </p>
      </div>
    );
  }

  // --- Clocked out ----------------------------------------------------------
  return (
    <div className="space-y-7">
      <div className="rounded-lg border border-rule bg-paper p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted m-0 mb-3">
          Not clocked in
        </p>
        {categories.length === 0 ? (
          <p className="font-serif text-[14px] text-ink-soft m-0">
            Add a category below to start tracking.
          </p>
        ) : (
          <div className="flex gap-2.5 flex-wrap items-center">
            <select
              value={selected}
              onChange={e => setPick(e.target.value)}
              className="font-serif text-[14px] bg-paper border border-rule rounded-sm px-3 py-2.5
                         text-ink focus:border-accent outline-none">
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              className={btnAccent}
              disabled={!selected}
              onClick={() => selected && onClockIn(selected)}>
              Clock in
            </button>
          </div>
        )}
      </div>

      {/* Category management */}
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted m-0 mb-2.5">
          Categories
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {categories.map(c => (
            <span key={c}
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-soft
                             border border-rule rounded-sm pl-2.5 pr-1.5 py-1">
              {c}
              <button
                onClick={() => onRemoveCategory(c)}
                title={`Remove ${c}`}
                className="text-muted hover:text-accent transition-colors leading-none text-[14px]">
                ×
              </button>
            </span>
          ))}
          {categories.length === 0 && (
            <span className="font-serif text-[13px] text-muted italic">None yet.</span>
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={e => {
            e.preventDefault();
            const v = newCat.trim();
            if (v) { onAddCategory(v); setNewCat(''); }
          }}>
          <input
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            placeholder="New category"
            className="font-serif text-[14px] bg-paper border border-rule rounded-sm px-3 py-2
                       text-ink focus:border-accent outline-none w-[200px]" />
          <button type="submit" className={btnMuted}>Add</button>
        </form>
      </div>
    </div>
  );
}

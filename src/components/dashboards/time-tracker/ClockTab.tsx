import { useState } from 'react';
import type { Session, Lap, Break } from './types';
import {
  activeSession, isOnBreak, sessionNetMs, sessionGrossMs, sessionBreakMs, breakMs,
  fmtClock, fmtHM, fmtTimeOfDay, isoToLocalInput, withLocalTime, normalizeHHMM,
} from './compute';
import RatingRow from './RatingRow';
import ActivityPicker from './ActivityPicker';

export const NOTES_PLACEHOLDER =
  "What you did — e.g. “drafted intro, read 2 papers”. Note anything that " +
  "shaped the session: sleep, caffeine, interruptions, location, mood going in.";

type Props = {
  sessions: Session[];
  categories: string[];
  now: number;
  onClockIn: (category: string) => void;
  onClockOut: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onAddLap: () => void;
  onUpdateLap: (sessionId: string, lapId: string, patch: Partial<Lap>) => void;
  onDeleteLap: (sessionId: string, lapId: string) => void;
  onUpdateBreak: (sessionId: string, breakId: string, patch: Partial<Break>) => void;
  onDeleteBreak: (sessionId: string, breakId: string) => void;
  onUpdateSession: (s: Session) => void;
  onDeleteSession: (id: string) => void;
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
  onClockIn, onClockOut, onStartBreak, onEndBreak,
  onAddLap, onUpdateLap, onDeleteLap, onUpdateBreak, onDeleteBreak,
  onUpdateSession, onDeleteSession,
  onAddCategory, onRemoveCategory,
}: Props) {
  const active = activeSession(sessions);
  const [pick, setPick] = useState('');
  const [newCat, setNewCat] = useState('');
  // After clock-out, prompt to rate the session that just ended.
  const [ratingId, setRatingId] = useState<string | null>(null);

  const selected = pick || categories[0] || '';
  const ratingSession = ratingId
    ? sessions.find(s => s.id === ratingId && s.clock_out !== null) ?? null
    : null;

  // --- Clocked in -----------------------------------------------------------
  if (active) {
    const onBreak = isOnBreak(active);
    const curBreak = onBreak ? active.breaks[active.breaks.length - 1] : null;
    // Open lap = the one currently running (start set, end still null). The
    // Lap button toggles: starts a new open lap, or stops the open one.
    const openLapIdx = active.laps.findIndex(l => l.end === null);
    const openLap = openLapIdx >= 0 ? active.laps[openLapIdx] : null;
    const openLapMs = openLap ? Math.max(0, now - Date.parse(openLap.start)) : 0;

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
                Worked time is paused. Clocked-in so far: {fmtHM(sessionGrossMs(active, now))}
                {' '}({fmtHM(sessionNetMs(active, now))} net).
              </p>
            </>
          ) : (
            <>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted m-0 mt-3 mb-1">
                Time worked
              </p>
              <p className="font-display text-[44px] leading-none text-ink m-0 tabular-nums">
                {fmtClock(sessionGrossMs(active, now))}
              </p>
              <p className="font-serif text-[13px] text-muted m-0 mt-2">
                {fmtHM(sessionNetMs(active, now))} net
                {sessionBreakMs(active, now) > 0
                  ? ` · ${fmtHM(sessionBreakMs(active, now))} on breaks`
                  : ''}
              </p>
              {openLap && (
                <p className="font-mono text-[11px] text-muted m-0 mt-2 tabular-nums">
                  lap #{openLapIdx + 1} running ·{' '}
                  <span className="text-ink-soft">{fmtClock(openLapMs)}</span>
                </p>
              )}
            </>
          )}

          <div className="flex gap-2.5 flex-wrap mt-5">
            {onBreak ? (
              <button className={btnAccent} onClick={onEndBreak}>End break</button>
            ) : (
              <>
                <button className={btnMuted} onClick={onStartBreak}>Take a break</button>
                <button className={btnMuted} onClick={onAddLap}>
                  {openLap ? 'Stop lap' : 'Start lap'}
                </button>
              </>
            )}
            <button className={btnAccent}
                    onClick={() => { setRatingId(active.id); onClockOut(); }}>
              Clock out
            </button>
          </div>

          <button
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted
                       hover:text-accent transition-colors mt-4"
            onClick={() => {
              if (window.confirm("Discard this session? It won't be saved.")) {
                onDeleteSession(active.id);
              }
            }}>
            discard this session
          </button>
        </div>

        <p className="font-serif text-[13px] text-muted m-0">
          Take a break is a pseudo clock-out — for a meal or an errand. It pauses worked
          time without ending the session. Start/Stop lap toggles a stopwatch lap on the
          current session — it doesn't change the time accounting, just records a labelled
          segment. Discard removes the session entirely (use it if you clocked in by mistake).
        </p>

        {active.laps.length > 0 && (
          <SegmentList
            title={`Laps (${active.laps.length})`}
            items={active.laps.map(l => ({
              id: l.id, start: l.start, end: l.end as string | null, notes: l.notes ?? '',
            }))}
            now={now}
            onChangeNotes={(id, notes) => onUpdateLap(active.id, id, { notes: notes || undefined })}
            onChangeStart={(id, iso) => onUpdateLap(active.id, id, { start: iso })}
            onChangeEnd={(id, iso) => onUpdateLap(active.id, id, { end: iso })}
            onDelete={id => onDeleteLap(active.id, id)}
          />
        )}

        {active.breaks.length > 0 && (
          <SegmentList
            title={`Breaks (${active.breaks.length})`}
            items={active.breaks.map(b => ({
              id: b.id, start: b.start, end: b.end, notes: b.notes ?? '',
            }))}
            now={now}
            onChangeNotes={(id, notes) => onUpdateBreak(active.id, id, { notes: notes || undefined })}
            onChangeStart={(id, iso) => onUpdateBreak(active.id, id, { start: iso })}
            onChangeEnd={(id, iso) => onUpdateBreak(active.id, id, { end: iso })}
            onDelete={id => {
              if (window.confirm('Delete this break? Its time will become worked time again.')) {
                onDeleteBreak(active.id, id);
              }
            }}
          />
        )}
      </div>
    );
  }

  // --- Clocked out ----------------------------------------------------------
  return (
    <div className="space-y-7">
      {ratingSession && (
        <ClockOutRating
          key={ratingSession.id}
          session={ratingSession}
          allSessions={sessions}
          onSave={s => { onUpdateSession(s); setRatingId(null); }}
          onApplyToOther={onUpdateSession}
          onSkip={() => setRatingId(null)}
          onDiscard={() => {
            if (window.confirm("Discard this session? It won't be saved.")) {
              onDeleteSession(ratingSession.id);
              setRatingId(null);
            }
          }}
        />
      )}

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

// Shown right after clock-out: rate the session that just ended. Skippable —
// a missed rating just leaves the three values at 0 (unrated).
function ClockOutRating({ session, allSessions, onSave, onApplyToOther, onSkip, onDiscard }: {
  session: Session;
  allSessions: Session[];
  onSave: (s: Session) => void;
  onApplyToOther: (s: Session) => void;
  onSkip: () => void;
  onDiscard: () => void;
}) {
  const [mood, setMood] = useState(session.mood);
  const [productivity, setProductivity] = useState(session.productivity);
  const [enjoyment, setEnjoyment] = useState(session.enjoyment);
  const [notes, setNotes] = useState(session.notes ?? '');
  const [activity1, setActivity1] = useState(session.activity1);
  const [activity2, setActivity2] = useState(session.activity2);
  const [activity1Pct, setActivity1Pct] = useState(session.activity1Pct);
  const [activity2Pct, setActivity2Pct] = useState(session.activity2Pct);

  // Other closed sessions in the same category from today or yesterday —
  // candidates to copy these ratings to (for days with multiple clock-ins
  // that should share one rating).
  const candidates = (() => {
    const now = Date.now();
    const today = new Date(now);
    const todayK = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const y = new Date(now - 86_400_000);
    const yesterdayK = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    return allSessions
      .filter(s => s.id !== session.id
                && s.category === session.category
                && s.clock_out !== null)
      .filter(s => {
        const d = new Date(Date.parse(s.clock_in));
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return k === todayK || k === yesterdayK;
      })
      .sort((a, b) => Date.parse(b.clock_in) - Date.parse(a.clock_in));
  })();
  const [applyTo, setApplyTo] = useState<Set<string>>(new Set());
  const toggleApply = (id: string) =>
    setApplyTo(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const handleSave = () => {
    const ts = new Date().toISOString();
    const ratings = { mood, productivity, enjoyment,
                      activity1, activity2, activity1Pct, activity2Pct };
    onSave({
      ...session, ...ratings,
      notes: notes.trim() || undefined,
      updated_at: ts,
    });
    // Copy ratings (NOT notes) to any selected same-category sessions.
    for (const id of applyTo) {
      const c = candidates.find(x => x.id === id);
      if (!c) continue;
      onApplyToOther({ ...c, ...ratings, updated_at: ts });
    }
  };

  return (
    <div className="rounded-lg border border-accent/40 bg-paper p-6 space-y-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent m-0">
          Rate that session
        </p>
        <p className="font-serif text-[13px] text-muted m-0 mt-0.5">
          {session.category} · {fmtHM(sessionNetMs(session, Date.parse(session.clock_out!)))} worked
        </p>
      </div>
      <div className="space-y-2.5">
        <RatingRow label="Mood" value={mood} onChange={setMood} />
        <RatingRow label="Productivity" value={productivity} onChange={setProductivity} />
        <RatingRow label="Enjoyment" value={enjoyment} onChange={setEnjoyment} />
      </div>
      <ActivityPicker
        activity1={activity1} activity2={activity2}
        activity1Pct={activity1Pct} activity2Pct={activity2Pct}
        onChange={(a1, a2, p1, p2) => {
          setActivity1(a1); setActivity2(a2); setActivity1Pct(p1); setActivity2Pct(p2);
        }}
      />
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Notes</span>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder={NOTES_PLACEHOLDER}
          className="mt-1 block w-full font-serif text-[14px] bg-paper border border-rule
                     rounded-sm px-3 py-2 text-ink focus:border-accent outline-none resize-y" />
      </label>

      {candidates.length > 0 && (
        <ApplyToOtherSessions
          candidates={candidates} applyTo={applyTo} toggleApply={toggleApply} />
      )}

      <div className="flex gap-2 items-center flex-wrap">
        <button className={btnAccent} onClick={handleSave}>Save</button>
        <button className={btnMuted} onClick={onSkip}>Skip</button>
        <button
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted
                     hover:text-accent transition-colors ml-auto"
          onClick={onDiscard}>
          discard this session
        </button>
      </div>
    </div>
  );
}

// Collapsible list of same-category sessions from today / yesterday that the
// rating panel can copy its ratings to (mood/productivity/enjoyment +
// activity1/2 + percentages). Notes are NOT copied — each session keeps its
// own. Skipping or leaving boxes unchecked is the default; nothing applies
// unless the user opts in. Useful for days with several broken-up clock-ins
// you want to rate as one.
export function ApplyToOtherSessions({ candidates, applyTo, toggleApply }: {
  candidates: Session[];
  applyTo: Set<string>;
  toggleApply: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const n = applyTo.size;
  return (
    <details open={open} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}
             className="border-t border-rule-soft pt-3">
      <summary className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted
                          cursor-pointer hover:text-accent transition-colors">
        Apply these ratings to other {candidates.length === 1 ? 'session' : 'sessions'} today / yesterday
        {n > 0 && <span className="text-accent ml-2">({n} selected)</span>}
      </summary>
      <div className="mt-2 space-y-1.5">
        {candidates.map(c => {
          const startMs = Date.parse(c.clock_in);
          const endMs = Date.parse(c.clock_out!);
          const dur = endMs - startMs;
          const day = new Date(startMs).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
          const rated = (c.mood || c.productivity || c.enjoyment) > 0;
          return (
            <label key={c.id}
                   className="flex items-center gap-2.5 font-serif text-[13px] text-ink-soft cursor-pointer">
              <input type="checkbox" checked={applyTo.has(c.id)}
                     onChange={() => toggleApply(c.id)} />
              <span className="font-mono text-[11px] text-muted w-20 shrink-0">{day}</span>
              <span className="font-mono text-[11px] text-muted w-32 shrink-0">
                {fmtTimeOfDay(c.clock_in)} – {fmtTimeOfDay(c.clock_out!)}
              </span>
              <span className="font-mono text-[11px] text-ink-soft tabular-nums w-12 shrink-0">
                {fmtHM(dur)}
              </span>
              <span className={'font-mono text-[10px] ' + (rated ? 'text-accent' : 'text-muted italic')}>
                {rated ? `M${c.mood || '–'} P${c.productivity || '–'} E${c.enjoyment || '–'}` : 'unrated'}
              </span>
            </label>
          );
        })}
      </div>
      <p className="font-serif text-[11px] text-muted m-0 mt-2">
        Copies mood / productivity / enjoyment + activity tags to checked sessions on Save.
        Notes stay per-session.
      </p>
    </details>
  );
}

// Compact list of laps or breaks: duration, time range, inline notes input,
// delete button. Items with `end: null` (an active break) render as "ongoing"
// and hide the delete control. Notes save on every keystroke via the lifted
// onChangeNotes — the sheet sync queue coalesces bursts into one write.
export function SegmentList({
  title, items, now, onChangeNotes, onChangeStart, onChangeEnd, onDelete,
}: {
  title: string;
  items: { id: string; start: string; end: string | null; notes: string }[];
  now: number;
  onChangeNotes: (id: string, notes: string) => void;
  onChangeStart?: (id: string, iso: string) => void;
  onChangeEnd?: (id: string, iso: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-rule bg-paper p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted m-0 mb-2">
        {title}
      </p>
      <div>
        {items.map((it, i) => {
          const startMs = Date.parse(it.start);
          const endMs = it.end ? Date.parse(it.end) : now;
          const durMs = Math.max(0, endMs - startMs);
          const ongoing = it.end === null;
          const startHHMM = isoToLocalInput(it.start).split('T')[1] ?? '';
          const endHHMM = ongoing ? '' : (isoToLocalInput(it.end!).split('T')[1] ?? '');
          return (
            <div key={it.id}
                 className="flex items-center gap-2 py-2 flex-wrap border-b border-rule-soft last:border-b-0">
              <span className="font-mono text-[10px] text-muted w-6 shrink-0">#{i + 1}</span>
              <span className="font-mono text-[11px] text-ink-soft tabular-nums w-14 shrink-0">
                {fmtHM(durMs)}
              </span>
              <TimeCell value={startHHMM}
                        onCommit={onChangeStart
                          ? v => { const nv = normalizeHHMM(v); if (nv) onChangeStart(it.id, withLocalTime(it.start, nv)); }
                          : undefined} />
              <span className="font-mono text-[11px] text-muted">–</span>
              {ongoing
                ? <em className="font-mono text-[11px] text-accent not-italic">ongoing</em>
                : <TimeCell value={endHHMM}
                            onCommit={onChangeEnd
                              ? v => { const nv = normalizeHHMM(v); if (nv) onChangeEnd(it.id, withLocalTime(it.end!, nv)); }
                              : undefined} />}
              <input type="text" placeholder="notes" value={it.notes}
                     onChange={e => onChangeNotes(it.id, e.target.value)}
                     className="flex-1 min-w-[140px] font-serif text-[13px] bg-paper-edge/40
                                border border-transparent hover:border-rule focus:border-accent
                                outline-none rounded-sm px-2 py-1" />
              {!ongoing && (
                <button onClick={() => onDelete(it.id)}
                        className="font-mono text-[16px] leading-none text-muted
                                   hover:text-accent transition-colors px-1.5"
                        title="Delete">×</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Compact HH:MM cell — read-only when onCommit is undefined; otherwise a
// text input that commits on blur (normalize tolerates "1430" / "9:5" etc).
function TimeCell({ value, onCommit }: { value: string; onCommit?: (v: string) => void }) {
  if (!onCommit) {
    return <span className="font-mono text-[11px] text-muted tabular-nums w-12 shrink-0 text-center">{value}</span>;
  }
  return (
    <input type="text" inputMode="numeric" defaultValue={value} maxLength={5} placeholder="HH:MM"
           key={value}
           onBlur={e => onCommit(e.target.value)}
           className="font-mono text-[11px] tabular-nums w-14 text-center bg-paper
                      border border-rule rounded-sm px-1 py-0.5 focus:border-accent outline-none" />
  );
}

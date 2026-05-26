import { useState } from 'react';
import type { Session, Lap, Break } from './types';
import {
  activeSession, isOnBreak, sessionNetMs, sessionGrossMs, sessionBreakMs, breakMs,
  fmtClock, fmtHM, fmtTimeOfDay,
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
              <>
                <button className={btnMuted} onClick={onStartBreak}>Take a break</button>
                <button className={btnMuted} onClick={onAddLap}>Lap</button>
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
          time without ending the session. Lap marks the end of one segment within the
          session for tracking what you did; it doesn't change the time accounting. Discard
          removes the session entirely (use it if you clocked in by mistake).
        </p>

        {active.laps.length > 0 && (
          <SegmentList
            title={`Laps (${active.laps.length})`}
            items={active.laps.map(l => ({
              id: l.id, start: l.start, end: l.end as string | null, notes: l.notes ?? '',
            }))}
            now={now}
            onChangeNotes={(id, notes) => onUpdateLap(active.id, id, { notes: notes || undefined })}
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
          onSave={s => { onUpdateSession(s); setRatingId(null); }}
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
function ClockOutRating({ session, onSave, onSkip, onDiscard }: {
  session: Session;
  onSave: (s: Session) => void;
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
      <div className="flex gap-2 items-center flex-wrap">
        <button
          className={btnAccent}
          onClick={() => onSave({
            ...session, mood, productivity, enjoyment,
            activity1, activity2, activity1Pct, activity2Pct,
            notes: notes.trim() || undefined,
            updated_at: new Date().toISOString(),
          })}>
          Save
        </button>
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

// Compact list of laps or breaks: duration, time range, inline notes input,
// delete button. Items with `end: null` (an active break) render as "ongoing"
// and hide the delete control. Notes save on every keystroke via the lifted
// onChangeNotes — the sheet sync queue coalesces bursts into one write.
export function SegmentList({ title, items, now, onChangeNotes, onDelete }: {
  title: string;
  items: { id: string; start: string; end: string | null; notes: string }[];
  now: number;
  onChangeNotes: (id: string, notes: string) => void;
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
          return (
            <div key={it.id}
                 className="flex items-center gap-3 py-2 flex-wrap border-b border-rule-soft last:border-b-0">
              <span className="font-mono text-[10px] text-muted w-6 shrink-0">#{i + 1}</span>
              <span className="font-mono text-[11px] text-ink-soft tabular-nums w-14 shrink-0">
                {fmtHM(durMs)}
              </span>
              <span className="font-mono text-[10px] text-muted w-32 shrink-0">
                {fmtTimeOfDay(it.start)} – {ongoing
                  ? <em className="not-italic text-accent">ongoing</em>
                  : fmtTimeOfDay(it.end!)}
              </span>
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

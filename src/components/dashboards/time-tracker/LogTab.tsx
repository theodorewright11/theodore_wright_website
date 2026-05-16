import { useMemo, useState } from 'react';
import type { Session } from './types';
import {
  rangeStats, sessionNetMs, sessionBreakMs, dayKey, todayKey,
  fmtHM, fmtTimeOfDay, fmtDateShort, isoToLocalInput, localInputToIso,
} from './compute';
import { sessionsToCsv, downloadFile } from './storage';

type Props = {
  sessions: Session[];
  categories: string[];
  now: number;
  onUpdateSession: (s: Session) => void;
  onDeleteSession: (id: string) => void;
  onAddSession: (s: Session) => void;
};

const btnMuted = 'font-mono text-[11px] uppercase tracking-[0.1em] border border-rule text-ink-soft ' +
  'hover:border-accent hover:text-accent rounded-sm px-3 py-2 transition-colors';
const btnAccent = 'font-mono text-[11px] uppercase tracking-[0.1em] border border-accent text-accent ' +
  'hover:bg-accent hover:text-paper rounded-sm px-3 py-2 transition-colors disabled:opacity-40 ' +
  'disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-accent';
const field = 'font-serif text-[14px] bg-paper border border-rule rounded-sm px-2.5 py-2 ' +
  'text-ink focus:border-accent outline-none';

type EditState =
  | { mode: 'new' }
  | { mode: 'edit'; session: Session }
  | null;

export default function LogTab({
  sessions, categories, now, onUpdateSession, onDeleteSession, onAddSession,
}: Props) {
  const [from, setFrom] = useState(() => dayKey(now - 6 * 86_400_000));
  const [to, setTo] = useState(() => todayKey(now));
  const [edit, setEdit] = useState<EditState>(null);

  const stats = useMemo(() => rangeStats(sessions, from, to, now), [sessions, from, to, now]);

  const rowsInRange = useMemo(() => {
    return sessions
      .filter(s => { const k = dayKey(Date.parse(s.clock_in)); return k >= from && k <= to; })
      .sort((a, b) => Date.parse(b.clock_in) - Date.parse(a.clock_in));
  }, [sessions, from, to]);

  const maxCat = stats.byCategory[0]?.netMs ?? 0;

  return (
    <div className="space-y-7">
      {/* Range picker */}
      <div className="flex items-end gap-3 flex-wrap">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">From</span>
          <input type="date" value={from} max={to}
                 onChange={e => setFrom(e.target.value)}
                 className={'mt-1 block ' + field} />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">To</span>
          <input type="date" value={to} min={from} max={todayKey(now)}
                 onChange={e => setTo(e.target.value)}
                 className={'mt-1 block ' + field} />
        </label>
        <div className="flex gap-2 ml-auto">
          <button className={btnMuted} onClick={() => setEdit({ mode: 'new' })}>+ Add session</button>
          <button className={btnMuted}
                  onClick={() => downloadFile('time-sessions.csv', sessionsToCsv(sessions))}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-rule bg-paper p-5">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Stat label="Total worked" value={fmtHM(stats.totalNetMs)} />
          <Stat label="Avg / day"
                value={stats.avgPerDayMs === null ? '—' : fmtHM(stats.avgPerDayMs)} />
          <Stat label="Sessions" value={String(stats.sessionCount)} />
        </div>
        {stats.byCategory.length > 0 && (
          <div className="space-y-1.5 pt-3 border-t border-rule-soft">
            {stats.byCategory.map(c => (
              <div key={c.category} className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-ink-soft w-28 shrink-0 truncate"
                      title={c.category}>{c.category}</span>
                <span className="h-2 bg-accent/70 rounded-sm"
                      style={{ width: `${maxCat > 0 ? Math.max(2, (c.netMs / maxCat) * 100) : 2}%` }} />
                <span className="font-mono text-[11px] text-muted ml-auto tabular-nums">
                  {fmtHM(c.netMs)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit / add form */}
      {edit && (
        <SessionForm
          key={edit.mode === 'edit' ? edit.session.id : 'new'}
          categories={categories}
          session={edit.mode === 'edit' ? edit.session : null}
          now={now}
          onCancel={() => setEdit(null)}
          onSave={s => {
            if (edit.mode === 'edit') onUpdateSession(s); else onAddSession(s);
            setEdit(null);
          }}
        />
      )}

      {/* Session table */}
      {rowsInRange.length === 0 ? (
        <p className="font-serif text-[14px] text-muted italic m-0">No sessions in this range.</p>
      ) : (
        <div className="border-t border-rule">
          {rowsInRange.map(s => {
            const active = s.clock_out === null;
            const breaksMs = sessionBreakMs(s, now);
            return (
              <div key={s.id}
                   className="flex items-center gap-3 flex-wrap py-3 border-b border-rule-soft">
                <span className="font-mono text-[11px] text-muted w-14 shrink-0">
                  {fmtDateShort(s.clock_in)}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent
                                 w-24 shrink-0 truncate" title={s.category}>
                  {s.category}
                </span>
                <span className="font-serif text-[13px] text-ink-soft w-36 shrink-0">
                  {fmtTimeOfDay(s.clock_in)} – {active
                    ? <em className="text-accent not-italic">active</em>
                    : fmtTimeOfDay(s.clock_out!)}
                </span>
                <span className="font-serif text-[13px] text-muted w-20 shrink-0">
                  {breaksMs > 0 ? `${fmtHM(breaksMs)} brk` : ''}
                </span>
                <span className="font-display text-[15px] text-ink tabular-nums w-16 shrink-0">
                  {fmtHM(sessionNetMs(s, now))}
                </span>
                {s.notes && (
                  <span className="font-serif text-[12px] text-muted italic truncate max-w-[200px]"
                        title={s.notes}>{s.notes}</span>
                )}
                <span className="ml-auto flex gap-2">
                  <button className="font-mono text-[10px] uppercase text-muted hover:text-accent
                                     transition-colors"
                          onClick={() => setEdit({ mode: 'edit', session: s })}>edit</button>
                  <button className="font-mono text-[10px] uppercase text-muted hover:text-accent
                                     transition-colors"
                          onClick={() => {
                            if (window.confirm('Delete this session?')) onDeleteSession(s.id);
                          }}>del</button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted m-0">{label}</p>
      <p className="font-display text-[26px] leading-tight text-ink m-0 tabular-nums">{value}</p>
    </div>
  );
}

// Add / edit form. Editing exposes clock-in/out, category, notes. Breaks are
// shown read-only with an option to clear them (for fixing a stray break);
// new sessions start with no breaks.
function SessionForm({
  categories, session, now, onCancel, onSave,
}: {
  categories: string[];
  session: Session | null;
  now: number;
  onCancel: () => void;
  onSave: (s: Session) => void;
}) {
  const [category, setCategory] = useState(session?.category ?? categories[0] ?? '');
  const [clockIn, setClockIn] = useState(
    isoToLocalInput(session?.clock_in ?? new Date(now).toISOString()));
  const [clockOut, setClockOut] = useState(
    session?.clock_out ? isoToLocalInput(session.clock_out) : '');
  const [notes, setNotes] = useState(session?.notes ?? '');
  const [clearBreaks, setClearBreaks] = useState(false);
  const [err, setErr] = useState('');

  const breaks = clearBreaks ? [] : (session?.breaks ?? []);

  const submit = () => {
    const inIso = localInputToIso(clockIn);
    const outIso = clockOut ? localInputToIso(clockOut) : null;
    if (!category) { setErr('Pick a category.'); return; }
    if (!inIso) { setErr('Clock-in time is required.'); return; }
    if (outIso && Date.parse(outIso) <= Date.parse(inIso)) {
      setErr('Clock-out must be after clock-in.'); return;
    }
    const nowIso = new Date(now).toISOString();
    onSave({
      id: session?.id ?? crypto.randomUUID(),
      category,
      clock_in: inIso,
      clock_out: outIso,
      breaks,
      notes: notes.trim() || undefined,
      created_at: session?.created_at ?? nowIso,
      updated_at: nowIso,
    });
  };

  return (
    <div className="rounded-lg border border-accent/40 bg-paper p-5 space-y-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent m-0">
        {session ? 'Edit session' : 'Add session'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Category</span>
          <select value={category} onChange={e => setCategory(e.target.value)}
                  className={'mt-1 block w-full ' + field}>
            {!categories.includes(category) && category && (
              <option value={category}>{category}</option>
            )}
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Notes</span>
          <input value={notes} onChange={e => setNotes(e.target.value)}
                 className={'mt-1 block w-full ' + field} />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Clock in</span>
          <input type="datetime-local" value={clockIn} onChange={e => setClockIn(e.target.value)}
                 className={'mt-1 block w-full ' + field} />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Clock out <span className="normal-case tracking-normal">(blank = still active)</span>
          </span>
          <input type="datetime-local" value={clockOut} onChange={e => setClockOut(e.target.value)}
                 className={'mt-1 block w-full ' + field} />
        </label>
      </div>
      {session && session.breaks.length > 0 && (
        <label className="flex items-center gap-2 font-serif text-[13px] text-ink-soft">
          <input type="checkbox" checked={clearBreaks}
                 onChange={e => setClearBreaks(e.target.checked)} />
          Clear {session.breaks.length} break{session.breaks.length === 1 ? '' : 's'} on this session
        </label>
      )}
      {err && <p className="font-serif text-[13px] text-accent m-0">{err}</p>}
      <div className="flex gap-2">
        <button className={btnAccent} onClick={submit}>Save</button>
        <button className={btnMuted} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

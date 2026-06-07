import { useMemo, useState } from 'react';
import type { Session } from './types';
import type { DayBucket } from './compute';
import {
  rangeStats, sessionNetMs, sessionGrossMs, sessionBreakMs, dayKey, todayKey,
  fmtHM, fmtTimeOfDay, fmtDateShort, isoToLocalInput, localInputToIso,
  normalizeHHMM,
} from './compute';
import { sessionsToCsv, downloadFile } from './storage';
import RatingRow from './RatingRow';
import ActivityPicker from './ActivityPicker';
import TimeStepper from './TimeStepper';
import { NOTES_PLACEHOLDER, SegmentList, ApplyToOtherSessions } from './ClockTab';
import type { Break, Lap } from './types';

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
const btnTiny = 'font-mono text-[10px] uppercase tracking-[0.1em] border border-rule text-ink-soft ' +
  'hover:border-accent hover:text-accent rounded-sm px-2 py-1.5 transition-colors whitespace-nowrap';

const DAY = 86_400_000;

// Palette for the per-day stacked chart, category legend, and category bars.
// Indexed by the sorted byCategory position; cycles if there are more
// categories than colors. Muted earth tones with varied hues so adjacent
// categories are readable as distinct, while staying coherent with the
// V4 paper aesthetic (no neon).
const CATEGORY_PALETTE = [
  '#8a4a2b', // sienna (brand accent)
  '#2f6e75', // teal
  '#c08a1f', // mustard
  '#6b7d3f', // olive
  '#6e3a52', // plum
  '#4a5878', // slate blue
  '#a8552c', // rust
  '#4a4035', // dark cocoa
];

// Pick a nice axis maximum (in hours) and tick values for a chart whose
// largest bar is `maxMs` milliseconds. Aims for 4–6 ticks at round steps.
function niceTicks(maxMs: number): { ticks: number[]; max: number } {
  const hours = maxMs / 3_600_000;
  if (hours <= 0) return { ticks: [0, 0.5, 1], max: 1 };
  const steps = [0.25, 0.5, 1, 2, 4, 6, 8, 12];
  let step = steps[steps.length - 1];
  for (const s of steps) { if (hours / s <= 5) { step = s; break; } }
  const max = Math.ceil(hours / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { ticks, max };
}

function tickLabel(h: number): string {
  if (h === 0) return '0';
  return Number.isInteger(h) ? `${h}h` : `${h}h`;
}

// Local label parts for a YYYY-MM-DD key (x-axis labels).
function weekdayAbbr(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short' });
}
function monthAbbr(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short' });
}
function dayOfMonth(key: string): number {
  return Number(key.split('-')[2]);
}
// Compact hours for the per-bar data label: "2.5", "2", "0.8" (unit on y-axis).
function compactHours(ms: number): string {
  const h = ms / 3_600_000;
  if (h <= 0) return '';
  const r = Math.round(h * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// normalizeHHMM lives in compute.ts now; imported above.

type EditState =
  | { mode: 'new' }
  | { mode: 'edit'; session: Session }
  | null;

export default function LogTab({
  sessions, categories, now, onUpdateSession, onDeleteSession, onAddSession,
}: Props) {
  // Default range: This week (Sun-start, matching the preset of the same name).
  const [from, setFrom] = useState(() => dayKey(now - new Date(now).getDay() * DAY));
  const [to, setTo] = useState(() => todayKey(now));
  const [edit, setEdit] = useState<EditState>(null);
  const [catFilter, setCatFilter] = useState('all');
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Date-range presets. Each resolves against `now` (and `sessions` for "all").
  // "Workdays" uses ISO-week Mon–Fri of the current week (Sunday belongs to
  // the previous week's workdays).
  const presets = useMemo(() => {
    const d = new Date(now);
    const dow = d.getDay();
    const isoDow = dow === 0 ? 7 : dow;
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const earliest = sessions.length
      ? Math.min(...sessions.map(s => Date.parse(s.clock_in)))
      : now;
    return [
      { label: 'Today',     from: todayKey(now),                          to: todayKey(now) },
      { label: 'This week', from: dayKey(now - dow * DAY),                to: todayKey(now) },
      { label: 'Workdays',  from: dayKey(now - (isoDow - 1) * DAY),       to: dayKey(now + (5 - isoDow) * DAY) },
      { label: 'Last 7d',   from: dayKey(now - 6 * DAY),                  to: todayKey(now) },
      { label: 'This month',from: dayKey(monthStart),                     to: todayKey(now) },
      { label: 'Last 30d',  from: dayKey(now - 29 * DAY),                 to: todayKey(now) },
      { label: 'All time',  from: dayKey(earliest),                       to: todayKey(now) },
    ];
  }, [now, sessions]);

  // Category filter applies to the stats, chart, and session list (but not
  // to the preset ranges or the CSV export, which stay whole).
  const filtered = useMemo(
    () => (catFilter === 'all' ? sessions : sessions.filter(s => s.category === catFilter)),
    [sessions, catFilter]);
  const filterCategories = useMemo(() => {
    const set = new Set<string>(categories);
    sessions.forEach(s => set.add(s.category));
    return [...set];
  }, [categories, sessions]);

  const stats = useMemo(() => rangeStats(filtered, from, to, now), [filtered, from, to, now]);

  const rowsInRange = useMemo(() => {
    return filtered
      .filter(s => { const k = dayKey(Date.parse(s.clock_in)); return k >= from && k <= to; })
      .sort((a, b) => Date.parse(b.clock_in) - Date.parse(a.clock_in));
  }, [filtered, from, to]);

  // Gross is the primary number across the chart, the per-category bars, and
  // the table. Net is the secondary read shown in subs / tooltips.
  const maxCat = stats.byCategory[0]?.grossMs ?? 0;
  const maxDay = Math.max(1, ...stats.perDay.map(d => d.grossMs));

  // Stable color per category — shared by the chart segments, the chart
  // legend, and the by-category breakdown bars.
  const catIndex = useMemo(() => {
    const m = new Map<string, number>();
    stats.byCategory.forEach((c, i) => m.set(c.category, i % CATEGORY_PALETTE.length));
    return m;
  }, [stats.byCategory]);
  const catColor = (c: string) => CATEGORY_PALETTE[catIndex.get(c) ?? 0];
  const chartScale = niceTicks(maxDay);
  const showAllDates = stats.perDay.length <= 31;   // per-bar x labels for ≤ a month
  const denseDates = stats.perDay.length > 14;      // sideways labels once crowded

  return (
    <div className="space-y-7">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map(p => {
          const active = p.from === from && p.to === to;
          return (
            <button key={p.label}
                    onClick={() => { setFrom(p.from); setTo(p.to); }}
                    className={'font-mono text-[10px] uppercase tracking-[0.1em] rounded-sm px-2.5 py-1.5 ' +
                      'transition-colors border ' + (active
                        ? 'border-accent text-accent bg-accent/5'
                        : 'border-rule text-muted hover:border-accent hover:text-accent')}>
              {p.label}
            </button>
          );
        })}
      </div>

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
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Category</span>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
                  className={'mt-1 block ' + field}>
            <option value="all">All</option>
            {filterCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
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
      <div className="rounded-lg border border-rule bg-paper p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Time worked" value={fmtHM(stats.totalGrossMs)}
                sub={`${fmtHM(stats.totalNetMs)} net (breaks excluded)`} />
          <Stat label="Avg / day"
                value={stats.avgPerDayMs === null ? '—' : fmtHM(stats.avgPerDayMs)}
                sub={stats.avgPerDayNetMs === null
                  ? 'total ÷ days in range'
                  : `${fmtHM(stats.avgPerDayNetMs)} net / day`} />
          <Stat label="Avg / working day"
                value={stats.avgPerWorkingDayMs === null ? '—' : fmtHM(stats.avgPerWorkingDayMs)}
                sub={`worked ${stats.workingDays} of ${stats.days} days`} />
          <Stat label="Sessions" value={String(stats.sessionCount)} />
        </div>

        {/* Session length + breaks */}
        <div className="flex flex-wrap gap-x-8 gap-y-2 pt-3 border-t border-rule-soft">
          <Inline label="Longest" value={stats.longestMs === null ? '—' : fmtHM(stats.longestMs)} />
          <Inline label="Median"  value={stats.medianMs === null ? '—' : fmtHM(stats.medianMs)} />
          <Inline label="Shortest" value={stats.shortestMs === null ? '—' : fmtHM(stats.shortestMs)} />
          <Inline label="Breaks"
                  value={stats.totalBreakMs === 0
                    ? 'none'
                    : `${fmtHM(stats.totalBreakMs)}` +
                      (stats.breakSharePct === null ? '' : ` · ${stats.breakSharePct.toFixed(0)}% of clocked time`)} />
        </div>

        {/* Per-day stacked chart */}
        {stats.perDay.length > 0 && (
          <div className="pt-3 border-t border-rule-soft">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted m-0">
                Worked per day
              </p>
              {stats.byCategory.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {stats.byCategory.map(c => (
                    <span key={c.category}
                          className="flex items-center gap-1.5 font-mono text-[10px] text-muted">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm"
                            style={{ background: catColor(c.category) }} />
                      {c.category}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex">
              {/* Y-axis labels (largest at top) */}
              <div className="w-9 flex flex-col-reverse justify-between items-end pr-1.5 h-32 pb-px">
                {chartScale.ticks.map(t => (
                  <span key={t} className="font-mono text-[9px] text-muted leading-none">
                    {tickLabel(t)}
                  </span>
                ))}
              </div>

              {/* Plot area: grid lines + stacked bars + data labels + hover tooltip */}
              <div className="flex-1 relative h-32 border-l border-rule">
                {/* Horizontal grid lines, evenly spaced */}
                <div className="absolute inset-0 flex flex-col-reverse justify-between
                                pointer-events-none">
                  {chartScale.ticks.map((t, i) => (
                    <div key={t} className={i === 0 ? 'h-0' : 'border-t border-rule-soft h-0'} />
                  ))}
                </div>

                {/* Bars (gross) */}
                <div className="absolute inset-0 flex items-end gap-px">
                  {stats.perDay.map((d, i) => {
                    const totalPct = (d.grossMs / (chartScale.max * 3_600_000)) * 100;
                    return (
                      <div key={d.dayKey}
                           className="flex-1 min-w-[2px] h-full relative"
                           onMouseEnter={() => setHoverDay(i)}
                           onMouseLeave={() => setHoverDay(h => (h === i ? null : h))}>
                        <div className="absolute inset-x-0 inset-y-0 flex flex-col-reverse">
                          {d.byCategory.map(c => (
                            <div key={c.category}
                                 style={{ height: `${(c.grossMs / (chartScale.max * 3_600_000)) * 100}%`,
                                          background: catColor(c.category) }} />
                          ))}
                        </div>
                        {showAllDates && d.grossMs > 0 && (
                          <span className="absolute inset-x-0 text-center font-mono text-[8px]
                                           text-ink-soft leading-none tabular-nums pointer-events-none"
                                style={{ bottom: `${totalPct}%`, transform: 'translateY(-3px)' }}>
                            {compactHours(d.grossMs)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Site-styled hover tooltip (replaces the native title) */}
                {hoverDay !== null && stats.perDay[hoverDay] && (
                  <div className="absolute z-10 pointer-events-none"
                       style={{ left: `${((hoverDay + 0.5) / stats.perDay.length) * 100}%`,
                                bottom: '100%', transform: 'translateX(-50%)', marginBottom: 6 }}>
                    <ChartTooltip d={stats.perDay[hoverDay]} catColor={catColor} />
                  </div>
                )}
              </div>
            </div>

            {/* X-axis: every day for ≤ a month, otherwise just the endpoints */}
            {!showAllDates ? (
              <div className="flex justify-between mt-1 pl-9">
                <span className="font-mono text-[9px] text-muted">
                  {fmtDateShort(stats.perDay[0].dayKey + 'T12:00:00')}
                </span>
                <span className="font-mono text-[9px] text-muted">
                  {fmtDateShort(stats.perDay[stats.perDay.length - 1].dayKey + 'T12:00:00')}
                </span>
              </div>
            ) : denseDates ? (
              // Sideways labels once bars get too narrow for stacked text.
              <div className="flex pl-9 mt-1 gap-px" style={{ height: 62 }}>
                {stats.perDay.map(d => (
                  <div key={d.dayKey} className="flex-1 min-w-0 flex justify-center">
                    <span className="font-mono text-[9px] text-muted whitespace-nowrap leading-none"
                          style={{ writingMode: 'vertical-rl' }}>
                      {`${weekdayAbbr(d.dayKey)} ${monthAbbr(d.dayKey)} ${dayOfMonth(d.dayKey)}`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              // Roomy: stacked weekday over month + day.
              <div className="flex pl-9 mt-1 gap-px">
                {stats.perDay.map(d => (
                  <div key={d.dayKey} className="flex-1 min-w-0 text-center leading-none">
                    <div className="font-mono text-[9px] text-muted truncate">{weekdayAbbr(d.dayKey)}</div>
                    <div className="font-mono text-[9px] text-ink-soft tabular-nums mt-0.5 truncate">
                      {`${monthAbbr(d.dayKey)} ${dayOfMonth(d.dayKey)}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Category breakdown */}
        {stats.byCategory.length > 0 && (
          <div className="pt-3 border-t border-rule-soft space-y-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted m-0">
              By category
            </p>
            {stats.byCategory.map(c => (
              <div key={c.category}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-ink-soft w-28 shrink-0 truncate"
                        title={c.category}>{c.category}</span>
                  <span className="h-2 rounded-sm"
                        style={{
                          width: `${maxCat > 0 ? Math.max(2, (c.grossMs / maxCat) * 100) : 2}%`,
                          background: catColor(c.category),
                        }} />
                  <span className="font-mono text-[11px] text-ink ml-auto tabular-nums">
                    {fmtHM(c.grossMs)}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-muted m-0 mt-0.5 ml-[124px]">
                  {c.sessionCount} session{c.sessionCount === 1 ? '' : 's'} ·{' '}
                  {c.sharePct.toFixed(0)}% · avg/day {fmtHM(c.avgPerDayMs)}
                  {' '}({fmtHM(c.avgPerDayNetMs)} net)
                </p>
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
          allSessions={sessions}
          now={now}
          onCancel={() => setEdit(null)}
          onSave={s => {
            if (edit.mode === 'edit') onUpdateSession(s); else onAddSession(s);
            setEdit(null);
          }}
          onApplyToOther={onUpdateSession}
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
            const expanded = expandedId === s.id;
            const hasSegments = s.laps.length > 0 || s.breaks.length > 0;
            const patchLaps = (next: Lap[]) =>
              onUpdateSession({ ...s, laps: next, updated_at: new Date().toISOString() });
            const patchBreaks = (next: Break[]) =>
              onUpdateSession({ ...s, breaks: next, updated_at: new Date().toISOString() });
            return (
              <div key={s.id} className="border-b border-rule-soft">
                <div className="flex items-center gap-3 flex-wrap py-3">
                  <button
                    onClick={() => setExpandedId(expanded ? null : s.id)}
                    className={'font-mono text-[12px] w-5 shrink-0 leading-none transition-colors ' +
                      (hasSegments ? 'text-muted hover:text-accent' : 'text-rule cursor-default')}
                    disabled={!hasSegments}
                    title={hasSegments ? 'Show laps & breaks' : 'No laps or breaks'}>
                    {expanded ? '▾' : '▸'}
                  </button>
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
                  <span className="font-display text-[15px] text-ink tabular-nums w-16 shrink-0"
                        title={`${fmtHM(sessionNetMs(s, now))} net`}>
                    {fmtHM(sessionGrossMs(s, now))}
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
                {expanded && hasSegments && (
                  <div className="pl-8 pr-2 pb-4 space-y-3">
                    {s.laps.length > 0 && (
                      <SegmentList
                        title={`Laps (${s.laps.length})`}
                        items={s.laps.map(l => ({ id: l.id, start: l.start, end: l.end as string | null, notes: l.notes ?? '' }))}
                        now={now}
                        onChangeNotes={(id, notesV) =>
                          patchLaps(s.laps.map(l => l.id === id ? { ...l, notes: notesV || undefined } : l))}
                        onChangeStart={(id, iso) =>
                          patchLaps(s.laps.map(l => l.id === id ? { ...l, start: iso } : l))}
                        onChangeEnd={(id, iso) =>
                          patchLaps(s.laps.map(l => l.id === id ? { ...l, end: iso } : l))}
                        onDelete={id => patchLaps(s.laps.filter(l => l.id !== id))}
                      />
                    )}
                    {s.breaks.length > 0 && (
                      <SegmentList
                        title={`Breaks (${s.breaks.length})`}
                        items={s.breaks.map(b => ({ id: b.id, start: b.start, end: b.end, notes: b.notes ?? '' }))}
                        now={now}
                        onChangeNotes={(id, notesV) =>
                          patchBreaks(s.breaks.map(b => b.id === id ? { ...b, notes: notesV || undefined } : b))}
                        onChangeStart={(id, iso) =>
                          patchBreaks(s.breaks.map(b => b.id === id ? { ...b, start: iso } : b))}
                        onChangeEnd={(id, iso) =>
                          patchBreaks(s.breaks.map(b => b.id === id ? { ...b, end: iso } : b))}
                        onDelete={id => {
                          if (window.confirm('Delete this break? Its time will become worked time again.')) {
                            patchBreaks(s.breaks.filter(b => b.id !== id));
                          }
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChartTooltip({ d, catColor }: { d: DayBucket; catColor: (c: string) => string }) {
  const label = new Date(d.dayKey + 'T12:00:00')
    .toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div className="bg-paper border border-rule rounded-sm px-2.5 py-2 whitespace-nowrap"
         style={{ boxShadow: '0 2px 10px rgba(26,22,20,0.14)' }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink m-0 mb-1">{label}</p>
      {d.byCategory.length === 0 ? (
        <p className="font-serif text-[11px] text-muted italic m-0">no work logged</p>
      ) : (
        d.byCategory.map(c => (
          <div key={c.category} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-ink-soft">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: catColor(c.category) }} />
              {c.category}
            </span>
            <span className="font-mono text-[10px] text-muted tabular-nums">{fmtHM(c.grossMs)}</span>
          </div>
        ))
      )}
      {d.grossMs > 0 && (
        <div className="border-t border-rule-soft mt-1 pt-1">
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-[10px] text-ink">total</span>
            <span className="font-mono text-[10px] text-ink tabular-nums">{fmtHM(d.grossMs)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-[10px] text-muted">net</span>
            <span className="font-mono text-[10px] text-muted tabular-nums">{fmtHM(d.netMs)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted m-0">{label}</p>
      <p className="font-display text-[26px] leading-tight text-ink m-0 tabular-nums">{value}</p>
      {sub && <p className="font-mono text-[10px] text-muted m-0 mt-0.5">{sub}</p>}
    </div>
  );
}

function Inline({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{label}</span>
      <span className="font-serif text-[14px] text-ink tabular-nums">{value}</span>
    </span>
  );
}

// Add / edit form. Editing exposes clock-in/out, category, notes. Breaks are
// shown read-only with an option to clear them (for fixing a stray break);
// new sessions start with no breaks.
function SessionForm({
  categories, session, allSessions, now, onCancel, onSave, onApplyToOther,
}: {
  categories: string[];
  session: Session | null;
  allSessions: Session[];
  now: number;
  onCancel: () => void;
  onSave: (s: Session) => void;
  onApplyToOther: (s: Session) => void;
}) {
  const [category, setCategory] = useState(session?.category ?? categories[0] ?? '');
  // Split clock-in/out into date + 24h time inputs — the native datetime-local
  // picker is clunky, and a separate date + `<input type="time" lang="en-GB">`
  // both reads cleaner and forces 24h.
  const initIn = isoToLocalInput(session?.clock_in ?? new Date(now).toISOString());
  const initOut = session?.clock_out ? isoToLocalInput(session.clock_out) : '';
  const [inDate, setInDate] = useState(initIn.split('T')[0] ?? '');
  const [inTime, setInTime] = useState(initIn.split('T')[1] ?? '');
  const [outDate, setOutDate] = useState(initOut.split('T')[0] ?? '');
  const [outTime, setOutTime] = useState(initOut.split('T')[1] ?? '');
  const [notes, setNotes] = useState(session?.notes ?? '');
  const [mood, setMood] = useState(session?.mood ?? 0);
  const [productivity, setProductivity] = useState(session?.productivity ?? 0);
  const [enjoyment, setEnjoyment] = useState(session?.enjoyment ?? 0);
  const [activity1, setActivity1] = useState(session?.activity1 ?? '');
  const [activity2, setActivity2] = useState(session?.activity2 ?? '');
  const [activity1Pct, setActivity1Pct] = useState(session?.activity1Pct ?? 100);
  const [activity2Pct, setActivity2Pct] = useState(session?.activity2Pct ?? 50);
  // Editable breaks + laps in form-local state; saved together via onSave.
  const [breaks, setBreaks] = useState<Break[]>(session?.breaks ?? []);
  const [laps, setLaps] = useState<Lap[]>(session?.laps ?? []);
  const [err, setErr] = useState('');
  // Apply-these-ratings-to-other-sessions selection, anchored to the day of
  // the session being edited (and the day before). Only meaningful in edit
  // mode — for a new "Add session" form we don't yet have an anchor day.
  const [applyTo, setApplyTo] = useState<Set<string>>(new Set());
  const candidates = useMemo(() => {
    if (!session) return [];
    const baseMs = Date.parse(session.clock_in);
    if (!Number.isFinite(baseMs)) return [];
    const baseKey = dayKey(baseMs);
    const prevKey = dayKey(baseMs - 86_400_000);
    return allSessions
      .filter(s => s.id !== session.id
                && s.category === category
                && s.clock_out !== null
                && (dayKey(Date.parse(s.clock_in)) === baseKey
                  || dayKey(Date.parse(s.clock_in)) === prevKey))
      .sort((a, b) => Date.parse(b.clock_in) - Date.parse(a.clock_in));
  }, [session, allSessions, category]);
  const toggleApply = (id: string) => setApplyTo(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const submit = () => {
    const niT = normalizeHHMM(inTime);
    const noT = normalizeHHMM(outTime);
    const inIso = (inDate && niT) ? localInputToIso(`${inDate}T${niT}`) : '';
    const outIso = (outDate && noT) ? localInputToIso(`${outDate}T${noT}`) : null;
    if (!category) { setErr('Pick a category.'); return; }
    if (!inIso) { setErr('Clock-in needs a valid date and time (HH:MM).'); return; }
    const outHalfFilled = (outDate && !noT) || (!outDate && (outTime || noT));
    if (outHalfFilled) {
      setErr('Clock-out needs both date and time (or leave both blank for active).'); return;
    }
    if (outIso && Date.parse(outIso) <= Date.parse(inIso)) {
      setErr('Clock-out must be after clock-in.'); return;
    }
    const nowIso = new Date(now).toISOString();
    // Copy the rating + activity + notes fields to any candidates the user
    // checked. Each candidate gets the same patch applied.
    if (applyTo.size > 0) {
      const patch = {
        mood, productivity, enjoyment,
        activity1, activity2, activity1Pct, activity2Pct,
        notes: notes.trim() || undefined,
      };
      for (const id of applyTo) {
        const c = candidates.find(x => x.id === id);
        if (!c) continue;
        onApplyToOther({ ...c, ...patch, updated_at: nowIso });
      }
    }
    onSave({
      id: session?.id ?? crypto.randomUUID(),
      category,
      clock_in: inIso,
      clock_out: outIso,
      breaks,
      laps,
      notes: notes.trim() || undefined,
      mood,
      productivity,
      enjoyment,
      activity1,
      activity2,
      activity1Pct,
      activity2Pct,
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
        <div className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Clock in</span>
          <div className="mt-1 flex gap-2 flex-wrap items-center">
            <input type="date" value={inDate} onChange={e => setInDate(e.target.value)}
                   className={'flex-1 min-w-[140px] ' + field} />
            <TimeStepper value={inTime} onChange={setInTime} />
            <button type="button" className={btnTiny}
                    onClick={() => {
                      const [d, t] = isoToLocalInput(new Date().toISOString()).split('T');
                      setInDate(d); setInTime(t);
                    }}>Now</button>
          </div>
        </div>
        <div className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Clock out <span className="normal-case tracking-normal">(blank = still active)</span>
          </span>
          <div className="mt-1 flex gap-2 flex-wrap items-center">
            <input type="date" value={outDate} onChange={e => setOutDate(e.target.value)}
                   className={'flex-1 min-w-[140px] ' + field} />
            <TimeStepper value={outTime} onChange={setOutTime} />
            <button type="button" className={btnTiny}
                    onClick={() => {
                      const [d, t] = isoToLocalInput(new Date().toISOString()).split('T');
                      setOutDate(d); setOutTime(t);
                    }}>Now</button>
          </div>
        </div>
      </div>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Notes</span>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  rows={3} placeholder={NOTES_PLACEHOLDER}
                  className={'mt-1 block w-full resize-y ' + field} />
      </label>
      <div className="space-y-2.5 pt-1">
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
      {laps.length > 0 && (
        <SegmentList
          title={`Laps (${laps.length})`}
          items={laps.map(l => ({ id: l.id, start: l.start, end: l.end as string | null, notes: l.notes ?? '' }))}
          now={now}
          onChangeNotes={(id, notesV) =>
            setLaps(prev => prev.map(l => l.id === id ? { ...l, notes: notesV || undefined } : l))}
          onChangeStart={(id, iso) =>
            setLaps(prev => prev.map(l => l.id === id ? { ...l, start: iso } : l))}
          onChangeEnd={(id, iso) =>
            setLaps(prev => prev.map(l => l.id === id ? { ...l, end: iso } : l))}
          onDelete={id => setLaps(prev => prev.filter(l => l.id !== id))}
        />
      )}
      {breaks.length > 0 && (
        <SegmentList
          title={`Breaks (${breaks.length})`}
          items={breaks.map(b => ({ id: b.id, start: b.start, end: b.end, notes: b.notes ?? '' }))}
          now={now}
          onChangeNotes={(id, notesV) =>
            setBreaks(prev => prev.map(b => b.id === id ? { ...b, notes: notesV || undefined } : b))}
          onChangeStart={(id, iso) =>
            setBreaks(prev => prev.map(b => b.id === id ? { ...b, start: iso } : b))}
          onChangeEnd={(id, iso) =>
            setBreaks(prev => prev.map(b => b.id === id ? { ...b, end: iso } : b))}
          onDelete={id => setBreaks(prev => prev.filter(b => b.id !== id))}
        />
      )}
      {candidates.length > 0 && (
        <ApplyToOtherSessions
          candidates={candidates} applyTo={applyTo} toggleApply={toggleApply} />
      )}
      {err && <p className="font-serif text-[13px] text-accent m-0">{err}</p>}
      <div className="flex gap-2">
        <button className={btnAccent} onClick={submit}>Save</button>
        <button className={btnMuted} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

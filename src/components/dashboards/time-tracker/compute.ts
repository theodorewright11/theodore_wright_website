// Pure derivations for the time-tracker. No side effects, no hidden clock —
// callers pass `now` (epoch ms) explicitly so the UI stays testable and the
// live timers all read one consistent instant.

import type { Session, Break, Pomodoro, RewardSpend } from './types';

const MS_PER_MIN = 60_000;
const MS_PER_DAY = 86_400_000;

function ms(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

// --- Session durations ----------------------------------------------------

export function breakMs(b: Break, now: number): number {
  const end = b.end ? ms(b.end) : now;
  return Math.max(0, end - ms(b.start));
}

export function sessionBreakMs(s: Session, now: number): number {
  return s.breaks.reduce((sum, b) => sum + breakMs(b, now), 0);
}

// Gross = clock-out (or now if still open) minus clock-in.
export function sessionGrossMs(s: Session, now: number): number {
  const end = s.clock_out ? ms(s.clock_out) : now;
  return Math.max(0, end - ms(s.clock_in));
}

// Net = gross minus all break time. This is the "real" worked time.
export function sessionNetMs(s: Session, now: number): number {
  return Math.max(0, sessionGrossMs(s, now) - sessionBreakMs(s, now));
}

export function isOnBreak(s: Session): boolean {
  return s.breaks.length > 0 && s.breaks[s.breaks.length - 1].end === null;
}

export function activeSession(sessions: Session[]): Session | null {
  return sessions.find(s => s.clock_out === null) ?? null;
}

// "Clocked in for real" = an open session that isn't currently on a break.
// Pomodoro intervals only earn reward minutes in this state.
export function isClockedInReal(sessions: Session[]): boolean {
  const a = activeSession(sessions);
  return !!a && !isOnBreak(a);
}

// --- Date helpers ---------------------------------------------------------

// Local calendar day of an epoch ms, as YYYY-MM-DD.
export function dayKey(epoch: number): string {
  const d = new Date(epoch);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function todayKey(now: number): string {
  return dayKey(now);
}

// Inclusive count of calendar days between two YYYY-MM-DD strings.
export function dayCount(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  if (!fy || !ty) return 0;
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  if (to < from) return 0;
  return Math.round((to - from) / MS_PER_DAY) + 1;
}

// --- Range statistics -----------------------------------------------------

export type RangeStats = {
  totalNetMs: number;
  byCategory: { category: string; netMs: number }[];   // sorted, descending
  sessionCount: number;
  days: number;
  avgPerDayMs: number | null;     // totalNet / days; null when days === 0
};

// Sessions are bucketed by the local calendar day of their clock-in.
export function rangeStats(
  sessions: Session[],
  fromKey: string,
  toKey: string,
  now: number,
): RangeStats {
  const inRange = sessions.filter(s => {
    const k = dayKey(ms(s.clock_in));
    return k >= fromKey && k <= toKey;
  });
  let totalNetMs = 0;
  const cat = new Map<string, number>();
  for (const s of inRange) {
    const net = sessionNetMs(s, now);
    totalNetMs += net;
    cat.set(s.category, (cat.get(s.category) ?? 0) + net);
  }
  const byCategory = [...cat.entries()]
    .map(([category, netMs]) => ({ category, netMs }))
    .sort((a, b) => b.netMs - a.netMs);
  const days = dayCount(fromKey, toKey);
  return {
    totalNetMs,
    byCategory,
    sessionCount: inRange.length,
    days,
    avgPerDayMs: days > 0 ? totalNetMs / days : null,
  };
}

// --- Pomodoro / reward ----------------------------------------------------

export function ticksOn(pomodoros: Pomodoro[], dateKey: string): number {
  return pomodoros.filter(p => dayKey(ms(p.completed_at)) === dateKey).length;
}

// Reward bank, in minutes (fractional): credited interval rewards earned
// minus reward minutes already spent. Never negative.
export function rewardBankMin(pomodoros: Pomodoro[], spends: RewardSpend[]): number {
  const earned = pomodoros.reduce((s, p) => s + (p.credited ? p.reward_minutes : 0), 0);
  const spent = spends.reduce((s, r) => s + r.minutes, 0);
  return Math.max(0, earned - spent);
}

// --- Formatters -----------------------------------------------------------

// "1:04:09" / "4:09" — for live ticking timers.
export function fmtClock(totalMs: number): string {
  const total = Math.max(0, Math.floor(totalMs / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// "2h 34m" / "34m" / "0m" — for log/summary readouts.
export function fmtHM(totalMs: number): string {
  const totalMin = Math.round(Math.max(0, totalMs) / MS_PER_MIN);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function fmtTimeOfDay(iso: string): string {
  if (!iso) return '—';
  return new Date(ms(iso)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function fmtDateShort(iso: string): string {
  if (!iso) return '—';
  return new Date(ms(iso)).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// epoch ms <-> the value/format a <input type="datetime-local"> expects.
export function isoToLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(ms(iso));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function localInputToIso(local: string): string {
  if (!local) return '';
  const t = Date.parse(local);
  return Number.isFinite(t) ? new Date(t).toISOString() : '';
}

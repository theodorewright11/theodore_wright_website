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

// Inclusive list of every YYYY-MM-DD between two keys (ascending).
export function daysBetween(fromKey: string, toKey: string): string[] {
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  if (!fy || !ty) return [];
  let cur = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  const out: string[] = [];
  while (cur <= end && out.length < 4000) {
    const d = new Date(cur);
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    out.push(`${d.getUTCFullYear()}-${mm}-${dd}`);
    cur += MS_PER_DAY;
  }
  return out;
}

// Split a session's net time across the local calendar days it spans, so a
// cross-midnight clock-in (e.g. Friday 11pm → Saturday 2am) contributes to
// both days proportionally. Returns a map of dayKey → ms of net time.
// "Net" = gross overlap with the day, minus any break overlap with the day.
function startOfLocalDay(epoch: number): number {
  const d = new Date(epoch);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function startOfNextLocalDay(epoch: number): number {
  const d = new Date(epoch);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

export function sessionDayContributions(s: Session, now: number): Map<string, { net: number; gross: number }> {
  const out = new Map<string, { net: number; gross: number }>();
  const inStart = ms(s.clock_in);
  const inEnd = s.clock_out ? ms(s.clock_out) : now;
  if (inEnd <= inStart) return out;
  let cursor = startOfLocalDay(inStart);
  // Guard against pathological dates; ~3 years of daily iterations max.
  for (let iters = 0; cursor < inEnd && iters < 1200; iters++) {
    const dayStart = cursor;
    const dayEnd = startOfNextLocalDay(cursor);
    const grossOverlap = Math.max(0, Math.min(inEnd, dayEnd) - Math.max(inStart, dayStart));
    let breakOverlap = 0;
    for (const b of s.breaks) {
      const bStart = ms(b.start);
      const bEnd = b.end ? ms(b.end) : now;
      if (bEnd <= bStart) continue;
      breakOverlap += Math.max(0, Math.min(bEnd, dayEnd) - Math.max(bStart, dayStart));
    }
    const net = Math.max(0, grossOverlap - breakOverlap);
    if (grossOverlap > 0) out.set(dayKey(dayStart), { net, gross: grossOverlap });
    cursor = dayEnd;
  }
  return out;
}

// --- Range statistics -----------------------------------------------------

export type CategoryStat = {
  category: string;
  netMs: number;
  grossMs: number;
  sessionCount: number;
  sharePct: number;       // % of totalGrossMs (primary display = gross)
  avgSessionMs: number;   // grossMs / sessionCount  (gross primary)
  avgSessionNetMs: number;
  avgPerDayMs: number;    // grossMs / calendar days in range
  avgPerDayNetMs: number;
};

// One day's worked time, plus a per-category breakdown for stacked charts.
// `byCategory` lists only categories with > 0 time on this day, in the same
// order as the top-level `byCategory` (largest-total first). Both net and
// gross are tracked; UI defaults to gross with net as the secondary read.
export type DayBucket = {
  dayKey: string;
  netMs: number;
  grossMs: number;
  byCategory: { category: string; netMs: number; grossMs: number }[];
};

export type RangeStats = {
  totalNetMs: number;
  totalGrossMs: number;
  totalBreakMs: number;
  breakSharePct: number | null;       // break / gross; null when no clocked time
  byCategory: CategoryStat[];         // sorted by grossMs, descending
  sessionCount: number;
  days: number;                       // calendar days in range
  workingDays: number;                // distinct local days with >= 1 session
  // Gross-primary, net-secondary (the rest of the UI defaults to gross).
  avgPerDayMs: number | null;         // totalGross / calendar days
  avgPerDayNetMs: number | null;      // totalNet / calendar days
  avgPerWorkingDayMs: number | null;  // totalGross / working days
  avgPerWorkingDayNetMs: number | null;
  // Session length stats use gross now (clock-in → clock-out, breaks included).
  longestMs: number | null;
  shortestMs: number | null;
  medianMs: number | null;
  perDay: DayBucket[];                // one bucket per calendar day in range
};

// Sessions whose clock-in *or any spanned day* falls within the range count.
// Per-day totals (chart + workingDays) split a cross-midnight session across
// the days it actually covers — so a Friday 11pm → Saturday 2am clock-in
// puts an hour on Friday and two on Saturday rather than dumping it all on
// the clock-in day.
export function rangeStats(
  sessions: Session[],
  fromKey: string,
  toKey: string,
  now: number,
): RangeStats {
  const inRange = sessions.filter(s => {
    const inDay = dayKey(ms(s.clock_in));
    const outDay = dayKey(s.clock_out ? ms(s.clock_out) : now);
    return outDay >= fromKey && inDay <= toKey;
  });
  let totalNetMs = 0, totalGrossMs = 0, totalBreakMs = 0;
  const cat = new Map<string, { net: number; gross: number; count: number }>();
  const dayNet = new Map<string, number>();
  const dayGross = new Map<string, number>();
  const dayCatNet = new Map<string, number>();    // key = "dayKey|category"
  const dayCatGross = new Map<string, number>();
  const grosses: number[] = [];                   // session-level gross durations
  for (const s of inRange) {
    const net = sessionNetMs(s, now);
    const gross = sessionGrossMs(s, now);
    totalNetMs += net;
    totalGrossMs += gross;
    totalBreakMs += sessionBreakMs(s, now);
    grosses.push(gross);
    const c = cat.get(s.category) ?? { net: 0, gross: 0, count: 0 };
    c.net += net; c.gross += gross; c.count += 1;
    cat.set(s.category, c);
    // Per-day buckets split across local midnights; clipped to the visible range.
    for (const [dk, contrib] of sessionDayContributions(s, now)) {
      if (dk < fromKey || dk > toKey) continue;
      dayNet.set(dk, (dayNet.get(dk) ?? 0) + contrib.net);
      dayGross.set(dk, (dayGross.get(dk) ?? 0) + contrib.gross);
      const ck = `${dk}|${s.category}`;
      dayCatNet.set(ck, (dayCatNet.get(ck) ?? 0) + contrib.net);
      dayCatGross.set(ck, (dayCatGross.get(ck) ?? 0) + contrib.gross);
    }
  }
  const days = dayCount(fromKey, toKey);
  const byCategory: CategoryStat[] = [...cat.entries()]
    .map(([category, v]) => ({
      category,
      netMs: v.net,
      grossMs: v.gross,
      sessionCount: v.count,
      sharePct: totalGrossMs > 0 ? (v.gross / totalGrossMs) * 100 : 0,
      avgSessionMs: v.count > 0 ? v.gross / v.count : 0,
      avgSessionNetMs: v.count > 0 ? v.net / v.count : 0,
      avgPerDayMs: days > 0 ? v.gross / days : 0,
      avgPerDayNetMs: days > 0 ? v.net / days : 0,
    }))
    .sort((a, b) => b.grossMs - a.grossMs);

  const workingDays = dayGross.size;
  const sorted = [...grosses].sort((a, b) => a - b);
  const median = sorted.length === 0
    ? null
    : sorted.length % 2 === 1
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const perDay: DayBucket[] = daysBetween(fromKey, toKey).map(dk => {
    const cats: { category: string; netMs: number; grossMs: number }[] = [];
    for (const c of byCategory) {
      const g = dayCatGross.get(`${dk}|${c.category}`) ?? 0;
      if (g > 0) cats.push({
        category: c.category,
        netMs: dayCatNet.get(`${dk}|${c.category}`) ?? 0,
        grossMs: g,
      });
    }
    return {
      dayKey: dk,
      netMs: dayNet.get(dk) ?? 0,
      grossMs: dayGross.get(dk) ?? 0,
      byCategory: cats,
    };
  });

  return {
    totalNetMs,
    totalGrossMs,
    totalBreakMs,
    breakSharePct: totalGrossMs > 0 ? (totalBreakMs / totalGrossMs) * 100 : null,
    byCategory,
    sessionCount: inRange.length,
    days,
    workingDays,
    avgPerDayMs: days > 0 ? totalGrossMs / days : null,
    avgPerDayNetMs: days > 0 ? totalNetMs / days : null,
    avgPerWorkingDayMs: workingDays > 0 ? totalGrossMs / workingDays : null,
    avgPerWorkingDayNetMs: workingDays > 0 ? totalNetMs / workingDays : null,
    longestMs: sorted.length ? sorted[sorted.length - 1] : null,
    shortestMs: sorted.length ? sorted[0] : null,
    medianMs: median,
    perDay,
  };
}

// --- Pomodoro / reward ----------------------------------------------------

export function ticksOn(pomodoros: Pomodoro[], dateKey: string): number {
  return pomodoros.filter(p => dayKey(ms(p.completed_at)) === dateKey).length;
}

// Count of completed intervals whose local day falls within [fromKey, toKey].
export function ticksBetween(pomodoros: Pomodoro[], fromKey: string, toKey: string): number {
  return pomodoros.filter(p => {
    const k = dayKey(ms(p.completed_at));
    return k >= fromKey && k <= toKey;
  }).length;
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

// "14:30" / "1430" / "9:5" → canonical "HH:MM", or '' if invalid. Used by
// the inline lap/break time editors and the session-form text fallback.
export function normalizeHHMM(s: string): string {
  const cleaned = s.replace(/[^\d:]/g, '');
  let hPart: string, mPart: string;
  if (cleaned.includes(':')) {
    const [a, b] = cleaned.split(':');
    hPart = a; mPart = b ?? '';
  } else if (cleaned.length === 4) {
    hPart = cleaned.slice(0, 2); mPart = cleaned.slice(2);
  } else if (cleaned.length === 3) {
    hPart = cleaned.slice(0, 1); mPart = cleaned.slice(1);
  } else if (cleaned.length > 0 && cleaned.length <= 2) {
    hPart = cleaned; mPart = '';
  } else {
    return '';
  }
  const hh = parseInt(hPart || '0', 10);
  const mm = mPart === '' ? 0 : parseInt(mPart, 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Replace only the local HH:MM portion of an ISO datetime; keep its date.
// Returns the original iso when hhmm is empty or invalid.
export function withLocalTime(iso: string, hhmm: string): string {
  if (!iso) return iso;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const norm = normalizeHHMM(hhmm);
  if (!norm) return iso;
  const [hh, mm] = norm.split(':').map(Number);
  const d = new Date(t);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

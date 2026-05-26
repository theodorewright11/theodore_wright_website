// Persistence for the time-tracker. Three localStorage keys:
//   tw-timetracker-v1          — synced data cache (mirrors the sheet)
//   tw-timetracker-settings-v1 — device-local Pomodoro preferences
//   tw-timetracker-timers-v1   — device-local live-timer state (resume on refresh)
// Plus CSV export of the session log as an offline backup.

import {
  EMPTY_STATE, EMPTY_TIMERS, DEFAULT_SETTINGS,
  type DataState, type Settings, type Timers, type Session,
} from './types';

const DATA_KEY = 'tw-timetracker-v1';
const SETTINGS_KEY = 'tw-timetracker-settings-v1';
const TIMERS_KEY = 'tw-timetracker-timers-v1';

export function loadState(): DataState {
  if (typeof window === 'undefined') return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(DATA_KEY);
    if (!raw) return EMPTY_STATE;
    const p = JSON.parse(raw);
    if (p?.version !== 1) return EMPTY_STATE;
    return {
      version: 1,
      // Coerce sessions defensively — older cached rows predate the rating
      // fields, so default them rather than letting `undefined` leak through.
      sessions: (Array.isArray(p.sessions) ? p.sessions : []).map((s: any): Session => ({
        ...s,
        breaks: (Array.isArray(s?.breaks) ? s.breaks : []).map((b: any) => ({
          id: typeof b?.id === 'string' && b.id ? b.id : crypto.randomUUID(),
          start: b?.start,
          end: typeof b?.end === 'string' ? b.end : null,
          notes: typeof b?.notes === 'string' && b.notes ? b.notes : undefined,
        })),
        laps: (Array.isArray(s?.laps) ? s.laps : []).map((l: any) => ({
          id: typeof l?.id === 'string' && l.id ? l.id : crypto.randomUUID(),
          start: l?.start,
          end: typeof l?.end === 'string' && l.end ? l.end : null,
          notes: typeof l?.notes === 'string' && l.notes ? l.notes : undefined,
        })),
        mood: Number.isFinite(s?.mood) ? s.mood : 0,
        productivity: Number.isFinite(s?.productivity) ? s.productivity : 0,
        enjoyment: Number.isFinite(s?.enjoyment) ? s.enjoyment : 0,
        activity1: typeof s?.activity1 === 'string' ? s.activity1 : '',
        activity2: typeof s?.activity2 === 'string' ? s.activity2 : '',
        activity1Pct: Number.isFinite(s?.activity1Pct) ? s.activity1Pct : 100,
        activity2Pct: Number.isFinite(s?.activity2Pct) ? s.activity2Pct : 50,
      })),
      categories: Array.isArray(p.categories) ? p.categories : [],
      pomodoros: Array.isArray(p.pomodoros) ? p.pomodoros : [],
      rewardSpends: Array.isArray(p.rewardSpends) ? p.rewardSpends : [],
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function saveState(state: DataState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DATA_KEY, JSON.stringify(state));
}

export function clearState(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DATA_KEY);
}

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const p = JSON.parse(raw);
    const intervalMin = Number(p?.intervalMin);
    const rewardPerInterval = Number(p?.rewardPerInterval);
    return {
      intervalMin: Number.isFinite(intervalMin) && intervalMin > 0 ? intervalMin : DEFAULT_SETTINGS.intervalMin,
      rewardPerInterval: Number.isFinite(rewardPerInterval) && rewardPerInterval >= 0
        ? rewardPerInterval : DEFAULT_SETTINGS.rewardPerInterval,
      autoStart: typeof p?.autoStart === 'boolean' ? p.autoStart : DEFAULT_SETTINGS.autoStart,
      autoRunWhenClockedIn: typeof p?.autoRunWhenClockedIn === 'boolean'
        ? p.autoRunWhenClockedIn : DEFAULT_SETTINGS.autoRunWhenClockedIn,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadTimers(): Timers {
  if (typeof window === 'undefined') return EMPTY_TIMERS;
  try {
    const raw = window.localStorage.getItem(TIMERS_KEY);
    if (!raw) return EMPTY_TIMERS;
    const p = JSON.parse(raw);
    return {
      pomodoroEndsAt: typeof p?.pomodoroEndsAt === 'number' ? p.pomodoroEndsAt : null,
      pomodoroRemainingSec: typeof p?.pomodoroRemainingSec === 'number' ? p.pomodoroRemainingSec : null,
      rewardPlayStartedAt: typeof p?.rewardPlayStartedAt === 'number' ? p.rewardPlayStartedAt : null,
    };
  } catch {
    return EMPTY_TIMERS;
  }
}

export function saveTimers(t: Timers): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TIMERS_KEY, JSON.stringify(t));
}

// --- CSV export -----------------------------------------------------------

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const SESSION_CSV_HEADERS = [
  'id', 'category', 'clock_in', 'clock_out',
  'break_count', 'breaks_json', 'lap_count', 'laps_json',
  'notes', 'mood', 'productivity', 'enjoyment',
  'activity1', 'activity2', 'activity1_pct', 'activity2_pct',
];

export function sessionsToCsv(sessions: Session[]): string {
  const head = SESSION_CSV_HEADERS.join(',');
  const body = sessions.map(s => [
    s.id, s.category, s.clock_in, s.clock_out ?? '',
    s.breaks.length, JSON.stringify(s.breaks), s.laps.length, JSON.stringify(s.laps),
    s.notes ?? '', s.mood ?? 0, s.productivity ?? 0, s.enjoyment ?? 0,
    s.activity1 ?? '', s.activity2 ?? '', s.activity1Pct ?? 100, s.activity2Pct ?? 50,
  ].map(csvEscape).join(',')).join('\n');
  return body ? head + '\n' + body + '\n' : head + '\n';
}

export function downloadFile(name: string, contents: string, mime = 'text/csv') {
  if (typeof window === 'undefined') return;
  const blob = new Blob([contents], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

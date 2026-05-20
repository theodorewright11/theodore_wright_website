import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EMPTY_STATE, DEFAULT_CATEGORIES, DEFAULT_SETTINGS, EMPTY_TIMERS,
  type DataState, type Settings, type Timers,
  type Session, type Pomodoro, type RewardSpend,
} from './types';
import {
  loadState, saveState, clearState,
  loadSettings, saveSettings, loadTimers, saveTimers,
} from './storage';
import {
  readConfig, type StoredToken,
  loadStoredToken, clearStoredToken,
  signIn as gisSignIn, signOut as gisSignOut,
  ensureTabs,
  readSessions, writeSessions,
  readCategories, writeCategories,
  readPomodoros, writePomodoros,
  readRewardSpends, writeRewardSpends,
  SheetsAuthError,
} from './sheets';
import { activeSession, isOnBreak, isClockedInReal } from './compute';
import ClockTab from './ClockTab';
import PomodoroTab from './PomodoroTab';
import LogTab from './LogTab';
import WeekStrip from './WeekStrip';
import AuthBar from './AuthBar';

type Tab = 'clock' | 'pomodoro' | 'log';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'clock',    label: 'Clock' },
  { id: 'pomodoro', label: 'Pomodoro' },
  { id: 'log',      label: 'Log' },
];

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';
type Entity = 'sessions' | 'categories' | 'pomodoros' | 'rewardSpends';
const ENTITIES: Entity[] = ['sessions', 'categories', 'pomodoros', 'rewardSpends'];

export default function TimeTrackerDashboard() {
  const config = useMemo(() => readConfig(), []);

  const [state, setState] = useState<DataState>(EMPTY_STATE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [timers, setTimers] = useState<Timers>(EMPTY_TIMERS);
  const [tab, setTab] = useState<Tab>('clock');
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [token, setToken] = useState<StoredToken | null>(null);
  const [sync, setSync] = useState<SyncState>('idle');
  const [lastError, setLastError] = useState<string | undefined>(undefined);

  // --- Hydration ------------------------------------------------------------
  useEffect(() => {
    const loaded = loadState();
    setState(loaded.categories.length ? loaded : { ...loaded, categories: DEFAULT_CATEGORIES });
    setSettings(loadSettings());
    setTimers(loadTimers());
    setHydrated(true);
    const stored = loadStoredToken();
    if (stored) setToken(stored);
  }, []);

  // localStorage is the offline cache; the sheet is the source of truth when
  // signed in. Settings + timers are device-local and never synced.
  useEffect(() => { if (hydrated) saveState(state); }, [state, hydrated]);
  useEffect(() => { if (hydrated) saveSettings(settings); }, [settings, hydrated]);
  useEffect(() => { if (hydrated) saveTimers(timers); }, [timers, hydrated]);

  // One shared 1-second clock drives every live timer in the dashboard.
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // --- Push queue (per-entity, latest-wins coalescing) ---------------------
  const pending = useRef<Record<Entity, any[] | null>>(
    { sessions: null, categories: null, pomodoros: null, rewardSpends: null });
  const inflight = useRef<Record<Entity, boolean>>(
    { sessions: false, categories: false, pomodoros: false, rewardSpends: false });

  const handleSyncError = useCallback((e: unknown) => {
    if (e instanceof SheetsAuthError) {
      clearStoredToken();
      setToken(null);
      setLastError('Session expired. Sign in again.');
    } else {
      setLastError(e instanceof Error ? e.message : String(e));
    }
    setSync('error');
  }, []);

  const doWrite = useCallback(async (entity: Entity, payload: any[]) => {
    if (!token || !config) return;
    const t = token.access_token, id = config.sheetId;
    if (entity === 'sessions') await writeSessions(t, id, payload);
    else if (entity === 'categories') await writeCategories(t, id, payload);
    else if (entity === 'pomodoros') await writePomodoros(t, id, payload);
    else if (entity === 'rewardSpends') await writeRewardSpends(t, id, payload);
  }, [token, config]);

  const drainQueue = useCallback(async (entity: Entity) => {
    if (inflight.current[entity]) return;
    inflight.current[entity] = true;
    setSync('syncing');
    try {
      while (pending.current[entity] !== null) {
        const next = pending.current[entity]!;
        pending.current[entity] = null;
        await doWrite(entity, next);
      }
    } catch (e) {
      handleSyncError(e);
      return;
    } finally {
      inflight.current[entity] = false;
    }
    const settled = ENTITIES.every(e => !inflight.current[e] && pending.current[e] === null);
    if (settled) {
      setSync(s => s === 'error' ? 'error' : 'idle');
      setLastError(undefined);
    }
  }, [doWrite, handleSyncError]);

  const push = useCallback((entity: Entity, payload: any[]) => {
    if (!token || !config) return;   // local-only mode: no-op
    pending.current[entity] = payload;
    drainQueue(entity);
  }, [token, config, drainQueue]);

  // --- Pull -----------------------------------------------------------------
  const pull = useCallback(async () => {
    if (!token || !config) return;
    // Don't pull while a write is in flight or queued — local state is the
    // source of truth during a mutation, and a mid-transition read would
    // either see stale data or (with the old replaceTab) an empty sheet.
    const busy = ENTITIES.some(e => inflight.current[e] || pending.current[e] !== null);
    if (busy) return;
    setSync('syncing');
    try {
      await ensureTabs(token.access_token, config.sheetId);
      const [sessions, categories, pomodoros, rewardSpends] = await Promise.all([
        readSessions(token.access_token, config.sheetId),
        readCategories(token.access_token, config.sheetId),
        readPomodoros(token.access_token, config.sheetId),
        readRewardSpends(token.access_token, config.sheetId),
      ]);
      if (categories.length === 0) {
        setState({ version: 1, sessions, categories: DEFAULT_CATEGORIES, pomodoros, rewardSpends });
        pending.current.categories = DEFAULT_CATEGORIES;
        drainQueue('categories');
      } else {
        setState({ version: 1, sessions, categories, pomodoros, rewardSpends });
        setSync('idle');
      }
      setLastError(undefined);
    } catch (e) {
      handleSyncError(e);
    }
  }, [token, config, handleSyncError, drainQueue]);

  useEffect(() => {
    if (token && config) pull();
  }, [token?.access_token, config?.sheetId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token || !config) return;
    function onFocus() { pull(); }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [token, config, pull]);

  // --- Sign-in / out --------------------------------------------------------
  const handleSignIn = useCallback(async () => {
    if (!config) return;
    try {
      setSync('syncing');
      const t = await gisSignIn({ clientId: config.clientId, prompt: 'consent' });
      setToken(t);
    } catch (e) {
      handleSyncError(e);
    }
  }, [config, handleSyncError]);

  const handleSignOut = useCallback(() => {
    if (token) gisSignOut(token.access_token);
    setToken(null);
    setSync('idle');
    setLastError(undefined);
  }, [token]);

  const handleRetry = useCallback(() => {
    setLastError(undefined);
    if (token && config) pull();
  }, [token, config, pull]);

  // --- Mutations ------------------------------------------------------------
  const iso = () => new Date().toISOString();

  const setSessions = (next: Session[]) => {
    setState(s => ({ ...s, sessions: next }));
    push('sessions', next);
  };

  // Pomodoro coupling for settings.autoRunWhenClockedIn: the focus timer
  // tracks the clocked-in-for-real state. Functional updaters so concurrent
  // session mutations can't read a stale `timers`.
  const pomodoroStart = () => setTimers(t => {
    if (t.pomodoroEndsAt !== null) return t;   // already running — leave it
    const remainingMs = t.pomodoroRemainingSec !== null
      ? t.pomodoroRemainingSec * 1000
      : settings.intervalMin * 60_000;
    return { ...t, pomodoroEndsAt: Date.now() + remainingMs, pomodoroRemainingSec: null };
  });
  const pomodoroPause = () => setTimers(t =>
    t.pomodoroEndsAt === null ? t
      : { ...t, pomodoroEndsAt: null,
          pomodoroRemainingSec: Math.max(0, Math.round((t.pomodoroEndsAt - Date.now()) / 1000)) });
  const pomodoroResume = () => setTimers(t =>
    (t.pomodoroEndsAt !== null || t.pomodoroRemainingSec === null) ? t
      : { ...t, pomodoroEndsAt: Date.now() + t.pomodoroRemainingSec * 1000, pomodoroRemainingSec: null });
  const pomodoroReset = () => setTimers(t =>
    (t.pomodoroEndsAt === null && t.pomodoroRemainingSec === null) ? t
      : { ...t, pomodoroEndsAt: null, pomodoroRemainingSec: null });

  const onClockIn = (category: string) => {
    if (activeSession(state.sessions)) return;   // already clocked in
    const ts = iso();
    setSessions([...state.sessions, {
      id: crypto.randomUUID(), category, clock_in: ts, clock_out: null,
      breaks: [], mood: 0, productivity: 0, enjoyment: 0,
      activity1: '', activity2: '', activity1Pct: 100, activity2Pct: 50,
      created_at: ts, updated_at: ts,
    }]);
    if (settings.autoRunWhenClockedIn) pomodoroStart();
  };

  const onClockOut = () => {
    const a = activeSession(state.sessions);
    if (!a) return;
    const ts = iso();
    // Auto-close a forgotten open break so net time stays correct.
    const breaks = a.breaks.map((b, i) =>
      i === a.breaks.length - 1 && b.end === null ? { ...b, end: ts } : b);
    setSessions(state.sessions.map(s =>
      s.id === a.id ? { ...s, clock_out: ts, breaks, updated_at: ts } : s));
    if (settings.autoRunWhenClockedIn) pomodoroReset();
  };

  const onStartBreak = () => {
    const a = activeSession(state.sessions);
    if (!a || isOnBreak(a)) return;
    const ts = iso();
    setSessions(state.sessions.map(s =>
      s.id === a.id ? { ...s, breaks: [...s.breaks, { start: ts, end: null }], updated_at: ts } : s));
    if (settings.autoRunWhenClockedIn) pomodoroPause();
  };

  const onEndBreak = () => {
    const a = activeSession(state.sessions);
    if (!a || !isOnBreak(a)) return;
    const ts = iso();
    setSessions(state.sessions.map(s =>
      s.id === a.id
        ? { ...s, breaks: s.breaks.map((b, i) =>
            i === s.breaks.length - 1 ? { ...b, end: ts } : b), updated_at: ts }
        : s));
    if (settings.autoRunWhenClockedIn) pomodoroResume();
  };

  const onUpdateSession = (u: Session) =>
    setSessions(state.sessions.map(s => s.id === u.id ? u : s));
  const onAddSession = (u: Session) => setSessions([...state.sessions, u]);
  const onDeleteSession = (id: string) =>
    setSessions(state.sessions.filter(s => s.id !== id));

  const onAddCategory = (name: string) => {
    if (state.categories.includes(name)) return;
    const next = [...state.categories, name];
    setState(s => ({ ...s, categories: next }));
    push('categories', next);
  };
  const onRemoveCategory = (name: string) => {
    const next = state.categories.filter(c => c !== name);
    setState(s => ({ ...s, categories: next }));
    push('categories', next);
  };

  const onCompleteInterval = useCallback((credited: boolean, rewardMin: number, lengthMin: number) => {
    setState(s => {
      const next: Pomodoro[] = [...s.pomodoros, {
        id: crypto.randomUUID(), completed_at: new Date().toISOString(),
        length_min: lengthMin, reward_minutes: credited ? rewardMin : 0, credited,
      }];
      push('pomodoros', next);
      return { ...s, pomodoros: next };
    });
  }, [push]);

  const onRewardSpend = useCallback((startedAt: string, endedAt: string, minutes: number) => {
    setState(s => {
      const next: RewardSpend[] = [...s.rewardSpends, {
        id: crypto.randomUUID(), started_at: startedAt, ended_at: endedAt, minutes,
      }];
      push('rewardSpends', next);
      return { ...s, rewardSpends: next };
    });
  }, [push]);

  const resetAll = () => {
    if (!window.confirm('Erase all local time-tracking data? This cannot be undone.')) return;
    clearState();
    setState({ ...EMPTY_STATE, categories: DEFAULT_CATEGORIES });
    setTimers(EMPTY_TIMERS);
    saveTimers(EMPTY_TIMERS);
  };

  if (!hydrated) {
    return (
      <div className="bg-paper-edge border border-rule rounded-lg py-16 text-center
                      font-serif italic text-muted shadow-sm">Loading…</div>
    );
  }

  const signedIn = !!token;

  return (
    <div className="bg-paper-edge border border-rule rounded-lg overflow-hidden
                    shadow-[0_1px_3px_rgba(26,22,20,0.04)]">
      <div className="bg-paper border-b border-rule px-3 flex items-center justify-between
                      gap-3 flex-wrap">
        <div className="flex items-stretch gap-0.5">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                      className={'font-mono text-[11px] uppercase px-3.5 py-3 -mb-px border-b-2 ' +
                        'transition-colors ' + (active
                          ? 'text-accent border-accent bg-paper-edge/50'
                          : 'text-muted border-transparent hover:text-ink hover:bg-paper-edge/30')}
                      style={{ letterSpacing: '0.12em' }}>{t.label}</button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 py-1.5">
          <AuthBar
            configured={!!config}
            email={token?.email}
            sync={sync}
            lastError={lastError}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onRetry={handleRetry}
          />
          {!signedIn && (
            <button onClick={resetAll}
                    className="font-mono text-[10px] uppercase text-muted hover:text-accent
                               transition-colors px-2 py-1.5"
                    style={{ letterSpacing: '0.08em' }}>Reset all data</button>
          )}
        </div>
      </div>

      <WeekStrip sessions={state.sessions} categories={state.categories} now={now} />

      <div className="p-5 sm:p-6">
        {tab === 'clock' && (
          <ClockTab
            sessions={state.sessions} categories={state.categories} now={now}
            onClockIn={onClockIn} onClockOut={onClockOut}
            onStartBreak={onStartBreak} onEndBreak={onEndBreak}
            onUpdateSession={onUpdateSession} onDeleteSession={onDeleteSession}
            onAddCategory={onAddCategory} onRemoveCategory={onRemoveCategory}
          />
        )}
        {tab === 'pomodoro' && (
          <PomodoroTab
            now={now}
            settings={settings} onChangeSettings={setSettings}
            timers={timers} onChangeTimers={setTimers}
            pomodoros={state.pomodoros} rewardSpends={state.rewardSpends}
            clockedInReal={isClockedInReal(state.sessions)}
            onCompleteInterval={onCompleteInterval}
            onRewardSpend={onRewardSpend}
          />
        )}
        {tab === 'log' && (
          <LogTab
            sessions={state.sessions} categories={state.categories} now={now}
            onUpdateSession={onUpdateSession}
            onDeleteSession={onDeleteSession}
            onAddSession={onAddSession}
          />
        )}
      </div>
    </div>
  );
}

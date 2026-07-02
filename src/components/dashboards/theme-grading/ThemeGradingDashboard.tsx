import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadCachedToken,
  refresh,
  signIn,
  signOut,
  type StoredToken,
} from '../../../lib/googleAuth';
import AuthBar, { type SyncStatus } from './AuthBar';
import { DriveAuthError } from './drive';
import { mergeStates, pullStateFromDrive, syncStateToDrive } from './driveSync';
import ExploreView from './ExploreView';
import RateView from './RateView';
import RunsView from './RunsView';
import type { AxisDef } from './rubric';
import {
  cryptoRandomId,
  downloadJSON,
  downloadText,
  loadState,
  parseCorpusCSV,
  ratingsCSV,
  saveState,
  similaritiesCSV,
} from './storage';
import { buildThemesFromImport, parseAIThemesJson, reanchorThemes } from './themeImport';
import type { AppState, AxisScore, Run, View } from './types';

const GOOGLE_CLIENT_ID = (import.meta as any).env?.PUBLIC_GOOGLE_CLIENT_ID as string | undefined;
const DRIVE_FOLDER_ID = (import.meta as any).env?.PUBLIC_THEME_GRADING_DRIVE_FOLDER_ID as
  | string
  | undefined;

type DriveState = {
  token: StoredToken | null;
  syncStatus: SyncStatus;
  lastError: string | null;
};

export default function ThemeGradingDashboard() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [hydrated, setHydrated] = useState(false);
  const [drive, setDrive] = useState<DriveState>({
    token: null,
    syncStatus: 'offline',
    lastError: null,
  });
  // Session-only UI state.
  const [focusThemeId, setFocusThemeId] = useState<string | null>(null);

  const view: View = state.view ?? 'runs';

  useEffect(() => {
    setHydrated(true);
    const cached = loadCachedToken();
    if (cached) setDrive((d) => ({ ...d, token: cached, syncStatus: 'idle' }));
    refresh()
      .then((t) => {
        if (t) setDrive((d) => ({ ...d, token: t, syncStatus: 'idle', lastError: null }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  // Runs shown side by side in the Rate view (max 3). Falls back to the last
  // opened run for state saved before rateRunIds existed.
  const shownRuns = useMemo<Run[]>(() => {
    const ids = state.rateRunIds ?? (state.activeRunId ? [state.activeRunId] : []);
    return ids
      .map((id) => state.runs.find((r) => r.id === id))
      .filter((r): r is Run => !!r)
      .slice(0, 4);
  }, [state.rateRunIds, state.activeRunId, state.runs]);

  const setRateRuns = (ids: string[]) =>
    setState((s) => ({
      ...s,
      rateRunIds: ids.slice(0, 4),
      activeRunId: ids[0] ?? s.activeRunId,
    }));

  // ----- Drive sync (single state file, debounced) -----
  const pendingWrite = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);
  const rerunAfter = useRef(false);
  const tokenRef = useRef<StoredToken | null>(null);
  tokenRef.current = drive.token;
  const queueWriteRef = useRef<() => void>(() => {});

  const runWrite = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    if (inflight.current) {
      rerunAfter.current = true;
      return;
    }
    inflight.current = true;
    setDrive((d) => ({ ...d, syncStatus: 'syncing', lastError: null }));
    try {
      // Read the freshest flushed state so the write includes edits saved
      // after this write was queued (saveState flushes on every state change).
      const snapshot = loadState();
      const link = await syncStateToDrive(token.access_token, snapshot, DRIVE_FOLDER_ID);
      setState((s) => ({ ...s, drive: link }));
      setDrive((d) => ({ ...d, syncStatus: 'idle' }));
    } catch (err) {
      if (err instanceof DriveAuthError) {
        const t = await refresh().catch(() => null);
        if (t) setDrive({ token: t, syncStatus: 'idle', lastError: null });
        else setDrive({ token: null, syncStatus: 'error', lastError: err.message });
      } else {
        setDrive((d) => ({
          ...d,
          syncStatus: 'error',
          lastError: err instanceof Error ? err.message : String(err),
        }));
      }
    } finally {
      inflight.current = false;
      if (rerunAfter.current) {
        rerunAfter.current = false;
        queueWriteRef.current();
      }
    }
  }, []);

  const queueWrite = useCallback(() => {
    if (!tokenRef.current) return;
    if (pendingWrite.current) clearTimeout(pendingWrite.current);
    pendingWrite.current = setTimeout(() => {
      pendingWrite.current = null;
      runWrite();
    }, 800);
  }, [runWrite]);
  queueWriteRef.current = queueWrite;

  const pull = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    setDrive((d) => ({ ...d, syncStatus: 'syncing', lastError: null }));
    try {
      const pulled = await pullStateFromDrive(token.access_token);
      if (!pulled) {
        // Nothing on Drive yet — push what we have if there's anything.
        setDrive((d) => ({ ...d, syncStatus: 'idle' }));
        queueWrite();
        return;
      }
      let pushNeeded = false;
      setState((s) => {
        const res = mergeStates(s, pulled.state, pulled.drive);
        pushNeeded = res.pushNeeded;
        return res.merged;
      });
      setDrive((d) => ({ ...d, syncStatus: 'idle' }));
      if (pushNeeded) queueWrite();
    } catch (err) {
      if (err instanceof DriveAuthError) {
        const t = await refresh().catch(() => null);
        if (t) setDrive({ token: t, syncStatus: 'idle', lastError: null });
        else setDrive({ token: null, syncStatus: 'error', lastError: err.message });
      } else {
        setDrive((d) => ({
          ...d,
          syncStatus: 'error',
          lastError: err instanceof Error ? err.message : String(err),
        }));
      }
    }
  }, [queueWrite]);

  // Pull on sign-in.
  useEffect(() => {
    if (drive.token) pull();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drive.token?.access_token]);

  // Wake handler: refresh a near-expiry token, then pull.
  useEffect(() => {
    if (!drive.token || !GOOGLE_CLIENT_ID) return;
    const wake = () => {
      if (!tokenRef.current) return;
      if (tokenRef.current.expires_at - Date.now() < 5 * 60_000) {
        refresh()
          .then((t) => {
            if (t) setDrive({ token: t, syncStatus: 'idle', lastError: null });
            else pull();
          })
          .catch(() => pull());
      } else {
        pull();
      }
    };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [drive.token, pull]);

  // Silent token refresh ~1 minute before expiry.
  useEffect(() => {
    if (!drive.token) return;
    const delay = drive.token.expires_at - 60_000 - Date.now();
    if (delay <= 0) return;
    const tid = window.setTimeout(async () => {
      try {
        const fresh = await refresh();
        if (fresh) setDrive({ token: fresh, syncStatus: 'idle', lastError: null });
      } catch {
        /* token dies naturally */
      }
    }, delay);
    return () => clearTimeout(tid);
  }, [drive.token]);

  const handleSignIn = async () => {
    if (!GOOGLE_CLIENT_ID) return;
    try {
      const t = await signIn(GOOGLE_CLIENT_ID);
      setDrive({ token: t, syncStatus: 'idle', lastError: null });
    } catch (err) {
      setDrive((d) => ({
        ...d,
        syncStatus: 'error',
        lastError: err instanceof Error ? err.message : String(err),
      }));
    }
  };

  const handleSignOut = () => {
    signOut();
    setDrive({ token: null, syncStatus: 'offline', lastError: null });
  };

  const syncNow = useCallback(() => {
    if (pendingWrite.current) {
      clearTimeout(pendingWrite.current);
      pendingWrite.current = null;
    }
    runWrite();
  }, [runWrite]);

  // ----- Mutations (all content mutations stamp updated_at + queue a sync) -----
  const mutate = useCallback(
    (fn: (s: AppState) => AppState) => {
      setState((s) => ({ ...fn(s), updated_at: new Date().toISOString() }));
      queueWrite();
    },
    [queueWrite],
  );

  const touchRun = (run: Run): Run => ({ ...run, updated_at: new Date().toISOString() });

  const addCorpus = (name: string, csvText: string) => {
    const { docs, warnings } = parseCorpusCSV(csvText);
    if (docs.length > 0) {
      mutate((s) => ({
        ...s,
        corpora: [
          ...s.corpora,
          {
            id: cryptoRandomId(),
            name: name || `Corpus ${s.corpora.length + 1}`,
            docs,
            created_at: new Date().toISOString(),
          },
        ],
      }));
    }
    return { docCount: docs.length, warnings };
  };

  const deleteCorpus = (id: string) =>
    mutate((s) => ({
      ...s,
      corpora: s.corpora.filter((c) => c.id !== id),
      deletedCorpusIds: [...(s.deletedCorpusIds ?? []), id],
    }));

  const renameCorpus = (id: string, name: string) =>
    mutate((s) => ({
      ...s,
      corpora: s.corpora.map((c) => (c.id === id ? { ...c, name } : c)),
    }));

  const createRun = (
    meta: Omit<Run, 'id' | 'themes' | 'created_at' | 'updated_at' | 'additionalText'>,
    themesJson: string,
  ) => {
    const raw = parseAIThemesJson(themesJson);
    const corpus = meta.corpusId ? state.corpora.find((c) => c.id === meta.corpusId) ?? null : null;
    const result = buildThemesFromImport(raw, corpus);
    if (result.themes.length === 0) {
      throw new Error(result.warnings.join(' ') || 'No themes found in the JSON.');
    }
    const now = new Date().toISOString();
    const run: Run = {
      ...meta,
      id: cryptoRandomId(),
      themes: result.themes,
      additionalText: result.additionalText,
      created_at: now,
      updated_at: now,
    };
    mutate((s) => ({ ...s, runs: [...s.runs, run], activeRunId: run.id }));
    return {
      themeCount: result.themes.length,
      anchoredQuotes: result.anchoredQuotes,
      totalQuotes: result.totalQuotes,
      warnings: result.warnings,
    };
  };

  const deleteRun = (id: string) =>
    mutate((s) => ({
      ...s,
      runs: s.runs.filter((r) => r.id !== id),
      deletedRunIds: [...(s.deletedRunIds ?? []), id],
      rateRunIds: (s.rateRunIds ?? []).filter((x) => x !== id),
      activeRunId: s.activeRunId === id ? s.runs.find((r) => r.id !== id)?.id ?? null : s.activeRunId,
    }));

  const updateRunMeta = (id: string, patch: Partial<Run>) =>
    mutate((s) => ({
      ...s,
      runs: s.runs.map((r) => (r.id === id ? touchRun({ ...r, ...patch }) : r)),
    }));

  // Re-run quote↔data matching for an existing run (e.g. after uploading the
  // data it should have pointed at). Ratings and theme ids are preserved.
  const reanchorRun = (runId: string, corpusId: string) => {
    const corpus = state.corpora.find((c) => c.id === corpusId);
    const run = state.runs.find((r) => r.id === runId);
    if (!corpus || !run) return { anchored: 0, total: 0 };
    const result = reanchorThemes(run.themes, corpus);
    mutate((s) => ({
      ...s,
      runs: s.runs.map((r) =>
        r.id === runId ? touchRun({ ...r, corpusId, themes: result.themes }) : r,
      ),
    }));
    return { anchored: result.anchoredQuotes, total: result.totalQuotes };
  };

  const setScore = (runId: string, themeId: string, axis: AxisDef['key'], v: AxisScore | undefined) =>
    mutate((s) => ({
      ...s,
      runs: s.runs.map((r) =>
        r.id === runId
          ? touchRun({
              ...r,
              themes: r.themes.map((t) =>
                t.id === themeId ? { ...t, rating: { ...t.rating, [axis]: v } } : t,
              ),
            })
          : r,
      ),
    }));

  const setRatingNotes = (runId: string, themeId: string, notes: string) =>
    mutate((s) => ({
      ...s,
      runs: s.runs.map((r) =>
        r.id === runId
          ? touchRun({
              ...r,
              themes: r.themes.map((t) =>
                t.id === themeId
                  ? { ...t, rating: { ...t.rating, notes: notes || undefined } }
                  : t,
              ),
            })
          : r,
      ),
    }));

  const findPairIndex = (sims: AppState['similarities'], a: string, b: string) =>
    sims.findIndex(
      (x) => (x.themeA === a && x.themeB === b) || (x.themeA === b && x.themeB === a),
    );

  // Adding a link keeps the pair even before a score is set; only the explicit
  // remove deletes it.
  const addSimilarity = (themeA: string, themeB: string) =>
    mutate((s) => {
      if (findPairIndex(s.similarities, themeA, themeB) >= 0) return s;
      return {
        ...s,
        similarities: [
          ...s.similarities,
          { id: cryptoRandomId(), themeA, themeB, created_at: new Date().toISOString() },
        ],
      };
    });

  const patchSimilarity = (
    themeA: string,
    themeB: string,
    apply: (cur: AppState['similarities'][number]) => AppState['similarities'][number],
  ) =>
    mutate((s) => {
      const idx = findPairIndex(s.similarities, themeA, themeB);
      if (idx >= 0) {
        const next = [...s.similarities];
        next[idx] = apply({ ...next[idx] });
        return { ...s, similarities: next };
      }
      return {
        ...s,
        similarities: [
          ...s.similarities,
          apply({ id: cryptoRandomId(), themeA, themeB, created_at: new Date().toISOString() }),
        ],
      };
    });

  const removeSimilarity = (themeA: string, themeB: string) =>
    mutate((s) => {
      const idx = findPairIndex(s.similarities, themeA, themeB);
      if (idx < 0) return s;
      const next = [...s.similarities];
      next.splice(idx, 1);
      return { ...s, similarities: next };
    });

  const jumpToTheme = (runId: string, themeId: string) => {
    setState((s) => {
      const shown = s.rateRunIds ?? (s.activeRunId ? [s.activeRunId] : []);
      const nextShown = shown.includes(runId) ? shown : [...shown, runId].slice(-4);
      return { ...s, rateRunIds: nextShown, activeRunId: runId, view: 'rate' };
    });
    setFocusThemeId(themeId);
  };

  const setView = (v: View) => setState((s) => ({ ...s, view: v }));

  if (!hydrated) return null;

  return (
    <div className="h-full flex flex-col bg-white text-slate-900">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-200 flex-shrink-0">
        <span className="font-bold text-[15px] tracking-tight">Theme Grading</span>
        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
          {(
            [
              ['runs', 'Runs'],
              ['rate', 'Rate'],
              ['explore', 'Explore'],
            ] as [View, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3.5 py-1 text-[12px] font-semibold ${
                view === v
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 border-l border-slate-200 first:border-l-0'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <AuthBar
            configured={!!GOOGLE_CLIENT_ID}
            email={drive.token?.email}
            syncStatus={drive.syncStatus}
            lastError={drive.lastError}
            runCount={state.runs.length}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onPull={pull}
            onSyncNow={syncNow}
          />
        </div>
      </div>

      {/* Views */}
      {view === 'runs' && (
        <RunsView
          state={state}
          onAddCorpus={addCorpus}
          onDeleteCorpus={deleteCorpus}
          onRenameCorpus={renameCorpus}
          onCreateRun={createRun}
          onDeleteRun={deleteRun}
          onUpdateRunMeta={updateRunMeta}
          onOpenRun={(id) =>
            setState((s) => ({ ...s, rateRunIds: [id], activeRunId: id, view: 'rate' }))
          }
          onReanchorRun={reanchorRun}
        />
      )}
      {view === 'rate' && (
        <RateView
          state={state}
          shownRuns={shownRuns}
          focusThemeId={focusThemeId}
          onSetRateRuns={setRateRuns}
          onSetScore={setScore}
          onSetRatingNotes={setRatingNotes}
          onAddSimilarity={addSimilarity}
          onSetSimilarity={(a, b, v) => patchSimilarity(a, b, (cur) => ({ ...cur, similarity: v }))}
          onSetSimilarityNotes={(a, b, notes) =>
            patchSimilarity(a, b, (cur) => ({ ...cur, notes: notes || undefined }))
          }
          onRemoveSimilarity={removeSimilarity}
          onToggleDisplay={(key) =>
            setState((s) => {
              // showRubricHints defaults off; the others default on.
              const current = key === 'showRubricHints' ? !!s[key] : s[key] !== false;
              return { ...s, [key]: !current };
            })
          }
          onFocusHandled={() => setFocusThemeId(null)}
        />
      )}
      {view === 'explore' && (
        <ExploreView
          state={state}
          onJumpToTheme={jumpToTheme}
          onExportRatingsCSV={() => downloadText('theme-grading.ratings.csv', ratingsCSV(state))}
          onExportSimilaritiesCSV={() =>
            downloadText('theme-grading.similarities.csv', similaritiesCSV(state))
          }
          onExportJSON={() => {
            const { drive: _d, ...rest } = state;
            downloadJSON('theme-grading.json', rest);
          }}
        />
      )}
    </div>
  );
}

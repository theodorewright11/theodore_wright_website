import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DataState, Transaction, Budget, Income, CategoryEntry } from './types';
import { EMPTY_STATE } from './types';
import { DEFAULT_CATEGORIES } from './categories';
import { loadState, saveState, clearState } from './storage';
import {
  readConfig,
  ensureTabs,
  readTransactions, writeTransactions,
  readBudgets, writeBudgets,
  readIncomes, writeIncomes,
  readCategories, writeCategories,
  SheetsAuthError,
} from './sheets';
import {
  type StoredToken, loadCachedToken, signIn, refresh, signOut,
} from '../../../lib/googleAuth';
import { fetchSpendingLog } from './spendingLogImporter';
import DashboardTab from './DashboardTab';
import TransactionsTab from './TransactionsTab';
import BudgetTab from './BudgetTab';
import AuthBar from './AuthBar';

type Tab = 'dashboard' | 'transactions' | 'budget' | 'insights';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'dashboard',    label: 'Dashboard' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'budget',       label: 'Budget' },
  { id: 'insights',     label: 'Insights' },
];

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';
type Entity = 'transactions' | 'budgets' | 'incomes' | 'categories';
const ENTITIES: Entity[] = ['transactions', 'budgets', 'incomes', 'categories'];

export default function FinanceDashboard() {
  const config = useMemo(() => readConfig(), []);

  const [state, setState] = useState<DataState>(EMPTY_STATE);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [hydrated, setHydrated] = useState(false);

  const [token, setToken] = useState<StoredToken | null>(null);
  const [sync, setSync] = useState<SyncState>('idle');
  const [lastError, setLastError] = useState<string | undefined>(undefined);

  // --- Hydration: localStorage first (fast UI), then confirm/renew the token
  //     from the server-side refresh cookie (popup-free) and pull the sheet. --

  useEffect(() => {
    const loaded = loadState();
    // A brand-new local store has no taxonomy — seed the default so the UI has
    // categories to render before the first sheet pull replaces it.
    setState(loaded.categories.length ? loaded : { ...loaded, categories: DEFAULT_CATEGORIES });
    setHydrated(true);
    // Instant paint from the cached access token, then silently renew from the
    // HttpOnly refresh-token cookie (no popup, immune to COOP).
    const cached = loadCachedToken();
    if (cached) setToken(cached);
    refresh().then(t => { if (t) setToken(t); }).catch(() => {});
  }, []);

  // Persist to localStorage on every state change. localStorage is the
  // offline cache; sheets is the source of truth when signed in.
  useEffect(() => {
    if (!hydrated) return;
    saveState(state);
  }, [state, hydrated]);

  // --- Push queue (per-entity, latest-wins coalescing) ---------------------

  const pending = useRef<Record<Entity, any[] | null>>(
    { transactions: null, budgets: null, incomes: null, categories: null });
  const inflight = useRef<Record<Entity, boolean>>(
    { transactions: false, budgets: false, incomes: false, categories: false });

  const handleSyncError = useCallback(async (e: unknown) => {
    if (e instanceof SheetsAuthError) {
      // The token 401'd — try a popup-free refresh before forcing re-sign-in.
      try {
        const t = await refresh();
        if (t) { setToken(t); setSync('idle'); setLastError(undefined); return; }
      } catch { /* fall through to sign-out */ }
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
    if (entity === 'transactions') await writeTransactions(t, id, payload);
    else if (entity === 'budgets') await writeBudgets(t, id, payload);
    else if (entity === 'incomes') await writeIncomes(t, id, payload);
    else if (entity === 'categories') await writeCategories(t, id, payload);
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
    // Settle to idle only when nothing is pending or in-flight on any entity.
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

  // --- Pull on token acquisition + window focus refresh -------------------

  const pull = useCallback(async () => {
    if (!token || !config) return;
    // Skip while a write is queued or in flight — local state is the source
    // of truth during a mutation, so a focus-triggered re-pull would race.
    const busy = ENTITIES.some(e => inflight.current[e] || pending.current[e] !== null);
    if (busy) return;
    setSync('syncing');
    try {
      await ensureTabs(token.access_token, config.sheetId);
      const [txs, bs, is, cats] = await Promise.all([
        readTransactions(token.access_token, config.sheetId),
        readBudgets(token.access_token, config.sheetId),
        readIncomes(token.access_token, config.sheetId),
        readCategories(token.access_token, config.sheetId),
      ]);
      // An empty `categories` tab (fresh sheet, or first run after this
      // upgrade) seeds the default taxonomy and pushes it back up.
      if (cats.length === 0) {
        setState({ version: 1, transactions: txs, budgets: bs, incomes: is, categories: DEFAULT_CATEGORIES });
        pending.current.categories = DEFAULT_CATEGORIES;
        drainQueue('categories');
      } else {
        setState({ version: 1, transactions: txs, budgets: bs, incomes: is, categories: cats });
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

  // On focus/visibility: if the token is near expiry, silent-refresh first (the
  // token-change effect re-pulls); otherwise just pull. Covers cross-tab and
  // manual-sheet edits, and background-tab timer throttling.
  useEffect(() => {
    if (!token || !config) return;
    const wake = () => {
      if (!token || !config) return;
      if (token.expires_at - Date.now() < 5 * 60_000) {
        refresh().then(t => { if (t) setToken(t); else pull(); }).catch(() => pull());
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
  }, [token, config, pull]);

  // Silent token refresh ~1 minute before expiry (no popup). If it fails
  // (refresh token revoked/expired) the token dies naturally and the next API
  // call prompts a normal sign-in.
  useEffect(() => {
    if (!token || !config) return;
    const delay = token.expires_at - 60_000 - Date.now();
    if (delay <= 0) return;
    const tid = window.setTimeout(async () => {
      try {
        const fresh = await refresh();
        if (fresh) setToken(fresh);
      } catch { /* let the token die naturally */ }
    }, delay);
    return () => clearTimeout(tid);
  }, [token, config]);

  // --- Sign-in / sign-out -------------------------------------------------

  const handleSignIn = useCallback(async () => {
    if (!config) return;
    try {
      setSync('syncing');
      const t = await signIn(config.clientId);
      setToken(t);
    } catch (e) {
      handleSyncError(e);
    }
  }, [config, handleSyncError]);

  const handleSignOut = useCallback(() => {
    signOut();
    setToken(null);
    setSync('idle');
    setLastError(undefined);
  }, []);

  const handleRetry = useCallback(() => {
    setLastError(undefined);
    if (token && config) pull();
  }, [token, config, pull]);

  // --- Mutation handlers (push if signed in) ------------------------------

  const onAddTx = (tx: Transaction) => {
    const next = [...state.transactions, tx];
    setState(s => ({ ...s, transactions: next }));
    push('transactions', next);
  };
  const onUpdateTx = (tx: Transaction) => {
    const next = state.transactions.map(t => t.id === tx.id ? tx : t);
    setState(s => ({ ...s, transactions: next }));
    push('transactions', next);
  };
  const onDeleteTx = (id: string) => {
    const next = state.transactions.filter(t => t.id !== id);
    setState(s => ({ ...s, transactions: next }));
    push('transactions', next);
  };
  const onReplaceAllTx = (txs: Transaction[]) => {
    setState(s => ({ ...s, transactions: txs }));
    push('transactions', txs);
  };
  const onAppendTx = (txs: Transaction[]) => {
    const seen = new Set(txs.map(t => t.id));
    const merged = state.transactions.filter(t => !seen.has(t.id)).concat(txs);
    setState(s => ({ ...s, transactions: merged }));
    push('transactions', merged);
  };

  const onSaveBudgets = (next: Budget[]) => {
    setState(s => ({ ...s, budgets: next }));
    push('budgets', next);
  };
  const onSaveIncomes = (next: Income[]) => {
    setState(s => ({ ...s, incomes: next }));
    push('incomes', next);
  };
  const onImportBudgets = (next: Budget[]) => {
    const merged = [...state.budgets, ...next];
    setState(s => ({ ...s, budgets: merged }));
    push('budgets', merged);
  };

  // Save the edited taxonomy. `renames` (oldKey → newKey) migrate existing
  // transactions and budgets so a renamed category doesn't strand its history
  // under "Uncategorized". Deletions are intentionally NOT migrated — those
  // rows fall into the Uncategorized bucket until re-filed (surfaced in the
  // Manage-categories confirm).
  const onSaveCategories = (next: CategoryEntry[], renames: { from: string; to: string }[]) => {
    const map = new Map(renames.filter(r => r.from !== r.to).map(r => [r.from, r.to]));
    const now = new Date().toISOString();
    const transactions = map.size
      ? state.transactions.map(t => map.has(t.category) ? { ...t, category: map.get(t.category)!, updated_at: now } : t)
      : state.transactions;
    const budgets = map.size
      ? state.budgets.map(b => map.has(b.category) ? { ...b, category: map.get(b.category)! } : b)
      : state.budgets;
    setState(s => ({ ...s, categories: next, transactions, budgets }));
    if (map.size) { push('transactions', transactions); push('budgets', budgets); }
    push('categories', next);
  };

  // --- Seed-from-Spending-Log (one-time historical import) ----------------

  const onSeedFromSpendingLog = useCallback(async () => {
    if (!token || !config) return;
    setSync('syncing');
    try {
      const summary = await fetchSpendingLog(token.access_token, config.sheetId, state.categories);
      const ok = window.confirm(
        `Found ${summary.imported.length} transactions in your "Spending Log" tab` +
        (summary.skipped ? ` (skipped ${summary.skipped} bad rows)` : '') + `.\n\n` +
        (summary.unknownCategories.length
          ? `${summary.unknownCategories.length} unknown categor${summary.unknownCategories.length === 1 ? 'y' : 'ies'} — will appear as "Uncategorized" until you fix them in the UI:\n  ${summary.unknownCategories.join(', ')}\n\n`
          : '') +
        `This will REPLACE everything currently in the dashboard's transactions tab. Continue?`
      );
      if (!ok) { setSync('idle'); return; }
      setState(s => ({ ...s, transactions: summary.imported }));
      push('transactions', summary.imported);
    } catch (e) {
      handleSyncError(e);
    }
  }, [token, config, push, handleSyncError, state.categories]);

  // --- Local-mode-only reset (hidden when signed in) ----------------------

  const resetAll = () => {
    if (!window.confirm('Erase all local finance data (transactions, budgets, incomes, categories)? This cannot be undone.')) return;
    clearState();
    setState({ ...EMPTY_STATE, categories: DEFAULT_CATEGORIES });
  };

  if (!hydrated) {
    return (
      <div className="bg-paper-edge border border-rule rounded-lg py-16 text-center font-serif italic text-muted shadow-sm">Loading…</div>
    );
  }

  const signedIn = !!token;

  return (
    <div className="bg-paper-edge border border-rule rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(26,22,20,0.04)]">
      {/* App bar */}
      <div className="bg-paper border-b border-rule px-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-stretch gap-0.5">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                      className={'font-mono text-[11px] uppercase px-3.5 py-3 -mb-px border-b-2 transition-colors ' + (
                        active
                          ? 'text-accent border-accent bg-paper-edge/50'
                          : 'text-muted border-transparent hover:text-ink hover:bg-paper-edge/30'
                      )}
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
                    className="font-mono text-[10px] uppercase text-muted hover:text-accent transition-colors px-2 py-1.5"
                    style={{ letterSpacing: '0.08em' }}>Reset all data</button>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {tab === 'dashboard' && (
          <DashboardTab transactions={state.transactions} budgets={state.budgets} incomes={state.incomes} categories={state.categories} />
        )}
        {tab === 'transactions' && (
          <TransactionsTab
            transactions={state.transactions}
            categories={state.categories}
            signedIn={signedIn}
            onAdd={onAddTx} onUpdate={onUpdateTx} onDelete={onDeleteTx}
            onReplaceAll={onReplaceAllTx} onAppend={onAppendTx}
            onSeedFromSpendingLog={signedIn ? onSeedFromSpendingLog : undefined}
          />
        )}
        {tab === 'budget' && (
          <BudgetTab
            budgets={state.budgets} incomes={state.incomes} categories={state.categories}
            transactions={state.transactions}
            signedIn={signedIn}
            onSaveBudgets={onSaveBudgets}
            onSaveIncomes={onSaveIncomes}
            onImportBudgets={onImportBudgets}
            onSaveCategories={onSaveCategories}
          />
        )}
        {tab === 'insights' && (
          <div className="bg-paper border border-rule rounded-md py-16 text-center shadow-[0_1px_2px_rgba(26,22,20,0.03)]">
            <p className="font-display text-[20px] text-ink m-0 mb-2"
               style={{ letterSpacing: '-0.01em' }}>Insights — coming soon</p>
            <p className="font-serif text-[14px] text-muted m-0 max-w-[440px] mx-auto"
               style={{ textWrap: 'pretty' }}>
              Spending over time, category drift, rolling averages, runway, month-over-month deltas.
              Built out after v1 is stable.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

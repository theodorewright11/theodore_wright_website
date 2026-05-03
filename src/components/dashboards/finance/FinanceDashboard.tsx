import { useEffect, useState } from 'react';
import type { DataState, Transaction, Budget, Income } from './types';
import { EMPTY_STATE } from './types';
import { loadState, saveState, clearState } from './storage';
import DashboardTab from './DashboardTab';
import TransactionsTab from './TransactionsTab';
import BudgetTab from './BudgetTab';

type Tab = 'dashboard' | 'transactions' | 'budget' | 'insights';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'dashboard',    label: 'Dashboard' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'budget',       label: 'Budget' },
  { id: 'insights',     label: 'Insights' },
];

export default function FinanceDashboard() {
  const [state, setState] = useState<DataState>(EMPTY_STATE);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  // Persist on every change after hydration. Re-fetch on focus so the user
  // sees fresh data if the tab was open in two windows.
  useEffect(() => {
    if (!hydrated) return;
    saveState(state);
  }, [state, hydrated]);

  useEffect(() => {
    function onFocus() { setState(loadState()); }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const update = (patch: Partial<DataState>) => setState(s => ({ ...s, ...patch }));

  const onAddTx = (tx: Transaction) => update({ transactions: [...state.transactions, tx] });
  const onUpdateTx = (tx: Transaction) =>
    update({ transactions: state.transactions.map(t => t.id === tx.id ? tx : t) });
  const onDeleteTx = (id: string) =>
    update({ transactions: state.transactions.filter(t => t.id !== id) });
  const onReplaceAllTx = (txs: Transaction[]) => update({ transactions: txs });
  const onAppendTx = (txs: Transaction[]) => {
    // Dedupe by id; new wins.
    const seen = new Set(txs.map(t => t.id));
    const merged = state.transactions.filter(t => !seen.has(t.id)).concat(txs);
    update({ transactions: merged });
  };

  const onSaveBudgets = (next: Budget[]) => update({ budgets: next });
  const onSaveIncomes = (next: Income[]) => update({ incomes: next });
  const onImportBudgets = (next: Budget[]) =>
    update({ budgets: [...state.budgets, ...next] });

  const resetAll = () => {
    if (!window.confirm('Erase all local finance data (transactions, budgets, incomes)? This cannot be undone.')) return;
    clearState();
    setState(EMPTY_STATE);
  };

  if (!hydrated) {
    return (
      <div className="py-16 text-center font-serif italic text-muted">Loading…</div>
    );
  }

  return (
    <div>
      <div className="border-b border-rule mb-8 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-1">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                      className={'font-mono text-[11px] uppercase px-3 py-2 -mb-px border-b-2 transition-colors ' + (
                        active
                          ? 'text-accent border-accent'
                          : 'text-muted border-transparent hover:text-ink'
                      )}
                      style={{ letterSpacing: '0.12em' }}>{t.label}</button>
            );
          })}
        </div>
        <button onClick={resetAll}
                className="font-mono text-[10px] uppercase text-muted hover:text-accent transition-colors mb-1"
                style={{ letterSpacing: '0.08em' }}>Reset all data</button>
      </div>

      {tab === 'dashboard' && (
        <DashboardTab transactions={state.transactions} budgets={state.budgets} incomes={state.incomes} />
      )}
      {tab === 'transactions' && (
        <TransactionsTab
          transactions={state.transactions}
          onAdd={onAddTx} onUpdate={onUpdateTx} onDelete={onDeleteTx}
          onReplaceAll={onReplaceAllTx} onAppend={onAppendTx}
        />
      )}
      {tab === 'budget' && (
        <BudgetTab
          budgets={state.budgets} incomes={state.incomes}
          onSaveBudgets={onSaveBudgets}
          onSaveIncomes={onSaveIncomes}
          onImportBudgets={onImportBudgets}
        />
      )}
      {tab === 'insights' && (
        <div className="py-16 text-center">
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
  );
}

import { useMemo, useRef, useState } from 'react';
import type { Budget, Income, CategoryEntry, Transaction } from './types';
import { groupByBroadMid } from './categories';
import { formatMoney, todayYM, currentBudgets, txsInMonth, spendByCategory } from './compute';
import { budgetsToCsv, csvToBudgets, downloadFile } from './storage';
import CategoriesModal from './CategoriesModal';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

type Props = {
  budgets: Budget[];
  incomes: Income[];
  categories: CategoryEntry[];
  transactions: Transaction[];
  /** CSV import/export is a local-only escape hatch — hidden when synced. */
  signedIn: boolean;
  onSaveBudgets: (next: Budget[]) => void;
  onSaveIncomes: (next: Income[]) => void;
  onImportBudgets: (next: Budget[]) => void;
  onSaveCategories: (next: CategoryEntry[], renames: { from: string; to: string }[]) => void;
};

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function BudgetTab({ budgets, incomes, categories, transactions, signedIn, onSaveBudgets, onSaveIncomes, onImportBudgets, onSaveCategories }: Props) {
  const ym = todayYM();
  const current = useMemo(() => currentBudgets(budgets, ym), [budgets, ym.year, ym.month]);

  // Actual spend this month per category — shown next to each budget input so
  // you can set a budget while seeing what you actually spend.
  const spendMap = useMemo(
    () => spendByCategory(txsInMonth(transactions, ym), categories),
    [transactions, categories, ym.year, ym.month]);

  const [showCategories, setShowCategories] = useState(false);

  const [drafts, setDrafts] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const c of categories) {
      m.set(c.detailed, (current.get(c.detailed) ?? 0).toString());
    }
    return m;
  });

  // Reseed drafts when budgets or the taxonomy change externally (CSV import,
  // a category add/rename/delete that migrated budget rows). Keying on budget
  // versions + category keys catches renames, which change a budget's category
  // without changing row count or effective_from.
  const reseedKey = budgets.length + ':' + budgets.map(b => b.effective_from).join('|')
    + '::' + categories.map(c => c.detailed).join('|');
  const lastSeed = useRef(reseedKey);
  if (lastSeed.current !== reseedKey) {
    lastSeed.current = reseedKey;
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.detailed, (current.get(c.detailed) ?? 0).toString());
    setDrafts(m);
  }

  const [incomeDrafts, setIncomeDrafts] = useState<Income[]>(() =>
    incomes.length === 0 ? [{ id: crypto.randomUUID(), source: 'Work', monthly_amount: 0, effective_from: todayIso() }] : incomes.map(i => ({ ...i }))
  );

  // Reseed income drafts when the incomes prop changes externally — chiefly the
  // first sheet pull after sign-in, which arrives after mount. Without this the
  // editor kept showing the default "Work $0" and never picked up the synced
  // amount.
  const incomeReseedKey = incomes.map(i => `${i.id}:${i.monthly_amount}:${i.effective_from}`).join('|');
  const lastIncomeSeed = useRef(incomeReseedKey);
  if (lastIncomeSeed.current !== incomeReseedKey) {
    lastIncomeSeed.current = incomeReseedKey;
    setIncomeDrafts(incomes.length === 0
      ? [{ id: crypto.randomUUID(), source: 'Work', monthly_amount: 0, effective_from: todayIso() }]
      : incomes.map(i => ({ ...i })));
  }

  const fileInput = useRef<HTMLInputElement>(null);

  const draftTotal = useMemo(() => {
    let s = 0;
    for (const v of drafts.values()) {
      const n = parseFloat(v);
      if (Number.isFinite(n)) s += n;
    }
    return s;
  }, [drafts]);

  const draftIncomeTotal = useMemo(() =>
    incomeDrafts.reduce((s, i) => s + (Number.isFinite(i.monthly_amount) ? i.monthly_amount : 0), 0),
  [incomeDrafts]);

  function setDraft(cat: string, value: string) {
    setDrafts(prev => {
      const next = new Map(prev);
      next.set(cat, value);
      return next;
    });
  }

  function saveBudgets() {
    const today = todayIso();
    const newRows: Budget[] = [];
    for (const c of categories) {
      const raw = drafts.get(c.detailed) ?? '0';
      const amt = parseFloat(raw);
      if (!Number.isFinite(amt) || amt < 0) {
        alert(`Invalid budget for ${c.detailed}. Must be a non-negative number.`);
        return;
      }
      const existing = current.get(c.detailed);
      if (existing === undefined || existing !== amt) {
        newRows.push({ category: c.detailed, monthly_amount: amt, effective_from: today });
      }
    }
    if (newRows.length === 0) { alert('No changes to save.'); return; }
    onSaveBudgets([...budgets, ...newRows]);
    alert(`Saved ${newRows.length} budget change${newRows.length === 1 ? '' : 's'}.`);
  }

  function saveIncomes() {
    for (const i of incomeDrafts) {
      if (!i.source.trim()) { alert('Income source cannot be empty.'); return; }
      if (!Number.isFinite(i.monthly_amount) || i.monthly_amount < 0) { alert(`Invalid income amount for ${i.source}.`); return; }
    }
    onSaveIncomes(incomeDrafts.map(i => ({ ...i, source: i.source.trim(), effective_from: i.effective_from || todayIso() })));
    alert('Income saved.');
  }

  function resetDrafts() {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.detailed, (current.get(c.detailed) ?? 0).toString());
    setDrafts(m);
    setIncomeDrafts(incomes.length === 0 ? [{ id: crypto.randomUUID(), source: 'Work', monthly_amount: 0, effective_from: todayIso() }] : incomes.map(i => ({ ...i })));
  }

  function importCsv() {
    const f = fileInput.current?.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = csvToBudgets(text);
      if (parsed.length === 0) { alert('No valid budget rows found. Required headers: category,monthly_amount,effective_from.'); return; }
      if (!window.confirm(`Import ${parsed.length} budget rows? Existing budgets are kept; new rows are appended (newest effective_from wins).`)) return;
      onImportBudgets(parsed);
      if (fileInput.current) fileInput.current.value = '';
    };
    reader.readAsText(f);
  }

  const grouped = groupByBroadMid(categories);
  const overspendingPlanned = draftTotal > draftIncomeTotal;

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="bg-paper border border-rule rounded-md px-3 py-2.5 flex items-baseline justify-between gap-3 flex-wrap shadow-[0_1px_2px_rgba(26,22,20,0.03)]">
        <div>
          <h2 className="font-display font-semibold text-[20px] text-ink m-0"
              style={{ letterSpacing: '-0.02em' }}>Budget</h2>
          <p className="font-serif text-[12px] text-muted m-0 mt-0.5">
            Edits create a new versioned row dated today. Past months keep the budget in effect then.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowCategories(true)}
                  className="font-mono text-[10px] uppercase text-accent border border-accent hover:bg-accent hover:text-paper rounded-sm px-2 py-1.5 transition-colors"
                  style={{ letterSpacing: '0.08em' }}>Manage categories</button>
          {!signedIn && (
            <>
              <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
              <button onClick={() => fileInput.current?.click()}
                      className="font-mono text-[10px] uppercase text-muted hover:text-accent border border-rule hover:border-accent rounded-sm px-2 py-1.5 transition-colors"
                      style={{ letterSpacing: '0.08em' }}>Import CSV</button>
              <button onClick={() => downloadFile('finance-budgets.csv', budgetsToCsv(budgets))}
                      className="font-mono text-[10px] uppercase text-muted hover:text-accent border border-rule hover:border-accent rounded-sm px-2 py-1.5 transition-colors"
                      style={{ letterSpacing: '0.08em' }}>Export CSV</button>
            </>
          )}
        </div>
      </div>

      {showCategories && (
        <CategoriesModal
          categories={categories}
          onClose={() => setShowCategories(false)}
          onSave={onSaveCategories}
        />
      )}

      {overspendingPlanned && (
        <div className="px-3 py-2 border border-accent rounded-md bg-accent/5">
          <p className="font-mono text-[11px] uppercase text-accent m-0"
             style={{ letterSpacing: '0.08em' }}>
            Planned spend ({formatMoney(draftTotal)}) exceeds planned income ({formatMoney(draftIncomeTotal)}).
          </p>
        </div>
      )}

      {/* Budget editor — paper panel */}
      <div className="bg-paper border border-rule rounded-md overflow-hidden shadow-[0_1px_2px_rgba(26,22,20,0.03)]">
        {/* Column key: spent this month · budgeted */}
        <div className="grid grid-cols-[1fr_90px_140px] gap-3 items-baseline px-6 py-1.5 border-b border-rule bg-paper-edge/40 font-mono text-[10px] uppercase text-muted"
             style={{ letterSpacing: '0.12em' }}>
          <span>{MONTH_NAMES[ym.month - 1]} budget</span>
          <span className="text-right">Spent</span>
          <span className="text-right pr-2">Budgeted</span>
        </div>
        {[...grouped.entries()].map(([broad, midMap], i) => {
          const broadCats = [...midMap.values()].flat();
          const broadTotal = broadCats.reduce((s, c) => {
            const n = parseFloat(drafts.get(c.detailed) ?? '0');
            return s + (Number.isFinite(n) ? n : 0);
          }, 0);
          const broadSpent = broadCats.reduce((s, c) => s + (spendMap.get(c.detailed) ?? 0), 0);
          return (
            <div key={broad} className={i > 0 ? 'border-t border-rule' : ''}>
              <div className="grid grid-cols-[1fr_90px_140px] gap-3 items-baseline px-3 py-2.5 bg-paper-edge/50 border-b border-rule">
                <span className="font-display font-semibold text-[14px] text-ink"
                      style={{ letterSpacing: '-0.01em' }}>{broad}</span>
                <span className={'font-mono text-[12px] tabular-nums text-right ' + (broadSpent > broadTotal && broadTotal > 0 ? 'text-accent' : 'text-ink-soft')}>{formatMoney(broadSpent)}</span>
                <span className="font-mono text-[12px] text-muted tabular-nums text-right pr-2">{formatMoney(broadTotal)}</span>
              </div>
              {[...midMap.entries()].map(([mid, cats], midIdx) => (
                <div key={mid} className={midIdx > 0 ? 'border-t border-rule-soft' : ''}>
                  <div className="px-4 py-1.5 font-mono text-[10px] uppercase text-muted bg-paper-edge/15"
                       style={{ letterSpacing: '0.12em' }}>{mid}</div>
                  {cats.map((c, catIdx) => {
                    const spent = spendMap.get(c.detailed) ?? 0;
                    const budgeted = parseFloat(drafts.get(c.detailed) ?? '0') || 0;
                    return (
                    <div key={c.detailed}
                         className={'grid grid-cols-[1fr_90px_140px] gap-3 items-center px-6 py-1.5 border-t border-rule-soft ' + (catIdx % 2 === 1 ? 'bg-paper-edge/15' : '')}>
                      <span className="font-serif text-[14px] text-ink">{c.detailed}</span>
                      <span className={'font-mono text-[12px] tabular-nums text-right ' + (spent > budgeted && budgeted > 0 ? 'text-accent' : spent > 0 ? 'text-ink-soft' : 'text-muted/50')}
                            title="Spent this month">{spent > 0 ? formatMoney(spent) : '—'}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[12px] text-muted">$</span>
                        <input
                          type="number" step="0.01" min="0"
                          value={drafts.get(c.detailed) ?? '0'}
                          onChange={e => setDraft(c.detailed, e.target.value)}
                          className="w-full bg-paper border border-rule rounded-sm px-2 py-1 text-[13px] font-mono text-ink text-right tabular-nums focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="font-mono text-[12px] text-muted">
          Total: <span className="text-ink tabular-nums">{formatMoney(draftTotal)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={resetDrafts}
                  className="font-mono text-[11px] uppercase text-muted hover:text-ink transition-colors px-3 py-1.5"
                  style={{ letterSpacing: '0.08em' }}>Reset</button>
          <button onClick={saveBudgets}
                  className="font-mono text-[11px] uppercase text-accent border border-accent hover:bg-accent hover:text-paper rounded-sm px-3 py-1.5 transition-colors"
                  style={{ letterSpacing: '0.08em' }}>Save budgets</button>
        </div>
      </div>

      {/* Income editor */}
      <div className="bg-paper border border-rule rounded-md px-3 py-2.5 flex items-baseline justify-between gap-3 flex-wrap shadow-[0_1px_2px_rgba(26,22,20,0.03)] mt-8">
        <div>
          <h2 className="font-display font-semibold text-[20px] text-ink m-0"
              style={{ letterSpacing: '-0.02em' }}>Income</h2>
          <p className="font-serif text-[12px] text-muted m-0 mt-0.5">
            Monthly income by source. Drives the Income card and net cash flow on the Dashboard.
          </p>
        </div>
      </div>

      <div className="bg-paper border border-rule rounded-md overflow-hidden shadow-[0_1px_2px_rgba(26,22,20,0.03)]">
        {incomeDrafts.length === 0 ? (
          <div className="py-6 text-center font-serif italic text-muted text-[13px]">No income sources yet.</div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_130px_150px_60px] gap-3 px-3 py-1.5 border-b border-rule bg-paper-edge/40 font-mono text-[10px] uppercase text-muted" style={{ letterSpacing: '0.12em' }}>
              <span>Source</span><span className="text-right">Monthly</span><span>Effective from</span><span></span>
            </div>
            {incomeDrafts.map((inc, idx) => (
              <div key={inc.id}
                   className={'grid grid-cols-[1fr_130px_150px_60px] gap-3 items-center px-3 py-2 ' + (idx > 0 ? 'border-t border-rule-soft ' : '') + (idx % 2 === 1 ? 'bg-paper-edge/25' : '')}>
                <input value={inc.source} onChange={e => {
                  const v = e.target.value;
                  setIncomeDrafts(prev => prev.map((p, i) => i === idx ? { ...p, source: v } : p));
                }} placeholder="Source"
                  className="bg-paper border border-rule rounded-sm px-2 py-1 text-[13px] font-serif text-ink focus:outline-none focus:border-accent" />
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[12px] text-muted">$</span>
                  <input type="number" step="0.01" min="0" value={inc.monthly_amount}
                         onChange={e => {
                           const v = parseFloat(e.target.value);
                           setIncomeDrafts(prev => prev.map((p, i) => i === idx ? { ...p, monthly_amount: Number.isFinite(v) ? v : 0 } : p));
                         }}
                         className="w-full bg-paper border border-rule rounded-sm px-2 py-1 text-[13px] font-mono text-ink text-right tabular-nums focus:outline-none focus:border-accent" />
                </div>
                <input type="date" value={inc.effective_from}
                       onChange={e => {
                         const v = e.target.value;
                         setIncomeDrafts(prev => prev.map((p, i) => i === idx ? { ...p, effective_from: v } : p));
                       }}
                       title="Income counts for months on or after this date"
                       className="bg-paper border border-rule rounded-sm px-2 py-1 text-[12px] font-mono text-ink focus:outline-none focus:border-accent" />
                <button onClick={() => setIncomeDrafts(prev => prev.filter((_, i) => i !== idx))}
                        className="font-mono text-[10px] uppercase text-muted hover:text-accent transition-colors text-right"
                        style={{ letterSpacing: '0.08em' }}>Remove</button>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => setIncomeDrafts(prev => [...prev, { id: crypto.randomUUID(), source: '', monthly_amount: 0, effective_from: todayIso() }])}
                  className="font-mono text-[11px] uppercase text-muted hover:text-accent bg-paper border border-rule hover:border-accent rounded-sm px-3 py-1.5 transition-colors"
                  style={{ letterSpacing: '0.08em' }}>+ Add source</button>
          <span className="font-mono text-[12px] text-muted">
            Total: <span className="text-ink tabular-nums">{formatMoney(draftIncomeTotal)}</span>
          </span>
        </div>
        <button onClick={saveIncomes}
                className="font-mono text-[11px] uppercase text-accent border border-accent hover:bg-accent hover:text-paper rounded-sm px-3 py-1.5 transition-colors"
                style={{ letterSpacing: '0.08em' }}>Save income</button>
      </div>
    </div>
  );
}

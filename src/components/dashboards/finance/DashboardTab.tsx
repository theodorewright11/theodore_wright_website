import { useMemo, useState } from 'react';
import type { Transaction, Budget, Income } from './types';
import { CATEGORIES, UNCATEGORIZED, lookupCategory, groupByBroadMid } from './categories';
import {
  type YearMonth, ymKey, shiftMonth, todayYM,
  txsInMonth, totalSpend, spendByCategory,
  currentBudgets, totalBudget,
  totalIncome,
  variance, formatMoney, formatPercent,
} from './compute';

type Props = {
  transactions: Transaction[];
  budgets: Budget[];
  incomes: Income[];
  initialMonth?: YearMonth;
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function DashboardTab({ transactions, budgets, incomes, initialMonth }: Props) {
  const [ym, setYm] = useState<YearMonth>(initialMonth ?? todayYM());

  const data = useMemo(() => {
    const monthTxs = txsInMonth(transactions, ym);
    const spent = totalSpend(monthTxs);
    const spendMap = spendByCategory(monthTxs);
    const budgetMap = currentBudgets(budgets, ym);
    const budget = totalBudget(budgets, ym);
    const income = totalIncome(incomes, ym);
    return { monthTxs, spent, spendMap, budgetMap, budget, income };
  }, [transactions, budgets, incomes, ym]);

  const monthLabel = `${MONTH_NAMES[ym.month - 1]} ${ym.year}`;
  const isCurrentMonth = ymKey(ym) === ymKey(todayYM());

  const overall = variance(data.spent, data.budget);
  const net = data.income - data.spent;

  // Build display rows grouped Broad → Mid → Detailed.
  const grouped = groupByBroadMid();
  const allCategoryKeys = new Set<string>([...CATEGORIES.map(c => c.detailed), ...data.spendMap.keys()]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  function toggle(broad: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(broad)) next.delete(broad); else next.add(broad);
      return next;
    });
  }

  const uncategorizedSpent = data.spendMap.get(UNCATEGORIZED) ?? 0;

  return (
    <div>
      {/* Month selector */}
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-2">
          <button onClick={() => setYm(shiftMonth(ym, -1))}
                  className="font-mono text-[11px] uppercase text-muted hover:text-accent border border-rule hover:border-accent rounded-sm px-2 py-1 transition-colors"
                  style={{ letterSpacing: '0.08em' }}>← Prev</button>
          <h2 className="font-display font-semibold text-[28px] text-ink m-0 px-3"
              style={{ letterSpacing: '-0.02em' }}>{monthLabel}</h2>
          <button onClick={() => setYm(shiftMonth(ym, 1))}
                  className="font-mono text-[11px] uppercase text-muted hover:text-accent border border-rule hover:border-accent rounded-sm px-2 py-1 transition-colors"
                  style={{ letterSpacing: '0.08em' }}>Next →</button>
        </div>
        {!isCurrentMonth && (
          <button onClick={() => setYm(todayYM())}
                  className="font-mono text-[11px] uppercase text-accent hover:underline transition-colors"
                  style={{ letterSpacing: '0.08em' }}>This month</button>
        )}
      </div>

      {/* Headline metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
        <Card label="Spent" value={formatMoney(data.spent)} />
        <Card label="Budgeted" value={formatMoney(data.budget)} />
        <Card label="Variance" value={formatMoney(overall.dollars)}
              tone={overall.dollars >= 0 ? 'good' : 'bad'} />
        <Card label="Income" value={formatMoney(data.income)} />
        <Card label="Net cash flow" value={formatMoney(net)}
              tone={net >= 0 ? 'good' : 'bad'} />
      </div>

      {/* Category breakdown */}
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display font-semibold text-[18px] text-ink m-0"
            style={{ letterSpacing: '-0.01em' }}>By category</h3>
        <span className="font-mono text-[11px] uppercase text-muted"
              style={{ letterSpacing: '0.08em' }}>
          {data.monthTxs.length} {data.monthTxs.length === 1 ? 'transaction' : 'transactions'}
        </span>
      </div>

      <div className="border-t border-rule">
        {[...grouped.entries()].map(([broad, midMap]) => {
          const broadCats = [...midMap.values()].flat();
          const broadSpent = broadCats.reduce((s, c) => s + (data.spendMap.get(c.detailed) ?? 0), 0);
          const broadBudget = broadCats.reduce((s, c) => s + (data.budgetMap.get(c.detailed) ?? 0), 0);
          const isCollapsed = collapsed.has(broad);
          const broadVar = variance(broadSpent, broadBudget);

          return (
            <div key={broad} className="border-b border-rule">
              <button onClick={() => toggle(broad)}
                      className="w-full flex items-center justify-between gap-3 px-2 py-2.5 hover:bg-paper-edge/40 transition-colors text-left">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] text-muted">{isCollapsed ? '▸' : '▾'}</span>
                  <span className="font-display font-semibold text-[15px] text-ink"
                        style={{ letterSpacing: '-0.01em' }}>{broad}</span>
                </div>
                <div className="flex items-baseline gap-4 font-mono text-[12px]">
                  <span className="text-ink-soft">{formatMoney(broadSpent)}</span>
                  <span className="text-muted">/ {formatMoney(broadBudget)}</span>
                  <span className={broadVar.dollars >= 0 ? 'text-ink-soft' : 'text-accent'}>
                    {broadVar.dollars >= 0 ? '+' : ''}{formatMoney(broadVar.dollars)}
                  </span>
                </div>
              </button>
              {!isCollapsed && (
                <div>
                  {broadCats.map(cat => {
                    const spent = data.spendMap.get(cat.detailed) ?? 0;
                    const budget = data.budgetMap.get(cat.detailed) ?? 0;
                    const v = variance(spent, budget);
                    const pctUsed = budget > 0 ? Math.min(spent / budget, 1.5) : 0;
                    const isOver = budget > 0 && spent > budget;
                    return (
                      <div key={cat.detailed} className="grid grid-cols-[1fr_minmax(140px,1.2fr)_minmax(180px,1fr)] items-center gap-3 px-6 py-2 border-t border-rule-soft">
                        <div className="min-w-0">
                          <div className="font-serif text-[14px] text-ink truncate">{cat.detailed}</div>
                          <div className="font-mono text-[10px] uppercase text-muted truncate"
                               style={{ letterSpacing: '0.08em' }}>{cat.mid}</div>
                        </div>
                        <div className="font-mono text-[12px] text-ink-soft text-right whitespace-nowrap">
                          {formatMoney(spent)} <span className="text-muted">/ {formatMoney(budget)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-paper-edge rounded-sm overflow-hidden">
                            {budget > 0 && (
                              <div className={'h-full ' + (isOver ? 'bg-accent' : 'bg-accent-soft')}
                                   style={{ width: `${Math.min(pctUsed * 100, 100)}%` }} />
                            )}
                          </div>
                          <span className={'font-mono text-[11px] tabular-nums w-14 text-right ' + (v.dollars >= 0 ? 'text-muted' : 'text-accent')}>
                            {v.percent === null ? '—' : formatPercent(v.percent, 0)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {uncategorizedSpent > 0 && (
          <div className="border-b border-rule">
            <div className="flex items-center justify-between gap-3 px-2 py-2.5 bg-accent/5">
              <span className="font-display font-semibold text-[15px] text-accent"
                    style={{ letterSpacing: '-0.01em' }}>Uncategorized</span>
              <span className="font-mono text-[12px] text-accent">{formatMoney(uncategorizedSpent)}</span>
            </div>
          </div>
        )}
      </div>

      {transactions.length === 0 && (
        <div className="mt-8 py-10 text-center font-serif italic text-muted">
          <p className="m-0">No transactions yet. Switch to the Transactions tab to add one.</p>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const valueColor = tone === 'good' ? 'text-ink' : tone === 'bad' ? 'text-accent' : 'text-ink';
  return (
    <div className="border border-rule rounded-sm px-3 py-3 bg-paper">
      <div className="font-mono text-[10px] uppercase text-muted mb-1"
           style={{ letterSpacing: '0.12em' }}>{label}</div>
      <div className={'font-display font-semibold text-[20px] ' + valueColor}
           style={{ letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}

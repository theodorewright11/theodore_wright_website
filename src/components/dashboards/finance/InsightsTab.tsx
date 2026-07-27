import { useEffect, useMemo, useRef, useState } from 'react';
import type { Transaction, Budget, Income, CategoryEntry } from './types';
import { UNCATEGORIZED } from './categories';
import {
  type YearMonth, todayYM, ymKey, shiftMonth,
  txsInMonth, totalSpend, totalBudget, totalIncome,
  spendByCategory, spendByAccount, spendByBroad,
  monthsRange, earliestTxYM, mean, median, rollingAverage, daysInMonth,
  formatMoney, formatPercent,
} from './compute';

type Props = {
  transactions: Transaction[];
  budgets: Budget[];
  incomes: Income[];
  categories: CategoryEntry[];
};

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monthShort = (ym: YearMonth) => `${MONTH_ABBR[ym.month - 1]} ${String(ym.year).slice(2)}`;
const monthLong  = (ym: YearMonth) => `${['January','February','March','April','May','June','July','August','September','October','November','December'][ym.month - 1]} ${ym.year}`;

// Categorical palette for broad categories — mid-tone hues chosen to stay
// legible on every theme (light paper and dark alike). Not theme-swapped;
// categorical identity should be stable across palettes.
const BROAD_COLORS = ['#b5673f','#5f8a6a','#5b82a6','#9b6f9c','#c19a4a','#a85f6e','#6f8598','#8a8577'];

const BALANCE_KEY = 'tw-finance-balance-v1';

type Win = 6 | 12 | 24 | 'all';

export default function InsightsTab({ transactions, budgets, incomes, categories }: Props) {
  const [win, setWin] = useState<Win>(12);

  const today = todayYM();
  const earliest = earliestTxYM(transactions) ?? today;

  // Insights preferences (device-local — not part of the synced sheet).
  const [excludePartial, setExcludePartial] = useState(true);
  const [recurringKeys, setRecurringKeys] = useState<Set<string>>(new Set());
  const recurringLoaded = useRef(false);
  const [showRecurringConfig, setShowRecurringConfig] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ep = window.localStorage.getItem('tw-finance-exclude-partial-v1');
    if (ep !== null) setExcludePartial(ep === '1');
    const rk = window.localStorage.getItem('tw-finance-recurring-v1');
    if (rk) { try { const a = JSON.parse(rk); if (Array.isArray(a)) { setRecurringKeys(new Set(a)); recurringLoaded.current = true; } } catch { /* ignore */ } }
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('tw-finance-exclude-partial-v1', excludePartial ? '1' : '0');
  }, [excludePartial]);

  // The earliest month is "partial" when the first transaction lands mid-month
  // (e.g. tracking started Aug 16) — that month skews every monthly stat, so
  // it can be dropped from all Insights aggregations.
  const earliestDate = useMemo(() => transactions.reduce((m, t) => !m || t.date < m ? t.date : m, ''), [transactions]);
  const firstMonthPartial = earliestDate ? parseInt(earliestDate.slice(8, 10), 10) > 1 : false;

  // Recurring set defaults to everything under the "Obligations" broad; the
  // user can override which categories count as recurring.
  const defaultRecurring = useMemo(() => new Set(categories.filter(c => c.broad === 'Obligations').map(c => c.detailed)), [categories]);
  const effectiveRecurring = recurringLoaded.current ? recurringKeys : defaultRecurring;
  function toggleRecurring(key: string) {
    const next = new Set(recurringLoaded.current ? recurringKeys : defaultRecurring);
    if (next.has(key)) next.delete(key); else next.add(key);
    recurringLoaded.current = true;
    setRecurringKeys(next);
    if (typeof window !== 'undefined') window.localStorage.setItem('tw-finance-recurring-v1', JSON.stringify([...next]));
  }

  const months = useMemo(() => {
    const start = win === 'all'
      ? earliest
      : laterYM(earliest, shiftMonth(today, -(win - 1)));
    let ms = monthsRange(start, today);
    // Drop the earliest month only when it's the global (partial) first month.
    if (excludePartial && firstMonthPartial && ms.length && ymKey(ms[0]) === ymKey(earliest)) ms = ms.slice(1);
    return ms;
  }, [win, earliest.year, earliest.month, today.year, today.month, excludePartial, firstMonthPartial]);

  // Per-month rollup over the window.
  const data = useMemo(() => months.map(ym => {
    const mtx = txsInMonth(transactions, ym);
    const spent = totalSpend(mtx);
    const budget = totalBudget(budgets, ym);
    const income = totalIncome(incomes, ym);
    return { ym, txs: mtx, spent, budget, income, net: income - spent };
  }), [months, transactions, budgets, incomes]);

  const curKey = ymKey(today);
  const completed = data.filter(d => ymKey(d.ym) !== curKey);
  const statsBase = completed.length ? completed : data;

  const spents = statsBase.map(d => d.spent);
  const avgSpend = mean(spents);
  const medSpend = median(spents);
  const highest = statsBase.reduce<null | typeof statsBase[number]>((m, d) => !m || d.spent > m.spent ? d : m, null);
  const lowest  = statsBase.reduce<null | typeof statsBase[number]>((m, d) => !m || d.spent < m.spent ? d : m, null);

  const curRow = data.find(d => ymKey(d.ym) === curKey);
  const dayOfMonth = ymKey(today) === curKey ? new Date().getDate() : daysInMonth(today);
  const projectedCur = curRow && dayOfMonth > 0 ? curRow.spent / dayOfMonth * daysInMonth(today) : null;
  const pace = projectedCur !== null && avgSpend ? projectedCur - avgSpend : null;

  const rolling = rollingAverage(data.map(d => d.spent), 3);

  // Ordered broad list (taxonomy order) + Uncategorized, with a stable color.
  const broads = useMemo(() => {
    const seen = new Set<string>(); const out: string[] = [];
    for (const c of categories) if (!seen.has(c.broad)) { seen.add(c.broad); out.push(c.broad); }
    out.push(UNCATEGORIZED);
    return out;
  }, [categories]);
  const colorOf = (broad: string) => BROAD_COLORS[Math.max(0, broads.indexOf(broad)) % BROAD_COLORS.length];

  // ── Section data ────────────────────────────────────────────────────────

  // Window-wide totals by broad (composition) and by account.
  const windowTxs = useMemo(() => data.flatMap(d => d.txs), [data]);
  const windowSpent = totalSpend(windowTxs);
  const broadTotals = useMemo(() => {
    const m = spendByBroad(windowTxs, categories);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [windowTxs, categories]);
  const accountTotals = useMemo(() => {
    const m = spendByAccount(windowTxs);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [windowTxs]);

  // Month-over-month movers: the two most recent months in the window.
  const movers = useMemo(() => {
    if (data.length < 2) return null;
    const cur = data[data.length - 1], prev = data[data.length - 2];
    const cs = spendByCategory(cur.txs, categories), ps = spendByCategory(prev.txs, categories);
    const keys = new Set([...cs.keys(), ...ps.keys()]);
    const rows = [...keys].map(k => {
      const c = cs.get(k) ?? 0, p = ps.get(k) ?? 0;
      return { key: k, cur: c, prev: p, delta: c - p };
    }).filter(r => Math.abs(r.delta) >= 0.005)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return { cur: cur.ym, prev: prev.ym, rows };
  }, [data, categories]);

  // Composition per month (stacked by broad).
  const composition = useMemo(() => data.map(d => {
    const m = spendByBroad(d.txs, categories);
    return { ym: d.ym, total: d.spent, segments: broads.map(b => ({ broad: b, value: m.get(b) ?? 0 })).filter(s => s.value > 0) };
  }), [data, categories, broads]);

  // Recurring vs discretionary, per month — split by the configurable set.
  const recurring = useMemo(() => data.map(d => {
    let rec = 0, dis = 0;
    for (const t of d.txs) {
      if (effectiveRecurring.has(t.category)) rec += t.amount; else dis += t.amount;
    }
    return { ym: d.ym, rec, dis };
  }), [data, effectiveRecurring]);
  const recTotal = recurring.reduce((s, r) => s + r.rec, 0);
  const disTotal = recurring.reduce((s, r) => s + r.dis, 0);

  // Budget adherence: overall % used per month + per-broad summary.
  const adherence = useMemo(() => data.map(d => ({
    ym: d.ym, pct: d.budget > 0 ? d.spent / d.budget : null, spent: d.spent, budget: d.budget,
  })), [data]);

  // Biggest individual transactions in the window.
  const biggest = useMemo(() =>
    [...windowTxs].sort((a, b) => b.amount - a.amount).slice(0, 10), [windowTxs]);

  // Cumulative net (savings trajectory) across the window.
  const cumulativeNet = useMemo(() => {
    let run = 0; return data.map(d => (run += d.net));
  }, [data]);
  const totalNet = data.reduce((s, d) => s + d.net, 0);
  const avgNet = mean(statsBase.map(d => d.net));

  // Runway (device-local balance input; not part of the synced sheet).
  const [balance, setBalance] = useState('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setBalance(window.localStorage.getItem(BALANCE_KEY) ?? '');
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (balance) window.localStorage.setItem(BALANCE_KEY, balance);
    else window.localStorage.removeItem(BALANCE_KEY);
  }, [balance]);
  const balanceNum = parseFloat(balance);
  const burn = avgNet !== null && avgNet < 0 ? -avgNet : 0;
  const runwayMonths = burn > 0 && Number.isFinite(balanceNum) && balanceNum > 0 ? balanceNum / burn : null;

  if (transactions.length === 0) {
    return (
      <div className="bg-paper border border-rule rounded-md py-16 text-center shadow-[0_1px_2px_rgba(26,22,20,0.03)]">
        <p className="font-display text-[20px] text-ink m-0 mb-2" style={{ letterSpacing: '-0.01em' }}>No data yet</p>
        <p className="font-serif text-[14px] text-muted m-0">Add transactions and insights will populate here.</p>
      </div>
    );
  }

  const maxSpend = Math.max(1, ...data.map(d => Math.max(d.spent, d.budget)), ...rolling.map(r => r ?? 0));

  return (
    <div className="space-y-5">
      {/* Window selector */}
      <div className="bg-paper border border-rule rounded-md px-3 py-2 flex items-center justify-between gap-3 flex-wrap shadow-[0_1px_2px_rgba(26,22,20,0.03)]">
        <h2 className="font-display font-semibold text-[20px] text-ink m-0" style={{ letterSpacing: '-0.02em' }}>Insights</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {firstMonthPartial && (
            <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-muted cursor-pointer" style={{ letterSpacing: '0.06em' }}
                   title={`${monthLong(earliest)} started mid-month, so it drags monthly stats down. Excluded by default.`}>
              <input type="checkbox" checked={excludePartial} onChange={e => setExcludePartial(e.target.checked)} />
              Exclude {monthShort(earliest)}
            </label>
          )}
          <div className="flex items-center gap-1">
            {([6, 12, 24, 'all'] as Win[]).map(w => (
              <button key={String(w)} onClick={() => setWin(w)}
                className={'font-mono text-[10px] uppercase px-2.5 py-1 rounded-sm border transition-colors ' + (
                  win === w ? 'text-accent border-accent bg-accent/5' : 'text-muted border-rule hover:text-accent hover:border-accent')}
                style={{ letterSpacing: '0.08em' }}>{w === 'all' ? 'All' : `${w}mo`}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Avg / month" value={fmt(avgSpend)} />
        <Stat label="Median / month" value={fmt(medSpend)} />
        <Stat label="Highest month" value={highest ? formatMoney(highest.spent) : '—'} sub={highest ? monthShort(highest.ym) : undefined} />
        <Stat label="Lowest month" value={lowest ? formatMoney(lowest.spent) : '—'} sub={lowest ? monthShort(lowest.ym) : undefined} />
        <Stat label="This month (projected)" value={projectedCur !== null ? formatMoney(projectedCur) : '—'}
              sub={pace !== null ? `${pace >= 0 ? '+' : ''}${formatMoney(pace)} vs avg` : undefined}
              tone={pace !== null ? (pace > 0 ? 'bad' : 'good') : undefined} />
      </div>

      {/* Monthly spending trend + 3-mo rolling average + budget reference */}
      <Section title="Monthly spending" note="Bars = spent · line = 3-month rolling average · dashes = that month's budget">
        <TrendChart data={data} rolling={rolling} max={maxSpend} colorOf={() => 'rgb(var(--color-accent))'} />
      </Section>

      {/* Category composition over time */}
      <Section title="Where it goes, over time" note="Spend stacked by broad category each month">
        <StackedChart months={composition} broads={broads} colorOf={colorOf} />
        <Legend broads={broadTotals.map(([b]) => b)} colorOf={colorOf} />
        <div className="mt-4 space-y-1.5">
          {broadTotals.map(([broad, val]) => (
            <HBar key={broad} label={broad} value={val} max={broadTotals[0]?.[1] ?? 1}
                  color={colorOf(broad)} right={`${formatMoney(val)} · ${formatPercent(windowSpent ? val / windowSpent : null)}`} />
          ))}
        </div>
      </Section>

      {/* Month-over-month movers */}
      {movers && movers.rows.length > 0 && (
        <Section title="Biggest movers" note={`${monthLong(movers.cur)} vs ${monthLong(movers.prev)} — change by category`}>
          <div className="space-y-1.5">
            {movers.rows.slice(0, 10).map(r => (
              <DivergingBar key={r.key} label={r.key} delta={r.delta}
                max={Math.max(...movers.rows.map(x => Math.abs(x.delta)), 1)}
                right={`${formatMoney(r.prev)} → ${formatMoney(r.cur)}`} />
            ))}
          </div>
        </Section>
      )}

      {/* Net cash flow + savings trajectory */}
      <Section title="Net cash flow" note="Income − spending each month (up = surplus, down = deficit)">
        <NetChart data={data} />
        <div className="grid grid-cols-3 gap-3 mt-4">
          <Stat label="Total over window" value={fmt(totalNet)} tone={totalNet >= 0 ? 'good' : 'bad'} small />
          <Stat label="Avg net / month" value={fmt(avgNet)} tone={(avgNet ?? 0) >= 0 ? 'good' : 'bad'} small />
          <Stat label="End cumulative" value={fmt(cumulativeNet[cumulativeNet.length - 1] ?? 0)} tone={(cumulativeNet[cumulativeNet.length - 1] ?? 0) >= 0 ? 'good' : 'bad'} small />
        </div>
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase text-muted mb-1.5" style={{ letterSpacing: '0.12em' }}>Cumulative (savings trajectory)</p>
          <MiniLine values={cumulativeNet} labels={data.map(d => monthShort(d.ym))} />
        </div>
      </Section>

      {/* Budget adherence */}
      <Section title="Budget adherence" note="% of total monthly budget used (100% = on budget)">
        <PctChart rows={adherence} />
      </Section>

      {/* Needs vs wants */}
      <Section title="Needs vs wants" note="Essentials you have to pay vs everything you choose — configure which categories are needs">
        <div className="flex justify-end mb-2">
          <button onClick={() => setShowRecurringConfig(v => !v)}
            className="font-mono text-[10px] uppercase text-muted hover:text-accent border border-rule hover:border-accent rounded-sm px-2 py-1 transition-colors"
            style={{ letterSpacing: '0.08em' }}>{showRecurringConfig ? 'Done' : 'Configure categories'}</button>
        </div>
        {showRecurringConfig && (
          <div className="mb-4 border border-rule rounded-md p-3 bg-paper-edge/20">
            <p className="font-serif text-[12px] text-muted m-0 mb-2">Tick the categories that are <span className="text-ink-soft font-semibold">needs</span> (essentials you have to pay). Everything unticked is a want. Saved on this device.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
              {categories.map(c => (
                <label key={c.detailed} className="flex items-center gap-1.5 font-serif text-[12px] text-ink cursor-pointer">
                  <input type="checkbox" checked={effectiveRecurring.has(c.detailed)} onChange={() => toggleRecurring(c.detailed)} />
                  <span className="truncate" title={`${c.broad} → ${c.mid}`}>{c.detailed}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <StackedChart
          months={recurring.map(r => ({ ym: r.ym, total: r.rec + r.dis, segments: [
            { broad: 'Needs', value: r.rec }, { broad: 'Wants', value: r.dis },
          ].filter(s => s.value > 0) }))}
          broads={['Needs', 'Wants']}
          colorOf={(b) => b === 'Needs' ? '#6f8598' : 'rgb(var(--color-accent))'} />
        <Legend broads={['Needs', 'Wants']} colorOf={(b) => b === 'Needs' ? '#6f8598' : 'rgb(var(--color-accent))'} />
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Stat label="Needs (window)" value={formatMoney(recTotal)} sub={formatPercent(windowSpent ? recTotal / windowSpent : null) + ' of spend'} small />
          <Stat label="Wants (window)" value={formatMoney(disTotal)} sub={formatPercent(windowSpent ? disTotal / windowSpent : null) + ' of spend'} small />
        </div>
      </Section>

      {/* Spending by account */}
      <Section title="By account" note="Where the money flows out">
        <div className="space-y-1.5">
          {accountTotals.map(([acct, val]) => (
            <HBar key={acct} label={acct} value={val} max={accountTotals[0]?.[1] ?? 1}
                  color="rgb(var(--color-accent-soft))" right={`${formatMoney(val)} · ${formatPercent(windowSpent ? val / windowSpent : null)}`} />
          ))}
        </div>
      </Section>

      {/* Biggest transactions */}
      <Section title="Biggest transactions" note={`Top ${biggest.length} in this window`}>
        <div className="bg-paper border border-rule rounded-md overflow-hidden">
          {biggest.map((t, i) => (
            <div key={t.id} className={'grid grid-cols-[80px_1fr_auto] gap-3 items-baseline px-3 py-2 ' + (i > 0 ? 'border-t border-rule-soft ' : '') + (i % 2 ? 'bg-paper-edge/25' : '')}>
              <span className="font-mono text-[11px] text-muted tabular-nums">{t.date.slice(5)}</span>
              <span className="font-serif text-[13px] text-ink truncate" title={`${t.item} · ${t.category || 'Uncategorized'}`}>{t.item}</span>
              <span className="font-mono text-[13px] text-ink tabular-nums text-right">{formatMoney(t.amount)}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Runway */}
      <Section title="Runway" note="How long your money lasts at your recent net burn rate">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="font-mono text-[11px] uppercase text-muted" style={{ letterSpacing: '0.08em' }}>Current balance</label>
          <div className="flex items-center gap-1">
            <span className="font-mono text-[13px] text-muted">$</span>
            <input type="number" step="0.01" min="0" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00"
                   className="w-32 bg-paper border border-rule rounded-sm px-2 py-1 text-[13px] font-mono text-ink text-right tabular-nums focus:outline-none focus:border-accent" />
          </div>
        </div>
        <p className="font-serif text-[14px] text-ink-soft mt-3 mb-0">
          {avgNet === null ? 'Not enough history yet.'
            : burn === 0 ? <>You're net <span className="text-ink font-semibold">positive</span> on average ({formatMoney(avgNet)}/mo) — at this rate savings grow rather than run down.</>
            : runwayMonths === null ? <>Enter your current balance to estimate runway. You're burning about <span className="text-accent font-semibold">{formatMoney(burn)}/mo</span>.</>
            : <>At ~{formatMoney(burn)}/mo net burn, your balance lasts about <span className="text-accent font-semibold">{runwayMonths.toFixed(1)} months</span> (~{monthLong(shiftMonth(today, Math.round(runwayMonths)))}).</>}
        </p>
        <p className="font-mono text-[10px] text-muted mt-2 mb-0" style={{ letterSpacing: '0.04em' }}>Balance is stored only on this device — it isn't written to the sheet.</p>
      </Section>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function laterYM(a: YearMonth, b: YearMonth): YearMonth {
  return (a.year * 12 + a.month) >= (b.year * 12 + b.month) ? a : b;
}
const fmt = (n: number | null) => n === null ? '—' : formatMoney(n);

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="bg-paper border border-rule rounded-md shadow-[0_1px_2px_rgba(26,22,20,0.03)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-rule bg-paper-edge/40">
        <h3 className="font-display font-semibold text-[15px] text-ink m-0" style={{ letterSpacing: '-0.01em' }}>{title}</h3>
        {note && <p className="font-serif text-[12px] text-muted m-0 mt-0.5">{note}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub, tone, small }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad'; small?: boolean }) {
  const color = tone === 'bad' ? 'text-accent' : 'text-ink';
  return (
    <div className="border border-rule rounded-md px-3 py-2.5 bg-paper shadow-[0_1px_2px_rgba(26,22,20,0.03)]">
      <div className="font-mono text-[10px] uppercase text-muted mb-1" style={{ letterSpacing: '0.1em' }}>{label}</div>
      <div className={'font-display font-semibold tabular-nums ' + (small ? 'text-[16px] ' : 'text-[20px] ') + color} style={{ letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div className="font-mono text-[10px] text-muted mt-0.5 tabular-nums">{sub}</div>}
    </div>
  );
}

// Vertical bars with a rolling-average line overlay + per-bar budget tick.
function TrendChart({ data, rolling, max, colorOf }: {
  data: { ym: YearMonth; spent: number; budget: number; income: number }[];
  rolling: (number | null)[]; max: number; colorOf: () => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const H = 180;
  return (
    <div className="relative">
      <div className="flex items-end gap-[3px]" style={{ height: H }}>
        {data.map((d, i) => (
          <div key={ymKey(d.ym)} className="relative flex-1 h-full flex items-end"
               onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(h => h === i ? null : h)}>
            <div className="w-full rounded-t-sm transition-colors" title={`${monthLong(d.ym)} — spent ${formatMoney(d.spent)}`}
                 style={{ height: `${(d.spent / max) * 100}%`, background: colorOf(), opacity: hover === null || hover === i ? 1 : 0.45 }} />
            {d.budget > 0 && (
              <div className="absolute left-0 right-0 border-t border-dashed" style={{ bottom: `${(d.budget / max) * 100}%`, borderColor: 'rgb(var(--color-muted))' }} />
            )}
          </div>
        ))}
      </div>
      {/* rolling average line — pinned to the bar area (not the labels below) */}
      <svg className="absolute top-0 left-0 right-0 pointer-events-none" width="100%" height={H} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height: H }}>
        <polyline fill="none" stroke="rgb(var(--color-accent-soft))" strokeWidth="0.7" vectorEffect="non-scaling-stroke"
          points={rolling.map((r, i) => r === null ? null : `${(i + 0.5) / data.length * 100},${100 - (r / max) * 100}`).filter(Boolean).join(' ')} />
      </svg>
      <div className="flex gap-[3px] mt-1">
        {data.map(d => <div key={ymKey(d.ym)} className="flex-1 text-center font-mono text-[9px] text-muted truncate">{data.length <= 14 ? monthShort(d.ym) : (d.ym.month === 1 ? d.ym.year : '')}</div>)}
      </div>
      {hover !== null && (
        <div className="mt-2 font-mono text-[11px] text-ink-soft tabular-nums">
          <span className="text-ink font-semibold">{monthLong(data[hover].ym)}</span>{'  '}
          spent {formatMoney(data[hover].spent)} · budget {formatMoney(data[hover].budget)} · income {formatMoney(data[hover].income)}
        </div>
      )}
    </div>
  );
}

// Diverging net-cash-flow bars around a zero baseline.
function NetChart({ data }: { data: { ym: YearMonth; net: number }[] }) {
  const maxAbs = Math.max(1, ...data.map(d => Math.abs(d.net)));
  const H = 160;
  return (
    <div>
      <div className="relative flex items-stretch gap-[3px]" style={{ height: H }}>
        <div className="absolute left-0 right-0 top-1/2 border-t border-rule" />
        {data.map(d => {
          const frac = Math.abs(d.net) / maxAbs * 50;
          const pos = d.net >= 0;
          return (
            <div key={ymKey(d.ym)} className="flex-1 relative" title={`${monthLong(d.ym)} — net ${formatMoney(d.net)}`}>
              <div className="absolute left-0 right-0 rounded-sm"
                   style={{ [pos ? 'bottom' : 'top']: '50%', height: `${frac}%`, background: pos ? 'rgb(var(--color-accent-soft))' : 'rgb(var(--color-accent))' } as React.CSSProperties} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-[3px] mt-1">
        {data.map(d => <div key={ymKey(d.ym)} className="flex-1 text-center font-mono text-[9px] text-muted truncate">{data.length <= 14 ? monthShort(d.ym) : (d.ym.month === 1 ? d.ym.year : '')}</div>)}
      </div>
    </div>
  );
}

// Stacked bars by category segment per month.
function StackedChart({ months, broads, colorOf }: {
  months: { ym: YearMonth; total: number; segments: { broad: string; value: number }[] }[];
  broads: string[]; colorOf: (b: string) => string;
}) {
  const max = Math.max(1, ...months.map(m => m.total));
  const H = 180;
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height: H }}>
        {months.map(m => (
          <div key={ymKey(m.ym)} className="flex-1 h-full flex flex-col justify-end" title={`${monthLong(m.ym)} — ${formatMoney(m.total)}`}>
            {m.segments.map(s => (
              <div key={s.broad} style={{ height: `${(s.value / max) * 100}%`, background: colorOf(s.broad) }} title={`${s.broad}: ${formatMoney(s.value)}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] mt-1">
        {months.map(m => <div key={ymKey(m.ym)} className="flex-1 text-center font-mono text-[9px] text-muted truncate">{months.length <= 14 ? monthShort(m.ym) : (m.ym.month === 1 ? m.ym.year : '')}</div>)}
      </div>
    </div>
  );
}

// % used per month vs 100% budget reference.
function PctChart({ rows }: { rows: { ym: YearMonth; pct: number | null; spent: number; budget: number }[] }) {
  const max = Math.max(1.2, ...rows.map(r => r.pct ?? 0));
  const H = 150;
  return (
    <div>
      <div className="relative flex items-end gap-[3px]" style={{ height: H }}>
        <div className="absolute left-0 right-0 border-t border-dashed border-muted" style={{ bottom: `${(1 / max) * 100}%` }} />
        {rows.map(r => (
          <div key={ymKey(r.ym)} className="flex-1 h-full flex items-end" title={`${monthLong(r.ym)} — ${r.pct === null ? 'no budget' : formatPercent(r.pct)} (${formatMoney(r.spent)} / ${formatMoney(r.budget)})`}>
            <div className="w-full rounded-t-sm" style={{ height: `${((r.pct ?? 0) / max) * 100}%`, background: (r.pct ?? 0) > 1 ? 'rgb(var(--color-accent))' : 'rgb(var(--color-accent-soft))' }} />
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] mt-1">
        {rows.map(r => <div key={ymKey(r.ym)} className="flex-1 text-center font-mono text-[9px] text-muted truncate">{rows.length <= 14 ? monthShort(r.ym) : (r.ym.month === 1 ? r.ym.year : '')}</div>)}
      </div>
    </div>
  );
}

// Single-series line chart (cumulative), with a zero baseline when it crosses.
function MiniLine({ values, labels }: { values: number[]; labels: string[] }) {
  const H = 120;
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const span = max - min || 1;
  const y = (v: number) => 100 - ((v - min) / span) * 100;
  return (
    <div>
      <svg width="100%" height={H} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height: H }}>
        {min < 0 && max > 0 && <line x1="0" x2="100" y1={y(0)} y2={y(0)} stroke="rgb(var(--color-rule))" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />}
        <polyline fill="none" stroke="rgb(var(--color-accent))" strokeWidth="1" vectorEffect="non-scaling-stroke"
          points={values.map((v, i) => `${values.length === 1 ? 50 : (i / (values.length - 1)) * 100},${y(v)}`).join(' ')} />
      </svg>
      <div className="flex justify-between font-mono text-[9px] text-muted mt-1">
        <span>{labels[0]}</span><span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

function HBar({ label, value, max, color, right }: { label: string; value: number; max: number; color: string; right?: string }) {
  return (
    <div className="grid grid-cols-[130px_1fr_auto] gap-3 items-center">
      <span className="font-serif text-[13px] text-ink truncate" title={label}>{label}</span>
      <div className="h-3 bg-rule/30 rounded-sm overflow-hidden">
        <div className="h-full rounded-sm" style={{ width: `${Math.max(2, (value / max) * 100)}%`, background: color }} />
      </div>
      {right && <span className="font-mono text-[11px] text-muted tabular-nums text-right whitespace-nowrap">{right}</span>}
    </div>
  );
}

// Diverging bar centered on zero: increases to the right (accent), decreases left (soft).
function DivergingBar({ label, delta, max, right }: { label: string; delta: number; max: number; right?: string }) {
  const frac = Math.min(50, Math.abs(delta) / max * 50);
  const up = delta >= 0;
  return (
    <div className="grid grid-cols-[130px_1fr_auto] gap-3 items-center">
      <span className="font-serif text-[13px] text-ink truncate" title={label}>{label}</span>
      <div className="relative h-3">
        <div className="absolute top-0 bottom-0 left-1/2 border-l border-rule" />
        <div className="absolute top-0 bottom-0 rounded-sm" style={{
          [up ? 'left' : 'right']: '50%', width: `${frac}%`,
          background: up ? 'rgb(var(--color-accent))' : 'rgb(var(--color-accent-soft))',
        } as React.CSSProperties} />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-right whitespace-nowrap" style={{ color: up ? 'rgb(var(--color-accent))' : 'rgb(var(--color-muted))' }}>
        {up ? '+' : ''}{formatMoney(delta)}{right ? ` · ${right}` : ''}
      </span>
    </div>
  );
}

function Legend({ broads, colorOf }: { broads: string[]; colorOf: (b: string) => string }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
      {broads.map(b => (
        <span key={b} className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: colorOf(b) }} />{b}
        </span>
      ))}
    </div>
  );
}

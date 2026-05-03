import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DOMAINS, SOURCES, SOURCE_LABEL, PRIORITY_LABEL, MET_LABEL,
  type Need, type Domain, type Source, type DataState,
} from './types';
import {
  loadState, saveState, clearState, initialState,
  needsToCsv, csvToNeeds, downloadFile,
} from './storage';
import {
  leverage, rated, rankedByLeverage,
  domainRollups, sourceGaps, distribution,
  perNeedSources, metShare,
} from './compute';

type Tab = 'needs' | 'insights';
type InsightView = 'leverage' | 'domain' | 'sources' | 'distribution';

export default function EmotionalWellbeingDashboard() {
  const [state, setState] = useState<DataState>(() => ({ version: 1, needs: [] }));
  const [tab, setTab] = useState<Tab>('needs');
  const [insightView, setInsightView] = useState<InsightView>('leverage');
  const [filterDomain, setFilterDomain] = useState<Domain | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  const updateNeed = (id: string, patch: Partial<Need>) => {
    setState(s => ({ ...s, needs: s.needs.map(n => n.id === id ? { ...n, ...patch } : n) }));
  };
  const updateSource = (id: string, source: Source, patch: Partial<{ actual: number; ideal: number }>) => {
    setState(s => ({
      ...s,
      needs: s.needs.map(n => n.id === id
        ? { ...n, sources: { ...n.sources, [source]: { ...n.sources[source], ...patch } } }
        : n),
    }));
  };
  const addNeed = () => {
    const id = `custom-${crypto.randomUUID().slice(0, 8)}`;
    setState(s => ({
      ...s,
      needs: [...s.needs, {
        id,
        name: 'New need',
        domain: 'Emotional',
        priority: 0,
        currentlyMet: 0,
        sources: structuredClone({
          self: { actual: 0, ideal: 0 },
          friends: { actual: 0, ideal: 0 },
          romantic: { actual: 0, ideal: 0 },
          activities: { actual: 0, ideal: 0 },
          career: { actual: 0, ideal: 0 },
          other: { actual: 0, ideal: 0 },
        }),
      }],
    }));
    setExpanded(prev => new Set(prev).add(id));
  };
  const removeNeed = (id: string) => {
    setState(s => ({ ...s, needs: s.needs.filter(n => n.id !== id) }));
  };
  const resetSeed = () => {
    if (!confirm('Reset all needs to the starter list and clear your ratings?')) return;
    clearState();
    setState(initialState());
  };
  const exportCsv = () => downloadFile('emotional-wellbeing.csv', needsToCsv(state.needs));
  const onImportClick = () => fileRef.current?.click();
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = csvToNeeds(text);
    if (parsed.length === 0) { alert('No valid rows found in that CSV.'); return; }
    if (!confirm(`Import ${parsed.length} need${parsed.length === 1 ? '' : 's'}? This will replace your current list.`)) {
      e.target.value = '';
      return;
    }
    setState({ version: 1, needs: parsed });
    e.target.value = '';
  };

  const visibleNeeds = useMemo(() => (
    filterDomain === 'all' ? state.needs : state.needs.filter(n => n.domain === filterDomain)
  ), [state.needs, filterDomain]);

  const grouped = useMemo(() => {
    const map = new Map<Domain, Need[]>();
    for (const d of DOMAINS) map.set(d, []);
    for (const n of visibleNeeds) map.get(n.domain)!.push(n);
    return map;
  }, [visibleNeeds]);

  const ratedNeeds = useMemo(() => rated(state.needs), [state.needs]);
  const ms = useMemo(() => metShare(state.needs), [state.needs]);

  return (
    <div className="not-prose">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-6 pb-4 border-b border-rule">
        <TabButton label="Needs" active={tab === 'needs'} onClick={() => setTab('needs')} />
        <TabButton label="Insights" active={tab === 'insights'} onClick={() => setTab('insights')} />
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase text-muted hidden sm:inline" style={{ letterSpacing: '0.08em' }}>
            {ratedNeeds.length}/{state.needs.length} rated
          </span>
          <ToolbarButton onClick={onImportClick}>Import CSV</ToolbarButton>
          <ToolbarButton onClick={exportCsv}>Export CSV</ToolbarButton>
          <ToolbarButton onClick={resetSeed}>Reset</ToolbarButton>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onImportFile} className="hidden" />
        </div>
      </div>

      {tab === 'needs' && (
        <NeedsTab
          state={state}
          grouped={grouped}
          filterDomain={filterDomain}
          setFilterDomain={setFilterDomain}
          expanded={expanded}
          setExpanded={setExpanded}
          updateNeed={updateNeed}
          updateSource={updateSource}
          removeNeed={removeNeed}
          addNeed={addNeed}
          metShareScore={ms.score}
          ratedCount={ms.rated}
        />
      )}

      {tab === 'insights' && (
        <InsightsTab
          needs={state.needs}
          view={insightView}
          setView={setInsightView}
          metShareScore={ms.score}
          ratedCount={ms.rated}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Needs tab

function NeedsTab(props: {
  state: DataState;
  grouped: Map<Domain, Need[]>;
  filterDomain: Domain | 'all';
  setFilterDomain: (d: Domain | 'all') => void;
  expanded: Set<string>;
  setExpanded: (s: Set<string>) => void;
  updateNeed: (id: string, patch: Partial<Need>) => void;
  updateSource: (id: string, source: Source, patch: Partial<{ actual: number; ideal: number }>) => void;
  removeNeed: (id: string) => void;
  addNeed: () => void;
  metShareScore: number;
  ratedCount: number;
}) {
  const { grouped, filterDomain, setFilterDomain, expanded, setExpanded,
    updateNeed, updateSource, removeNeed, addNeed, metShareScore, ratedCount } = props;

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  return (
    <div>
      {/* Headline strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Card label="Met share" value={ratedCount > 0 ? `${(metShareScore * 100).toFixed(0)}%` : '—'}
              hint="Priority-weighted % of how met your rated needs are." />
        <Card label="Rated" value={`${ratedCount}`} hint="Needs with both priority and currently-met set." />
        <Card label="Domains" value={`${[...grouped.values()].filter(arr => arr.length).length}`}
              hint="Domains with at least one need." />
      </div>

      {/* Domain filter */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="font-mono text-[10px] uppercase text-muted mr-1" style={{ letterSpacing: '0.08em' }}>Domain</span>
        <FilterChip label="All" active={filterDomain === 'all'} onClick={() => setFilterDomain('all')} />
        {DOMAINS.map(d => (
          <FilterChip key={d} label={shortDomain(d)} active={filterDomain === d} onClick={() => setFilterDomain(d)} />
        ))}
      </div>

      {/* Per-domain groups */}
      {[...grouped.entries()].map(([domain, needs]) => {
        if (!needs.length) return null;
        return (
          <section key={domain} className="mb-8">
            <div className="flex items-baseline justify-between mb-2 pb-2 border-b border-rule">
              <h3 className="font-display font-semibold text-[16px] text-ink m-0" style={{ letterSpacing: '-0.01em' }}>
                {domain}
              </h3>
              <span className="font-mono text-[10px] uppercase text-muted" style={{ letterSpacing: '0.08em' }}>
                {needs.length}
              </span>
            </div>
            <ul className="m-0 p-0 list-none">
              {needs.map(n => (
                <NeedRow
                  key={n.id}
                  need={n}
                  expanded={expanded.has(n.id)}
                  onToggle={() => toggle(n.id)}
                  onUpdate={patch => updateNeed(n.id, patch)}
                  onUpdateSource={(s, p) => updateSource(n.id, s, p)}
                  onRemove={() => removeNeed(n.id)}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <div className="mt-6">
        <button onClick={addNeed}
                className="font-mono text-[11px] uppercase text-accent border border-accent rounded-sm px-3 py-1.5 hover:bg-accent hover:text-paper transition-colors"
                style={{ letterSpacing: '0.08em' }}>
          + Add need
        </button>
      </div>
    </div>
  );
}

function NeedRow(props: {
  need: Need;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<Need>) => void;
  onUpdateSource: (source: Source, patch: Partial<{ actual: number; ideal: number }>) => void;
  onRemove: () => void;
}) {
  const { need, expanded, onToggle, onUpdate, onUpdateSource, onRemove } = props;
  const lev = leverage(need);
  const isRated = need.priority > 0 && need.currentlyMet > 0;

  return (
    <li className="border-b border-rule-soft py-3">
      <div className="grid grid-cols-12 gap-3 items-center">
        <div className="col-span-12 md:col-span-5">
          <input
            value={need.name}
            onChange={e => onUpdate({ name: e.target.value })}
            className="w-full bg-transparent font-serif text-[15px] text-ink leading-tight border-none p-0 focus:outline-none focus:bg-paper-edge/40 rounded-sm px-1 -ml-1"
          />
          <div className="mt-1">
            <select
              value={need.domain}
              onChange={e => onUpdate({ domain: e.target.value as Domain })}
              className="font-mono text-[10px] uppercase text-muted bg-transparent border-none p-0 focus:outline-none cursor-pointer"
              style={{ letterSpacing: '0.08em' }}
            >
              {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="col-span-6 md:col-span-3">
          <ScaleControl
            label="Priority"
            max={5}
            value={need.priority}
            onChange={v => onUpdate({ priority: v })}
            valueLabel={PRIORITY_LABEL[need.priority]}
          />
        </div>

        <div className="col-span-6 md:col-span-3">
          <ScaleControl
            label="Met"
            max={7}
            value={need.currentlyMet}
            onChange={v => onUpdate({ currentlyMet: v })}
            valueLabel={MET_LABEL[need.currentlyMet]}
          />
        </div>

        <div className="col-span-12 md:col-span-1 flex items-center justify-end gap-2">
          {isRated && (
            <span className="font-mono text-[11px] text-ink" title={`Leverage = priority × (8 − met) = ${need.priority} × ${8 - need.currentlyMet}`}>
              {lev}
            </span>
          )}
          <button onClick={onToggle}
                  className="font-mono text-[10px] text-muted hover:text-accent w-5 h-5 flex items-center justify-center"
                  aria-label={expanded ? 'Collapse sources' : 'Expand sources'}>
            {expanded ? '▾' : '▸'}
          </button>
        </div>
      </div>

      {expanded && (
        <SourcesPanel
          need={need}
          onUpdateSource={onUpdateSource}
          onRemove={onRemove}
        />
      )}
    </li>
  );
}

function ScaleControl({ label, max, value, onChange, valueLabel }:
  { label: string; max: number; value: number; onChange: (v: number) => void; valueLabel: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-mono text-[10px] uppercase text-muted" style={{ letterSpacing: '0.08em' }}>{label}</span>
        <span className="font-mono text-[10px] text-ink-soft">{value > 0 ? `${value} · ${valueLabel}` : '—'}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: max + 1 }, (_, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            aria-label={`${label} ${i}`}
            className={`flex-1 h-5 rounded-sm border text-[10px] font-mono transition-colors ${
              value === i
                ? 'bg-accent border-accent text-paper'
                : i === 0
                  ? 'border-rule-soft text-muted hover:border-rule'
                  : i <= value
                    ? 'bg-accent-soft/30 border-accent-soft text-ink-soft'
                    : 'border-rule text-muted hover:border-accent-soft'
            }`}
          >
            {i === 0 ? '·' : i}
          </button>
        ))}
      </div>
    </div>
  );
}

function SourcesPanel({ need, onUpdateSource, onRemove }: {
  need: Need;
  onUpdateSource: (source: Source, patch: Partial<{ actual: number; ideal: number }>) => void;
  onRemove: () => void;
}) {
  const rows = perNeedSources(need);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const totalIdeal = rows.reduce((s, r) => s + r.ideal, 0);

  return (
    <div className="mt-4 ml-2 pl-4 border-l-2 border-rule-soft">
      <div className="font-mono text-[10px] uppercase text-muted mb-2" style={{ letterSpacing: '0.08em' }}>
        Sources — % this need comes from each, actual vs ideal
      </div>
      <div className="grid gap-2">
        {rows.map(({ source, actual, ideal, gap }) => (
          <div key={source} className="grid grid-cols-12 gap-2 items-center">
            <span className="col-span-3 font-serif text-[13px] text-ink-soft">{SOURCE_LABEL[source]}</span>
            <div className="col-span-4 flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted w-12">actual</span>
              <input type="range" min={0} max={100} step={5} value={actual}
                     onChange={e => onUpdateSource(source, { actual: parseInt(e.target.value, 10) })}
                     className="flex-1 accent-accent" />
              <span className="font-mono text-[10px] text-ink-soft w-8 text-right">{actual}%</span>
            </div>
            <div className="col-span-4 flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted w-12">ideal</span>
              <input type="range" min={0} max={100} step={5} value={ideal}
                     onChange={e => onUpdateSource(source, { ideal: parseInt(e.target.value, 10) })}
                     className="flex-1 accent-accent-soft" />
              <span className="font-mono text-[10px] text-ink-soft w-8 text-right">{ideal}%</span>
            </div>
            <span className={`col-span-1 font-mono text-[10px] text-right ${gap > 0 ? 'text-accent' : gap < 0 ? 'text-muted' : 'text-muted'}`}
                  title="Gap = ideal − actual; positive = under-getting from this source">
              {gap > 0 ? '+' : ''}{gap}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-rule-soft">
        <span className="font-mono text-[10px] text-muted">
          totals — actual {totalActual}% · ideal {totalIdeal}%
          {totalIdeal !== 100 && totalIdeal > 0 ? ' (ideal should sum to ~100)' : ''}
        </span>
        <button onClick={onRemove}
                className="font-mono text-[10px] text-muted hover:text-accent">
          remove need
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Insights tab

function InsightsTab({ needs, view, setView, metShareScore, ratedCount }: {
  needs: Need[];
  view: InsightView;
  setView: (v: InsightView) => void;
  metShareScore: number;
  ratedCount: number;
}) {
  if (ratedCount === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-serif text-[15px] text-muted m-0">
          Rate at least one need (priority + currently met) to see insights.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Card label="Met share" value={`${(metShareScore * 100).toFixed(0)}%`}
              hint="Priority-weighted % across rated needs." />
        <Card label="Rated needs" value={`${ratedCount}`} />
        <Card label="Top leverage" value={`${rankedByLeverage(needs)[0]?.name ?? '—'}`}
              hint="Highest priority × unmet." />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6 pb-3 border-b border-rule-soft">
        <FilterChip label="Leverage" active={view === 'leverage'} onClick={() => setView('leverage')} />
        <FilterChip label="By domain" active={view === 'domain'} onClick={() => setView('domain')} />
        <FilterChip label="Sources" active={view === 'sources'} onClick={() => setView('sources')} />
        <FilterChip label="Distribution" active={view === 'distribution'} onClick={() => setView('distribution')} />
      </div>

      {view === 'leverage' && <LeverageView needs={needs} />}
      {view === 'domain' && <DomainView needs={needs} />}
      {view === 'sources' && <SourcesView needs={needs} />}
      {view === 'distribution' && <DistributionView needs={needs} />}
    </div>
  );
}

function LeverageView({ needs }: { needs: Need[] }) {
  const ranked = rankedByLeverage(rated(needs));
  const max = ranked[0] ? leverage(ranked[0]) : 1;
  return (
    <div>
      <p className="font-serif text-[14px] text-ink-soft m-0 mb-4">
        Highest-leverage needs first — what to act on for the biggest movement. <span className="font-mono text-[12px] text-muted">leverage = priority × (8 − met)</span>
      </p>
      <ul className="m-0 p-0 list-none">
        {ranked.map(n => {
          const lev = leverage(n);
          return (
            <li key={n.id} className="py-2 border-b border-rule-soft">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <div className="min-w-0">
                  <span className="font-serif text-[14px] text-ink truncate">{n.name}</span>
                  <span className="font-mono text-[10px] uppercase text-muted ml-2" style={{ letterSpacing: '0.08em' }}>
                    {shortDomain(n.domain)}
                  </span>
                </div>
                <div className="flex items-baseline gap-3 font-mono text-[11px] flex-shrink-0">
                  <span className="text-muted">P{n.priority} · M{n.currentlyMet}</span>
                  <span className="text-ink w-6 text-right">{lev}</span>
                </div>
              </div>
              <Bar value={lev} max={max} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DomainView({ needs }: { needs: Need[] }) {
  const rolls = domainRollups(needs).filter(r => r.ratedCount > 0);
  const max = Math.max(...rolls.map(r => r.totalLeverage), 1);
  return (
    <div>
      <p className="font-serif text-[14px] text-ink-soft m-0 mb-4">
        Domains ranked by total leverage. Shows where the biggest aggregate gaps live.
      </p>
      <ul className="m-0 p-0 list-none">
        {rolls.map(r => (
          <li key={r.domain} className="py-3 border-b border-rule-soft">
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="font-serif text-[14px] text-ink">{r.domain}</span>
              <div className="flex items-baseline gap-4 font-mono text-[11px]">
                <span className="text-muted">P̄ {r.avgPriority.toFixed(1)} · M̄ {r.avgMet.toFixed(1)}</span>
                <span className="text-muted">{r.ratedCount}</span>
                <span className="text-ink w-8 text-right">{r.totalLeverage}</span>
              </div>
            </div>
            <Bar value={r.totalLeverage} max={max} />
            {r.topName && (
              <div className="font-mono text-[10px] text-muted mt-1">top: {r.topName}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourcesView({ needs }: { needs: Need[] }) {
  const gaps = sourceGaps(needs);
  const anyAlloc = gaps.some(g => g.weightedActual > 0 || g.weightedIdeal > 0);
  if (!anyAlloc) {
    return (
      <div className="text-center py-8">
        <p className="font-serif text-[14px] text-muted m-0">
          No source allocations yet. Expand a need's row (▸) to set how much of it comes from each source.
        </p>
      </div>
    );
  }
  const maxAbs = Math.max(...gaps.map(g => Math.abs(g.weightedGap)), 1);
  return (
    <div>
      <p className="font-serif text-[14px] text-ink-soft m-0 mb-4">
        Where each source over- or under-contributes across all rated needs (priority-weighted).
        <br/><span className="font-mono text-[12px] text-muted">positive (sienna) = source under-delivers vs ideal · negative (muted) = over-delivers</span>
      </p>
      <ul className="m-0 p-0 list-none">
        {[...gaps].sort((a, b) => b.weightedGap - a.weightedGap).map(g => (
          <li key={g.source} className="py-3 border-b border-rule-soft">
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="font-serif text-[14px] text-ink">{SOURCE_LABEL[g.source]}</span>
              <div className="flex items-baseline gap-4 font-mono text-[11px]">
                <span className="text-muted">share {g.sharePctActual.toFixed(0)}% / ideal {g.sharePctIdeal.toFixed(0)}%</span>
                <span className={g.weightedGap > 0 ? 'text-accent' : 'text-muted'}>
                  {g.weightedGap > 0 ? '+' : ''}{g.weightedGap.toFixed(0)}
                </span>
              </div>
            </div>
            <SignedBar value={g.weightedGap} maxAbs={maxAbs} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DistributionView({ needs }: { needs: Need[] }) {
  const dist = distribution(needs);
  const maxP = Math.max(...dist.priority, 1);
  const maxM = Math.max(...dist.met, 1);
  return (
    <div className="grid gap-8">
      <div>
        <h4 className="font-display font-semibold text-[14px] text-ink m-0 mb-3">Priority distribution</h4>
        <ul className="m-0 p-0 list-none">
          {dist.priority.map((count, i) => {
            const v = i + 1;
            return (
              <li key={v} className="py-1.5 grid grid-cols-12 items-center gap-2">
                <span className="col-span-4 font-mono text-[11px] text-ink-soft">{v} · {PRIORITY_LABEL[v]}</span>
                <div className="col-span-7"><Bar value={count} max={maxP} /></div>
                <span className="col-span-1 font-mono text-[11px] text-muted text-right">{count}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <h4 className="font-display font-semibold text-[14px] text-ink m-0 mb-3">Currently-met distribution</h4>
        <ul className="m-0 p-0 list-none">
          {dist.met.map((count, i) => {
            const v = i + 1;
            return (
              <li key={v} className="py-1.5 grid grid-cols-12 items-center gap-2">
                <span className="col-span-4 font-mono text-[11px] text-ink-soft">{v} · {MET_LABEL[v]}</span>
                <div className="col-span-7"><Bar value={count} max={maxM} /></div>
                <span className="col-span-1 font-mono text-[11px] text-muted text-right">{count}</span>
              </li>
            );
          })}
        </ul>
      </div>
      {dist.unrated > 0 && (
        <p className="font-mono text-[11px] text-muted m-0">
          {dist.unrated} need{dist.unrated === 1 ? '' : 's'} not yet rated.
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------- Small UI bits

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`font-mono text-[11px] uppercase px-3 py-1.5 rounded-sm border transition-colors ${
        active
          ? 'bg-accent text-paper border-accent'
          : 'text-muted border-rule hover:text-accent hover:border-accent'
      }`}
      style={{ letterSpacing: '0.08em' }}
    >
      {label}
    </button>
  );
}

function ToolbarButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-mono text-[10px] uppercase text-muted border border-rule rounded-sm px-2 py-1 hover:text-accent hover:border-accent transition-colors"
      style={{ letterSpacing: '0.08em' }}
    >
      {children}
    </button>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`font-mono text-[10px] uppercase px-2 py-1 rounded-sm border transition-colors ${
        active
          ? 'border-accent text-accent'
          : 'border-rule text-muted hover:border-accent-soft hover:text-ink-soft'
      }`}
      style={{ letterSpacing: '0.08em' }}
    >
      {label}
    </button>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-rule rounded-sm p-3 bg-paper-edge/30">
      <div className="font-mono text-[10px] uppercase text-muted mb-1" style={{ letterSpacing: '0.08em' }}>{label}</div>
      <div className="font-display font-semibold text-[20px] text-ink leading-none mb-1" style={{ letterSpacing: '-0.01em' }}>{value}</div>
      {hint && <div className="font-mono text-[10px] text-muted leading-tight">{hint}</div>}
    </div>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-1.5 bg-rule-soft rounded-sm overflow-hidden">
      <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function SignedBar({ value, maxAbs }: { value: number; maxAbs: number }) {
  const pct = maxAbs > 0 ? Math.min(100, (Math.abs(value) / maxAbs) * 100) : 0;
  const positive = value >= 0;
  return (
    <div className="relative h-1.5 bg-rule-soft rounded-sm overflow-hidden">
      <div
        className={`absolute top-0 h-full ${positive ? 'bg-accent left-1/2' : 'bg-muted right-1/2'}`}
        style={{ width: `${pct / 2}%` }}
      />
      <div className="absolute top-0 left-1/2 h-full w-px bg-rule" />
    </div>
  );
}

function shortDomain(d: Domain): string {
  return d.replace(/ \/ .*/, '');
}

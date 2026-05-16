import { useState } from 'react';
import type { Session } from './types';
import { rangeStats, dayKey, todayKey, fmtHM } from './compute';

const DAY = 86_400_000;

// Always-visible strip under the tab bar: this week's net worked time,
// filterable to one category. "This week" is Sunday-start, matching the
// Log tab's "This week" preset.
export default function WeekStrip({ sessions, categories, now }: {
  sessions: Session[];
  categories: string[];
  now: number;
}) {
  const [filter, setFilter] = useState('all');
  const weekStart = dayKey(now - new Date(now).getDay() * DAY);
  const stats = rangeStats(sessions, weekStart, todayKey(now), now);
  const value = filter === 'all'
    ? stats.totalNetMs
    : (stats.byCategory.find(c => c.category === filter)?.netMs ?? 0);

  return (
    <div className="bg-paper border-b border-rule px-5 py-2.5 flex items-center
                    justify-between gap-3 flex-wrap">
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          This week
        </span>
        <span className="font-display text-[20px] leading-none text-ink tabular-nums">
          {fmtHM(value)}
        </span>
        <span className="font-serif text-[12px] text-muted">
          {filter === 'all' ? 'all categories' : filter}
        </span>
      </div>
      <select value={filter} onChange={e => setFilter(e.target.value)}
              className="font-mono text-[11px] bg-paper border border-rule rounded-sm
                         px-2 py-1 text-ink-soft focus:border-accent outline-none">
        <option value="all">All categories</option>
        {categories.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

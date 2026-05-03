import type { Need, Source, Domain } from './types';
import { SOURCES } from './types';

// Leverage = priority × (8 − currently_met). High priority + low fulfillment ranks first.
// Returns 0 when either input is unset (0). Range 1..35 when both set.
export function leverage(n: Need): number {
  if (n.priority <= 0 || n.currentlyMet <= 0) return 0;
  return n.priority * (8 - n.currentlyMet);
}

export function rated(needs: Need[]): Need[] {
  return needs.filter(n => n.priority > 0 && n.currentlyMet > 0);
}

export function rankedByLeverage(needs: Need[]): Need[] {
  return [...needs].sort((a, b) => {
    const la = leverage(a), lb = leverage(b);
    if (lb !== la) return lb - la;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.currentlyMet - b.currentlyMet;
  });
}

export type DomainRollup = {
  domain: Domain;
  count: number;            // total needs in domain
  ratedCount: number;       // needs with priority + met both set
  avgPriority: number;      // average over rated
  avgMet: number;           // average over rated
  totalLeverage: number;    // sum of leverage across rated
  topName: string | null;   // highest-leverage need's name (for display)
};

export function domainRollups(needs: Need[]): DomainRollup[] {
  const byDomain = new Map<Domain, Need[]>();
  for (const n of needs) {
    const arr = byDomain.get(n.domain) ?? [];
    arr.push(n);
    byDomain.set(n.domain, arr);
  }
  const out: DomainRollup[] = [];
  for (const [domain, arr] of byDomain) {
    const r = rated(arr);
    const totalLev = r.reduce((s, n) => s + leverage(n), 0);
    const avgP = r.length ? r.reduce((s, n) => s + n.priority, 0) / r.length : 0;
    const avgM = r.length ? r.reduce((s, n) => s + n.currentlyMet, 0) / r.length : 0;
    const top = rankedByLeverage(r)[0];
    out.push({
      domain,
      count: arr.length,
      ratedCount: r.length,
      avgPriority: avgP,
      avgMet: avgM,
      totalLeverage: totalLev,
      topName: top ? top.name : null,
    });
  }
  return out.sort((a, b) => b.totalLeverage - a.totalLeverage);
}

export type SourceGap = {
  source: Source;
  totalActual: number;        // unweighted sum of actual % across all rated needs
  totalIdeal: number;         // unweighted sum of ideal %
  weightedActual: number;     // sum of priority × actual
  weightedIdeal: number;      // sum of priority × ideal
  weightedGap: number;        // weightedIdeal − weightedActual (positive = under-getting)
  sharePctActual: number;     // % of total actual contribution coming from this source
  sharePctIdeal: number;      // % of total ideal contribution coming from this source
};

// Aggregate source contribution gaps, priority-weighted, across all rated needs.
// "Gap" follows the spreadsheet convention: ideal − actual. Positive = source is
// under-contributing relative to where you want it.
export function sourceGaps(needs: Need[]): SourceGap[] {
  const r = rated(needs);
  let totWA = 0, totWI = 0;
  const acc: Record<Source, { wA: number; wI: number; tA: number; tI: number }> = {
    self:       { wA: 0, wI: 0, tA: 0, tI: 0 },
    friends:    { wA: 0, wI: 0, tA: 0, tI: 0 },
    romantic:   { wA: 0, wI: 0, tA: 0, tI: 0 },
    activities: { wA: 0, wI: 0, tA: 0, tI: 0 },
    career:     { wA: 0, wI: 0, tA: 0, tI: 0 },
    other:      { wA: 0, wI: 0, tA: 0, tI: 0 },
  };
  for (const n of r) {
    for (const s of SOURCES) {
      const a = n.sources[s].actual;
      const i = n.sources[s].ideal;
      acc[s].tA += a;
      acc[s].tI += i;
      acc[s].wA += a * n.priority;
      acc[s].wI += i * n.priority;
      totWA += a * n.priority;
      totWI += i * n.priority;
    }
  }
  return SOURCES.map(s => ({
    source: s,
    totalActual: acc[s].tA,
    totalIdeal: acc[s].tI,
    weightedActual: acc[s].wA,
    weightedIdeal: acc[s].wI,
    weightedGap: acc[s].wI - acc[s].wA,
    sharePctActual: totWA > 0 ? (acc[s].wA / totWA) * 100 : 0,
    sharePctIdeal: totWI > 0 ? (acc[s].wI / totWI) * 100 : 0,
  }));
}

export type Distribution = {
  priority: number[];   // count at each priority value 1..5
  met: number[];        // count at each currently_met value 1..7
  unrated: number;      // count of needs with priority=0 OR met=0
  rated: number;
};

export function distribution(needs: Need[]): Distribution {
  const priority = [0, 0, 0, 0, 0]; // 1..5
  const met = [0, 0, 0, 0, 0, 0, 0]; // 1..7
  let unrated = 0, ratedCount = 0;
  for (const n of needs) {
    if (n.priority > 0 && n.currentlyMet > 0) {
      ratedCount++;
      priority[n.priority - 1]++;
      met[n.currentlyMet - 1]++;
    } else {
      unrated++;
    }
  }
  return { priority, met, unrated, rated: ratedCount };
}

// Per-need source view: actual & ideal sorted descending by ideal so the
// "where this need should mostly come from" is visible at a glance.
export type PerNeedSourceRow = {
  source: Source;
  actual: number;
  ideal: number;
  gap: number; // ideal − actual
};

export function perNeedSources(n: Need): PerNeedSourceRow[] {
  return SOURCES.map(s => ({
    source: s,
    actual: n.sources[s].actual,
    ideal: n.sources[s].ideal,
    gap: n.sources[s].ideal - n.sources[s].actual,
  }));
}

// "Met share": rough single-number health score. Avg of (currently_met / 7) over rated needs,
// weighted by priority. 0..1.
export function metShare(needs: Need[]): { score: number; rated: number } {
  const r = rated(needs);
  if (!r.length) return { score: 0, rated: 0 };
  let num = 0, den = 0;
  for (const n of r) {
    num += n.priority * (n.currentlyMet / 7);
    den += n.priority;
  }
  return { score: den > 0 ? num / den : 0, rated: r.length };
}

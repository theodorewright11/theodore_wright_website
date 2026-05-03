import { useMemo, useState } from 'react';

// ----------------------------------------------------------------------
// Findings panel for the data stage of navigating-ai-world.
//
// All numbers below come from the curated CSVs in
// stage_outputs/navigating-ai-world/data/. Frozen at build time;
// re-run pipeline.py and re-paste findings.json to refresh.
//
// V4 design tokens used directly (paper, ink, ink-soft, muted, rule,
// rule-soft, accent, accent-soft, paper-edge). Charts hand-rolled in SVG
// to match the existing model-stage dashboard aesthetic.
// ----------------------------------------------------------------------

type AlphaRow = {
  study: string;
  domain: string;
  measure: string;
  effect_pct: number;
  s: number;
  alpha: number;
  outcome_type: string;
};

type AlphaDomainRow = {
  domain: string;
  n: number;
  median: number;
  lo: number;
  hi: number;
  spread_x: number;
};

type ModeRow = {
  mode: string;
  share_pct: number;
  f: number;
  rho: number;
  f_rho: number;
  above_gate: boolean;
};

type DoseRow = {
  label: string;
  daily_minutes: number;
  outcome: string;
  effect_direction: 'protective' | 'null' | 'harmful' | 'beneficial' | 'causal_harm';
  modality: string;
};

type OffloadRow = {
  study: string;
  n: number;
  design: string;
  outcome: string;
  effect_label: string;
  cumulative_evidence: 'cross_sectional' | 'short_duration' | 'rct_with_retest' | 'longitudinal_field' | 'qualitative' | 'baseline';
};

type LaborRow = {
  cohort: string;
  metric: string;
  effect_pct: number;
  source_label: string;
};

type AeiRow = {
  date: string;
  augmentation_pct: number;
  surface: 'consumer' | 'api';
};

// ---- Frozen data from the pipeline -----------------------------------

const PER_TASK_ALPHA: AlphaRow[] = [
  // Customer service
  { study: 'Brynjolfsson-Li-Raymond 2025 (overall)',  domain: 'customer_service', measure: 'issues/hour',         effect_pct: 14,    s: 0.50, alpha: 0.28,  outcome_type: 'throughput_quality_blend' },
  { study: 'Brynjolfsson-Li-Raymond 2025 (novice)',   domain: 'customer_service', measure: 'issues/hour',         effect_pct: 34,    s: 0.20, alpha: 0.43,  outcome_type: 'throughput_quality_blend' },
  // Consulting
  { study: "Dell'Acqua BCG 2023 (productivity)",      domain: 'consulting',       measure: 'tasks completed',     effect_pct: 12.2,  s: 0.50, alpha: 0.24,  outcome_type: 'quality_throughput' },
  { study: "Dell'Acqua BCG 2023 (quality)",           domain: 'consulting',       measure: 'quality score',       effect_pct: 40,    s: 0.50, alpha: 0.80,  outcome_type: 'quality_throughput' },
  // Coding
  { study: 'Cui et al. 2024 (Microsoft+Accenture+F100)', domain: 'coding',        measure: 'weekly tasks',        effect_pct: 26.08, s: 0.45, alpha: 0.47,  outcome_type: 'throughput' },
  { study: 'Peng et al. 2023 (Copilot, JS HTTP)',     domain: 'coding',           measure: 'time to complete',    effect_pct: 55.8,  s: 0.45, alpha: 1.01,  outcome_type: 'time' },
  // Writing
  { study: 'Noy & Zhang 2023 (time)',                 domain: 'writing',          measure: 'time to complete',    effect_pct: 40,    s: 0.40, alpha: 0.67,  outcome_type: 'time' },
  { study: 'Noy & Zhang 2023 (quality)',              domain: 'writing',          measure: 'quality grade',       effect_pct: 18,    s: 0.40, alpha: 0.30,  outcome_type: 'quality' },
  // Realized economy-level (excluded from per-domain α aggregate)
  { study: 'Humlum-Vestergaard 2025 (earnings)',      domain: 'realized_economy', measure: 'earnings ≤ 2 yrs',    effect_pct: 2,     s: 0.55, alpha: 0.04,  outcome_type: 'realized_economic_outcome' },
  { study: 'Humlum-Vestergaard 2025 (self-reported)', domain: 'realized_economy', measure: 'time saved (self)',   effect_pct: 3,     s: 0.55, alpha: 0.07,  outcome_type: 'self_reported_time_saved' },
];

const ALPHA_BY_DOMAIN: AlphaDomainRow[] = [
  { domain: 'coding',           n: 2, median: 0.74,  lo: 0.47, hi: 1.01, spread_x: 2.15 },
  { domain: 'consulting',       n: 2, median: 0.52,  lo: 0.24, hi: 0.80, spread_x: 3.33 },
  { domain: 'writing',          n: 2, median: 0.485, lo: 0.30, hi: 0.67, spread_x: 2.23 },
  { domain: 'customer_service', n: 2, median: 0.355, lo: 0.28, hi: 0.43, spread_x: 1.54 },
  { domain: 'realized_economy', n: 2, median: 0.055, lo: 0.04, hi: 0.07, spread_x: 1.75 },
];

const ALPHA_SUMMARY = {
  n_per_task: 8,
  per_task_min: 0.24,
  per_task_max: 1.01,
  per_task_median: 0.45,
  per_task_spread_x: 4.21,
  model_default: 0.40,
  model_default_percentile: 37,
};

const BCG_MODES: ModeRow[] = [
  { mode: 'Self-automator', share_pct: 27, f: 0.20, rho: 0.30, f_rho: 0.06, above_gate: false },
  { mode: 'Cyborg',         share_pct: 60, f: 0.65, rho: 0.65, f_rho: 0.42, above_gate: true  },
  { mode: 'Centaur',        share_pct: 13, f: 0.70, rho: 0.80, f_rho: 0.56, above_gate: true  },
];

const TAU_SUMMARY = {
  self_automator_centroid: 0.06,
  cyborg_centaur_centroid: 0.45,
  midpoint_estimate: 0.255,
  model_default_tau: 0.30,
  sigma: 0.06,
};

const DOSE_ANCHORS: DoseRow[] = [
  { label: 'OpenAI-MIT (low dose)',           daily_minutes: 5,  outcome: 'loneliness',         effect_direction: 'protective', modality: 'text/voice' },
  { label: 'OpenAI-MIT (med dose)',           daily_minutes: 30, outcome: 'loneliness',         effect_direction: 'null',       modality: 'text/voice' },
  { label: 'OpenAI-MIT (high dose)',          daily_minutes: 90, outcome: 'loneliness',         effect_direction: 'harmful',    modality: 'text/voice' },
  { label: 'OpenAI-MIT (high dose, depend.)', daily_minutes: 90, outcome: 'emotional dependence', effect_direction: 'harmful',  modality: 'text/voice' },
  { label: 'OpenAI-MIT (voice low)',          daily_minutes: 15, outcome: 'loneliness',         effect_direction: 'protective', modality: 'voice' },
  { label: 'Therabot (PHQ-9 reduction)',      daily_minutes: 13, outcome: 'depression',         effect_direction: 'beneficial', modality: 'therapy-tuned text' },
  { label: 'Therabot (GAD-7)',                daily_minutes: 13, outcome: 'anxiety',            effect_direction: 'beneficial', modality: 'therapy-tuned text' },
  { label: 'Therabot (eating disorder)',      daily_minutes: 13, outcome: 'eating concerns',    effect_direction: 'beneficial', modality: 'therapy-tuned text' },
];

const DOSE_FIT = {
  d_safe_minutes: 30,
  beta_R: 0.001,
  psi_R: 0.0028,
  model_psi_R: 0.003,
  therabot_dose_minutes: 13,
  therabot_below_d_safe: true,
  catastrophic_loss_baseline_pct: 0.13,
  catastrophic_loss_post_pct: 0.65,
  catastrophic_loss_chi2: 11.04,
};

const COGNITIVE_OFFLOADING: OffloadRow[] = [
  { study: 'Gerlich 2025',         n: 666, design: 'cross-sectional mixed methods',     outcome: 'critical thinking ↔ AI use',     effect_label: 'r ≈ −0.68 (mediated through cognitive offloading r=+0.72)', cumulative_evidence: 'cross_sectional' },
  { study: 'Stadler-Bannert-Sailer 2024', n: 150, design: 'within-subject controlled',  outcome: 'argument quality + depth',       effect_label: 'lower load, lower-quality arguments (acute)',                cumulative_evidence: 'short_duration' },
  { study: 'Kosmyna et al. 2025 (MIT)', n: 54, design: 'within-subject neuroimaging',   outcome: 'EEG sustained attention',        effect_label: 'reduced neural engagement during LLM-assisted writing',     cumulative_evidence: 'short_duration' },
  { study: 'Bastani 2025 (PNAS)',  n: 494, design: 'RCT with unassisted retest',        outcome: 'unassisted exam performance',    effect_label: '−17 pp on retest after GPT-Base; GUARDRAILS eliminate it',  cumulative_evidence: 'rct_with_retest' },
  { study: 'Ehsan 2026 (year-long)', n: 52, design: 'longitudinal field observational', outcome: 'expert-judgment dulling',        effect_label: 'gradual intuition rust over 12 months — invisible in throughput', cumulative_evidence: 'longitudinal_field' },
  { study: 'Shukla et al. 2025',   n: 38,  design: 'qualitative field',                  outcome: 'deskilling + responsibility',    effect_label: 'thematic — Bainbridge ironies of automation in UX design',  cumulative_evidence: 'qualitative' },
  { study: 'Calculator analogue',  n: 0,   design: 'historical meta-anchor',             outcome: 'long-run arithmetic fluency',    effect_label: 'no durable decline — the λ ≈ 0 tail of A3',                  cumulative_evidence: 'baseline' },
];

const LAMBDA_BOUNDS = {
  bastani_high_u_short_window: 1.86,    // implausibly fast; high-bound illustration
  bastani_amortized_yearlong: 0.19,
  ehsan_year_long_moderate_u: 0.10,
  calculator_analogue: 0.0,
  model_default: 0.06,
  realistic_lower_bound_band: '0.05 – 0.20 / yr',
  half_life_at_default_heavy_u: 19,     // years at u=0.6, λ=0.06
};

const ENTRY_LEVEL: LaborRow[] = [
  { cohort: '22–25, highly AI-exposed (US ADP)',         metric: 'employment',  effect_pct: -13.0, source_label: 'Brynjolfsson-Chandar-Chen 2025' },
  { cohort: '22–25, software developers (US ADP)',       metric: 'employment',  effect_pct: -19.5, source_label: 'Brynjolfsson-Chandar-Chen 2025' },
  { cohort: 'Over-35, highly AI-exposed (US ADP)',       metric: 'employment',  effect_pct: 2.0,   source_label: 'Brynjolfsson-Chandar-Chen 2025' },
  { cohort: 'Upwork freelancers (affected, all ages)',   metric: 'monthly jobs', effect_pct: -2.0,  source_label: 'Hui-Reshef-Zhou 2024' },
  { cohort: 'Upwork freelancers (affected, all ages)',   metric: 'earnings',    effect_pct: -5.2,  source_label: 'Hui-Reshef-Zhou 2024' },
  { cohort: 'Upwork image work (post-DALL-E/Midjourney)', metric: 'monthly jobs', effect_pct: -3.7,  source_label: 'Hui-Reshef-Zhou 2024' },
  { cohort: 'Upwork image work (post-DALL-E/Midjourney)', metric: 'earnings',    effect_pct: -9.4,  source_label: 'Hui-Reshef-Zhou 2024' },
];

const AEI_DRIFT: AeiRow[] = [
  { date: 'Feb 2025', augmentation_pct: 57, surface: 'consumer' },
  { date: 'Sep 2025', augmentation_pct: 55, surface: 'consumer' },
  { date: 'Jan 2026', augmentation_pct: 52, surface: 'consumer' },
  { date: 'Mar 2026', augmentation_pct: 51, surface: 'consumer' },
  { date: 'Jan 2026', augmentation_pct: 30, surface: 'api' },
];

// ---- Tabs --------------------------------------------------------------

type Tab = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'backdrop';

const TABS: { key: Tab; label: string; symbol: string }[] = [
  { key: 'q1',       label: 'λ atrophy speed',       symbol: 'Q1' },
  { key: 'q2',       label: 'Dose-response',         symbol: 'Q2' },
  { key: 'q3',       label: 'Self-automator gate τ', symbol: 'Q3' },
  { key: 'q4',       label: 'Identity allocation',   symbol: 'Q4' },
  { key: 'q5',       label: 'κ sensitivity',         symbol: 'Q5' },
  { key: 'q6',       label: 'Per-domain α',          symbol: 'Q6' },
  { key: 'backdrop', label: 'Structural backdrop',   symbol: '★'  },
];

export default function AITransitionData() {
  const [tab, setTab] = useState<Tab>('q6');
  return (
    <div className="border border-rule rounded-md bg-paper-edge/40 p-5 md:p-6 my-8 not-prose">
      <div className="flex flex-wrap gap-1.5 mb-5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              'px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider border rounded transition-colors ' +
              (tab === t.key
                ? 'border-accent text-accent bg-paper'
                : 'border-rule text-muted hover:text-accent hover:border-accent')
            }
          >
            <span className="text-accent-soft mr-1.5">{t.symbol}</span>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'q1' && <Q1Lambda />}
      {tab === 'q2' && <Q2Dose />}
      {tab === 'q3' && <Q3Tau />}
      {tab === 'q4' && <Q4Identity />}
      {tab === 'q5' && <Q5Kappa />}
      {tab === 'q6' && <Q6Alpha />}
      {tab === 'backdrop' && <BackdropPanel />}
    </div>
  );
}

// ---- Generic atoms -----------------------------------------------------

type VerdictKind = 'supported' | 'qualitative' | 'bounded' | 'untestable';

function Verdict({ kind, children }: { kind: VerdictKind; children: React.ReactNode }) {
  const color =
    kind === 'supported' ? 'text-accent border-accent' :
    kind === 'qualitative' ? 'text-accent-soft border-accent-soft' :
    kind === 'bounded' ? 'text-accent-soft border-accent-soft' :
    'text-muted border-rule';
  return (
    <span className={'inline-block ml-2 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded ' + color}>
      {children}
    </span>
  );
}

function PanelHeader({ title, claim, verdict, verdictKind }: {
  title: string;
  claim: string;
  verdict: string;
  verdictKind: VerdictKind;
}) {
  return (
    <div className="mb-5">
      <h4 className="font-display text-[18px] text-ink leading-tight">
        {title}
        <Verdict kind={verdictKind}>{verdict}</Verdict>
      </h4>
      <p className="text-[13px] text-ink-soft mt-1.5 leading-relaxed">{claim}</p>
    </div>
  );
}

function NumberCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-rule-soft rounded p-3 bg-paper">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted">{label}</div>
      <div className="font-display text-[22px] text-ink mt-1 leading-none">{value}</div>
      {hint && <div className="text-[11px] text-muted mt-1.5">{hint}</div>}
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">{children}</div>;
}

function FootNote({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted mt-4 leading-relaxed">{children}</p>;
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3 mt-3 text-[10px] font-mono text-muted">
      {items.map(i => (
        <span key={i.label} className="flex items-center">
          <span className="inline-block w-2.5 h-2.5 mr-1.5 rounded-sm" style={{ backgroundColor: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ---- Q6 — per-domain α -------------------------------------------------

function Q6Alpha() {
  const W = 480;
  const H = 30;
  const padX = 8;
  const innerW = W - 2 * padX;
  const maxAxis = 1.1;
  const sx = (v: number) => padX + (v / maxAxis) * innerW;

  // Sort domains by median descending (skipping realized_economy → showed at bottom)
  const ordered = [...ALPHA_BY_DOMAIN].sort((a, b) => b.median - a.median);

  return (
    <div>
      <PanelHeader
        title="Q6. Per-domain productivity scale α"
        claim={`Across 8 per-task productivity studies the implied α spans ${ALPHA_SUMMARY.per_task_min} to ${ALPHA_SUMMARY.per_task_max} — a ${ALPHA_SUMMARY.per_task_spread_x}× spread. Median α = ${ALPHA_SUMMARY.per_task_median}; the model's default α = 0.40 sits at the ${ALPHA_SUMMARY.model_default_percentile}th percentile, a lower-middle anchor that under-represents coding and writing. The structural claim that α should vary by domain is empirically vindicated.`}
        verdict="supported"
        verdictKind="supported"
      />

      <CardGrid>
        <NumberCard label="α range" value={`${ALPHA_SUMMARY.per_task_min} – ${ALPHA_SUMMARY.per_task_max}`} hint={`${ALPHA_SUMMARY.per_task_spread_x}× spread`} />
        <NumberCard label="α median" value={String(ALPHA_SUMMARY.per_task_median)} hint="across per-task studies" />
        <NumberCard label="model α" value={String(ALPHA_SUMMARY.model_default)} hint={`${ALPHA_SUMMARY.model_default_percentile}th percentile`} />
        <NumberCard label="J-curve gap" value="≈ 10×" hint="per-task α vs realized economy α" />
      </CardGrid>

      <h5 className="font-display text-[15px] text-ink mb-2">α distribution by domain</h5>
      <div className="space-y-1 text-[12px] mb-2">
        <div className="grid grid-cols-[150px_1fr] gap-3 text-[10px] font-mono uppercase tracking-wider text-muted pb-1 border-b border-rule-soft">
          <span>domain (n)</span>
          <div className="relative h-3">
            {[0, 0.25, 0.5, 0.75, 1.0].map(v => (
              <span key={v} className="absolute" style={{ left: `${(v / maxAxis) * 100}%`, transform: 'translateX(-50%)' }}>
                {v.toFixed(2)}
              </span>
            ))}
          </div>
        </div>
        {ordered.map(d => {
          const isRealized = d.domain === 'realized_economy';
          return (
            <div key={d.domain} className="grid grid-cols-[150px_1fr] gap-3 items-center py-1">
              <span className="text-ink text-[12px] flex items-center gap-2">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: isRealized ? '#a89677' : '#8a4a2b' }}
                />
                {d.domain.replace(/_/g, ' ')} <span className="text-muted">({d.n})</span>
              </span>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H}>
                {/* faint grid */}
                {[0.25, 0.5, 0.75, 1.0].map(v => (
                  <line key={v} x1={sx(v)} y1={0} x2={sx(v)} y2={H} stroke="#e6dfcf" strokeWidth={0.5} />
                ))}
                {/* model default marker */}
                <line x1={sx(0.40)} y1={2} x2={sx(0.40)} y2={H - 2} stroke="#c98a6e" strokeWidth={1} strokeDasharray="2 2" />
                {/* range bar */}
                <line x1={sx(d.lo)} y1={H / 2} x2={sx(d.hi)} y2={H / 2} stroke="#d9d0bf" strokeWidth={3} />
                {/* lo / hi caps */}
                <line x1={sx(d.lo)} y1={H / 2 - 5} x2={sx(d.lo)} y2={H / 2 + 5} stroke="#a89677" strokeWidth={1} />
                <line x1={sx(d.hi)} y1={H / 2 - 5} x2={sx(d.hi)} y2={H / 2 + 5} stroke="#a89677" strokeWidth={1} />
                {/* median dot */}
                <circle cx={sx(d.median)} cy={H / 2} r={4.5} fill={isRealized ? '#a89677' : '#8a4a2b'} stroke="#f7f3ec" strokeWidth={1} />
                <text x={sx(d.median) + 8} y={H / 2 + 3.5} fontSize="10" fill="#3a342c" fontFamily="JetBrains Mono, monospace">
                  {d.median.toFixed(2)}
                </text>
              </svg>
            </div>
          );
        })}
      </div>
      <Legend items={[
        { label: 'per-task α (median + range)', color: '#8a4a2b' },
        { label: 'realized economy α', color: '#a89677' },
        { label: 'model default α=0.40', color: '#c98a6e' },
      ]} />

      <h5 className="font-display text-[15px] text-ink mt-6 mb-2">Per-study breakdown</h5>
      <div className="border border-rule-soft rounded overflow-hidden">
        <div className="grid grid-cols-[1fr_110px_70px_60px] text-[10px] font-mono uppercase tracking-wider text-muted px-3 py-2 bg-paper border-b border-rule-soft">
          <span>study</span>
          <span>domain</span>
          <span>effect</span>
          <span>α</span>
        </div>
        {PER_TASK_ALPHA.map(r => (
          <div key={r.study} className="grid grid-cols-[1fr_110px_70px_60px] text-[12px] px-3 py-1.5 border-b border-rule-soft last:border-b-0">
            <span className="text-ink">{r.study}</span>
            <span className="text-muted">{r.domain.replace(/_/g, ' ')}</span>
            <span className="text-ink-soft font-mono text-[11px]">
              {r.effect_pct > 0 ? '+' : ''}{r.effect_pct}%
            </span>
            <span className={'font-mono text-[11px] ' + (r.alpha < 0.20 ? 'text-muted' : 'text-accent')}>
              {r.alpha.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      <FootNote>
        α inferred from headline effect / (1 − s) at gate-open with assumed average s per population. Within-study spreads are themselves substantial — Brynjolfsson novice-vs-overall = 1.5×; BCG productivity-vs-quality = 3.3×. The realized-economy anchor (Humlum-Vestergaard) is roughly 1/10th of the median per-task α — the J-curve gap. Stage 5 should let the user select a domain rather than treat α as a constant. Bastani's GPT-Tutor-during-practice α≈1.81 (assisted performance) is excluded from the per-domain summary above because it's not the per-task gain α represents — it's the during-AI-on lift; the relevant α from Bastani is the negative unassisted-retest residual, which appears in Q1.
      </FootNote>
    </div>
  );
}

// ---- Q3 — self-automator gate τ ---------------------------------------

function Q3Tau() {
  // Logistic with τ=0.30, σ=0.06
  const tau = TAU_SUMMARY.model_default_tau;
  const sigma = TAU_SUMMARY.sigma;
  const g = (x: number) => 1 / (1 + Math.exp(-(x - tau) / sigma));

  const W = 520;
  const H = 220;
  const padL = 50;
  const padR = 12;
  const padT = 12;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const sx = (v: number) => padL + v * innerW;            // f·ρ in [0, 1]
  const sy = (v: number) => padT + (1 - v) * innerH;     // g in [0, 1]

  // Curve points
  const curvePts = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 100; i++) {
      const x = i / 100;
      pts.push(`${sx(x).toFixed(2)},${sy(g(x)).toFixed(2)}`);
    }
    return pts.join(' ');
  }, []);

  return (
    <div>
      <PanelHeader
        title="Q3. Self-automator gate threshold τ"
        claim={`BCG-Randazzo three-mode distribution implies τ between the self-automator centroid (f·ρ ≈ ${TAU_SUMMARY.self_automator_centroid}) and the cyborg+centaur centroid (f·ρ ≈ ${TAU_SUMMARY.cyborg_centaur_centroid}). Midpoint estimate τ ≈ ${TAU_SUMMARY.midpoint_estimate}. Model default τ = ${TAU_SUMMARY.model_default_tau} lands within 0.05 of the midpoint and inside the empirical range.`}
        verdict="supported"
        verdictKind="supported"
      />

      <CardGrid>
        <NumberCard label="self-automator share" value="27%" hint="BCG-Randazzo HBS WP 26-036" />
        <NumberCard label="cyborg+centaur" value="73%" hint="centroid f·ρ ≈ 0.45" />
        <NumberCard label="τ midpoint" value={String(TAU_SUMMARY.midpoint_estimate)} hint="empirical estimate" />
        <NumberCard label="model τ" value={String(TAU_SUMMARY.model_default_tau)} hint="within 0.05 of midpoint" />
      </CardGrid>

      <h5 className="font-display text-[15px] text-ink mb-2">Logistic gate g(f·ρ) and BCG mode positions</h5>
      <div className="border border-rule-soft rounded bg-paper">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" style={{ display: 'block' }}>
          {/* y grid */}
          {[0, 0.25, 0.5, 0.75, 1].map(v => (
            <g key={v}>
              <line x1={padL} y1={sy(v)} x2={W - padR} y2={sy(v)} stroke="#e6dfcf" strokeWidth={0.5} />
              <text x={padL - 6} y={sy(v) + 3.5} fontSize="9" fill="#7a7166" fontFamily="JetBrains Mono, monospace" textAnchor="end">{v.toFixed(2)}</text>
            </g>
          ))}
          {/* x grid */}
          {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(v => (
            <g key={v}>
              <line x1={sx(v)} y1={padT} x2={sx(v)} y2={H - padB} stroke="#e6dfcf" strokeWidth={0.5} />
              <text x={sx(v)} y={H - padB + 14} fontSize="9" fill="#7a7166" fontFamily="JetBrains Mono, monospace" textAnchor="middle">{v.toFixed(1)}</text>
            </g>
          ))}
          {/* axes labels */}
          <text x={padL + innerW / 2} y={H - 4} fontSize="10" fill="#3a342c" fontFamily="Source Serif 4, serif" textAnchor="middle">f · ρ</text>
          <text x={12} y={padT + innerH / 2} fontSize="10" fill="#3a342c" fontFamily="Source Serif 4, serif" textAnchor="middle" transform={`rotate(-90 12 ${padT + innerH / 2})`}>g (gate)</text>
          {/* τ line */}
          <line x1={sx(tau)} y1={padT} x2={sx(tau)} y2={H - padB} stroke="#c98a6e" strokeWidth={1} strokeDasharray="3 3" />
          <text x={sx(tau) + 4} y={padT + 11} fontSize="9" fill="#8a4a2b" fontFamily="JetBrains Mono, monospace">τ = 0.30</text>
          {/* logistic curve */}
          <polyline points={curvePts} fill="none" stroke="#1a1614" strokeWidth={1.5} />
          {/* mode markers */}
          {BCG_MODES.map(m => (
            <g key={m.mode}>
              <circle cx={sx(m.f_rho)} cy={sy(g(m.f_rho))} r={6 + Math.sqrt(m.share_pct) * 0.8} fill={m.above_gate ? '#8a4a2b' : '#a89677'} fillOpacity={0.55} stroke="#f7f3ec" strokeWidth={1.5} />
              <text x={sx(m.f_rho)} y={sy(g(m.f_rho)) - 18} fontSize="10" fill="#1a1614" fontFamily="Source Serif 4, serif" textAnchor="middle">{m.mode}</text>
              <text x={sx(m.f_rho)} y={sy(g(m.f_rho)) - 6} fontSize="9" fill="#7a7166" fontFamily="JetBrains Mono, monospace" textAnchor="middle">{m.share_pct}%</text>
            </g>
          ))}
        </svg>
      </div>

      <Legend items={[
        { label: 'g(f·ρ) — model gate', color: '#1a1614' },
        { label: 'τ = 0.30 (model default)', color: '#c98a6e' },
        { label: 'BCG modes (above gate)', color: '#8a4a2b' },
        { label: 'BCG mode (below gate)', color: '#a89677' },
      ]} />

      <FootNote>
        f and ρ values per mode are inferred from Randazzo's qualitative descriptions of workflow patterns (one-or-two interactions vs full-workflow integration vs split-task) — BCG individual-level f and ρ panels are not published. The midpoint τ ≈ 0.255 is the principled zero-information estimate; refining requires the individual-level data. Generalization beyond consulting is not tested. Stage 4 should re-fit τ if mode-distribution data becomes available for coding, design, or other domains — see D2 in the cruxes.
      </FootNote>
    </div>
  );
}

// ---- Q2 — relational dose-response ------------------------------------

function Q2Dose() {
  const W = 520;
  const H = 240;
  const padL = 56;
  const padR = 12;
  const padT = 12;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  // X: daily minutes 0–120; Y: utility −0.18 to +0.05
  const xMin = 0;
  const xMax = 120;
  const yMin = -0.20;
  const yMax = 0.05;
  const sx = (v: number) => padL + ((v - xMin) / (xMax - xMin)) * innerW;
  const sy = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const dSafe = DOSE_FIT.d_safe_minutes;
  const psi = DOSE_FIT.psi_R;
  const beta = DOSE_FIT.beta_R;
  const deltaR = 0.4; // representative thin-baseline user
  // Below d_safe: ΔV_rel = +β·d·(1−δ_R/2). Above: ΔM_rel = −ψ·(d − d_safe)·(1 − δ_R), summed with the (still-paid) ΔV_rel cap
  const utility = (d: number) => {
    const v = beta * Math.min(d, dSafe) * (1 - deltaR / 2);
    const m = -psi * Math.max(0, d - dSafe) * (1 - deltaR);
    return v + m;
  };

  const curvePts: string[] = [];
  for (let d = 0; d <= xMax; d += 2) curvePts.push(`${sx(d).toFixed(2)},${sy(utility(d)).toFixed(2)}`);

  return (
    <div>
      <PanelHeader
        title="Q2. Relational dose-response (ψ_R, β_R, d_safe)"
        claim="OpenAI-MIT N=981 four-week RCT supports the piecewise shape: voluntary daily use predicts loneliness, dependence, and reduced in-person socialization regardless of text/voice/personal/impersonal arm. Voice protective at low doses but protection vanishes at high. Dose dominates modality. Without raw data, magnitudes are calibrated rather than fit — ψ_R re-estimates to 0.0028 (model 0.003); β_R unchanged at 0.001. The catastrophic-loss mechanism (Replika ERP removal) is a separate failure mode the model's additive-channel structure does not encode."
        verdict="supported qualitatively"
        verdictKind="qualitative"
      />

      <CardGrid>
        <NumberCard label="d_safe" value={`${dSafe} min/d`} hint="placeholder kink" />
        <NumberCard label="β_R" value={String(beta)} hint="below threshold benefit slope" />
        <NumberCard label="ψ_R (re-fit)" value={String(psi)} hint={`model: ${DOSE_FIT.model_psi_R}`} />
        <NumberCard label="ERP shock" value="0.13% → 0.65%" hint={`χ²=${DOSE_FIT.catastrophic_loss_chi2}, p<.001`} />
      </CardGrid>

      <h5 className="font-display text-[15px] text-ink mb-2">Modeled dose-response (thin-baseline user, δ_R=0.4)</h5>
      <div className="border border-rule-soft rounded bg-paper">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" style={{ display: 'block' }}>
          {/* y grid */}
          {[-0.20, -0.15, -0.10, -0.05, 0, 0.05].map(v => (
            <g key={v}>
              <line x1={padL} y1={sy(v)} x2={W - padR} y2={sy(v)} stroke="#e6dfcf" strokeWidth={0.5} />
              <text x={padL - 6} y={sy(v) + 3.5} fontSize="9" fill="#7a7166" fontFamily="JetBrains Mono, monospace" textAnchor="end">{v >= 0 ? '+' : ''}{v.toFixed(2)}</text>
            </g>
          ))}
          {/* x grid */}
          {[0, 30, 60, 90, 120].map(v => (
            <g key={v}>
              <line x1={sx(v)} y1={padT} x2={sx(v)} y2={H - padB} stroke="#e6dfcf" strokeWidth={0.5} />
              <text x={sx(v)} y={H - padB + 14} fontSize="9" fill="#7a7166" fontFamily="JetBrains Mono, monospace" textAnchor="middle">{v}</text>
            </g>
          ))}
          {/* zero line */}
          <line x1={padL} y1={sy(0)} x2={W - padR} y2={sy(0)} stroke="#7a7166" strokeWidth={1} />
          {/* d_safe vertical */}
          <line x1={sx(dSafe)} y1={padT} x2={sx(dSafe)} y2={H - padB} stroke="#c98a6e" strokeWidth={1} strokeDasharray="3 3" />
          <text x={sx(dSafe) + 4} y={padT + 11} fontSize="9" fill="#8a4a2b" fontFamily="JetBrains Mono, monospace">d_safe = 30 min</text>
          {/* curve */}
          <polyline points={curvePts.join(' ')} fill="none" stroke="#1a1614" strokeWidth={1.5} />
          {/* anchor markers */}
          <circle cx={sx(13)} cy={sy(utility(13))} r={5} fill="#8a4a2b" stroke="#f7f3ec" strokeWidth={1.5}>
            <title>Therabot avg dose ≈ 13 min/day</title>
          </circle>
          <text x={sx(13)} y={sy(utility(13)) - 8} fontSize="9" fill="#1a1614" fontFamily="Source Serif 4, serif" textAnchor="middle">Therabot</text>
          <circle cx={sx(90)} cy={sy(utility(90))} r={5} fill="#a89677" stroke="#f7f3ec" strokeWidth={1.5}>
            <title>OpenAI-MIT high-dose anchor</title>
          </circle>
          <text x={sx(90)} y={sy(utility(90)) - 8} fontSize="9" fill="#1a1614" fontFamily="Source Serif 4, serif" textAnchor="middle">OAI-MIT high</text>
          {/* x label */}
          <text x={padL + innerW / 2} y={H - 4} fontSize="10" fill="#3a342c" fontFamily="Source Serif 4, serif" textAnchor="middle">daily AI-emotional engagement (min)</text>
          {/* y label */}
          <text x={12} y={padT + innerH / 2} fontSize="10" fill="#3a342c" fontFamily="Source Serif 4, serif" textAnchor="middle" transform={`rotate(-90 12 ${padT + innerH / 2})`}>ΔV_rel + ΔM_rel</text>
        </svg>
      </div>

      <h5 className="font-display text-[15px] text-ink mt-5 mb-2">Empirical anchor points</h5>
      <div className="border border-rule-soft rounded overflow-hidden">
        <div className="grid grid-cols-[1fr_90px_140px_140px] text-[10px] font-mono uppercase tracking-wider text-muted px-3 py-2 bg-paper border-b border-rule-soft">
          <span>anchor</span>
          <span>dose (min)</span>
          <span>outcome</span>
          <span>direction</span>
        </div>
        {DOSE_ANCHORS.map((d, i) => (
          <div key={i} className="grid grid-cols-[1fr_90px_140px_140px] text-[12px] px-3 py-1.5 border-b border-rule-soft last:border-b-0">
            <span className="text-ink">{d.label}</span>
            <span className="text-ink-soft font-mono text-[11px]">{d.daily_minutes}</span>
            <span className="text-muted">{d.outcome}</span>
            <span className={'font-mono text-[10px] uppercase tracking-wider ' + (
              d.effect_direction === 'beneficial' || d.effect_direction === 'protective' ? 'text-accent' :
              d.effect_direction === 'null' ? 'text-muted' : 'text-accent-soft'
            )}>{d.effect_direction.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>

      <FootNote>
        Curve shape is fit to the OpenAI-MIT qualitative finding (low-dose null/protective, high-dose harmful, dose dominates modality). Magnitudes are calibrated, not fit — Stage 4 pass 2 should mine the public summary statistics at <code>mitmedialab/chatbot-psychosocial-study</code> on GitHub and refit ψ_R, β_R, and d_safe directly. d_safe ≈ 30 min is a useful pedagogical kink; the underlying curve is plausibly smooth and may have a sigmoidal saturation at very high doses.
      </FootNote>
    </div>
  );
}

// ---- Q1 — λ atrophy speed ---------------------------------------------

function Q1Lambda() {
  // Plot ρ(t) = ρ₀ · exp(−λ · u · t) for several λ values at u=0.6
  const W = 520;
  const H = 220;
  const padL = 50;
  const padR = 12;
  const padT = 12;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const tMax = 10; // years
  const sx = (v: number) => padL + (v / tMax) * innerW;
  const sy = (v: number) => padT + (1 - v) * innerH;

  const u = 0.6;
  const rho0 = 0.8;
  const trajectories: { lambda: number; label: string; color: string }[] = [
    { lambda: 0.0,  label: 'λ = 0 (calculator)',  color: '#7a7166' },
    { lambda: 0.06, label: 'λ = 0.06 (model)',    color: '#8a4a2b' },
    { lambda: 0.10, label: 'λ = 0.10 (Ehsan)',    color: '#c98a6e' },
    { lambda: 0.20, label: 'λ = 0.20 (Bastani)',  color: '#1a1614' },
  ];

  const traj = (lam: number) => {
    const pts: string[] = [];
    for (let t = 0; t <= tMax; t += 0.2) {
      pts.push(`${sx(t).toFixed(2)},${sy(rho0 * Math.exp(-lam * u * t)).toFixed(2)}`);
    }
    return pts.join(' ');
  };

  return (
    <div>
      <PanelHeader
        title="Q1. λ — cumulative atrophy speed"
        claim="λ = 0 (calculator-analogue) ruled out for the measured tasks and populations (Bastani math, Ehsan oncology, Gerlich UK adults). Whether the analogue holds for general multi-task knowledge work over multi-year timescales remains open — no existing study has the design. Under standard scaling: Bastani amortized to one year at heavy offloading → λ ≈ 0.19/year; Ehsan year-long at moderate u → λ ≈ 0.10/year. Honest band from positive-evidence studies: 0.05–0.20/year. The model's λ = 0.06 sits at the lower edge — consistent with the data but not centered."
        verdict="bounded from below"
        verdictKind="bounded"
      />

      <CardGrid>
        <NumberCard label="model λ" value={String(LAMBDA_BOUNDS.model_default)} hint={`half-life ≈ ${LAMBDA_BOUNDS.half_life_at_default_heavy_u}y at u=0.6`} />
        <NumberCard label="lower bound" value={LAMBDA_BOUNDS.realistic_lower_bound_band} hint="cross-sectional evidence" />
        <NumberCard label="Bastani amortized" value={`≈ ${LAMBDA_BOUNDS.bastani_amortized_yearlong}`} hint="−17pp / 1yr at u=1" />
        <NumberCard label="Ehsan year-long" value={`≈ ${LAMBDA_BOUNDS.ehsan_year_long_moderate_u}`} hint="dulling at u=0.5" />
      </CardGrid>

      <h5 className="font-display text-[15px] text-ink mb-2">ρ(t) trajectories under different λ (u = 0.6, ρ₀ = 0.8)</h5>
      <div className="border border-rule-soft rounded bg-paper">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" style={{ display: 'block' }}>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map(v => (
            <g key={v}>
              <line x1={padL} y1={sy(v)} x2={W - padR} y2={sy(v)} stroke="#e6dfcf" strokeWidth={0.5} />
              <text x={padL - 6} y={sy(v) + 3.5} fontSize="9" fill="#7a7166" fontFamily="JetBrains Mono, monospace" textAnchor="end">{v.toFixed(1)}</text>
            </g>
          ))}
          {[0, 2, 4, 6, 8, 10].map(t => (
            <g key={t}>
              <line x1={sx(t)} y1={padT} x2={sx(t)} y2={H - padB} stroke="#e6dfcf" strokeWidth={0.5} />
              <text x={sx(t)} y={H - padB + 14} fontSize="9" fill="#7a7166" fontFamily="JetBrains Mono, monospace" textAnchor="middle">{t}</text>
            </g>
          ))}
          {trajectories.map(t => (
            <polyline key={t.lambda} points={traj(t.lambda)} fill="none" stroke={t.color} strokeWidth={t.lambda === 0.06 ? 2 : 1.2} strokeDasharray={t.lambda === 0 ? '4 3' : undefined} />
          ))}
          <text x={padL + innerW / 2} y={H - 4} fontSize="10" fill="#3a342c" fontFamily="Source Serif 4, serif" textAnchor="middle">years</text>
          <text x={12} y={padT + innerH / 2} fontSize="10" fill="#3a342c" fontFamily="Source Serif 4, serif" textAnchor="middle" transform={`rotate(-90 12 ${padT + innerH / 2})`}>ρ (retained practice)</text>
        </svg>
      </div>
      <Legend items={trajectories.map(t => ({ label: t.label, color: t.color }))} />

      <h5 className="font-display text-[15px] text-ink mt-5 mb-2">Cross-sectional offloading evidence</h5>
      <div className="border border-rule-soft rounded overflow-hidden">
        <div className="grid grid-cols-[200px_60px_1fr_140px] text-[10px] font-mono uppercase tracking-wider text-muted px-3 py-2 bg-paper border-b border-rule-soft">
          <span>study</span>
          <span>n</span>
          <span>finding</span>
          <span>evidence type</span>
        </div>
        {COGNITIVE_OFFLOADING.map(r => (
          <div key={r.study} className="grid grid-cols-[200px_60px_1fr_140px] text-[12px] px-3 py-1.5 border-b border-rule-soft last:border-b-0">
            <span className="text-ink">{r.study}</span>
            <span className="text-muted font-mono text-[11px]">{r.n || '—'}</span>
            <span className="text-ink-soft text-[11px]">{r.effect_label}</span>
            <span className="text-muted font-mono text-[10px] uppercase tracking-wider">{r.cumulative_evidence.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>

      <FootNote>
        Translation of Bastani's per-event deskilling to per-year λ relies on assumed offloading rate u and time-scale projection; both are interpretive (see D3 in the cruxes). The "bounded from below" verdict is more defensible than a "fit" verdict — the cross-sectional evidence establishes that cumulative offloading produces measurable skill decay in at least some domains, ruling out the strong calculator-analogue claim, but the numeric lower bound itself is interpretive. The 2+ year longitudinal study with periodic capacity assessment that would pin λ does not yet exist.
      </FootNote>
    </div>
  );
}

// ---- Q4 — scalar T, B (untestable) ------------------------------------

function Q4Identity() {
  return (
    <div>
      <PanelHeader
        title="Q4. Scalar T, B vs vector identity-domain allocation"
        claim="Real careers span multiple identity domains (work, family, civic, hobby, friendship), each with its own T_i, B_i, φ_i, a_i, κ_i. The model's scalar T, B is the appropriate first-cut. A clean test would require (a) identity-domain weights per respondent, (b) AI-exposure measurement per domain, and (c) outcome measurement (meaning, life satisfaction, identity coherence) tied to (a) × (b). No existing dataset combines all three."
        verdict="untestable"
        verdictKind="untestable"
      />

      <div className="border border-rule-soft rounded p-4 bg-paper space-y-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted">What exists</div>
          <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
            <span className="font-mono text-[12px] text-accent">ATUS</span> — per-domain time use, no identity weights. <span className="font-mono text-[12px] text-accent">SDT panels</span> — domain importance (aspirations, life-task batteries), but not paired with AI-use data. <span className="font-mono text-[12px] text-accent">AI-use surveys</span> (Anthropic Economic Index, Pew, Common Sense Media) — frequency by demographic, not by identity domain.
          </p>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted">What's needed</div>
          <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
            ATUS respondents × domain-importance battery × per-domain AI-use frequency × meaning / wellbeing measure. Smallest design that would fit the question. Probable cost: a single-wave panel survey with N ≈ 2,000 — within reach of any well-funded research group, but not currently in the field.
          </p>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted">Stage 5 implication</div>
          <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
            Expose T and B as user-tunable scalars while flagging in the dashboard text that the scalar is doing dual work — identity-domain count <span className="font-mono text-[11px] text-accent">and</span> atelic share within domain. The S2 (identity diversification) recommendation maps to "raise B" under this conflation; a vector form would let S2 and S3 be visibly distinct interventions.
          </p>
        </div>
      </div>

      <FootNote>
        This is one of two parameters where the model's defensive-side conclusions rest on an unfit constant (the other is κ — see Q5). Readers should treat the precise numbers in ΔM_telic and ΔM_comp as ordinal-only (which configuration is structurally better-positioned) until Q4 / Q5 can be fit.
      </FootNote>
    </div>
  );
}

// ---- Q5 — κ (untestable) ----------------------------------------------

function Q5Kappa() {
  return (
    <div>
      <PanelHeader
        title="Q5. κ — competence-frustration sensitivity (population calibration)"
        claim="κ ∈ [0, 1] translates competence shortfall into amotivation. The model predicts κ varies across populations and may stratify by trait class (higher in conscientiousness-loaded populations). The Basic Psychological Need Satisfaction and Frustration Scale (BPNSFS) gives within-study coefficients but not a portable population-level scale. SDT literature has measured competence frustration in clinical samples and college students but has not measured how κ stratifies under measured AI-exposure variation."
        verdict="untestable"
        verdictKind="untestable"
      />

      <div className="border border-rule-soft rounded p-4 bg-paper space-y-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted">What exists</div>
          <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
            <span className="font-mono text-[12px] text-accent">BPNSFS within-study</span> — Chen et al. 2015, dozens of replications; reliable per-study but no cross-population panel. <span className="font-mono text-[12px] text-accent">SDT clinical work</span> — competence frustration in depression and burnout populations, not in AI-exposed knowledge workers. <span className="font-mono text-[12px] text-accent">Conscientiousness stratification</span> — Big-Five panels exist but are not paired with BPNSFS + AI-use.
          </p>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted">What's needed</div>
          <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
            BPNSFS panel × AI-use frequency × Big-Five conscientiousness × self-reported competence-displacement experiences. Cross-population sample to test whether κ stratifies meaningfully. Cleanest design: nested in the Q4 instrument above — same panel, additional batteries.
          </p>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted">Connection to human-psych-variation</div>
          <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
            The sibling topic <a href="/ai-research/human-psych-variation" className="text-accent underline underline-offset-2">human-psych-variation</a> is the natural home for κ population calibration. If conscientiousness and neuroticism predict κ, the joint fit is novel even though neither dataset is. A future cross-topic refinement should attempt this.
          </p>
        </div>
      </div>

      <FootNote>
        Until κ is fit at population scale, the model's defensive-side ΔM_comp channel should be read as: "if κ has the value the model assigns, this is what happens." Useful for comparative claims (this configuration vs. that one) but not for absolute claims about meaning loss.
      </FootNote>
    </div>
  );
}

// ---- Backdrop — apprenticeship ladder + AEI ---------------------------

function BackdropPanel() {
  // Bar chart for entry-level
  const W = 520;
  const H = 28;
  const padX = 8;
  const innerW = W - 2 * padX;
  const maxAbs = 22; // pct
  const sx = (v: number) => padX + ((v + maxAbs) / (2 * maxAbs)) * innerW;
  const zeroX = sx(0);

  // AEI series
  const aeiW = 480;
  const aeiH = 200;
  const aeiPadL = 50;
  const aeiPadR = 80;
  const aeiPadT = 12;
  const aeiPadB = 30;
  const aeiInnerW = aeiW - aeiPadL - aeiPadR;
  const aeiInnerH = aeiH - aeiPadT - aeiPadB;
  const consumer = AEI_DRIFT.filter(a => a.surface === 'consumer');
  const xByDate = (date: string) => {
    const idx = consumer.findIndex(a => a.date === date);
    return aeiPadL + (idx / Math.max(1, consumer.length - 1)) * aeiInnerW;
  };
  const ay = (v: number) => aeiPadT + (1 - (v - 30) / (70 - 30)) * aeiInnerH;
  const consumerPath = consumer.map((a, i) => `${i === 0 ? 'M' : 'L'} ${xByDate(a.date).toFixed(2)} ${ay(a.augmentation_pct).toFixed(2)}`).join(' ');

  return (
    <div>
      <PanelHeader
        title="Structural backdrop — apprenticeship break + AEI drift"
        claim="Two side-results from the broader landscape data. Both load on the topology's E4 / G5 (apprenticeship-ladder break) and G3 (engagement-optimized substitution) mechanisms. Independent confirmation across the US payroll panel and global freelance market for the apprenticeship-ladder break; slow but monotonic drift toward automation in consumer Claude.ai over 13 months for AEI."
        verdict="exploratory"
        verdictKind="qualitative"
      />

      <h5 className="font-display text-[15px] text-ink mb-2">Entry-level + freelancer disruption</h5>
      <div className="space-y-1 text-[12px] mb-2">
        <div className="grid grid-cols-[300px_1fr] gap-3 text-[10px] font-mono uppercase tracking-wider text-muted pb-1 border-b border-rule-soft">
          <span>cohort</span>
          <div className="relative h-3">
            {[-20, -10, 0, 10, 20].map(v => (
              <span key={v} className="absolute" style={{ left: `${((v + maxAbs) / (2 * maxAbs)) * 100}%`, transform: 'translateX(-50%)' }}>
                {v > 0 ? '+' : ''}{v}%
              </span>
            ))}
          </div>
        </div>
        {ENTRY_LEVEL.map(row => (
          <div key={row.cohort + row.metric} className="grid grid-cols-[300px_1fr] gap-3 items-center py-1">
            <span className="text-ink text-[12px] flex flex-col">
              <span>{row.cohort}</span>
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider">{row.metric}</span>
            </span>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H}>
              {[-20, -10, 10, 20].map(v => (
                <line key={v} x1={sx(v)} y1={0} x2={sx(v)} y2={H} stroke="#e6dfcf" strokeWidth={0.5} />
              ))}
              <line x1={zeroX} y1={0} x2={zeroX} y2={H} stroke="#7a7166" strokeWidth={1} />
              <rect
                x={Math.min(zeroX, sx(row.effect_pct))}
                y={H / 2 - 6}
                width={Math.abs(sx(row.effect_pct) - zeroX)}
                height={12}
                fill={row.effect_pct < 0 ? '#8a4a2b' : '#a89677'}
                fillOpacity={0.7}
              />
              <text
                x={sx(row.effect_pct) + (row.effect_pct < 0 ? -6 : 6)}
                y={H / 2 + 3.5}
                fontSize="10"
                fill="#1a1614"
                fontFamily="JetBrains Mono, monospace"
                textAnchor={row.effect_pct < 0 ? 'end' : 'start'}
              >
                {row.effect_pct > 0 ? '+' : ''}{row.effect_pct}%
              </text>
            </svg>
          </div>
        ))}
      </div>
      <Legend items={[
        { label: 'employment / earnings decline', color: '#8a4a2b' },
        { label: 'increase', color: '#a89677' },
      ]} />

      <h5 className="font-display text-[15px] text-ink mt-6 mb-2">AEI augmentation share (consumer Claude.ai)</h5>
      <div className="border border-rule-soft rounded bg-paper">
        <svg viewBox={`0 0 ${aeiW} ${aeiH}`} preserveAspectRatio="none" width="100%" style={{ display: 'block' }}>
          {[30, 40, 50, 60, 70].map(v => (
            <g key={v}>
              <line x1={aeiPadL} y1={ay(v)} x2={aeiW - aeiPadR} y2={ay(v)} stroke="#e6dfcf" strokeWidth={0.5} />
              <text x={aeiPadL - 6} y={ay(v) + 3.5} fontSize="9" fill="#7a7166" fontFamily="JetBrains Mono, monospace" textAnchor="end">{v}%</text>
            </g>
          ))}
          {consumer.map(a => (
            <text key={a.date} x={xByDate(a.date)} y={aeiH - aeiPadB + 14} fontSize="9" fill="#7a7166" fontFamily="JetBrains Mono, monospace" textAnchor="middle">{a.date}</text>
          ))}
          {/* 50% midpoint */}
          <line x1={aeiPadL} y1={ay(50)} x2={aeiW - aeiPadR} y2={ay(50)} stroke="#c98a6e" strokeWidth={1} strokeDasharray="3 3" />
          <text x={aeiW - aeiPadR + 6} y={ay(50) + 3} fontSize="9" fill="#8a4a2b" fontFamily="JetBrains Mono, monospace">50%</text>
          <path d={consumerPath} fill="none" stroke="#1a1614" strokeWidth={1.5} />
          {consumer.map(a => (
            <g key={a.date + 'pt'}>
              <circle cx={xByDate(a.date)} cy={ay(a.augmentation_pct)} r={4} fill="#8a4a2b" stroke="#f7f3ec" strokeWidth={1.5} />
              <text x={xByDate(a.date)} y={ay(a.augmentation_pct) - 8} fontSize="9" fill="#1a1614" fontFamily="JetBrains Mono, monospace" textAnchor="middle">{a.augmentation_pct}%</text>
            </g>
          ))}
          {/* API anchor */}
          <line x1={xByDate('Jan 2026')} y1={ay(30)} x2={xByDate('Jan 2026')} y2={ay(30) + 12} stroke="#a89677" strokeWidth={1} />
          <circle cx={xByDate('Jan 2026')} cy={ay(30)} r={4} fill="#a89677" stroke="#f7f3ec" strokeWidth={1.5} />
          <text x={xByDate('Jan 2026') + 6} y={ay(30) + 3.5} fontSize="9" fill="#7a7166" fontFamily="JetBrains Mono, monospace">API automation 70%</text>
          <text x={aeiPadL + aeiInnerW / 2} y={aeiH - 4} fontSize="10" fill="#3a342c" fontFamily="Source Serif 4, serif" textAnchor="middle">AEI report date</text>
          <text x={12} y={aeiPadT + aeiInnerH / 2} fontSize="10" fill="#3a342c" fontFamily="Source Serif 4, serif" textAnchor="middle" transform={`rotate(-90 12 ${aeiPadT + aeiInnerH / 2})`}>augmentation share</text>
        </svg>
      </div>

      <FootNote>
        Apprenticeship-ladder break: independent confirmation across two settings (US payroll panel + global freelance platform). Effect size larger in the freelance market — lower switching costs, more transparent pricing, less institutional friction — consistent with the freelance market acting as the leading indicator for broader labor restructuring. AEI consumer-surface drift is slow (~0.5 pp / month) but monotonic over four reports. API surface dominated by automation throughout. Both consistent with the topology's claim that engagement-optimized substitution (G3) is structurally favored over time, but slow.
      </FootNote>
    </div>
  );
}

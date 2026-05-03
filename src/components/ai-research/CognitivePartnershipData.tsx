import { useState } from 'react';

// ----------------------------------------------------------------------
// Findings panel for the data stage of technology-utilization-architecture.
//
// All numbers below come from the curated CSVs in
// stage_outputs/technology-utilization-architecture/data/, frozen at
// build time. Re-run pipeline.py and re-paste findings.json to refresh.
//
// V4 design tokens used directly (paper, ink, ink-soft, muted, rule,
// rule-soft, accent, accent-soft, paper-edge). Charts hand-rolled in
// SVG to match the model-stage and human-psych-variation aesthetic.
// ----------------------------------------------------------------------

// ---- Frozen data from findings.json -----------------------------------

// Pass 2: Q1 reframed around Mozannar 2024 published aggregates only.
// The granular 10-state breakdown in pass 1 was partly extrapolated;
// pass 2 uses only the 4 cells separately reported in Figure 5(b)
// plus the 51.5% Copilot-specific aggregate.
const Q1_PUBLISHED_CELLS = [
  { name: 'Copilot-specific (verify + defer + wait + prompt + edit)', share: 51.5, sd: 19.3, color: '#8a4a2b' },
  { name: 'Pure thinking/verifying suggestion', share: 22.4, sd: 12.97, color: '#c98a6e' },
  { name: 'Writing new functionality', share: 14.05, sd: 8.36, color: '#1a1614' },
  { name: 'Waiting for suggestion', share: 4.2, sd: 4.46, color: '#a89677' },
];
const Q1_FITTED = {
  phi_cyborg: 1.59,           // verify (22.4) / write-new (14.05)
  phi_default: 0.30,
  epsilon_default: 0.15,
};

const Q2_CONDITIONS: { name: string; in_session: number; post_test: number; beta_implied: number; corner: string }[] = [
  { name: 'Control', in_session: 0, post_test: 0, beta_implied: 0.000, corner: '— (no AI)' },
  { name: 'GPT Base (unfettered)', in_session: 48, post_test: -17, beta_implied: 0.057, corner: '(1, 0) self-automator' },
  { name: 'GPT Tutor (guardrailed)', in_session: 127, post_test: 0, beta_implied: 0.000, corner: '(1, 1) spec-driven' },
];

const Q3_CORNERS = {
  model: [
    { label: '(0, 0) do-yourself', share: 0.076 },
    { label: '(1, 0) self-automator', share: 0.516 },
    { label: '(1, 1) spec-driven', share: 0.408 },
  ],
  empirical: [
    { label: 'cyborg', share: 0.60 },
    { label: 'centaur', share: 0.30 },
    { label: 'self-automator', share: 0.10 },
  ],
};

const Q4_ANCHORS: {
  study: string;
  c_h: number;
  c_ai: number;
  observed: number;
  cleanly_misrouted: boolean;
}[] = [
  { study: "Dell'Acqua inside",  c_h: 0.55, c_ai: 0.85, observed: 40,   cleanly_misrouted: false },
  { study: "Dell'Acqua outside", c_h: 0.65, c_ai: 0.40, observed: -19,  cleanly_misrouted: true },
  { study: 'Brynjolfsson novice', c_h: 0.40, c_ai: 0.70, observed: 34,  cleanly_misrouted: false },
  { study: 'Brynjolfsson expert', c_h: 0.85, c_ai: 0.70, observed: 0,   cleanly_misrouted: false },
  { study: 'Otis high-baseline',  c_h: 0.50, c_ai: 0.65, observed: 15,  cleanly_misrouted: false },
  { study: 'Otis low-baseline',   c_h: 0.55, c_ai: 0.40, observed: -8,  cleanly_misrouted: true },
  { study: 'Goh physicians + GPT-4', c_h: 0.74, c_ai: 0.90, observed: 2, cleanly_misrouted: false },
  { study: 'Everett indep-then-synth', c_h: 0.74, c_ai: 0.90, observed: 9.9, cleanly_misrouted: false },
  { study: 'METR real-repo',      c_h: 0.85, c_ai: 0.55, observed: -19, cleanly_misrouted: true },
];

// Pass 2: split into within-study (no across-study confounds) and
// across-study (with confounds disclosed).
const Q5_WITHIN_STUDY: { label: string; swing: number; design: string }[] = [
  { label: 'Bastani unfettered→guardrailed', swing: 17, design: 'same RCT, same students, same model, same task set' },
  { label: 'Single-agent → multi-agent (Anthropic)', swing: 90.2, design: 'same internal eval, same base model' },
];
const Q5_ACROSS_STUDY: { label: string; swing: number; design: string; confounds: string }[] = [
  {
    label: 'Goh 2024 → Everett 2025 (medicine)',
    swing: 7.9,
    design: 'across-study comparison; same broad domain',
    confounds: 'different vignettes; different outcome metrics; different AI implementations (Goh: vanilla GPT-4; Everett: custom GPT system with engineered system prompt)',
  },
];

const Q6_CORNER_VARIANCE = [
  { corner: '(0, 0) do-yourself', mean: -0.28, sd: 0.000 },
  { corner: '(1, 0) self-automator', mean: 0.286, sd: 0.246 },
  { corner: '(1, 1) spec-driven', mean: 0.303, sd: 0.088 },
];

const Q6_FINDINGS: { finding: string; source: string }[] = [
  { finding: 'Higher confidence in GenAI correlates with less critical thinking (n=319)', source: 'Lee & Sarkar 2025 CHI' },
  { finding: 'Participants more confident when over- AND under-relying than when relying appropriately', source: 'Wang et al. 2025 CHI' },
  { finding: 'Cognitive forcing functions help only high Need-for-Cognition users', source: 'Buçinca 2021 CSCW' },
  { finding: 'Sycophancy escalation: AI flips correct human judgments under pushback', source: 'Randazzo HBS WP 26-021' },
  { finding: 'Explanations increase acceptance regardless of correctness', source: 'Bansal 2021 CHI' },
];

const PRODUCTIVITY: {
  label: string;
  domain: string;
  effect_pct: number;
  is_neg?: boolean;
  outline?: 'novice' | 'expert' | 'mixed';
  source: string;
}[] = [
  { label: 'Brynjolfsson novice',  domain: 'cs_support',     effect_pct:  34, outline: 'novice', source: 'Brynjolfsson 2023' },
  { label: 'Brynjolfsson avg',     domain: 'cs_support',     effect_pct:  14, outline: 'mixed',  source: 'Brynjolfsson 2023' },
  { label: 'Brynjolfsson expert',  domain: 'cs_support',     effect_pct:   0, outline: 'expert', source: 'Brynjolfsson 2023' },
  { label: 'Noy & Zhang quality',  domain: 'writing',        effect_pct:  18, source: 'Noy & Zhang 2023' },
  { label: 'Peng coding speed',    domain: 'coding',         effect_pct:  56, source: 'Peng 2023' },
  { label: 'Cui coding (3 expts)', domain: 'coding',         effect_pct:  26, source: 'Cui 2025 Mgmt Sci' },
  { label: 'METR real-repo',       domain: 'coding',         effect_pct: -19, is_neg: true, outline: 'expert', source: 'Becker et al. 2025' },
  { label: 'Otis high-baseline',   domain: 'entrepreneur',   effect_pct:  15, source: 'Otis 2024' },
  { label: 'Otis low-baseline',    domain: 'entrepreneur',   effect_pct:  -8, is_neg: true, source: 'Otis 2024' },
  { label: "Dell'Acqua inside",    domain: 'consulting',     effect_pct:  40, source: "Dell'Acqua 2023" },
  { label: "Dell'Acqua outside",   domain: 'consulting',     effect_pct: -19, is_neg: true, source: "Dell'Acqua 2023" },
  { label: 'Goh physician + GPT-4', domain: 'medicine',      effect_pct:   2, source: 'Goh 2024 JAMA NO' },
  { label: 'Everett (AI-first)',    domain: 'medicine',      effect_pct:  9.9, source: 'Everett 2025' },
  { label: 'Bastani unfettered',    domain: 'education',     effect_pct:  48, source: 'Bastani 2025 PNAS' },
  { label: 'Bastani guardrailed',   domain: 'education',     effect_pct: 127, source: 'Bastani 2025 PNAS' },
  { label: 'Bastani post-test base', domain: 'education',    effect_pct: -17, is_neg: true, source: 'Bastani 2025 PNAS' },
  { label: 'Schoenegger (calibrated)', domain: 'forecasting', effect_pct: 23, source: 'Schoenegger 2024/25' },
  { label: 'Schoenegger (overconfident)', domain: 'forecasting', effect_pct: 28, source: 'Schoenegger 2024/25' },
  { label: 'Anthropic multi-agent', domain: 'research',     effect_pct: 90.2, source: 'Anthropic 2025' },
  { label: 'Humlum-Vestergaard (aggregate)', domain: 'labor', effect_pct: 0, outline: 'mixed', source: 'Humlum 2025 NBER' },
];

// ---- Tabs --------------------------------------------------------------

type Tab = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'productivity';

const TABS: { key: Tab; label: string; symbol: string }[] = [
  { key: 'productivity', label: 'Productivity record', symbol: 'S1' },
  { key: 'q1', label: 'CUPS time fractions',  symbol: 'Q1' },
  { key: 'q2', label: 'Bastani β fit',        symbol: 'Q2' },
  { key: 'q3', label: 'Mode distribution',    symbol: 'Q3' },
  { key: 'q4', label: 'Outside-frontier',     symbol: 'Q4' },
  { key: 'q5', label: 'Workflow > capability', symbol: 'Q5' },
  { key: 'q6', label: 'c_AI calibration',     symbol: 'Q6' },
];

export default function CognitivePartnershipData() {
  const [tab, setTab] = useState<Tab>('productivity');
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
      {tab === 'productivity' && <ProductivityPanel />}
      {tab === 'q1' && <Q1Panel />}
      {tab === 'q2' && <Q2Panel />}
      {tab === 'q3' && <Q3Panel />}
      {tab === 'q4' && <Q4Panel />}
      {tab === 'q5' && <Q5Panel />}
      {tab === 'q6' && <Q6Panel />}
    </div>
  );
}

// ---- Atoms -----------------------------------------------------------

type VerdictKind = 'supported' | 'caveat' | 'mixed' | 'framed';

function Verdict({ kind, children }: { kind: VerdictKind; children: React.ReactNode }) {
  const color =
    kind === 'supported' ? 'text-accent border-accent' :
    kind === 'caveat'    ? 'text-accent-soft border-accent-soft' :
    kind === 'framed'    ? 'text-muted border-rule' :
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
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-1">{label}</div>
      <div className="font-display text-[22px] text-ink leading-none">{value}</div>
      {hint && <div className="text-[11px] text-muted mt-1.5 leading-snug">{hint}</div>}
    </div>
  );
}

// ---- Productivity record (S1 backdrop) -------------------------------

function ProductivityPanel() {
  const data = PRODUCTIVITY;
  // Bound the scale at -25 .. +130
  const xMin = -25;
  const xMax = 135;
  const W = 600;
  const H = 22 * data.length + 30;
  const padTop = 18;
  const padLeft = 180;
  const innerW = W - padLeft - 12;

  const sx = (v: number) => padLeft + ((v - xMin) / (xMax - xMin)) * innerW;

  return (
    <div>
      <PanelHeader
        title="The productivity record (~22 RCTs and field experiments, 2023–2026)"
        claim="The empirical context for S1 (workflow architecture > model capability). Same axis (% effect of AI), 22 study rows. Sienna bars = positive effects. Muted bars = ~zero. Soft-sienna bars = negative effects (the four mis-routed cases — METR real-repo, Otis low-baseline, Dell'Acqua outside-frontier, Bastani unassisted post-test). The Humlum-Vestergaard aggregate-zero (n=25,000 Danish workers) is the named scope-limit at the bottom."
        verdict="evidence base"
        verdictKind="framed"
      />

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 480 }}>
          {/* zero line */}
          <line x1={sx(0)} y1={padTop - 4} x2={sx(0)} y2={H - 4} stroke="#3a342c" strokeWidth={0.7} />
          {/* gridlines */}
          {[-20, 20, 40, 60, 80, 100, 120].map(v => (
            <line key={v} x1={sx(v)} y1={padTop - 4} x2={sx(v)} y2={H - 4} stroke="#e6dfcf" strokeWidth={0.5} />
          ))}
          {/* x-axis ticks */}
          {[-20, 0, 20, 40, 60, 80, 100, 120].map(v => (
            <text key={v} x={sx(v)} y={padTop - 6} fontSize={9} fontFamily="JetBrains Mono, monospace" fill="#7a7166" textAnchor="middle">
              {v > 0 ? '+' : ''}{v}%
            </text>
          ))}
          {data.map((d, i) => {
            const y = padTop + 8 + i * 22;
            const x0 = sx(0);
            const x1 = sx(d.effect_pct);
            const isNeg = d.effect_pct < 0;
            const isZero = Math.abs(d.effect_pct) < 0.5;
            const fill = isZero ? '#a89677' : isNeg ? '#c98a6e' : '#8a4a2b';
            const opacity = d.outline === 'expert' ? 0.55 : d.outline === 'novice' ? 1.0 : 0.85;
            return (
              <g key={d.label}>
                <text x={padLeft - 10} y={y + 4} fontSize={11} fontFamily="Source Serif 4, serif" fill="#1a1614" textAnchor="end">
                  {d.label}
                </text>
                <rect
                  x={Math.min(x0, x1)}
                  y={y - 5}
                  width={Math.max(Math.abs(x1 - x0), 1)}
                  height={10}
                  fill={fill}
                  opacity={opacity}
                  rx={1}
                />
                <text
                  x={x1 + (isNeg ? -4 : 4)}
                  y={y + 3}
                  fontSize={10}
                  fontFamily="JetBrains Mono, monospace"
                  fill="#3a342c"
                  textAnchor={isNeg ? 'end' : 'start'}
                >
                  {d.effect_pct > 0 ? '+' : ''}{d.effect_pct}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 text-[11px]">
        <NumberCard label="Studies cited" value="22" hint="Spans 2023–2026 RCTs and field experiments" />
        <NumberCard label="Largest novice gain" value="+34%" hint="Brynjolfsson 2023 customer-support agent novices" />
        <NumberCard label="Largest negative" value="−19%" hint="METR real-repo experts AND Dell'Acqua outside-frontier" />
        <NumberCard label="Aggregate zero" value="0% (CI ±1%)" hint="Humlum-Vestergaard 25k Danish workers; the scope-limit" />
      </div>

      <div className="mt-4 text-[11px] text-muted leading-relaxed">
        Read the four red bars: when the workflow doesn't fit the task structure, AI-augmented work goes worse than no AI. METR experts in real repos (-19%), Otis low-baseline picking too-hard tasks (-8%), Dell'Acqua outside-frontier (-19pp), Bastani unfettered post-test (-17%). All four are explained by the same model mechanism: mis-routing to (u &gt; 0) when c_H &gt; c_AI, OR mis-routing to v=0 when σ·(1−c_AI) is large. The four mis-routed cases are not separate failures; they are one failure with four faces.
      </div>
    </div>
  );
}

// ---- Q1 CUPS ---------------------------------------------------------

function Q1Panel() {
  // Pass 2: only published Mozannar Figure 5(b) cells with SD bars.
  const W = 440;
  const maxShare = 75; // cap above 51.5 + SD
  const sx = (v: number) => (v / maxShare) * W;
  return (
    <div>
      <PanelHeader
        title="Q1. ε and φ from Mozannar 2024 CUPS telemetry"
        claim="The model defaults are ε = 0.15 and φ ≈ 0.30. Mozannar 2024 publishes 51.5% (SD 19.3pp) of session time as Copilot-specific in the cyborg regime — strong qualitative confirmation of the L1 substitution-myth invariant. Cyborg-regime φ ≈ 22.4 / 14.05 ≈ 1.59, far higher than the model's default 0.30 — the headline Q1 finding. Pass-1 ε ≈ 0.17 was retracted as over-precise on partly-fabricated cells."
        verdict="supported qualitatively (φ headline)"
        verdictKind="caveat"
      />

      <div className="border border-rule-soft rounded bg-paper p-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-3">
          Mozannar 2024 Figure 5(b) — published cells only (n=21 programmers, GitHub Copilot)
        </div>
        <svg viewBox={`0 0 ${W} 200`} width="100%" height={220}>
          {Q1_PUBLISHED_CELLS.map((c, i) => {
            const y = 22 + i * 42;
            const xBar = sx(c.share);
            const xSdLow = sx(Math.max(0, c.share - c.sd));
            const xSdHigh = sx(c.share + c.sd);
            return (
              <g key={c.name}>
                <text x={0} y={y - 4} fontSize={10} fontFamily="Source Serif 4, serif" fill="#1a1614">
                  {c.name}
                </text>
                <rect x={0} y={y + 4} width={xBar} height={12} fill={c.color} opacity={0.85} rx={1} />
                <line x1={xSdLow} y1={y + 10} x2={xSdHigh} y2={y + 10} stroke="#3a342c" strokeWidth={1} />
                <line x1={xSdLow} y1={y + 6} x2={xSdLow} y2={y + 14} stroke="#3a342c" strokeWidth={1} />
                <line x1={xSdHigh} y1={y + 6} x2={xSdHigh} y2={y + 14} stroke="#3a342c" strokeWidth={1} />
                <text x={xBar + 6} y={y + 14} fontSize={11} fontFamily="JetBrains Mono, monospace" fill="#3a342c">
                  {c.share}% <tspan fill="#7a7166" fontSize={9}>(SD {c.sd})</tspan>
                </text>
              </g>
            );
          })}
          {/* x-axis */}
          <line x1={0} y1={193} x2={W} y2={193} stroke="#d9d0bf" strokeWidth={0.7} />
          {[0, 25, 50, 75].map(v => (
            <g key={v}>
              <line x1={sx(v)} y1={193} x2={sx(v)} y2={196} stroke="#d9d0bf" strokeWidth={0.5} />
              <text x={sx(v)} y={205} fontSize={9} fontFamily="JetBrains Mono, monospace" fill="#7a7166" textAnchor="middle">
                {v}%
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <NumberCard label="Copilot-specific share" value="51.5%" hint="SD 19.3pp; L1 invariant strongly confirmed" />
        <NumberCard label="Pure verify share" value="22.4%" hint="SD 12.97pp; the 'thinking/verifying' state" />
        <NumberCard label="Cyborg φ estimate" value="1.59" hint={`Default ${Q1_FITTED.phi_default.toFixed(2)}; coding cyborg is verification-heavy`} />
        <NumberCard label="Pass-1 retraction" value="ε ≈ 0.17" hint="Retracted — false precision on partly-fabricated breakdown" />
      </div>

      <p className="text-[11px] text-muted mt-4 leading-relaxed">
        Pass 2 reports only the 4 cells separately published in Mozannar 2024 Figure 5(b), with their reported standard deviations. The Q1 headline is the φ ≈ 1.59 cyborg-regime finding — coding cyborg work spends 1.6× as much time verifying as writing new code, far higher than the model's lit-review prior of 0.30. Implication: φ should be regime-dependent (cyborg-coding ~1.5; spec-driven structured-output ~0.3). Pass 1's ε ≈ 0.17 was computed off a 10-state breakdown where 7 of 10 cells were extrapolated, not published — that false precision is retracted.
      </p>
    </div>
  );
}

// ---- Q2 Bastani β -----------------------------------------------------

function Q2Panel() {
  const W = 460;
  const H = 200;
  const padX = 60;
  const padY = 30;
  const barW = 50;
  const groupW = 130;
  const innerH = H - 2 * padY;
  const yMax = 130;
  const yMin = -25;
  const sy = (v: number) => padY + ((yMax - v) / (yMax - yMin)) * innerH;

  return (
    <div>
      <PanelHeader
        title="Q2. β fitted from Bastani 2025 longitudinal panel"
        claim="The model defaults β = 0.05 per task at u=1, v=0, calibrated to produce Bastani's −17pp unassisted-post-test drop over ~30 unguardrailed problems. Computing the per-problem rate from the empirical −17%/30 = 0.057 — within 14% of the default. The shape is also confirmed: guardrailed condition implies β ≈ 0 (skill preserved), so atrophy IS proportional to UNVERIFIED delegation."
        verdict="supported"
        verdictKind="supported"
      />

      <div className="border border-rule-soft rounded bg-paper p-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">
          Bastani PNAS 2025 — high-school math (~1000 students)
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
          {/* y-axis */}
          <line x1={padX} y1={padY} x2={padX} y2={H - padY} stroke="#d9d0bf" strokeWidth={0.7} />
          {/* y ticks */}
          {[-20, 0, 20, 50, 100].map(v => (
            <g key={v}>
              <line x1={padX - 3} y1={sy(v)} x2={padX} y2={sy(v)} stroke="#d9d0bf" strokeWidth={0.5} />
              <text x={padX - 6} y={sy(v) + 3} fontSize={10} fontFamily="JetBrains Mono, monospace" fill="#7a7166" textAnchor="end">
                {v > 0 ? '+' : ''}{v}%
              </text>
            </g>
          ))}
          {/* zero line */}
          <line x1={padX} y1={sy(0)} x2={W - 10} y2={sy(0)} stroke="#3a342c" strokeWidth={0.7} />
          {Q2_CONDITIONS.map((c, i) => {
            const xCenter = padX + 25 + i * groupW;
            const xIn = xCenter - 28;
            const xPost = xCenter + 4;
            const yIn = sy(Math.max(c.in_session, 0));
            const hIn = Math.abs(sy(c.in_session) - sy(0));
            const yPost = sy(Math.max(c.post_test, 0));
            const hPost = Math.abs(sy(c.post_test) - sy(0));
            return (
              <g key={c.name}>
                {/* in-session bar (sienna) */}
                <rect x={xIn} y={c.in_session > 0 ? yIn : sy(0)} width={barW * 0.5} height={hIn} fill="#8a4a2b" opacity={0.85} />
                {/* post-test bar (soft / negative = darker) */}
                <rect x={xPost} y={c.post_test > 0 ? yPost : sy(0)} width={barW * 0.5} height={hPost} fill={c.post_test < 0 ? '#c98a6e' : '#a89677'} opacity={0.85} />
                <text x={xCenter} y={H - padY + 14} fontSize={10} fontFamily="Source Serif 4, serif" fill="#1a1614" textAnchor="middle">
                  {c.name}
                </text>
                <text x={xCenter} y={H - padY + 26} fontSize={9} fontFamily="JetBrains Mono, monospace" fill="#7a7166" textAnchor="middle">
                  β = {c.beta_implied.toFixed(3)}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex gap-4 mt-2 text-[10px] font-mono text-muted">
          <span><span className="inline-block w-2 h-2 mr-1.5 align-middle" style={{ backgroundColor: '#8a4a2b' }} />in-session lift (with AI)</span>
          <span><span className="inline-block w-2 h-2 mr-1.5 align-middle" style={{ backgroundColor: '#c98a6e' }} />unassisted post-test (after AI removed)</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <NumberCard label="β default" value="0.050" hint="Lit-review-anchored prior" />
        <NumberCard label="β fitted (unfettered)" value="0.057" hint="−17 pp / ~30 problems" />
        <NumberCard label="β fitted (guardrailed)" value="0.000" hint="Skill preserved when v=1" />
        <NumberCard label="Default vs fitted gap" value="14%" hint="Default within sampling noise of empirical" />
      </div>
    </div>
  );
}

// ---- Q3 Mode distribution -------------------------------------------

function Q3Panel() {
  const renderBars = (rows: { label: string; share: number }[], color: string) => {
    const W = 280;
    const H = 30;
    return rows.map(r => (
      <div key={r.label} className="grid grid-cols-[170px_1fr_50px] gap-3 items-center py-1">
        <span className="text-[11px] text-ink">{r.label}</span>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
          <rect x={0} y={H / 2 - 6} width={W} height={12} fill="#e6dfcf" />
          <rect x={0} y={H / 2 - 6} width={r.share * W} height={12} fill={color} opacity={0.85} />
        </svg>
        <span className="text-[11px] font-mono text-muted text-right">{(r.share * 100).toFixed(1)}%</span>
      </div>
    ));
  };
  return (
    <div>
      <PanelHeader
        title="Q3. Mode-distribution structure (Randazzo)"
        claim="The bilinearity result says per-task optima are corners, never interior. Randazzo classifies WORKERS into three behavioural modes (cyborg / centaur / self-automator) — not per-task corners. The empirical 60/30/10 distribution is consistent with TWO different underlying behaviours: (a) workers interleave corners across a day (model prediction), or (b) workers apply a flat interior (u, v) policy uniformly (the failure mode). Randazzo doesn't release per-task u-v telemetry, so the data is silent on which is happening."
        verdict="structural prediction (not directly testable)"
        verdictKind="framed"
      />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border border-rule-soft rounded bg-paper p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">
            Model — per-task corner share (synthetic θ, n=2000)
          </div>
          {renderBars(Q3_CORNERS.model, '#8a4a2b')}
        </div>
        <div className="border border-rule-soft rounded bg-paper p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">
            Randazzo HBS WP 26-036 — empirical worker-level labels (n=244 BCG consultants)
          </div>
          {renderBars(Q3_CORNERS.empirical, '#c98a6e')}
        </div>
      </div>
      <p className="text-[11px] text-muted mt-4 leading-relaxed">
        These are NOT directly comparable bars — left chart is per-task corners under a synthetic BCG-like θ prior; right chart is aggregate worker-mode labels from Randazzo's coding. Pass 2 honest framing: the synthetic exercise demonstrates that corner-mixing CAN aggregate to a 60/30/10 behavioural pattern under reasonable θ priors. Whether BCG consultants actually interleave corners (model prediction) or apply a flat (u, v) policy (failure mode) requires per-task u-v telemetry that Randazzo does not release. Pass 1's interpretive moves (which simultaneously asserted both readings) have been retracted.
      </p>
    </div>
  );
}

// ---- Q4 Outside-frontier --------------------------------------------

function Q4Panel() {
  const W = 460;
  const H = 280;
  const padL = 50;
  const padR = 16;
  const padT = 24;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  // x = (c_H - c_AI) ∈ [-0.55, +0.40]
  const xMin = -0.55;
  const xMax = 0.40;
  // y = observed quality change (%)
  const yMin = -25;
  const yMax = 50;
  const sx = (v: number) => padL + ((v - xMin) / (xMax - xMin)) * innerW;
  const sy = (v: number) => padT + ((yMax - v) / (yMax - yMin)) * innerH;

  return (
    <div>
      <PanelHeader
        title="Q4. Outside-frontier quality magnitude (sanity check)"
        claim="The model says quality drops by u·(c_H − c_AI) when a worker mis-routes. Across three cleanly mis-routed cases, observed drops are in the predicted ballpark — magnitude matches u·(c_H − c_AI) at u in roughly [0.5, 1.0]. Pass 2 disclosure: the (c_H, c_AI) values on the x-axis are inferred from the same outcome variable on the y-axis, so the regression is partly circular. With n=3 and circular x, there's neither degrees of freedom nor independent x — pass 1's 'fitted slope 0.67' was reported as if it were a slope estimate; pass 2 calls it a sanity check, not a slope test."
        verdict="sanity check, consistent"
        verdictKind="caveat"
      />

      <div className="border border-rule-soft rounded bg-paper p-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">
          Each dot = one anchor study. Sienna line = model prediction at u=1; muted dashed line = fitted slope 0.67.
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
          {/* axes */}
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#d9d0bf" strokeWidth={0.7} />
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#d9d0bf" strokeWidth={0.7} />
          {/* zero lines */}
          <line x1={sx(0)} y1={padT} x2={sx(0)} y2={H - padB} stroke="#3a342c" strokeWidth={0.5} strokeDasharray="3 3" />
          <line x1={padL} y1={sy(0)} x2={W - padR} y2={sy(0)} stroke="#3a342c" strokeWidth={0.5} strokeDasharray="3 3" />
          {/* x ticks */}
          {[-0.5, -0.25, 0, 0.25, 0.5].map(v => (
            <g key={`x${v}`}>
              <line x1={sx(v)} y1={H - padB} x2={sx(v)} y2={H - padB + 3} stroke="#d9d0bf" strokeWidth={0.5} />
              <text x={sx(v)} y={H - padB + 14} fontSize={9} fontFamily="JetBrains Mono, monospace" fill="#7a7166" textAnchor="middle">
                {v > 0 ? '+' : ''}{v.toFixed(2)}
              </text>
            </g>
          ))}
          {/* y ticks */}
          {[-20, 0, 20, 40].map(v => (
            <g key={`y${v}`}>
              <line x1={padL - 3} y1={sy(v)} x2={padL} y2={sy(v)} stroke="#d9d0bf" strokeWidth={0.5} />
              <text x={padL - 6} y={sy(v) + 3} fontSize={9} fontFamily="JetBrains Mono, monospace" fill="#7a7166" textAnchor="end">
                {v > 0 ? '+' : ''}{v}%
              </text>
            </g>
          ))}
          {/* axis labels */}
          <text x={sx(0)} y={H - 6} fontSize={10} fontFamily="JetBrains Mono, monospace" fill="#3a342c" textAnchor="middle">
            (c_H − c_AI)
          </text>
          <text x={12} y={padT + innerH / 2} fontSize={10} fontFamily="JetBrains Mono, monospace" fill="#3a342c" textAnchor="middle" transform={`rotate(-90, 12, ${padT + innerH / 2})`}>
            observed % change
          </text>
          {/* model line: y (frac) = -x; draw at u=1 (slope -100% per unit) */}
          <line x1={sx(0)} y1={sy(0)} x2={sx(0.4)} y2={sy(-40)} stroke="#8a4a2b" strokeWidth={1.5} />
          <line x1={sx(0)} y1={sy(0)} x2={sx(-0.4)} y2={sy(40)} stroke="#8a4a2b" strokeWidth={1.5} opacity={0.4} strokeDasharray="2 3" />
          {/* fitted slope: -0.67 */}
          <line x1={sx(0)} y1={sy(0)} x2={sx(0.4)} y2={sy(-26.8)} stroke="#7a7166" strokeWidth={1} strokeDasharray="3 3" />
          {Q4_ANCHORS.map(a => {
            const x = sx(a.c_h - a.c_ai);
            const y = sy(a.observed);
            const fill = a.cleanly_misrouted ? '#8a4a2b' : a.observed >= 0 ? '#1a1614' : '#a89677';
            return (
              <g key={a.study}>
                <circle cx={x} cy={y} r={4} fill={fill} stroke="#f7f3ec" strokeWidth={1}>
                  <title>{a.study}: gap={(a.c_h - a.c_ai).toFixed(2)}, observed={a.observed.toFixed(1)}%</title>
                </circle>
                <text x={x + 6} y={y - 4} fontSize={8.5} fontFamily="Source Serif 4, serif" fill="#3a342c">
                  {a.study}
                </text>
              </g>
            );
          })}
          {/* legend */}
          <g transform={`translate(${W - 165}, ${padT + 2})`}>
            <line x1={0} y1={6} x2={20} y2={6} stroke="#8a4a2b" strokeWidth={1.5} />
            <text x={24} y={9} fontSize={9} fontFamily="JetBrains Mono, monospace" fill="#3a342c">model: y = −x</text>
            <line x1={0} y1={20} x2={20} y2={20} stroke="#7a7166" strokeWidth={1} strokeDasharray="3 3" />
            <text x={24} y={23} fontSize={9} fontFamily="JetBrains Mono, monospace" fill="#3a342c">fitted: y = −0.67·x</text>
            <circle cx={6} cy={36} r={3.5} fill="#8a4a2b" />
            <text x={14} y={39} fontSize={9} fontFamily="JetBrains Mono, monospace" fill="#3a342c">cleanly mis-routed</text>
          </g>
        </svg>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <NumberCard label="Predicted slope (u=1)" value="−1.00" hint="If subjects mis-routed completely" />
        <NumberCard label="Descriptive slope" value="−0.67" hint="Not a real slope test — x inferred from y; n=3" />
        <NumberCard label="Mis-routed n" value="3" hint="Dell'Acqua outside / Otis low / METR" />
        <NumberCard label="Linearity-as-shape" value="untested" hint="Requires per-subject (c_H, c_AI, u) data not currently released" />
      </div>

      <p className="text-[11px] text-muted mt-4 leading-relaxed">
        Pass 2 disclosure: the (c_H, c_AI) gap on the x-axis is inferred from the same outcome variable that drives the y-axis. Regressing observed-quality on outcome-derived gap is structurally circular. The honest qualitative claim — outside-frontier mis-routing produces drops on the order of (c_H − c_AI), not orders of magnitude smaller or larger — is supported. The specific linearity claim requires a within-subject RCT that varies u explicitly across the (c_H − c_AI) range with INDEPENDENT per-subject baseline performance.
      </p>
    </div>
  );
}

// ---- Q5 Workflow > capability ---------------------------------------

function Q5Panel() {
  const W = 460;
  const maxSwing = 100;
  const barH = 24;
  const padLeft = 240;
  const innerW = W - padLeft - 40;

  return (
    <div>
      <PanelHeader
        title="Q5. Workflow architecture > model capability (the headline S1)"
        claim="Pass-2 reorder: within-study evidence (no across-study confounds) at the top, across-study evidence with confounds disclosed below. Bastani within-study (+17pp, same RCT, same students, same model) and Anthropic within-eval (+90.2pp, same internal eval, same base model) carry the case. Goh-vs-Everett (+7.9pp) demoted from 'cleanest natural experiment' to suggestive corroboration: pass 2 surfaced three confounds (different vignettes, different outcome metrics, different AI implementations)."
        verdict="supported by convergent evidence"
        verdictKind="supported"
      />

      <div className="border border-rule-soft rounded bg-paper p-4 mb-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">
          Cleanest within-study evidence (no across-study confounds)
        </div>
        <svg viewBox={`0 0 ${W} ${barH * Q5_WITHIN_STUDY.length + 30}`} width="100%" height={barH * Q5_WITHIN_STUDY.length + 30}>
          {[20, 40, 60, 80, 100].map(v => (
            <line key={v} x1={padLeft + (v / maxSwing) * innerW} y1={4} x2={padLeft + (v / maxSwing) * innerW} y2={barH * Q5_WITHIN_STUDY.length + 22} stroke="#e6dfcf" strokeWidth={0.5} />
          ))}
          {Q5_WITHIN_STUDY.map((s, i) => {
            const y = 16 + i * barH + 5;
            const w = (s.swing / maxSwing) * innerW;
            return (
              <g key={s.label}>
                <text x={padLeft - 8} y={y + 4} fontSize={11} fontFamily="Source Serif 4, serif" fill="#1a1614" textAnchor="end">
                  {s.label}
                </text>
                <rect x={padLeft} y={y - 5} width={w} height={10} fill="#8a4a2b" opacity={0.9} rx={1} />
                <text x={padLeft + w + 4} y={y + 3} fontSize={10} fontFamily="JetBrains Mono, monospace" fill="#3a342c">
                  +{s.swing}{s.swing < 50 ? 'pp' : '%'}
                </text>
                <text x={padLeft - 8} y={y + 16} fontSize={9} fontFamily="JetBrains Mono, monospace" fill="#7a7166" textAnchor="end">
                  {s.design}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="border border-rule-soft rounded bg-paper p-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">
          Suggestive across-study evidence (with confounds disclosed)
        </div>
        {Q5_ACROSS_STUDY.map(s => (
          <div key={s.label} className="text-[12px]">
            <div className="flex items-baseline justify-between">
              <span className="text-ink">{s.label}</span>
              <span className="font-mono text-accent-soft">+{s.swing}pp</span>
            </div>
            <div className="text-[10px] font-mono text-muted mt-0.5">{s.design}</div>
            <div className="text-[10px] text-muted mt-1.5 leading-snug border-l-2 border-rule-soft pl-2">
              <span className="font-mono uppercase tracking-wider text-accent-soft mr-1">confounds:</span>
              {s.confounds}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
        <NumberCard
          label="Bastani within-study"
          value="+17pp"
          hint="Same model, same students, same task set; load-bearing"
        />
        <NumberCard
          label="Anthropic within-eval"
          value="+90.2%"
          hint="Same base model, internal eval; load-bearing"
        />
        <NumberCard
          label="Vaccaro meta"
          value="106 / 370"
          hint="Studies / effect sizes; population-level corroboration of asymmetry"
        />
      </div>

      <p className="text-[11px] text-muted mt-4 leading-relaxed">
        Pass-2 reframing: the load-bearing evidence for S1 is within-study (Bastani: same RCT comparing unfettered vs guardrailed at the same model and student pool; Anthropic: same internal eval comparing single-agent vs orchestrator-worker at the same base model class). Goh-vs-Everett's +7.9pp is suggestive but bundles three confounds — different vignette sets, different outcome rubrics, different AI implementations (vanilla GPT-4 in Goh; custom GPT system with engineered system prompt in Everett). Vaccaro 2024's 106-study meta-analysis showing decision-vs-creation asymmetry corroborates S1 at the population level.
      </p>
    </div>
  );
}

// ---- Q6 Calibration -------------------------------------------------

function Q6Panel() {
  const maxSD = 0.30;
  const W = 360;
  const H = 30;
  return (
    <div>
      <PanelHeader
        title="Q6. Calibration / explore-exploit on c_AI"
        claim="The model treats c_AI as known, but the literature uniformly documents miscalibration. Q6 is structural, not literature-replicable: the pipeline tabulates the calibration evidence and runs a Monte-Carlo showing that spec-driven (1, 1) absorbs c_AI variance much more effectively than self-automator (1, 0) — the variance ratio is the information bonus a fully-specified extension would credit to verification under uncertainty."
        verdict="framed_not_resolved"
        verdictKind="framed"
      />

      <div className="border border-rule-soft rounded bg-paper p-4 mb-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">
          Monte Carlo — V variance per corner under c_AI ~ Beta(4, 2) (n=2000)
        </div>
        <div className="space-y-2 text-[12px]">
          {Q6_CORNER_VARIANCE.map(r => (
            <div key={r.corner} className="grid grid-cols-[170px_1fr_60px] gap-3 items-center">
              <span className="text-ink">{r.corner}</span>
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
                <rect x={0} y={H / 2 - 6} width={W} height={12} fill="#e6dfcf" />
                <rect x={0} y={H / 2 - 6} width={(r.sd / maxSD) * W} height={12} fill={r.corner.includes('1, 1') ? '#8a4a2b' : '#c98a6e'} opacity={0.85} />
              </svg>
              <span className="font-mono text-muted text-[10px] text-right">SD = {r.sd.toFixed(3)}</span>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-muted mt-3 leading-relaxed">
          Lower SD = corner is more robust to c_AI uncertainty. Spec-driven absorbs ~64% more variance than self-automator. The variance reduction (~0.05) is the model's information bonus — verifying isn't only a quality move, it's a learning move.
        </div>
      </div>

      <div className="border border-rule-soft rounded bg-paper p-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-3">
          Literature evidence — c_AI miscalibration is the rule, not the exception
        </div>
        <ul className="text-[12px] text-ink-soft space-y-2">
          {Q6_FINDINGS.map(f => (
            <li key={f.finding} className="flex gap-2">
              <span className="text-accent-soft">•</span>
              <span>
                {f.finding} <span className="text-muted text-[10px] font-mono">— {f.source}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[11px] text-muted mt-4 leading-relaxed">
        Practical reading: when you don't know c_AI on a new task, the model's optimal advice doubles as a calibration recipe — verify the first few outputs to estimate c_AI, then drop verification once your prior tightens. The spec-driven corner isn't only about quality; it's about learning what you don't know about the AI on this task type.
      </p>
    </div>
  );
}

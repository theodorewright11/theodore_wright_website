import { useMemo, useState } from 'react';

type Tab = 'router' | 'portfolio';
type Mode = 'do-yourself' | 'centaur' | 'cyborg' | 'self-automator' | 'spec-driven';

// ---- Constants (calibrated to lit-review anchors) ----------------------
//
// α (attention price). Normalisation: attention is the numéraire; all other
// costs are denominated in attention units. α = 1.
//
// ε (residual attention at full delegation). Mozannar CUPS (E12) shows
// verification + monitoring is a "substantial fraction" of total interaction
// time even when AI is doing the generation. 0.15 is a midpoint of the
// reported range. This is the L1 substitution-myth invariant — without
// ε > 0 the model would predict full delegation is free of attention cost,
// which is exactly the substitution myth.
//
// β (per-task skill-atrophy rate). Bastani PNAS 17% drop (E9) over a
// session of ~30 unguardrailed tasks → ~0.5% per task. β = 0.05 means
// the model implies ~5% atrophy per task in the worst-case (u=1, v=0)
// regime, which compounds to Bastani's order-of-magnitude over a week.
//
// M (per-task metacognitive routing tax). Tankelevitch G1 metacognitive-
// bottleneck finding compressed to a constant. 0.08 = 8% of the base
// generation time per task is consistent with the magnitude of the
// metacognitive-bottleneck claim. Stage 4 should test whether M varies
// by task type.

const ALPHA = 1.0;
const EPSILON = 0.15;
const BETA = 0.05;
const M_ROUTE = 0.08;

// ---- Mode classification thresholds ------------------------------------
const U_LO = 0.15;
const U_HI = 0.85;
const V_LO = 0.30;
const V_HI = 0.60;

function classifyMode(u: number, v: number): Mode {
  if (u < U_LO) return 'do-yourself';
  if (u >= U_HI && v < V_LO) return 'self-automator';
  if (u >= U_HI && v >= V_HI) return 'spec-driven';
  if (v >= V_HI) return 'centaur';
  return 'cyborg';
}

const MODE_LABEL: Record<Mode, string> = {
  'do-yourself': 'Do yourself',
  'centaur': 'Centaur',
  'cyborg': 'Cyborg',
  'self-automator': 'Self-automator (trap)',
  'spec-driven': 'Spec-driven / independent-then-synthesize',
};

// ---- Per-task value function -------------------------------------------

type TaskParams = {
  cH: number;     // human capability
  cAI: number;   // AI capability
  phi: number;   // verify/generate cost ratio
  sigma: number; // stakes
  lambda: number; // skill-formation value
};

type TaskResult = {
  V: number;
  Q: number;
  A: number;
  R: number;
  S: number;
  qChannel: number;   // quality contribution to V (= Q − cH baseline)
  aChannel: number;   // attention contribution to V (= −α·(A − M))
  rChannel: number;   // risk contribution to V (= −σ·R)
  sChannel: number;   // skill contribution to V (= λ·S)
};

function computeV(u: number, v: number, p: TaskParams): TaskResult {
  // Verified-output ceiling: c_⋆ = c_AI + (1 − c_AI)·c_H = 1 − (1 − c_AI)·(1 − c_H).
  // "Either AI got it right OR human catches the error." This naturally
  // handles deskilled verifier (c_H → 0 ⇒ c_⋆ → c_AI, verification adds
  // nothing) and verifier-stronger (c_H → 1 ⇒ c_⋆ → 1) without a piecewise
  // max. Pass-1 used Math.max(c_H, c_AI), which over-credited verification
  // when c_H > c_AI (as if the human catches every AI error) and under-
  // credited it when c_H < c_AI (as if a partly-skilled human catches no
  // AI errors). The complementary-product form is what falls out from
  // independent error events; pass 2 fix.
  const cStar = p.cAI + (1 - p.cAI) * p.cH;
  const Q = (1 - u) * p.cH + u * ((1 - v) * p.cAI + v * cStar);
  const A = (1 - u * (1 - EPSILON)) + v * p.phi + M_ROUTE;
  const R = u * (1 - v) * (1 - p.cAI);
  const S = (1 - u) - BETA * u * (1 - v);
  const V = Q - ALPHA * A + p.lambda * S - p.sigma * R;
  return {
    V, Q, A, R, S,
    qChannel: Q - p.cH,
    aChannel: -ALPHA * (A - (1 + M_ROUTE)),
    rChannel: -p.sigma * R,
    sChannel: p.lambda * (S - 1),
  };
}

// Grid-search optimum on the unit square.
function optimize(p: TaskParams) {
  const N = 40;
  let best = { u: 0, v: 0, result: computeV(0, 0, p) };
  for (let ui = 0; ui <= N; ui++) {
    for (let vi = 0; vi <= N; vi++) {
      const u = ui / N;
      const v = vi / N;
      const r = computeV(u, v, p);
      if (r.V > best.result.V) {
        best = { u, v, result: r };
      }
    }
  }
  return best;
}

// ---- UI atoms ----------------------------------------------------------

type SliderProps = {
  label: string;
  symbol?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  unit?: string;
  onChange: (v: number) => void;
};

function Slider({ label, symbol, value, min, max, step, decimals, unit, onChange }: SliderProps) {
  const dec = decimals ?? (step < 1 ? 2 : 0);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-[13px] text-ink-soft">
          {symbol && <span className="font-mono text-accent mr-2">{symbol}</span>}
          {label}
        </label>
        <span className="text-[13px] font-mono text-ink">{value.toFixed(dec)}{unit ?? ''}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#8a4a2b]"
      />
    </div>
  );
}

type NumberCardProps = {
  label: string;
  value: string;
  formula?: string;
  hint?: string;
  tone?: 'pos' | 'neg' | 'neutral';
};

function NumberCard({ label, value, formula, hint, tone }: NumberCardProps) {
  const valueColor =
    tone === 'pos' ? 'text-accent' :
    tone === 'neg' ? 'text-[#5a3221]' :
    'text-ink';
  return (
    <div className="border border-rule rounded px-3 py-2 bg-paper">
      <div className="text-[10px] uppercase tracking-wider font-mono text-muted">{label}</div>
      <div className={`text-[18px] font-display mt-0.5 ${valueColor}`}>{value}</div>
      {formula && <div className="text-[10px] font-mono text-muted mt-0.5">{formula}</div>}
      {hint && <div className="text-[10px] text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

type SignedBarProps = {
  segments: { label: string; value: number; color: string; }[];
  axisMax?: number;
};

function SignedBar({ segments, axisMax = 0.6 }: SignedBarProps) {
  return (
    <div className="space-y-1">
      {segments.map((s, i) => {
        const sign = s.value >= 0 ? 1 : -1;
        const mag = Math.min(Math.abs(s.value), axisMax);
        const widthPct = (mag / axisMax) * 50;
        return (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <div className="w-32 font-mono text-muted shrink-0">{s.label}</div>
            <div className="flex-1 h-4 relative bg-paper border border-rule rounded overflow-hidden">
              <div className="absolute inset-y-0 left-1/2 w-px bg-rule" />
              <div
                className="absolute inset-y-0 transition-all"
                style={{
                  backgroundColor: s.color,
                  left: sign > 0 ? '50%' : `${50 - widthPct}%`,
                  width: `${widthPct}%`,
                }}
              />
            </div>
            <div className="w-14 font-mono text-ink text-right">{s.value >= 0 ? '+' : ''}{s.value.toFixed(3)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Per-task router ---------------------------------------------------

type RouterPresetKey =
  | 'boilerplate_code'
  | 'persuasive_writing'
  | 'lit_synthesis'
  | 'strategic_decision'
  | 'routine_email'
  | 'novice_spec'
  | 'expert_outside_frontier';

const ROUTER_PRESETS: Record<RouterPresetKey, { label: string; params: TaskParams; note: string }> = {
  boilerplate_code: {
    label: 'Boilerplate code',
    params: { cH: 0.80, cAI: 0.90, phi: 0.20, sigma: 0.30, lambda: 0.10 },
    note: 'AI strong, easy to verify (run tests), low stakes, low skill-formation value. Optimum lands deep in self-automator / spec-driven territory.',
  },
  persuasive_writing: {
    label: 'Persuasive writing',
    params: { cH: 0.70, cAI: 0.50, phi: 0.60, sigma: 0.50, lambda: 0.60 },
    note: 'Human better than AI here, verification expensive (need to read carefully), skill matters. Optimum tilts toward do-yourself or low-u centaur.',
  },
  lit_synthesis: {
    label: 'Literature synthesis',
    params: { cH: 0.50, cAI: 0.65, phi: 0.30, sigma: 0.40, lambda: 0.40 },
    note: 'AI mildly stronger, modestly cheap verification, moderate stakes. Optimum lands at spec-driven — AI does the synthesis, you read the output.',
  },
  strategic_decision: {
    label: 'Strategic decision',
    params: { cH: 0.65, cAI: 0.30, phi: 0.80, sigma: 0.95, lambda: 0.70 },
    note: 'Human much stronger, verification is the whole job, very high stakes, must preserve judgment. Optimum: do-yourself, or use AI as devil\'s-advocate consultant only.',
  },
  routine_email: {
    label: 'Routine email',
    params: { cH: 0.75, cAI: 0.85, phi: 0.10, sigma: 0.05, lambda: 0.05 },
    note: 'AI stronger, very cheap to verify, low stakes, no skill. Optimum: spec-driven — but interpret v=1 here as the empirical "skim" (the bilinear model rounds skim to full-verify).',
  },
  novice_spec: {
    label: 'Novice on a hard task (Brynjolfsson + Bastani)',
    params: { cH: 0.30, cAI: 0.70, phi: 0.20, sigma: 0.50, lambda: 0.50 },
    note: 'Big AI capability advantage on a task the worker is still learning, real stakes, real skill-formation value, cheap-verify. Optimum: spec-driven — full delegation with full verification (read the AI output to learn from it).',
  },
  expert_outside_frontier: {
    label: 'Expert outside the frontier (Dell\'Acqua)',
    params: { cH: 0.85, cAI: 0.40, phi: 0.50, sigma: 0.70, lambda: 0.60 },
    note: 'Human much better, AI worse, high stakes. The Dell\'Acqua "outside-frontier 19-pp drop" regime. Optimum: do-yourself. Naive AI use here is the harm.',
  },
};

const DEFAULT_TASK = ROUTER_PRESETS.lit_synthesis.params;

function RouterPanel() {
  const [params, setParams] = useState<TaskParams>(DEFAULT_TASK);
  const [presetNote, setPresetNote] = useState<string>(ROUTER_PRESETS.lit_synthesis.note);

  const opt = useMemo(() => optimize(params), [params]);
  const mode = classifyMode(opt.u, opt.v);

  const setPreset = (k: RouterPresetKey) => {
    setParams(ROUTER_PRESETS[k].params);
    setPresetNote(ROUTER_PRESETS[k].note);
  };

  const set = <K extends keyof TaskParams>(k: K) => (v: number) => setParams(prev => ({ ...prev, [k]: v }));

  // Channel decomposition for the four-bar chart.
  const channels = [
    { label: 'Q quality', value: opt.result.qChannel, color: '#3a342c' },
    { label: 'A attention', value: opt.result.aChannel, color: '#8a4a2b' },
    { label: 'R risk', value: opt.result.rChannel, color: '#5a3221' },
    { label: 'S skill', value: opt.result.sChannel, color: '#7a7166' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Task parameters (θ)</h4>
        <div className="space-y-4">
          <Slider symbol="c_H" label="Human capability on this task" value={params.cH} min={0} max={1} step={0.01} onChange={set('cH')} />
          <Slider symbol="c_AI" label="AI capability on this task" value={params.cAI} min={0} max={1} step={0.01} onChange={set('cAI')} />
          <Slider symbol="φ" label="Verification cost ratio (verify / generate)" value={params.phi} min={0} max={2} step={0.01} onChange={set('phi')} />
          <Slider symbol="σ" label="Stakes (uncaught-error penalty weight)" value={params.sigma} min={0} max={1} step={0.01} onChange={set('sigma')} />
          <Slider symbol="λ" label="Skill-formation value (preserve this skill?)" value={params.lambda} min={0} max={1} step={0.01} onChange={set('lambda')} />
        </div>

        <div className="mt-6 pt-4 border-t border-rule-soft">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">Task presets</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(ROUTER_PRESETS) as RouterPresetKey[]).map(k => (
              <button
                key={k}
                onClick={() => setPreset(k)}
                className="px-2 py-1 text-[11px] font-mono border border-rule rounded text-muted hover:text-accent hover:border-accent text-left"
              >
                {ROUTER_PRESETS[k].label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-3 leading-relaxed italic">{presetNote}</p>
        </div>
      </div>

      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Optimal policy</h4>
        <div className="grid grid-cols-3 gap-2">
          <NumberCard
            label="u*"
            value={opt.u.toFixed(2)}
            formula="autonomy"
            tone="neutral"
          />
          <NumberCard
            label="v*"
            value={opt.v.toFixed(2)}
            formula="verification"
            tone="neutral"
          />
          <NumberCard
            label="V*"
            value={(opt.result.V >= 0 ? '+' : '') + opt.result.V.toFixed(3)}
            formula="net value"
            tone={opt.result.V >= 0 ? 'pos' : 'neg'}
          />
        </div>

        <div className="mt-4 border border-accent rounded px-3 py-2 bg-paper">
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted">Workflow mode</div>
          <div className="text-[16px] font-display text-accent mt-0.5">{MODE_LABEL[mode]}</div>
          <div className="text-[10px] font-mono text-muted mt-1">
            (u, v) = ({opt.u.toFixed(2)}, {opt.v.toFixed(2)}) → {mode}
          </div>
        </div>

        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mt-6 mb-3">Channel decomposition</h4>
        <SignedBar segments={channels} axisMax={0.4} />
        <p className="text-[11px] text-muted mt-2 leading-relaxed">
          Each bar shows that channel&apos;s contribution to V at the optimum. Q is gain over the human-only baseline; A is attention saved (or spent) vs. the M-only floor; R is the stakes-weighted risk penalty; S is the skill change weighted by λ.
        </p>

        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mt-6 mb-3">Diagnostics</h4>
        <div className="space-y-2 text-[11px] text-muted">
          <div>Q (quality) = {opt.result.Q.toFixed(3)}, A (attention) = {opt.result.A.toFixed(3)}, R (risk) = {opt.result.R.toFixed(3)}, S (skill) = {opt.result.S.toFixed(3)}</div>
          <div>c_⋆ = c_AI + (1 − c_AI)·c_H = {(params.cAI + (1 - params.cAI) * params.cH).toFixed(3)}</div>
          <div className="text-[10px] italic">V is bilinear in (u, v); the maximum on the unit square is at a corner. The router will return one of three corners — (0, 0) do-yourself, (1, 0) self-automator, or (1, 1) spec-driven. Centaur and cyborg modes appear at the aggregate level when a worker mixes corner policies across sub-tasks with heterogeneous θ — see Day Portfolio.</div>
          {params.cH > params.cAI && opt.u > U_LO && (
            <div className="text-accent">⚠ Outside-frontier regime (c_H &gt; c_AI) but optimum still uses AI — verify your φ and σ are right; the Dell&apos;Acqua harm pattern starts here.</div>
          )}
          {opt.u >= U_HI && opt.v < V_LO && params.lambda > 0.3 && (
            <div className="text-accent">⚠ Self-automator on a high-λ task — skill atrophy is being accepted; check whether you actually want to give up this capacity.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Day portfolio -----------------------------------------------------

type PortfolioTask = {
  key: string;
  label: string;
  params: TaskParams;
  count: number;
  g: number; // base generation time per instance (relative units)
};

type Strategy = 'self' | 'maxai' | 'naive' | 'optimal';

const STRATEGY_LABEL: Record<Strategy, string> = {
  self: 'Always-self (pre-AI)',
  maxai: 'Max-AI (u=1, v=0)',
  naive: 'Naive cyborg (u=0.7, v=0.3)',
  optimal: 'Optimal routing (u*, v*)',
};

const DEFAULT_PORTFOLIO: PortfolioTask[] = [
  { key: 'boilerplate_code', label: 'Boilerplate code', params: ROUTER_PRESETS.boilerplate_code.params, count: 8, g: 1.0 },
  { key: 'routine_email', label: 'Routine email', params: ROUTER_PRESETS.routine_email.params, count: 12, g: 0.5 },
  { key: 'lit_synthesis', label: 'Lit synthesis', params: ROUTER_PRESETS.lit_synthesis.params, count: 3, g: 2.0 },
  { key: 'persuasive_writing', label: 'Persuasive writing', params: ROUTER_PRESETS.persuasive_writing.params, count: 2, g: 3.0 },
  { key: 'strategic_decision', label: 'Strategic decision', params: ROUTER_PRESETS.strategic_decision.params, count: 1, g: 4.0 },
];

function strategyChoice(strategy: Strategy, params: TaskParams): { u: number; v: number } {
  if (strategy === 'self') return { u: 0, v: 0 };
  if (strategy === 'maxai') return { u: 1, v: 0 };
  if (strategy === 'naive') return { u: 0.7, v: 0.3 };
  // optimal
  const opt = optimize(params);
  return { u: opt.u, v: opt.v };
}

function evaluatePortfolio(tasks: PortfolioTask[], strategy: Strategy) {
  let totalQ = 0;
  let totalA = 0;
  let totalS = 0;
  let totalR = 0;
  let totalQ_baseline = 0; // total quality if everything were always-self
  for (const t of tasks) {
    const { u, v } = strategyChoice(strategy, t.params);
    const r = computeV(u, v, t.params);
    totalQ += r.Q * t.count;
    totalA += r.A * t.count * t.g;
    totalS += (r.S - 1) * t.count * t.params.lambda;
    totalR += r.R * t.count * t.params.sigma;
    totalQ_baseline += t.params.cH * t.count;
  }
  return { totalQ, totalA, totalS, totalR, totalQ_baseline };
}

function PortfolioPanel() {
  const [tasks, setTasks] = useState<PortfolioTask[]>(DEFAULT_PORTFOLIO);
  const [budget, setBudget] = useState(20);

  const setCount = (key: string, count: number) => {
    setTasks(prev => prev.map(t => t.key === key ? { ...t, count } : t));
  };

  const evaluations = useMemo(() => {
    const strategies: Strategy[] = ['self', 'maxai', 'naive', 'optimal'];
    return strategies.map(s => ({ strategy: s, ...evaluatePortfolio(tasks, s) }));
  }, [tasks]);

  const optEval = evaluations.find(e => e.strategy === 'optimal')!;
  const naiveEval = evaluations.find(e => e.strategy === 'naive')!;
  const selfEval = evaluations.find(e => e.strategy === 'self')!;
  const maxAiEval = evaluations.find(e => e.strategy === 'maxai')!;

  // Quality per unit attention — the headline metric.
  const qPerA = (e: typeof optEval) => e.totalA > 0 ? e.totalQ / e.totalA : 0;

  const maxQ = Math.max(...evaluations.map(e => e.totalQ));
  const maxA = Math.max(...evaluations.map(e => e.totalA));
  const maxQpA = Math.max(...evaluations.map(qPerA));

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Task mix (count per day)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tasks.map(t => (
            <div key={t.key} className="border border-rule rounded px-3 py-2">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[12px] text-ink-soft">{t.label}</span>
                <span className="text-[11px] font-mono text-muted">g = {t.g.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={t.count}
                  onChange={e => setCount(t.key, parseInt(e.target.value))}
                  className="flex-1 accent-[#8a4a2b]"
                />
                <span className="text-[12px] font-mono text-ink w-8 text-right">{t.count}</span>
              </div>
              <div className="text-[10px] font-mono text-muted mt-1">
                c_H={t.params.cH.toFixed(2)} c_AI={t.params.cAI.toFixed(2)} φ={t.params.phi.toFixed(2)} σ={t.params.sigma.toFixed(2)} λ={t.params.lambda.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted">Daily attention budget T</h4>
          <span className="text-[12px] font-mono text-ink">{budget.toFixed(1)} units</span>
        </div>
        <input
          type="range"
          min={5}
          max={40}
          step={0.5}
          value={budget}
          onChange={e => setBudget(parseFloat(e.target.value))}
          className="w-full accent-[#8a4a2b]"
        />
      </div>

      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Strategies compared</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-rule text-muted font-mono text-[10px] uppercase tracking-wider">
                <th className="text-left py-2 pr-3">Strategy</th>
                <th className="text-right py-2 pr-3">Total Q</th>
                <th className="text-right py-2 pr-3">Total A</th>
                <th className="text-right py-2 pr-3">Q/A</th>
                <th className="text-right py-2 pr-3">Skill change</th>
                <th className="text-right py-2 pr-3">Risk</th>
                <th className="text-right py-2 pr-0">In budget?</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map(e => {
                const isOptimal = e.strategy === 'optimal';
                const inBudget = e.totalA <= budget;
                return (
                  <tr key={e.strategy} className={`border-b border-rule-soft ${isOptimal ? 'bg-paper-edge' : ''}`}>
                    <td className={`py-2 pr-3 ${isOptimal ? 'text-accent font-medium' : 'text-ink-soft'}`}>{STRATEGY_LABEL[e.strategy]}</td>
                    <td className="text-right py-2 pr-3 font-mono text-ink">{e.totalQ.toFixed(2)}</td>
                    <td className="text-right py-2 pr-3 font-mono text-ink">{e.totalA.toFixed(2)}</td>
                    <td className="text-right py-2 pr-3 font-mono text-ink">{qPerA(e).toFixed(3)}</td>
                    <td className={`text-right py-2 pr-3 font-mono ${e.totalS >= 0 ? 'text-ink' : 'text-[#5a3221]'}`}>{e.totalS >= 0 ? '+' : ''}{e.totalS.toFixed(2)}</td>
                    <td className="text-right py-2 pr-3 font-mono text-[#5a3221]">{e.totalR.toFixed(2)}</td>
                    <td className={`text-right py-2 pr-0 font-mono ${inBudget ? 'text-ink' : 'text-accent'}`}>{inBudget ? 'yes' : 'over'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Headline (S1: workflow architecture &gt; model capability)</h4>
        <div className="space-y-2 text-[12px] text-ink-soft leading-relaxed">
          <p>
            On the same task mix and the same c_AI, optimal routing achieves{' '}
            <span className="font-mono text-accent">Q/A = {qPerA(optEval).toFixed(3)}</span> vs.{' '}
            <span className="font-mono">{qPerA(naiveEval).toFixed(3)}</span> for the naive flat-cyborg heuristic ({((qPerA(optEval) / qPerA(naiveEval) - 1) * 100).toFixed(1)}% lift in quality-per-attention),{' '}
            <span className="font-mono">{qPerA(maxAiEval).toFixed(3)}</span> for max-AI (which over-spends attention on the residual-monitoring tax ε), and{' '}
            <span className="font-mono">{qPerA(selfEval).toFixed(3)}</span> for always-self (which under-uses available capability).
          </p>
          <p className="text-muted text-[11px]">
            The S1 effect is the gap between &quot;optimal routing on mid-tier AI&quot; and &quot;naive routing on frontier AI&quot;. The dashboard runs both routings on the same c_AI; widen the gap by raising c_AI uniformly (frontier regime) and notice that the naive strategy still loses to optimal because it over-delegates on high-σ, high-λ tasks. The model capability matters; the routing matters more.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- Top-level shell ---------------------------------------------------

export default function CognitivePartnershipModel() {
  const [tab, setTab] = useState<Tab>('router');

  return (
    <div className="not-prose border border-rule rounded-md p-5 bg-paper-edge">
      <div className="flex items-center gap-1 mb-5 border-b border-rule pb-3">
        {(['router', 'portfolio'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 text-[12px] font-mono uppercase tracking-wider rounded ${
              tab === t
                ? 'bg-accent text-paper'
                : 'text-muted hover:text-accent'
            }`}
          >
            {t === 'router' ? 'Per-task router' : 'Day portfolio'}
          </button>
        ))}
      </div>

      {tab === 'router' && <RouterPanel />}
      {tab === 'portfolio' && <PortfolioPanel />}

      <p className="text-[10px] font-mono text-muted mt-6 pt-4 border-t border-rule-soft leading-relaxed">
        V(u, v; θ) = Q(u,v) − α·A(u,v) + λ·S(u,v) − σ·R(u,v). Constants: α = {ALPHA.toFixed(2)} (normalised), ε = {EPSILON.toFixed(2)} (residual attention at u=1; L1 invariant), β = {BETA.toFixed(2)} (per-task atrophy rate), M = {M_ROUTE.toFixed(2)} (routing tax). Mode thresholds: u_lo = {U_LO}, u_hi = {U_HI}, v_lo = {V_LO}, v_hi = {V_HI}. Optimum found by 41×41 grid search on the unit square. Stage-4 fitting will tighten α, ε, β, M against telemetry data; mode-distribution match against Randazzo BCG sample (~60% cyborg / ~30% centaur / ~10% self-automator) is Q3 of the named fitting targets.
      </p>
    </div>
  );
}

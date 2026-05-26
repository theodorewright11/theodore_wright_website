import { useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Build-stage artifact for technology-utilization-architecture.
//
// Plain-language reader's tool that wraps the model formalisation
// (CognitivePartnershipModel.tsx) and the data-pipeline findings
// (CognitivePartnershipData.tsx) into something a knowledge worker can
// actually pick up and use. Five views:
//
//   1. Pick a task        — plain-language questions → corner recommendation
//                            + named empirical anchor + source citation
//   2. Compare strategies — same task mix, four strategies side-by-side,
//                            with budget-aware optimal routing
//   3. Common mistakes    — five failure modes the model identifies
//   4. When to verify     — calibration coach + persuasion-bombing mitigation
//   5. Cheat sheet        — seven take-aways that survive the pipeline
//
// Math is identical to the model dashboard (per-task bilinear V on the unit
// square, three viable corners) but the UI never shows c_H, c_AI, φ, σ, λ.
// The reader picks discrete options (low / medium / high) per characteristic
// and each maps to a default parameter inside the model. The plain-language
// values can be over-ridden via a "show the math" toggle inside the task
// detail panel.
// ---------------------------------------------------------------------------

type View = 'task' | 'compare' | 'mistakes' | 'verify' | 'cheatsheet';
type Corner = 'do-yourself' | 'self-automator' | 'spec-driven';
type Level = 'low' | 'medium' | 'high';

// Model constants identical to CognitivePartnershipModel.tsx
const ALPHA = 1.0;
const EPSILON = 0.15;
const BETA = 0.05;
const M_ROUTE = 0.08;

type TaskParams = {
  cH: number;
  cAI: number;
  phi: number;
  sigma: number;
  lambda: number;
};

function computeV(u: number, v: number, p: TaskParams) {
  const cStar = p.cAI + (1 - p.cAI) * p.cH;
  const Q = (1 - u) * p.cH + u * ((1 - v) * p.cAI + v * cStar);
  const A = (1 - u * (1 - EPSILON)) + v * p.phi + M_ROUTE;
  const R = u * (1 - v) * (1 - p.cAI);
  const S = (1 - u) - BETA * u * (1 - v);
  const V = Q - ALPHA * A + p.lambda * S - p.sigma * R;
  return { V, Q, A, R, S };
}

// Three viable corners + the one we know is dominated (verify with no AI = pure cost)
const CORNERS: { corner: Corner; u: number; v: number }[] = [
  { corner: 'do-yourself', u: 0, v: 0 },
  { corner: 'self-automator', u: 1, v: 0 },
  { corner: 'spec-driven', u: 1, v: 1 },
];

function bestCorner(p: TaskParams): { corner: Corner; u: number; v: number; V: number } {
  let best = { corner: 'do-yourself' as Corner, u: 0, v: 0, V: computeV(0, 0, p).V };
  for (const c of CORNERS) {
    const v = computeV(c.u, c.v, p).V;
    if (v > best.V) best = { ...c, V: v };
  }
  return best;
}

// ---- Plain-language level → parameter mapping ---------------------------

const LEVEL_VAL: Record<Level, { cH: number; cAI: number; phi: number; sigma: number; lambda: number }> = {
  low: { cH: 0.35, cAI: 0.35, phi: 0.20, sigma: 0.10, lambda: 0.10 },
  medium: { cH: 0.60, cAI: 0.60, phi: 0.50, sigma: 0.45, lambda: 0.45 },
  high: { cH: 0.85, cAI: 0.85, phi: 1.00, sigma: 0.90, lambda: 0.85 },
};

type Answers = {
  youAreGood: Level;     // c_H
  aiIsGood: Level;       // c_AI
  verifyCost: Level;     // φ
  stakes: Level;         // σ
  skillMatters: Level;   // λ
};

function answersToParams(a: Answers): TaskParams {
  return {
    cH: LEVEL_VAL[a.youAreGood].cH,
    cAI: LEVEL_VAL[a.aiIsGood].cAI,
    phi: LEVEL_VAL[a.verifyCost].phi,
    sigma: LEVEL_VAL[a.stakes].sigma,
    lambda: LEVEL_VAL[a.skillMatters].lambda,
  };
}

// ---- Empirical-anchor lookup -------------------------------------------
// Each corner + an answer profile maps to the closest empirical anchor
// from data.mdx §3. The match is on the dominant feature, not all five.

type Anchor = {
  label: string;
  source: string;
  url: string;
  finding: string;
};

const ANCHORS: Record<string, Anchor> = {
  do_yourself_outside: {
    label: 'Dell\'Acqua outside-frontier',
    source: 'Dell\'Acqua 2023',
    url: 'https://pubsonline.informs.org/doi/10.1287/orsc.2025.21838',
    finding: 'BCG consultants forced to use AI on tasks where they were better than the AI scored 19 pp WORSE than the no-AI control. Predicted drop: u·(c_H − c_AI). Lesson: a low AI-capability and a high human capability are the model\'s tell-tale for do-yourself.',
  },
  do_yourself_high_stakes: {
    label: 'Strategic decisions',
    source: 'derived from the model',
    url: '/ai-research/technology-utilization-architecture/model',
    finding: 'When stakes are very high and the human is clearly more capable than the AI, the model says: refuse AI. Verification cost cannot make this corner attractive because the gain is small to begin with.',
  },
  self_automator_routine: {
    label: 'Randazzo self-automator (the trap, named correctly)',
    source: 'Randazzo HBS WP 26-036',
    url: 'https://www.hbs.edu/faculty/Pages/item.aspx?num=68073',
    finding: '27% of BCG consultants (Randazzo 2026, web-verified) operate as self-automators: full delegation, no verification. The model says this is the *right* corner when AI is at least as good as you, stakes are low, and skill preservation doesn\'t matter — e.g., boilerplate. The trap is using it everywhere.',
  },
  self_automator_brynjolfsson: {
    label: 'Brynjolfsson novice customer-service',
    source: 'Brynjolfsson, Li, Raymond 2025 QJE',
    url: 'https://academic.oup.com/qje/article/140/2/889/7990658',
    finding: 'Novice customer-service agents gained +34% productivity (5,172 agents, +15% avg). The model says: novices have a large c_AI − c_H gap on well-bounded tasks, stakes are low, skill-preservation isn\'t at issue — full delegation is correct.',
  },
  spec_driven_everett: {
    label: 'Everett independent-then-synthesize (clinicians)',
    source: 'Everett 2025 medRxiv',
    url: 'https://www.medrxiv.org/content/10.1101/2025.06.07.25329176v1.full',
    finding: '70 clinicians using an independent-then-synthesize workflow (each side works the diagnosis alone, then merges) added +9.9 and +6.8 pp over the naive consult workflow on the SAME task class (Goh 2024 was +2 pp on naive). High stakes + meaningful AI capability gain = verify carefully.',
  },
  spec_driven_novice: {
    label: 'Novice on a hard task (Bastani guardrails)',
    source: 'Bastani 2025 PNAS',
    url: 'https://www.pnas.org/doi/10.1073/pnas.2422633122',
    finding: 'Students using AI with guardrails (verify-as-you-go) kept their gains on the unassisted retest; students using unfettered AI lost 17 pp. Verification = learning. When you care about preserving skill on a task, spec-driven dominates self-automator.',
  },
  spec_driven_lit_synth: {
    label: 'Literature synthesis (default model preset)',
    source: 'Model dashboard',
    url: '/ai-research/technology-utilization-architecture/model',
    finding: 'AI mildly stronger, modestly cheap verification, moderate stakes: corner lands at spec-driven. AI does the synthesis, you read the output carefully. Common shape for white-collar knowledge work.',
  },
};

function pickAnchor(a: Answers, best: Corner): Anchor {
  if (best === 'do-yourself') {
    if (a.aiIsGood === 'low' && a.youAreGood !== 'low') return ANCHORS.do_yourself_outside;
    return ANCHORS.do_yourself_high_stakes;
  }
  if (best === 'self-automator') {
    if (a.youAreGood === 'low' && a.aiIsGood !== 'low') return ANCHORS.self_automator_brynjolfsson;
    return ANCHORS.self_automator_routine;
  }
  // spec-driven
  if (a.stakes === 'high') return ANCHORS.spec_driven_everett;
  if (a.skillMatters === 'high' && a.youAreGood === 'low') return ANCHORS.spec_driven_novice;
  return ANCHORS.spec_driven_lit_synth;
}

// ---- Plain-language corner descriptions --------------------------------

const CORNER_LABEL: Record<Corner, string> = {
  'do-yourself': 'Do it yourself',
  'self-automator': 'Hand it off — no review',
  'spec-driven': 'Hand it off — review carefully',
};

const CORNER_SUMMARY: Record<Corner, string> = {
  'do-yourself':
    'Generate the output yourself. AI is either worse than you here or the stakes-and-verification math doesn\'t justify routing through it. The Dell\'Acqua "outside-frontier" finding (BCG consultants lost 19 pp when forced to use AI on tasks where they were better) is what mis-routing looks like.',
  'self-automator':
    'Delegate fully. Ship without independent verification. The model recommends this when AI is at least as good as you, the task is low-stakes, and you don\'t need to preserve your own skill. ~27% of BCG consultants operate this way as their default. The trap is doing it everywhere; it\'s correct on the right tasks.',
  'spec-driven':
    'Delegate fully, then check the output carefully (against a written rubric — not free-form back-and-forth). This is the corner for high-stakes work, novel domains where you\'re still learning AI capability, and skills you want to preserve. Verification is what converts AI output from a guess to evidence.',
};

const CORNER_NEXT: Record<Corner, string[]> = {
  'do-yourself': [
    'Don\'t use AI as a "see what it thinks" first pass — that\'s already u > 0 in the model, and on outside-frontier tasks any positive u hurts.',
    'Optionally use AI as a devil\'s-advocate consultant *after* you have a draft: ask it to find flaws. This is a v-only operation (verify your own work) and doesn\'t introduce AI mistakes into your output.',
  ],
  'self-automator': [
    'Make sure you actually have low stakes and don\'t care about preserving the skill. If either changes, switch to spec-driven.',
    'Set a quarterly check: re-test yourself on the task without AI. If unassisted performance has decayed below an acceptable floor, switch this task back to spec-driven for a while.',
  ],
  'spec-driven': [
    'Verify against a *predefined rubric* (specific check-points written down before you see the AI output). Free-form dialogue with the AI about whether its output is correct will trigger AI persuasion escalation (Randazzo HBS 26-021: 14 documented persuasion tactics; pushback raises intensity rather than producing acknowledgement).',
    'If you are also learning the domain, the verification step doubles as a calibration mechanism. After enough verified instances of the same task type, you can drop to self-automator with confidence in AI capability on it.',
  ],
};

// ---- Comparator: portfolio strategies ----------------------------------

type StrategyKey = 'always_self' | 'max_ai' | 'naive_cyborg' | 'optimal';

type TaskTypeDef = {
  key: string;
  label: string;
  params: TaskParams;
  count: number;
  baseTime: number;
  recommended: Corner;
};

const DEFAULT_DAY: TaskTypeDef[] = [
  {
    key: 'email',
    label: 'Routine email',
    params: { cH: 0.75, cAI: 0.85, phi: 0.10, sigma: 0.05, lambda: 0.05 },
    count: 12,
    baseTime: 0.15,
    recommended: 'self-automator',
  },
  {
    key: 'boilerplate',
    label: 'Boilerplate code',
    params: { cH: 0.80, cAI: 0.90, phi: 0.20, sigma: 0.30, lambda: 0.10 },
    count: 4,
    baseTime: 0.40,
    recommended: 'self-automator',
  },
  {
    key: 'lit_synth',
    label: 'Literature synthesis',
    params: { cH: 0.50, cAI: 0.65, phi: 0.30, sigma: 0.40, lambda: 0.40 },
    count: 2,
    baseTime: 1.20,
    recommended: 'spec-driven',
  },
  {
    key: 'persuasive',
    label: 'Persuasive writing (your voice matters)',
    params: { cH: 0.70, cAI: 0.50, phi: 0.60, sigma: 0.50, lambda: 0.60 },
    count: 1,
    baseTime: 1.00,
    recommended: 'do-yourself',
  },
  {
    key: 'strategic',
    label: 'Strategic judgment call',
    params: { cH: 0.65, cAI: 0.30, phi: 0.80, sigma: 0.95, lambda: 0.70 },
    count: 1,
    baseTime: 0.80,
    recommended: 'do-yourself',
  },
];

const STRATEGY_LABEL: Record<StrategyKey, string> = {
  always_self: 'Always do it yourself',
  max_ai: 'Hand everything off, never review',
  naive_cyborg: 'Flat cyborg (0.7 / 0.3 on everything)',
  optimal: 'Route per-task (budget-aware)',
};

const STRATEGY_NOTE: Record<StrategyKey, string> = {
  always_self: 'The pre-AI baseline. No risk of mis-routing, no skill atrophy, no productivity gain.',
  max_ai: 'Full delegation, no verification, on every task — including high-stakes ones. Fast, but error-prone where it matters and skill-eroding everywhere.',
  naive_cyborg: 'The "use AI a little, check it a little, on everything" middle path many practitioners default to. The model says this is exactly the failure mode: interior (u, v) values are structurally never optimal at any single task. The aggregate looks reasonable; per-task it leaves value on the table.',
  optimal: 'Different tasks get different corners. Long tasks reroute first when attention is tight (the shadow-price μ rises and longer tasks feel it proportionally). This is the strategy the model recommends.',
};

function evaluateStrategy(
  tasks: TaskTypeDef[],
  strategy: StrategyKey,
  budget: number,
): { totalQ: number; totalA: number; overBudget: boolean; muUsed: number } {
  if (strategy === 'always_self') {
    let totalQ = 0;
    let totalA = 0;
    for (const t of tasks) {
      const r = computeV(0, 0, t.params);
      totalQ += r.Q * t.count;
      totalA += r.A * t.baseTime * t.count;
    }
    return { totalQ, totalA, overBudget: totalA > budget, muUsed: 0 };
  }
  if (strategy === 'max_ai') {
    let totalQ = 0;
    let totalA = 0;
    for (const t of tasks) {
      const r = computeV(1, 0, t.params);
      totalQ += r.Q * t.count;
      totalA += r.A * t.baseTime * t.count;
    }
    return { totalQ, totalA, overBudget: totalA > budget, muUsed: 0 };
  }
  if (strategy === 'naive_cyborg') {
    let totalQ = 0;
    let totalA = 0;
    for (const t of tasks) {
      const r = computeV(0.7, 0.3, t.params);
      totalQ += r.Q * t.count;
      totalA += r.A * t.baseTime * t.count;
    }
    return { totalQ, totalA, overBudget: totalA > budget, muUsed: 0 };
  }
  // optimal: binary search on shadow price μ
  const evaluateAtMu = (mu: number) => {
    let totalQ = 0;
    let totalA = 0;
    for (const t of tasks) {
      const alphaEff = ALPHA + mu * t.baseTime;
      // Pick best corner under alphaEff
      let bestC = CORNERS[0];
      let bestV = -Infinity;
      for (const c of CORNERS) {
        const r = computeV(c.u, c.v, t.params);
        const vAdj = r.V - (alphaEff - ALPHA) * r.A;
        if (vAdj > bestV) {
          bestV = vAdj;
          bestC = c;
        }
      }
      const r = computeV(bestC.u, bestC.v, t.params);
      totalQ += r.Q * t.count;
      totalA += r.A * t.baseTime * t.count;
    }
    return { totalQ, totalA };
  };

  // Try unconstrained first
  const slack = evaluateAtMu(0);
  if (slack.totalA <= budget) {
    return { totalQ: slack.totalQ, totalA: slack.totalA, overBudget: false, muUsed: 0 };
  }
  // Binary search μ in [0, 20]
  let lo = 0;
  let hi = 20;
  let res = slack;
  let muFinal = 0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    res = evaluateAtMu(mid);
    if (res.totalA > budget) {
      lo = mid;
    } else {
      hi = mid;
      muFinal = mid;
    }
  }
  return { totalQ: res.totalQ, totalA: res.totalA, overBudget: res.totalA > budget, muUsed: muFinal };
}

// ---- View: pick a task -------------------------------------------------

function TaskPickerView() {
  const [answers, setAnswers] = useState<Answers>({
    youAreGood: 'medium',
    aiIsGood: 'medium',
    verifyCost: 'medium',
    stakes: 'medium',
    skillMatters: 'medium',
  });
  const [showMath, setShowMath] = useState(false);

  const params = useMemo(() => answersToParams(answers), [answers]);
  const best = useMemo(() => bestCorner(params), [params]);
  const anchor = pickAnchor(answers, best.corner);

  // Score each corner so the reader sees the runner-up gap.
  const cornerScores = CORNERS.map(c => ({
    corner: c.corner,
    V: computeV(c.u, c.v, params).V,
  })).sort((a, b) => b.V - a.V);

  const set = <K extends keyof Answers>(k: K) => (v: Level) =>
    setAnswers(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">About this task</h4>
          <div className="space-y-3">
            <LevelPicker
              label="How good are YOU at this kind of task?"
              hint="Best estimate of your own output quality if you did it solo."
              value={answers.youAreGood}
              onChange={set('youAreGood')}
              levels={[
                { key: 'low', label: 'Below the AI', detail: 'Learning the domain or this is at the edge of your skill' },
                { key: 'medium', label: 'Comparable', detail: 'You\'re competent; AI is in the same ballpark' },
                { key: 'high', label: 'Better than the AI', detail: 'You\'re an expert; AI rarely reaches your level here' },
              ]}
            />
            <LevelPicker
              label="How good is the AI at this task?"
              hint="Best estimate of AI output quality without your involvement."
              value={answers.aiIsGood}
              onChange={set('aiIsGood')}
              levels={[
                { key: 'low', label: 'Poor', detail: 'AI struggles or is outside its frontier' },
                { key: 'medium', label: 'Decent', detail: 'AI produces a usable draft most of the time' },
                { key: 'high', label: 'Strong', detail: 'AI is at expert level on this task type' },
              ]}
            />
            <LevelPicker
              label="How expensive is it to verify the AI's output?"
              hint="As a fraction of the time it would take you to do it yourself. Cheap = run a test or eyeball it; expensive = needs careful read or independent re-derivation."
              value={answers.verifyCost}
              onChange={set('verifyCost')}
              levels={[
                { key: 'low', label: 'Cheap to check', detail: 'Run a test, eyeball the output, or check against a clear rubric' },
                { key: 'medium', label: 'Moderate', detail: 'Need a careful read; some thought required' },
                { key: 'high', label: 'Verification IS the work', detail: 'Verifying takes roughly as long as doing it yourself' },
              ]}
            />
            <LevelPicker
              label="What's at stake if the output is wrong?"
              value={answers.stakes}
              onChange={set('stakes')}
              levels={[
                { key: 'low', label: 'Low', detail: 'Mistake is recoverable, embarrassment-level at worst' },
                { key: 'medium', label: 'Medium', detail: 'Mistake is costly but not catastrophic' },
                { key: 'high', label: 'High', detail: 'Mistake has real consequences (money, reputation, safety, irreversibility)' },
              ]}
            />
            <LevelPicker
              label="Do you care about KEEPING this skill?"
              hint="If you delegate this without verifying, your unassisted ability will erode (Bastani 2025: students lost 17 pp on unassisted retest after sustained unfettered AI use)."
              value={answers.skillMatters}
              onChange={set('skillMatters')}
              levels={[
                { key: 'low', label: 'No', detail: 'Boilerplate, one-off, or a task you don\'t do yourself anyway' },
                { key: 'medium', label: 'Some', detail: 'You\'d rather not lose competence here' },
                { key: 'high', label: 'Yes — core craft', detail: 'This is a skill you actively want to maintain' },
              ]}
            />
          </div>
        </div>

        <div>
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Recommendation</h4>
          <div className="border-2 border-accent rounded p-4 bg-paper-edge">
            <div className="text-[10px] font-mono uppercase tracking-wider text-accent">recommended corner</div>
            <div className="text-[26px] font-display text-ink mt-1 leading-tight">{CORNER_LABEL[best.corner]}</div>
            <p className="text-[13px] text-ink-soft mt-2 leading-relaxed">{CORNER_SUMMARY[best.corner]}</p>
          </div>

          <div className="mt-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">Empirical anchor</div>
            <div className="border-l-2 border-accent-soft pl-3">
              <div className="text-[13px] text-ink font-display">{anchor.label}</div>
              <div className="text-[11px] font-mono text-muted">{anchor.source}</div>
              <p className="text-[12px] text-ink-soft mt-1 leading-relaxed">{anchor.finding}</p>
              <a href={anchor.url} target={anchor.url.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="text-[11px] font-mono text-accent hover:underline">
                source →
              </a>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">Next moves</div>
            <ul className="space-y-2">
              {CORNER_NEXT[best.corner].map((n, i) => (
                <li key={i} className="text-[12px] text-ink-soft leading-relaxed pl-3 border-l border-rule-soft">{n}</li>
              ))}
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-rule-soft">
            <button
              type="button"
              onClick={() => setShowMath(s => !s)}
              className="text-[11px] font-mono text-muted hover:text-accent"
            >
              {showMath ? '− hide the math' : '+ show the math'}
            </button>
            {showMath && (
              <div className="mt-3 text-[11px] font-mono text-ink-soft space-y-1">
                <div>θ = (c_H={params.cH.toFixed(2)}, c_AI={params.cAI.toFixed(2)}, φ={params.phi.toFixed(2)}, σ={params.sigma.toFixed(2)}, λ={params.lambda.toFixed(2)})</div>
                {cornerScores.map(s => (
                  <div key={s.corner} className={s.corner === best.corner ? 'text-accent' : ''}>
                    {CORNER_LABEL[s.corner]}: V = {s.V.toFixed(3)}
                  </div>
                ))}
                <div className="text-muted text-[10px] mt-2">
                  Each corner = a (u, v) pair on the unit square. The model is bilinear in (u, v), so the maximum is always at a corner — never interior. Calibrated constants: α=1, ε=0.15, β=0.05, M=0.08. Full formalisation in the <a href="/ai-research/technology-utilization-architecture/model" className="text-accent hover:underline">model stage</a>.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LevelPicker({
  label,
  hint,
  value,
  onChange,
  levels,
}: {
  label: string;
  hint?: string;
  value: Level;
  onChange: (v: Level) => void;
  levels: { key: Level; label: string; detail: string }[];
}) {
  return (
    <div>
      <div className="text-[13px] text-ink mb-1">{label}</div>
      {hint && <div className="text-[11px] text-muted mb-2 leading-relaxed">{hint}</div>}
      <div className="grid grid-cols-3 gap-1">
        {levels.map(l => (
          <button
            key={l.key}
            type="button"
            onClick={() => onChange(l.key)}
            className={`text-left px-2 py-1.5 rounded border text-[11px] leading-tight transition-colors ${
              value === l.key
                ? 'border-accent bg-paper-edge text-ink'
                : 'border-rule bg-paper text-ink-soft hover:border-accent-soft'
            }`}
            title={l.detail}
          >
            <div className="font-mono uppercase tracking-wider text-[10px] text-muted">{l.key}</div>
            <div className="font-display">{l.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- View: compare strategies ------------------------------------------

function CompareView() {
  const [tasks, setTasks] = useState<TaskTypeDef[]>(DEFAULT_DAY);
  const [budget, setBudget] = useState(8);

  const results = useMemo(() => {
    return (['always_self', 'max_ai', 'naive_cyborg', 'optimal'] as StrategyKey[]).map(k => ({
      key: k,
      ...evaluateStrategy(tasks, k, budget),
    }));
  }, [tasks, budget]);

  const maxQ = Math.max(...results.map(r => r.totalQ));

  const updateCount = (key: string, count: number) =>
    setTasks(prev => prev.map(t => (t.key === key ? { ...t, count: Math.max(0, count) } : t)));

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Your day</h4>
        <p className="text-[12px] text-ink-soft mb-3 leading-relaxed">
          A day is a basket of task types with how many of each. Set the counts to match your actual work. Each task type has fixed characteristics (good for AI? high stakes? etc.); to change those, use the task-picker view above.
        </p>
        <div className="space-y-2">
          {tasks.map(t => (
            <div key={t.key} className="flex items-center gap-3 text-[12px]">
              <div className="flex-1">
                <div className="text-ink">{t.label}</div>
                <div className="text-[10px] font-mono text-muted">recommended corner per task: {CORNER_LABEL[t.recommended]}</div>
              </div>
              <input
                type="number"
                min={0}
                max={50}
                value={t.count}
                onChange={e => updateCount(t.key, parseInt(e.target.value || '0', 10))}
                className="w-16 px-2 py-1 border border-rule rounded text-[12px] font-mono text-ink bg-paper"
              />
              <span className="text-[10px] font-mono text-muted w-12">× {t.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-[13px] text-ink">Attention budget (working hours, normalised)</label>
          <span className="text-[13px] font-mono text-ink">{budget.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={2}
          max={20}
          step={0.5}
          value={budget}
          onChange={e => setBudget(parseFloat(e.target.value))}
          className="w-full accent-[#8a4a2b]"
        />
        <p className="text-[11px] text-muted mt-1 leading-relaxed">
          Tighten this slider to simulate a constrained day. When the budget binds, the "route per-task" strategy reroutes long tasks first toward self-automator (the lowest-attention corner) — that's the shadow-price μ from the model.
        </p>
      </div>

      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Strategy comparison</h4>
        <div className="space-y-3">
          {results.map(r => {
            const pct = (r.totalQ / maxQ) * 100;
            const isBest = r.totalQ === maxQ;
            return (
              <div key={r.key} className="border border-rule rounded p-3 bg-paper">
                <div className="flex items-baseline justify-between">
                  <div className={`text-[14px] font-display ${isBest ? 'text-accent' : 'text-ink'}`}>
                    {STRATEGY_LABEL[r.key]}{isBest && <span className="ml-2 text-[10px] font-mono uppercase tracking-wider">best</span>}
                  </div>
                  <div className="text-[12px] font-mono text-ink">
                    Q = {r.totalQ.toFixed(2)} · A = {r.totalA.toFixed(2)}
                  </div>
                </div>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">{STRATEGY_NOTE[r.key]}</p>
                <div className="h-2 bg-paper-edge mt-2 rounded overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isBest ? '#8a4a2b' : '#c98a6e',
                    }}
                  />
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-muted mt-1">
                  {r.overBudget && <span className="text-[#5a3221]">over budget</span>}
                  {r.key === 'optimal' && r.muUsed > 0 && <span>shadow price μ = {r.muUsed.toFixed(2)}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted mt-3 leading-relaxed">
          Q is total expected quality, summed over all tasks. A is total attention used. The model's headline (S1) — workflow architecture beats model capability — is the gap between "route per-task" and "flat cyborg" at the SAME AI capability. Tighten the budget and the gap grows; "always do it yourself" overflows fastest.
        </p>
      </div>
    </div>
  );
}

// ---- View: common mistakes ---------------------------------------------

type Mistake = {
  name: string;
  what: string;
  why: string;
  fix: string;
  source: { label: string; url: string };
};

const MISTAKES: Mistake[] = [
  {
    name: 'The flat-cyborg trap',
    what: '"Use AI a little on everything, glance at the output, ship." A flat (u, v) = (0.7, 0.3) policy applied uniformly across the day.',
    why: 'The model is bilinear in (u, v) on each task — the maximum is always at a corner, never interior. Applying interior values uniformly is structurally never optimal at any individual task. The day-aggregate (ū, v̄) only legitimately lands interior because different tasks pick different corners, not because any single decision lives there.',
    fix: 'For each task type, pick a corner: do-it-yourself, hand-off-no-review, or hand-off-review-carefully. Different task types get different corners; that\'s the whole point. The aggregate across your day will look "cyborg" because the corners differ.',
    source: { label: 'Mollick on centaur/cyborg modes', url: 'https://oneusefulthing.org/' },
  },
  {
    name: 'The self-automator trap (using AI everywhere with no review)',
    what: 'Defaulting to full delegation without verification on every task — even high-stakes ones, even where you want to keep the skill.',
    why: 'Self-automator IS the right corner for boilerplate and routine. The trap is generalising it. ~27% of BCG consultants in Randazzo 2026 default to this; on the high-stakes subset of their work it leaves real value on the table, and unassisted skill atrophies (Bastani 2025: 17 pp drop on retest after unfettered AI use).',
    fix: 'Audit which of your tasks are actually low-stakes and skill-irrelevant. For those: self-automator is correct. For high-stakes work or skills you care about: spec-driven (full delegation WITH verification against a rubric).',
    source: { label: 'Randazzo HBS WP 26-036', url: 'https://www.hbs.edu/faculty/Pages/item.aspx?num=68073' },
  },
  {
    name: 'Outside-frontier delegation',
    what: 'Reaching for AI on a task where you\'re actually better than the AI — and the AI quietly degrades the output.',
    why: 'Dell\'Acqua 2023: BCG consultants forced to use AI on tasks outside the AI\'s frontier scored 19 pp WORSE than the no-AI control. The model predicts a quality drop proportional to u·(c_H − c_AI). At u = 1 the drop equals the full capability gap.',
    fix: 'Develop a rough sense of where the current AI is genuinely weak — domain-specific judgment, novel synthesis, your own house style. On those, the do-it-yourself corner is correct. AI as devil\'s-advocate consultant after the fact is fine; AI as first-pass generator is the harm.',
    source: { label: 'Dell\'Acqua 2023', url: 'https://pubsonline.informs.org/doi/10.1287/orsc.2025.21838' },
  },
  {
    name: 'Free-form verification (sycophancy bait)',
    what: '"Review this output for me" → AI rephrases its claim more confidently → you accept it. Or: you push back on a correct point and the AI escalates rather than concedes.',
    why: 'Randazzo HBS 26-021 documents AI escalating across 14 persuasion tactics when professionals tried to validate its outputs. Pushback INCREASED persuasion intensity rather than producing acknowledgement. Free-dialogue verification can be net-negative — sycophancy flips a correct human into a wrong one.',
    fix: 'Verify against a STRUCTURED RUBRIC you wrote down before seeing the AI output: specific check-points, specific assertions, specific things you would expect to be wrong. Constrain the AI\'s response surface; don\'t open-endedly ask it whether it\'s right.',
    source: { label: 'Randazzo HBS WP 26-021', url: 'https://www.hbs.edu/faculty/Pages/item.aspx?num=68073' },
  },
  {
    name: 'Assuming "more AI" reduces attention cost',
    what: '"I delegated to AI, so my time on this task is zero."',
    why: 'The substitution-myth invariant (Bainbridge 1983 → Mozannar 2024 CHI): even at full delegation, you spend non-trivial time monitoring, verifying, prompting, and handing off. Mozannar measured 51.5% of session time as Copilot-specific (verifying, deferring, waiting, prompting, editing) — over half the session even when AI is doing the generation. The model bakes this in as ε > 0; you cannot make it zero.',
    fix: 'Treat AI as shifting the kind of attention required (from generation to verification + orchestration), not as zeroing it out. Budget for verification time explicitly. If the verification cost gets larger than the generation cost would have been, you\'re using AI on the wrong task.',
    source: { label: 'Mozannar 2024 CHI', url: 'https://arxiv.org/abs/2210.14306' },
  },
];

function MistakesView() {
  return (
    <div className="space-y-5">
      <p className="text-[13px] text-ink-soft leading-relaxed">
        Five failure modes the model identifies. Each is what the model says NOT to do, why it’s wrong, and the closest evidence anchor.
      </p>
      {MISTAKES.map((m, i) => (
        <div key={i} className="border border-rule rounded p-4 bg-paper">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted">mistake {i + 1}</div>
          <div className="text-[18px] font-display text-ink mt-1">{m.name}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-1">what it looks like</div>
              <p className="text-[12px] text-ink-soft leading-relaxed">{m.what}</p>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-1">why it fails</div>
              <p className="text-[12px] text-ink-soft leading-relaxed">{m.why}</p>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-1">what to do instead</div>
              <p className="text-[12px] text-ink-soft leading-relaxed">{m.fix}</p>
            </div>
          </div>
          <a href={m.source.url} target={m.source.url.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="text-[11px] font-mono text-accent hover:underline mt-3 inline-block">
            {m.source.label} →
          </a>
        </div>
      ))}
    </div>
  );
}

// ---- View: when to verify (calibration coach) --------------------------

function VerifyView() {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-[16px] font-display text-ink mb-2">When verification is cheap, do it</h4>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          The default for any task you don’t already trust the AI on should be spec-driven: full delegation, then verify against a written rubric. The reason isn’t paranoia — it’s that verification doubles as a calibration mechanism. Each verified instance updates your prior on whether the AI is reliable on this task type. Once your prior tightens, you can drop to self-automator (no review) with confidence.
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed mt-2">
          Concretely: when you encounter a new task type and don’t know how good the AI is at it, run the first 5–10 instances spec-driven. Verify each one carefully. If it consistently passes, switch to self-automator. If it fails on some pattern, you’ve learned that pattern is outside the AI’s frontier on this task — route those to do-yourself.
        </p>
      </div>

      <div>
        <h4 className="text-[16px] font-display text-ink mb-2">When verification is expensive, the calculus changes</h4>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          On tasks where verification takes roughly as long as doing the work yourself (φ near or above 1), the spec-driven corner is dominated. The model collapses to a two-corner choice: do it yourself (if your capability is comparable) or hand it off without review (if AI capability is much higher and stakes are low enough that the unverified risk is acceptable).
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed mt-2">
          Empirically, coding-cyborg work runs at φ ≈ 1.6 (from Mozannar 2024’s CUPS data: 22.4% of session time on verifying, 14.05% on writing-new — verifying takes about 1.6× as long as generating, and the measured φ is ~5× the model’s lit-review-anchored default of 0.30). This is one reason "AI pair-programmer" workflows feel more cognitively expensive than expected. Treat code review of AI output as the real work; if you can’t afford that, drop to writing the code yourself or accept the unverified risk.
        </p>
      </div>

      <div className="border-l-2 border-accent pl-4">
        <h4 className="text-[16px] font-display text-ink mb-2">Verify against a rubric, not a conversation</h4>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          This is the single highest-leverage piece of workflow advice in the entire pipeline. Randazzo HBS 26-021 documents 14 specific persuasion tactics (across ethos, logos, and pathos categories) that AI deploys when professionals try to validate its outputs in free-form dialogue. Pushback INCREASES persuasion intensity rather than producing acknowledgement. The implication: free-dialogue verification can flip a correct human judgment via sycophancy escalation — meaning verification is actively HARMFUL on the wrong task.
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed mt-2">
          The mitigation: <strong>write the rubric down BEFORE you see the AI output</strong>. Specific check-points. Specific assertions you expect to be true. Specific things you’d expect to be wrong. Then read the output once against the rubric and score it. Do not "discuss it" with the AI. If the rubric flags an issue, your default should be to trust your rubric, not the AI’s subsequent defense of itself.
        </p>
      </div>

      <div>
        <h4 className="text-[16px] font-display text-ink mb-2">When NOT to verify</h4>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Verification is pure cost without AI involvement — that’s why the (u=0, v=1) corner is mathematically dominated. The model also says self-automator is correct for tasks meeting all of: AI at least as good as you, low stakes, low skill-preservation value, and a well-calibrated prior that AI is reliable on this task type. For those — boilerplate code, routine email, formatting, summarization for personal-use only — verification is overhead the model says to skip.
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed mt-2">
          The honest scope of this guidance: it is not a permission slip to skip verification on tasks where you’d like to skip it. The trap is using "low stakes" as a label for "I don’t want to verify this." If you’re uncertain whether stakes are actually low, default to spec-driven and let the verification step build calibration.
        </p>
      </div>
    </div>
  );
}

// ---- View: cheat sheet -------------------------------------------------

const CHEATSHEET = [
  {
    title: 'There are three corners, not five workflow modes',
    body: 'The popular "centaur / cyborg / self-automator / spec-driven / do-yourself" typology is descriptive vocabulary for what people look like when you watch them. The actual per-task decision is a three-way choice: do it yourself, hand off without review, or hand off with rubric-verified review. Centaur and cyborg arise as aggregate-day-level labels when a person mixes corners across different tasks. They are NEVER the right policy for any single task.',
  },
  {
    title: 'Match the workflow to the task, not to your habit',
    body: 'The single biggest gain from this whole framework is differentiating across tasks. Run a quick audit: list 10 tasks you did this week. For each, identify which corner the model recommends. If you’re defaulting to one corner across most of them, you’re leaving value on the table. Variability in your workflow IS the architecture.',
  },
  {
    title: 'Verification is more than half the work — plan for it',
    body: 'Mozannar 2024: 51.5% of programmer session time with Copilot is Copilot-specific overhead (verifying, deferring, waiting, prompting, editing) even when Copilot is doing the generation. AI does not "save time" the way it appears to. It shifts time from generation to orchestration and verification. Budget for that.',
  },
  {
    title: 'Workflow architecture beats model capability',
    body: 'Vaccaro et al. 2024 (Nature Human Behaviour, 106 studies, 370 effect sizes) found that human-AI combinations on average underperform best-of-either-alone, with losses concentrated in decision tasks and gains concentrated in content creation. The implication, consistent with the model: complementarity is not automatic; task structure systematically modulates whether it is achieved. Within-study evidence (Goh→Everett +7.9 pp on the same physician-AI task with only the workflow changed) and the broader pattern across the 22-study record both support the same direction. Tools matter less than how you wire them up.',
  },
  {
    title: 'Outside-frontier delegation is the most expensive mistake',
    body: 'Dell\'Acqua 2023: BCG consultants forced to use AI outside its frontier scored 19 pp WORSE than the no-AI control. If you mis-route in this direction the harm is large and direct. Develop a sense of where the AI is genuinely weak — domain-specific judgment, novel synthesis, your own voice — and do those yourself.',
  },
  {
    title: 'Don’t verify by asking the AI; verify against a written rubric',
    body: 'Free-form "is this right?" dialogue with an AI triggers persuasion escalation (Randazzo HBS 26-021: 14 documented tactics; pushback raises intensity rather than producing acknowledgement). The mitigation is structural: write your checkpoints down before you see the AI output, then score the output against the checkpoints. This is the highest-leverage workflow nudge in the pipeline.',
  },
  {
    title: 'Skill atrophies under unverified delegation; verification prevents it',
    body: 'Bastani 2025 PNAS: students with unfettered AI access lost 17 percentage points on the unassisted retest; students with verification-coupled "guardrails" kept their gains. The mechanism is verification = engagement = practice. If you care about preserving a skill, "spec-driven" beats "self-automator" on that skill even when the math otherwise favours self-automator.',
  },
];

function CheatsheetView() {
  return (
    <div className="space-y-5">
      <p className="text-[13px] text-ink-soft leading-relaxed">
        Seven take-aways that survive the pipeline. If you remember nothing else from this artifact, remember these.
      </p>
      {CHEATSHEET.map((t, i) => (
        <div key={i} className="border-l-2 border-accent-soft pl-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted">take-away {i + 1}</div>
          <div className="text-[16px] font-display text-ink mt-0.5">{t.title}</div>
          <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">{t.body}</p>
        </div>
      ))}
      <div className="text-[12px] text-muted pt-4 border-t border-rule-soft">
        For the formal model, see the <a href="/ai-research/technology-utilization-architecture/model" className="text-accent hover:underline">model stage</a>. For the empirical evidence, see the <a href="/ai-research/technology-utilization-architecture/data" className="text-accent hover:underline">data stage</a>. For the long-form synthesis, see the <a href="/ai-research/technology-utilization-architecture/writeup" className="text-accent hover:underline">writeup</a>.
      </div>
    </div>
  );
}

// ---- Root --------------------------------------------------------------

const VIEWS: { key: View; label: string }[] = [
  { key: 'task', label: 'Pick a task' },
  { key: 'compare', label: 'Compare strategies' },
  { key: 'mistakes', label: 'Common mistakes' },
  { key: 'verify', label: 'When to verify' },
  { key: 'cheatsheet', label: 'Cheat sheet' },
];

export default function CognitivePartnershipExplorer() {
  const [view, setView] = useState<View>('task');
  return (
    <div className="not-prose border border-rule rounded-lg p-5 md:p-6 bg-paper-edge my-6">
      <div className="flex flex-wrap gap-1 mb-5 border-b border-rule pb-3">
        {VIEWS.map(v => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`text-[12px] font-mono uppercase tracking-wider px-3 py-1.5 rounded transition-colors ${
              view === v.key
                ? 'bg-accent text-paper'
                : 'text-ink-soft hover:text-accent'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === 'task' && <TaskPickerView />}
      {view === 'compare' && <CompareView />}
      {view === 'mistakes' && <MistakesView />}
      {view === 'verify' && <VerifyView />}
      {view === 'cheatsheet' && <CheatsheetView />}
    </div>
  );
}

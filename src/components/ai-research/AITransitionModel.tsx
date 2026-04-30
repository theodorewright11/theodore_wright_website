import { useMemo, useState } from 'react';

type Tab = 'integrated' | 'trajectory';

// ---- Default constants (calibrated from lit-review anchors) -------------
//
// α (productivity scale). Brynjolfsson-Li-Raymond customer-service field study:
// +14% overall, +34% novice (s ≈ 0.2). α · (1 − s) at s=0.2 should be ~0.32 →
// α ≈ 0.40. BCG study (Dell'Acqua-Mollick): 12% inside-frontier productivity
// gain, 40% inside-frontier quality gain — same order.
//
// η_trap (self-automator penalty). Randazzo 27%/44% BCG numbers — gives a
// "no skill development in either domain" outcome. Penalty as fraction of α.
//
// τ, σ (gate threshold and width). The product f · ρ governs whether AI use
// upskills (f·ρ > τ) or deskills (f·ρ < τ). τ = 0.30 places the median
// knowledge worker (f ≈ ρ ≈ 0.5, f·ρ ≈ 0.25) just below the threshold —
// a small intervention pushes them above it; a small drift pushes them
// below. This matches the topology's structural claim that the median
// worker without conscious intervention sits on the edge, rather than
// the stronger claim (which τ = 0.40 would encode) that they are
// already deeply trapped. σ = 0.06 makes the transition smooth rather
// than a step. Pass-2 calibration; pass-1 used τ = 0.40, which over-
// stated how far below the gate the median worker sits.
//
// λ_M (competence-erosion coefficient). SDT competence-frustration produces
// amotivation roughly linearly in the magnitude of the competence shortfall.
// Calibrated so a fully telic identity with zero retained practice loses
// ~30% of its meaning — the upper bound of what the SDT literature
// (Sheldon-Hilpert, BPNSFS scale) considers a severe shortfall.
//
// d_safe (relational dose threshold). OpenAI-MIT N=981 RCT: protective at
// low daily voluntary use, harm at high daily use. The crossover is not
// precisely measured but is roughly in the 20–40 min/day range across modes.
//
// ψ_R (dose-response slope). Linear above d_safe. β_R is the therapeutic-
// grade benefit slope below d_safe (Therabot RCT scale). Pass 1 used
// β_R = 0.004, which made 30 min/day at thin baseline give ΔV_rel ≈ 0.10
// — implausibly large relative to ΔV_prod in moderate-AI-use scenarios.
// Therabot's effect was on diagnosed clinical conditions, not on the
// general user. β_R = 0.001 (pass 2) keeps the qualitative shape but
// scales the benefit to a level comparable to ΔV_prod at moderate
// productivity gain, which is the right order of magnitude.

const ALPHA = 0.40;
const ETA_TRAP = 0.30;
const TAU = 0.30;
const SIGMA = 0.06;
const LAMBDA_M = 0.30;
const D_SAFE = 30; // minutes per day
const PSI_R = 0.003; // ΔM per minute above d_safe per (1 − relational thickness)
const BETA_R = 0.001; // ΔV per minute up to d_safe (therapeutic-grade scale)

// ---- Gate function ------------------------------------------------------

// g(f, ρ) is a smooth gate over the f·ρ axis. When f·ρ >> τ, the user gets
// the full novice-skill-compression upside; when f·ρ << τ, they fall into
// the self-automator trap. Width σ controls how sharply the gate flips.
function gate(f: number, rho: number) {
  return 1 / (1 + Math.exp(-(f * rho - TAU) / SIGMA));
}

// ---- The generating function -------------------------------------------

type Inputs = {
  T: number;     // telic share of identity (0–1)
  B: number;     // atelic ballast (0–1)
  phi: number;   // AI-absorbable fraction of telic work (0–1)
  kappa: number; // competence-frustration sensitivity (0–1)
  s: number;     // pre-attempt skill stock (0–1)
  a: number;     // AI capability on relevant tasks (0–1)
  f: number;     // feedback-loop richness (0–1)
  rho: number;   // retained effortful practice (0–1)
  d: number;     // daily AI-emotional-engagement minutes
  delta_R: number; // relational baseline thickness (0–1, higher = thicker)
};

function compute(I: Inputs) {
  const g = gate(I.f, I.rho);

  // Defensive side. Three channels of meaning loss.
  // (a) Telic absorption: AI does the work that gave you meaning.
  // (b) Competence erosion: you lose the capacity itself (the bridge through ρ).
  // (c) Relational dose-response: heavy AI-emotional engagement above d_safe.
  const dM_telic = -I.kappa * I.phi * Math.max(0, I.T - I.B);
  const dM_comp = -LAMBDA_M * (1 - I.rho) * I.T;
  const dose_excess = Math.max(0, I.d - D_SAFE);
  const dM_rel = -PSI_R * dose_excess * (1 - I.delta_R);
  const dM = dM_telic + dM_comp + dM_rel;

  // Offensive side.
  // (a) Productivity / novice-skill compression — gated by f·ρ.
  // (b) Therapeutic-grade relational benefit — saturates at d_safe.
  // (c) Self-automator penalty when below the gate threshold.
  const dV_prod = g * ALPHA * I.a * (1 - I.s);
  const dose_safe = Math.min(I.d, D_SAFE);
  const dV_rel = BETA_R * dose_safe * (1 - I.delta_R * 0.5); // floor: even thick relational baseline still gets some therapeutic upside
  const dV_trap = -(1 - g) * ETA_TRAP * I.a;
  const dV = dV_prod + dV_rel + dV_trap;

  const dNet = dV + dM;

  return {
    g,
    dM_telic, dM_comp, dM_rel, dM,
    dV_prod, dV_rel, dV_trap, dV,
    dNet,
  };
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

// Signed bar: negative bars grow leftward from a center axis, positive bars
// grow rightward. Used for ΔV / ΔM / ΔNet so the sign is visible at a glance.
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

// ---- Integrated panel --------------------------------------------------

type PresetKey = 'default_risk' | 'ballast_intervention' | 'self_automator' | 'asymmetric_exploiter' | 'creative_predisplaced' | 'heavy_companion';

const PRESETS: Record<PresetKey, { label: string; inputs: Inputs; note: string }> = {
  default_risk: {
    label: 'Knowledge worker (default path)',
    inputs: { T: 0.70, B: 0.20, phi: 0.60, kappa: 0.50, s: 0.60, a: 0.70, f: 0.50, rho: 0.60, d: 15, delta_R: 0.40 },
    note: 'Telic-heavy career identity, thin atelic ballast, moderate AI capability on the work. Default trajectory of the topology.',
  },
  ballast_intervention: {
    label: 'Same worker after S3 (atelic ballast)',
    inputs: { T: 0.50, B: 0.50, phi: 0.60, kappa: 0.50, s: 0.60, a: 0.70, f: 0.50, rho: 0.60, d: 15, delta_R: 0.40 },
    note: 'Same person, same AI exposure. The only change: atelic ballast B raised to match telic share T. ΔM_telic collapses to zero.',
  },
  self_automator: {
    label: 'Self-automator trap (Randazzo)',
    inputs: { T: 0.60, B: 0.30, phi: 0.70, kappa: 0.40, s: 0.40, a: 0.80, f: 0.20, rho: 0.30, d: 10, delta_R: 0.40 },
    note: 'Delegating both what and how to AI; thin feedback loops; low retained practice. The 27% of BCG consultants who showed no skill development.',
  },
  asymmetric_exploiter: {
    label: 'Asymmetric exploiter (upside path)',
    inputs: { T: 0.40, B: 0.40, phi: 0.40, kappa: 0.40, s: 0.20, a: 0.80, f: 0.70, rho: 0.70, d: 5, delta_R: 0.50 },
    note: 'Novice using AI to attempt projects previously out of reach. High feedback richness, maintained practice, balanced T/B identity. Captures the capability-vs-price asymmetry.',
  },
  creative_predisplaced: {
    label: 'Creative pre-AI (high displacement risk)',
    inputs: { T: 0.80, B: 0.10, phi: 0.80, kappa: 0.70, s: 0.70, a: 0.80, f: 0.40, rho: 0.50, d: 10, delta_R: 0.30 },
    note: 'Identity tightly bound to the making-process. The Caporusso "creative displacement anxiety" vector — high κ, very thin B, high φ.',
  },
  heavy_companion: {
    label: 'Heavy companion-app user',
    inputs: { T: 0.50, B: 0.30, phi: 0.40, kappa: 0.40, s: 0.50, a: 0.70, f: 0.50, rho: 0.60, d: 90, delta_R: 0.20 },
    note: 'Moderate work-side parameters but daily AI-emotional engagement well above d_safe, in a thin relational baseline. The OpenAI-MIT high-dose tail.',
  },
};

const DEFAULT_INPUTS: Inputs = PRESETS.default_risk.inputs;

function IntegratedPanel() {
  const [I, setI] = useState<Inputs>(DEFAULT_INPUTS);
  const [presetNote, setPresetNote] = useState<string>(PRESETS.default_risk.note);

  const out = useMemo(() => compute(I), [I]);

  const setPreset = (k: PresetKey) => {
    setI(PRESETS[k].inputs);
    setPresetNote(PRESETS[k].note);
  };

  const set = <K extends keyof Inputs>(k: K) => (v: number) => setI(prev => ({ ...prev, [k]: v }));

  // Domain-channel breakdown for the signed bar.
  const channelSegments = [
    { label: 'ΔM telic', value: out.dM_telic, color: '#8a4a2b' },
    { label: 'ΔM compet.', value: out.dM_comp, color: '#a85d3c' },
    { label: 'ΔM relat.', value: out.dM_rel, color: '#c98a6e' },
    { label: 'ΔV product.', value: out.dV_prod, color: '#3a342c' },
    { label: 'ΔV relat.', value: out.dV_rel, color: '#7a7166' },
    { label: 'ΔV trap', value: out.dV_trap, color: '#5a3221' },
  ];

  const summary = [
    { label: 'ΔV (offensive)', value: out.dV, color: '#1a1614' },
    { label: 'ΔM (defensive)', value: out.dM, color: '#8a4a2b' },
    { label: 'ΔNet', value: out.dNet, color: out.dNet >= 0 ? '#3a342c' : '#5a3221' },
  ];

  // Warnings when the user crosses a structural threshold.
  const belowGate = out.g < 0.5;
  const aboveDoseSafe = I.d > D_SAFE;
  const ballastShortfall = I.T - I.B > 0.20;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Identity allocation</h4>
        <div className="space-y-4">
          <Slider symbol="T" label="Telic share of identity" value={I.T} min={0} max={1} step={0.01} onChange={set('T')} />
          <Slider symbol="B" label="Atelic ballast" value={I.B} min={0} max={1} step={0.01} onChange={set('B')} />
        </div>

        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mt-6 mb-3">AI exposure on telic work</h4>
        <div className="space-y-4">
          <Slider symbol="φ" label="AI-absorbable fraction" value={I.phi} min={0} max={1} step={0.01} onChange={set('phi')} />
          <Slider symbol="κ" label="Competence-frustration sensitivity" value={I.kappa} min={0} max={1} step={0.01} onChange={set('kappa')} />
        </div>

        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mt-6 mb-3">Capability vs price asymmetry</h4>
        <div className="space-y-4">
          <Slider symbol="s" label="Pre-attempt skill stock" value={I.s} min={0} max={1} step={0.01} onChange={set('s')} />
          <Slider symbol="a" label="AI capability on the task" value={I.a} min={0} max={1} step={0.01} onChange={set('a')} />
          <Slider symbol="f" label="Feedback-loop richness" value={I.f} min={0} max={1} step={0.01} onChange={set('f')} />
          <Slider symbol="ρ" label="Retained effortful practice" value={I.rho} min={0} max={1} step={0.01} onChange={set('rho')} />
        </div>

        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mt-6 mb-3">Relational channel</h4>
        <div className="space-y-4">
          <Slider symbol="d" label="Daily AI-emotional minutes" value={I.d} min={0} max={180} step={1} decimals={0} unit=" min" onChange={set('d')} />
          <Slider symbol="δ_R" label="Relational baseline thickness" value={I.delta_R} min={0} max={1} step={0.01} onChange={set('delta_R')} />
        </div>

        <div className="mt-6 pt-4 border-t border-rule-soft">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">Scenario presets</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PRESETS) as PresetKey[]).map(k => (
              <button
                key={k}
                onClick={() => setPreset(k)}
                className="px-2 py-1 text-[11px] font-mono border border-rule rounded text-muted hover:text-accent hover:border-accent text-left"
              >
                {PRESETS[k].label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-3 leading-relaxed italic">{presetNote}</p>
        </div>
      </div>

      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Net</h4>
        <div className="grid grid-cols-3 gap-2">
          <NumberCard
            label="ΔV"
            value={(out.dV >= 0 ? '+' : '') + out.dV.toFixed(3)}
            formula="offensive"
            tone={out.dV >= 0 ? 'pos' : 'neg'}
          />
          <NumberCard
            label="ΔM"
            value={(out.dM >= 0 ? '+' : '') + out.dM.toFixed(3)}
            formula="defensive (≤ 0)"
            tone="neg"
          />
          <NumberCard
            label="ΔNet"
            value={(out.dNet >= 0 ? '+' : '') + out.dNet.toFixed(3)}
            formula="ΔV + ΔM"
            tone={out.dNet >= 0 ? 'pos' : 'neg'}
          />
        </div>

        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mt-6 mb-3">Channel decomposition</h4>
        <SignedBar segments={channelSegments} axisMax={0.4} />

        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mt-6 mb-3">Summary</h4>
        <SignedBar segments={summary} axisMax={0.6} />

        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mt-6 mb-3">Structural flags</h4>
        <div className="space-y-2 text-[11px]">
          <div className={`flex items-start gap-2 ${belowGate ? 'text-accent' : 'text-muted'}`}>
            <span className="font-mono shrink-0">{belowGate ? '⚠' : '○'}</span>
            <span>
              {belowGate
                ? `Below self-automator gate (g = ${out.g.toFixed(2)}). f·ρ = ${(I.f * I.rho).toFixed(2)} < τ = ${TAU.toFixed(2)}. ΔV is being penalised, not augmented.`
                : `Above gate (g = ${out.g.toFixed(2)}). f·ρ ≥ τ — AI use is augmenting rather than degrading.`}
            </span>
          </div>
          <div className={`flex items-start gap-2 ${aboveDoseSafe ? 'text-accent' : 'text-muted'}`}>
            <span className="font-mono shrink-0">{aboveDoseSafe ? '⚠' : '○'}</span>
            <span>
              {aboveDoseSafe
                ? `Daily AI-emotional dose ${I.d} min above d_safe = ${D_SAFE} min. Linear ΔM_rel penalty active, scaled by (1 − δ_R).`
                : `Daily AI-emotional dose at or below d_safe — therapeutic-grade benefit dominates.`}
            </span>
          </div>
          <div className={`flex items-start gap-2 ${ballastShortfall ? 'text-accent' : 'text-muted'}`}>
            <span className="font-mono shrink-0">{ballastShortfall ? '⚠' : '○'}</span>
            <span>
              {ballastShortfall
                ? `Telic share T exceeds atelic ballast B by ${(I.T - I.B).toFixed(2)}. ΔM_telic active. S3 (build atelic infrastructure) is the load-bearing intervention.`
                : `B ≥ T. Atelic-ballast hypothesis holds — telic absorption produces no net meaning loss in this configuration.`}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-muted mt-5 leading-relaxed">
          ΔV and ΔM are normalised changes in expected outcome over a fixed horizon (treat the unit as &quot;life-scale outcome share&quot; — comparable across people, not comparable across stages of life). ΔNet is positive when the asymmetric capability-vs-price upside dominates and negative when telic absorption, competence erosion, or relational-dose-response wins. The constants α, η_trap, τ, σ, λ_M, ψ_R, β_R are calibrated to the lit-review anchors but await Stage 4 fitting against time-use surveys, the BCG consultant data, and the OpenAI-MIT dose-response curve.
        </p>
      </div>
    </div>
  );
}

// ---- Trajectory panel --------------------------------------------------

// Time evolution makes the A3 crux (cumulative atrophy vs calculator
// analogue) directly parametric. Under λ_atrophy = 0, ρ stays put — the
// calculator analogue. Under λ_atrophy > 0, ρ decays exponentially in the
// product of offloading rate u and time t, and ΔNet drifts down accordingly.
// Only ρ evolves: deskilling-over-time is captured through ρ → g closing
// → ΔV_trap dominating. Adding a separate s(t) decay would either double-
// count the deskilling effect or imply the user becomes a fresh novice
// with full upside available — neither matches the lit-review finding.

function TrajectoryPanel() {
  const [u, setU] = useState(0.6);            // offloading rate
  const [lambda, setLambda] = useState(0.04); // atrophy speed
  const [rho0, setRho0] = useState(0.80);
  const [phi, setPhi] = useState(0.60);
  const [T, setT] = useState(0.70);
  const [B, setB] = useState(0.20);
  const [a, setA] = useState(0.70);
  const [s, setS] = useState(0.60);
  const [f, setF] = useState(0.50);
  const [kappa, setKappa] = useState(0.50);
  const [d, setD] = useState(15);
  const [delta_R, setDeltaR] = useState(0.40);
  const [horizon, setHorizon] = useState(10);

  const series = useMemo(() => {
    const xs: number[] = [];
    const dNets: number[] = [];
    const rhos: number[] = [];
    for (let t = 0; t <= horizon; t += 0.5) {
      const rho_t = rho0 * Math.exp(-lambda * u * t);
      const inputs: Inputs = {
        T, B, phi, kappa, s, a, f, rho: rho_t, d, delta_R,
      };
      const out = compute(inputs);
      xs.push(t);
      dNets.push(out.dNet);
      rhos.push(rho_t);
    }
    return { xs, dNets, rhos };
  }, [u, lambda, rho0, phi, T, B, a, s, f, kappa, d, delta_R, horizon]);

  // SVG plot dimensions
  const W = 380;
  const H = 200;
  const padX = 38;
  const padY = 18;
  const yMin = -0.8;
  const yMax = 0.6;

  const xToPx = (t: number) => padX + ((t - 0) / (horizon - 0)) * (W - padX - 8);
  const yToPx = (y: number) => padY + ((yMax - y) / (yMax - yMin)) * (H - padY * 2);
  const yToPxRho = (y: number) => padY + ((1 - y) / 1) * (H - padY * 2);

  const dNetPath = series.xs.map((t, i) => `${i === 0 ? 'M' : 'L'} ${xToPx(t).toFixed(1)} ${yToPx(series.dNets[i]).toFixed(1)}`).join(' ');
  const rhoPath = series.xs.map((t, i) => `${i === 0 ? 'M' : 'L'} ${xToPx(t).toFixed(1)} ${yToPxRho(series.rhos[i]).toFixed(1)}`).join(' ');

  const setRegime = (k: 'calculator' | 'mild' | 'cumulative') => {
    if (k === 'calculator') setLambda(0);
    else if (k === 'mild') setLambda(0.02);
    else if (k === 'cumulative') setLambda(0.06);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Atrophy regime (A3)</h4>
        <div className="flex gap-1 mb-4">
          {([
            ['calculator', 'Calculator'],
            ['mild', 'Mild atrophy'],
            ['cumulative', 'Cumulative'],
          ] as [Parameters<typeof setRegime>[0], string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setRegime(k)}
              className="flex-1 px-2 py-1 text-[11px] font-mono uppercase tracking-wider border border-rule rounded text-muted hover:text-accent hover:border-accent"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          <Slider symbol="λ" label="Atrophy speed" value={lambda} min={0} max={0.10} step={0.005} decimals={3} onChange={setLambda} />
          <Slider symbol="u" label="Offloading rate" value={u} min={0} max={1} step={0.01} onChange={setU} />
          <Slider symbol="ρ₀" label="Initial retained practice" value={rho0} min={0} max={1} step={0.01} onChange={setRho0} />
        </div>

        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mt-6 mb-3">Held fixed across the trajectory</h4>
        <div className="space-y-4">
          <Slider symbol="T" label="Telic share" value={T} min={0} max={1} step={0.01} onChange={setT} />
          <Slider symbol="B" label="Atelic ballast" value={B} min={0} max={1} step={0.01} onChange={setB} />
          <Slider symbol="φ" label="AI-absorbable fraction" value={phi} min={0} max={1} step={0.01} onChange={setPhi} />
          <Slider symbol="κ" label="Competence-frustration sensitivity" value={kappa} min={0} max={1} step={0.01} onChange={setKappa} />
          <Slider symbol="s" label="Pre-attempt skill stock" value={s} min={0} max={1} step={0.01} onChange={setS} />
          <Slider symbol="a" label="AI capability" value={a} min={0} max={1} step={0.01} onChange={setA} />
          <Slider symbol="f" label="Feedback-loop richness" value={f} min={0} max={1} step={0.01} onChange={setF} />
          <Slider symbol="d" label="Daily AI-emotional minutes" value={d} min={0} max={180} step={1} decimals={0} unit=" min" onChange={setD} />
          <Slider symbol="δ_R" label="Relational baseline thickness" value={delta_R} min={0} max={1} step={0.01} onChange={setDeltaR} />
          <Slider label="Horizon (years)" value={horizon} min={1} max={20} step={1} decimals={0} unit=" yr" onChange={setHorizon} />
        </div>
      </div>

      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">ΔNet over time</h4>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="border border-rule rounded bg-paper">
          {/* y axis grid */}
          {[-0.6, -0.3, 0, 0.3, 0.6].map(y => (
            <g key={y}>
              <line x1={padX} y1={yToPx(y)} x2={W - 8} y2={yToPx(y)} stroke="#e6dfcf" strokeWidth={y === 0 ? 1 : 0.5} />
              <text x={padX - 4} y={yToPx(y) + 3} fontSize="9" fontFamily="monospace" fill="#7a7166" textAnchor="end">{y >= 0 ? '+' : ''}{y.toFixed(1)}</text>
            </g>
          ))}
          {/* x axis labels */}
          {[0, Math.floor(horizon / 2), horizon].map(x => (
            <text key={x} x={xToPx(x)} y={H - 4} fontSize="9" fontFamily="monospace" fill="#7a7166" textAnchor="middle">{x}y</text>
          ))}
          {/* dNet curve */}
          <path d={dNetPath} fill="none" stroke="#8a4a2b" strokeWidth={1.5} />
          {/* markers */}
          <text x={W - 12} y={padY + 8} fontSize="9" fontFamily="monospace" fill="#8a4a2b" textAnchor="end">ΔNet</text>
        </svg>

        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mt-6 mb-3">ρ(t) — retained practice</h4>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="border border-rule rounded bg-paper">
          {[0, 0.25, 0.5, 0.75, 1].map(y => (
            <g key={y}>
              <line x1={padX} y1={yToPxRho(y)} x2={W - 8} y2={yToPxRho(y)} stroke="#e6dfcf" strokeWidth={0.5} />
              <text x={padX - 4} y={yToPxRho(y) + 3} fontSize="9" fontFamily="monospace" fill="#7a7166" textAnchor="end">{y.toFixed(2)}</text>
            </g>
          ))}
          {[0, Math.floor(horizon / 2), horizon].map(x => (
            <text key={x} x={xToPx(x)} y={H - 4} fontSize="9" fontFamily="monospace" fill="#7a7166" textAnchor="middle">{x}y</text>
          ))}
          <path d={rhoPath} fill="none" stroke="#3a342c" strokeWidth={1.5} />
          <text x={W - 12} y={padY + 8} fontSize="9" fontFamily="monospace" fill="#3a342c" textAnchor="end">ρ(t)</text>
        </svg>

        <p className="text-[11px] text-muted mt-5 leading-relaxed">
          ρ(t) = ρ₀ · exp(−λ · u · t). Under the calculator-analogue regime (λ = 0), retained practice does not decay — using AI is structurally like using a calculator. Under the cumulative-atrophy regime (λ &gt; 0), ρ falls exponentially in the offloading-rate × time product, and ΔNet drifts down with it because the gate g(f, ρ) closes and ΔV_prod gives way to ΔV_trap. Only ρ evolves; everything else is held fixed across the trajectory so the bridge effect is visible in isolation. The A3 crux (O3 in the topology) is whether the empirical λ for AI-augmented knowledge work is closer to 0 or to 0.06; this will be answered, if at all, by 2+ year longitudinal studies that do not yet exist.
        </p>
      </div>
    </div>
  );
}

// ---- Outer component ---------------------------------------------------

export default function AITransitionModel() {
  const [tab, setTab] = useState<Tab>('integrated');

  return (
    <div className="not-prose my-8 border border-rule rounded-lg bg-paper-edge p-5">
      <div className="flex border-b border-rule mb-5">
        <button
          onClick={() => setTab('integrated')}
          className={
            'px-4 py-2 text-[12px] font-mono uppercase tracking-wider border-b-2 -mb-px transition-colors ' +
            (tab === 'integrated'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted hover:text-accent')
          }
        >
          Integrated ΔNet
        </button>
        <button
          onClick={() => setTab('trajectory')}
          className={
            'px-4 py-2 text-[12px] font-mono uppercase tracking-wider border-b-2 -mb-px transition-colors ' +
            (tab === 'trajectory'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted hover:text-accent')
          }
        >
          Trajectory ρ(t)
        </button>
      </div>

      {tab === 'integrated' ? <IntegratedPanel /> : <TrajectoryPanel />}
    </div>
  );
}

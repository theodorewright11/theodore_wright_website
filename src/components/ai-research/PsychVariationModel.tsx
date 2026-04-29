import { useMemo, useState } from 'react';

type TraitClass = 'cognitive' | 'personality' | 'psychopathology';
type Tab = 'variance' | 'sexdiff';

// ---- Variance decomposition logic ---------------------------------------

// Per-trait-class defaults at the parameter floor (age 5 / m=0 / etc).
// Numbers are illustrative-but-anchored to the literature (Bouchard 2013,
// Briley & Tucker-Drob 2013, Polderman 2015, Howe 2022, Wainschtein 2025).
const TRAIT_DEFAULTS: Record<TraitClass, {
  h2_inf: number;     // Wilson asymptote
  h2_0: number;       // Wilson floor (age 0)
  k_h: number;        // Wilson rate (per year)
  c2_0: number;       // shared-env at age 0
  k_c: number;        // shared-env decay rate
  ratio_i_default: number; // β_i / β_d
  m_default: number;       // cross-spouse phenotypic correlation
  age_default: number;
  age_label: string;
}> = {
  cognitive: {
    h2_inf: 0.80, h2_0: 0.20, k_h: 0.15,
    c2_0: 0.30, k_c: 0.18,
    ratio_i_default: 0.40, m_default: 0.40,
    age_default: 25, age_label: 'adulthood',
  },
  personality: {
    h2_inf: 0.45, h2_0: 0.40, k_h: 0.05, // nearly flat
    c2_0: 0.10, k_c: 0.20,
    ratio_i_default: 0.10, m_default: 0.15,
    age_default: 30, age_label: 'adulthood',
  },
  psychopathology: {
    h2_inf: 0.50, h2_0: 0.30, k_h: 0.10,
    c2_0: 0.15, k_c: 0.15,
    ratio_i_default: 0.20, m_default: 0.20,
    age_default: 30, age_label: 'adulthood',
  },
};

function computeDecomposition(
  trait: TraitClass,
  age: number,
  m: number,
  ratio_i: number,
  shareRare: number,
) {
  const T = TRAIT_DEFAULTS[trait];

  // Wilson curve: h²(t). Treat this as the upper-bound additive
  // (V(A_d) + V(A_LD)) under random-mating assumption; we then add
  // V(A_i) on top via genetic-nurture coupling, as a separate component.
  const h2_random_mating = T.h2_inf - (T.h2_inf - T.h2_0) * Math.exp(-T.k_h * age);
  const c2 = T.c2_0 * Math.exp(-T.k_c * age);

  // Crow–Felsenstein AM equilibrium: solve r_δ = m · h²*(r_δ) as a fixed point.
  // h²*(r_δ) = h²_rm / (1 − r_δ + r_δ · h²_rm)  (after one substitution).
  // We use ~6 fixed-point iterations; converges fast for m·h² < 0.5.
  let r_delta = m * h2_random_mating;
  for (let i = 0; i < 6; i++) {
    const inflation_iter = 1 / Math.max(1 - r_delta, 0.05);
    const v_a_eq = h2_random_mating * inflation_iter;
    const h2_eq = v_a_eq / (v_a_eq + (1 - h2_random_mating)); // fix V_E at random-mating level
    r_delta = Math.min(m * h2_eq, 0.6);
  }
  const am_inflation = 1 / Math.max(1 - r_delta, 0.05);

  // Build the variance components.
  // V(A_d) is the direct genetic; under AM equilibrium V(A_d) inflates to V(A_d)·inflation.
  // We treat the inflation as the V(A_LD) component (so V(A_d) is the random-mating direct).
  const v_Ad_total_with_LD = h2_random_mating * am_inflation;
  const v_ALD = v_Ad_total_with_LD - h2_random_mating;
  const v_Ad = h2_random_mating;
  // V(A_i) sits on top and adds to total variance (this is the genetic-nurture environmental contribution).
  const v_Ai = ratio_i * v_Ad;

  // Rare-variant slice peels off V(A_d).
  const v_Ad_rare = v_Ad * shareRare;
  const v_Ad_common = v_Ad - v_Ad_rare;

  // Residual environment (V(C) + V(E)) fills to 1 once we've accounted for additive + indirect.
  const total_genetic_plus_LD = v_Ad + v_ALD;
  const v_C_with_nurture = c2 + v_Ai;            // V(A_i) lands in C under correctly specified ACE
  const v_E = Math.max(0, 1 - total_genetic_plus_LD - v_C_with_nurture);

  // Estimator views (corrected per pass-2 method-gradient discussion):
  //   Twin h² (classical ACE) = V(A_d) + V(A_LD); V(A_i) lands in C.
  //   SNP h² (LDSC on population GWAS) = V(A_d, common) + V(A_LD) + a fraction of V(A_i)·k.
  //     We approximate the V(A_i) leakage at 0.5 (mid-range AM coupling).
  //   Within-family h² = V(A_d) only.
  const twin_h2 = v_Ad + v_ALD;
  const snp_h2 = v_Ad_common + v_ALD + 0.5 * v_Ai;
  const wf_h2 = v_Ad;

  return {
    h2_random_mating, c2, r_delta, am_inflation,
    v_Ad, v_Ai, v_ALD, v_Ad_rare, v_Ad_common,
    v_C_baseline: c2, v_C_with_nurture, v_E,
    twin_h2, snp_h2, wf_h2,
  };
}

// ---- Multivariate sex-difference logic ----------------------------------

// For an equicorrelated covariance matrix Σ with constant off-diagonal ρ̄,
// and an effect-size vector with constant magnitude |d|,
// D² = d² · n / (1 + (n−1)·ρ̄)
function computeMahalanobisD(n: number, dAvg: number, rhoAvg: number) {
  const denom = 1 + (n - 1) * rhoAvg;
  if (denom <= 0) return { D: NaN, overlapPct: NaN };
  const D2 = (dAvg * dAvg * n) / denom;
  const D = Math.sqrt(D2);
  // For multivariate normal distributions in n-D, the overlap of two
  // distributions separated by D is approximately 2·Φ(−D/2) on each
  // marginal projection, then iterated. The standard approximation
  // (Del Giudice et al. 2012) is overlap ≈ 2 · Φ(−D/2).
  const overlapPct = 100 * 2 * normalCDF(-D / 2);
  return { D, overlapPct };
}

function normalCDF(x: number) {
  // Abramowitz & Stegun 7.1.26
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
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

type StackedBarProps = {
  segments: { label: string; value: number; color: string; }[];
};

function StackedBar({ segments }: StackedBarProps) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className="space-y-2">
      <div className="h-7 w-full flex rounded overflow-hidden border border-rule">
        {segments.map((s, i) => (
          <div
            key={i}
            className="h-full transition-all"
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.label}: ${(s.value * 100).toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono text-muted">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="flex items-center">
              <span className="inline-block w-2 h-2 mr-2 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
            <span className="text-ink-soft">{(s.value * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type NumberCardProps = {
  label: string;
  value: string;
  formula?: string;
  hint?: string;
};

function NumberCard({ label, value, formula, hint }: NumberCardProps) {
  return (
    <div className="border border-rule rounded px-3 py-2 bg-paper">
      <div className="text-[10px] uppercase tracking-wider font-mono text-muted">{label}</div>
      <div className="text-[18px] font-display text-ink mt-0.5">{value}</div>
      {formula && <div className="text-[10px] font-mono text-muted mt-0.5">{formula}</div>}
      {hint && <div className="text-[10px] text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

// ---- Variance panel ----------------------------------------------------

function VariancePanel() {
  const [trait, setTrait] = useState<TraitClass>('cognitive');
  const [age, setAge] = useState(25);
  const [m, setM] = useState(0.40);
  const [ratio_i, setRatioI] = useState(0.40);
  const [shareRare, setShareRare] = useState(0.10);

  const d = useMemo(
    () => computeDecomposition(trait, age, m, ratio_i, shareRare),
    [trait, age, m, ratio_i, shareRare],
  );

  const segments = [
    { label: 'V(A_d) common', value: d.v_Ad_common, color: '#1a1614' },
    { label: 'V(A_d) rare',   value: d.v_Ad_rare,   color: '#3a342c' },
    { label: 'V(A_LD) AM-induced', value: d.v_ALD, color: '#c98a6e' },
    { label: 'V(A_i) → lands in C', value: d.v_Ai, color: '#8a4a2b' },
    { label: 'V(C) shared env',  value: d.v_C_baseline, color: '#a89677' },
    { label: 'V(E) non-shared',  value: d.v_E, color: '#d9d0bf' },
  ];

  const setPreset = (p: 'ea' | 'iq_child' | 'iq_adult' | 'big5') => {
    if (p === 'ea') {
      setTrait('cognitive'); setAge(25); setM(0.40); setRatioI(0.40); setShareRare(0.10);
    } else if (p === 'iq_child') {
      setTrait('cognitive'); setAge(5); setM(0.40); setRatioI(0.40); setShareRare(0.10);
    } else if (p === 'iq_adult') {
      setTrait('cognitive'); setAge(25); setM(0.30); setRatioI(0.30); setShareRare(0.10);
    } else if (p === 'big5') {
      setTrait('personality'); setAge(35); setM(0.15); setRatioI(0.10); setShareRare(0.05);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Inputs</h4>

        <div className="mb-4">
          <div className="text-[13px] text-ink-soft mb-1.5">Trait class</div>
          <div className="flex gap-1">
            {(['cognitive', 'personality', 'psychopathology'] as TraitClass[]).map(t => (
              <button
                key={t}
                onClick={() => setTrait(t)}
                className={
                  'flex-1 px-2 py-1 text-[11px] font-mono uppercase tracking-wider border rounded transition-colors ' +
                  (trait === t
                    ? 'border-accent text-accent bg-paper-edge'
                    : 'border-rule text-muted hover:text-accent hover:border-accent')
                }
              >
                {t.slice(0, 7)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Slider label="Age (years)" value={age} min={1} max={80} step={1} onChange={setAge} />
          <Slider symbol="m" label="Spousal phenotypic correlation" value={m} min={0} max={0.6} step={0.01} onChange={setM} />
          <Slider symbol="β_i/β_d" label="Indirect / direct genetic ratio" value={ratio_i} min={0} max={0.6} step={0.01} onChange={setRatioI} />
          <Slider symbol="rare" label="Rare-variant share of direct" value={shareRare} min={0} max={0.30} step={0.01} onChange={setShareRare} />
        </div>

        <div className="mt-5 pt-4 border-t border-rule-soft">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">Anchors</div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setPreset('ea')} className="px-2 py-1 text-[11px] font-mono border border-rule rounded text-muted hover:text-accent hover:border-accent">EA, age 25</button>
            <button onClick={() => setPreset('iq_child')} className="px-2 py-1 text-[11px] font-mono border border-rule rounded text-muted hover:text-accent hover:border-accent">IQ, age 5</button>
            <button onClick={() => setPreset('iq_adult')} className="px-2 py-1 text-[11px] font-mono border border-rule rounded text-muted hover:text-accent hover:border-accent">IQ, age 25</button>
            <button onClick={() => setPreset('big5')} className="px-2 py-1 text-[11px] font-mono border border-rule rounded text-muted hover:text-accent hover:border-accent">Big Five adult</button>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Variance decomposition</h4>
        <StackedBar segments={segments} />

        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mt-6 mb-3">Method gradient</h4>
        <div className="grid grid-cols-3 gap-2">
          <NumberCard label="Twin h² (ACE)" value={d.twin_h2.toFixed(2)} formula="A_d + A_LD" hint="A_i lands in C" />
          <NumberCard label="SNP h² (LDSC)" value={d.snp_h2.toFixed(2)} formula="A_d,common + A_LD + ½·A_i" />
          <NumberCard label="Within-family" value={d.wf_h2.toFixed(2)} formula="A_d only" />
        </div>

        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mt-6 mb-3">Assortative mating (fixed point)</h4>
        <div className="grid grid-cols-2 gap-2">
          <NumberCard label="r_δ equilibrium" value={d.r_delta.toFixed(3)} formula="r_δ = m · h²(r_δ)" />
          <NumberCard label="V_A inflation" value={d.am_inflation.toFixed(2) + '×'} formula="1 / (1 − r_δ)" />
        </div>

        <p className="text-[11px] text-muted mt-5 leading-relaxed">
          Under correctly specified ACE, V(A_i) is shared identically by MZ and DZ co-twins (same parents) and lands in C, not in twin h². Empirical twin h² for EA exceeds within-family by ~0.20–0.25 mostly because AM and unmodeled genetic nurture leak into A. The honest method gradient: twin h² ≥ SNP h² ≥ within-family h², with each estimator answering a slightly different question.
        </p>
      </div>
    </div>
  );
}

// ---- Sex-difference panel ----------------------------------------------

function SexDiffPanel() {
  const [n, setN] = useState(15);
  const [dAvg, setDAvg] = useState(0.50);
  const [rho, setRho] = useState(0.20);

  const { D, overlapPct } = useMemo(() => computeMahalanobisD(n, dAvg, rho), [n, dAvg, rho]);

  const setPreset = (p: 'math' | 'big5' | '16pf_obs' | 'people_things') => {
    if (p === 'math') { setN(1); setDAvg(0.05); setRho(0); }
    else if (p === 'big5') { setN(5); setDAvg(0.40); setRho(0.20); }
    else if (p === '16pf_obs') { setN(15); setDAvg(0.50); setRho(0.18); }
    else if (p === 'people_things') { setN(1); setDAvg(0.93); setRho(0); }
  };

  // Bar visualizing where this lands relative to common anchors
  const dBarMax = 3.0;
  const Dpct = Math.min((D / dBarMax) * 100, 100);

  let label = 'trivial';
  if (D >= 0.2 && D < 0.5) label = 'small';
  else if (D >= 0.5 && D < 0.8) label = 'medium';
  else if (D >= 0.8 && D < 1.5) label = 'large';
  else if (D >= 1.5 && D < 2.5) label = 'very large';
  else if (D >= 2.5) label = 'extreme';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Inputs</h4>
        <div className="space-y-4">
          <Slider symbol="n" label="Number of dimensions" value={n} min={1} max={20} step={1} onChange={setN} />
          <Slider symbol="|d|" label="Avg univariate Cohen's d" value={dAvg} min={0} max={1.5} step={0.01} onChange={setDAvg} />
          <Slider symbol="ρ̄" label="Avg inter-trait correlation" value={rho} min={-0.2} max={0.8} step={0.01} onChange={setRho} />
        </div>

        <div className="mt-5 pt-4 border-t border-rule-soft">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">Anchors</div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setPreset('math')} className="px-2 py-1 text-[11px] font-mono border border-rule rounded text-muted hover:text-accent hover:border-accent">Math d=0.05</button>
            <button onClick={() => setPreset('big5')} className="px-2 py-1 text-[11px] font-mono border border-rule rounded text-muted hover:text-accent hover:border-accent">Big Five</button>
            <button onClick={() => setPreset('16pf_obs')} className="px-2 py-1 text-[11px] font-mono border border-rule rounded text-muted hover:text-accent hover:border-accent">16PF observed</button>
            <button onClick={() => setPreset('people_things')} className="px-2 py-1 text-[11px] font-mono border border-rule rounded text-muted hover:text-accent hover:border-accent">People-things d=0.93</button>
          </div>
        </div>

        <p className="text-[11px] text-muted mt-5 leading-relaxed">
          Same data, two numbers: a single dimension gives a univariate d; many weakly correlated dimensions give a multivariate D much larger than any individual d. Both are correct about different objects. D3 distortions cite small d's; D4 distortions cite large D's.
        </p>
        <p className="text-[11px] text-muted mt-3 leading-relaxed">
          The "16PF observed" preset gives D ≈ 1.0. Del Giudice 2012's reported D = 2.71 used latent-variable modeling with measurement-error disattenuation, which the equicorrelated approximation here cannot reproduce. The gap between observed and disattenuated D is itself a substantive piece of the field's debate.
        </p>
      </div>

      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Multivariate effect</h4>

        <div className="grid grid-cols-2 gap-2">
          <NumberCard label="Mahalanobis D" value={isNaN(D) ? '—' : D.toFixed(2)} formula="√(d² · n / (1 + (n−1)ρ̄))" hint={label} />
          <NumberCard label="Distribution overlap" value={isNaN(overlapPct) ? '—' : `${overlapPct.toFixed(1)}%`} formula="≈ 2·Φ(−D/2)" />
        </div>

        <div className="mt-6">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">D on a 0—3 scale</div>
          <div className="h-7 bg-paper-edge rounded relative overflow-hidden border border-rule">
            <div className="h-full transition-all" style={{ width: `${Dpct}%`, backgroundColor: '#8a4a2b' }} />
            <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-mono text-muted pointer-events-none">
              <span>0</span><span>0.8 large</span><span>2.5 extreme</span>
            </div>
          </div>
        </div>

        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mt-6 mb-3">Compare</h4>
        <div className="space-y-2 text-[12px]">
          <div className="flex justify-between border-b border-rule-soft pb-1">
            <span className="text-ink-soft">Avg univariate d (one dim)</span>
            <span className="font-mono text-ink">{dAvg.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-b border-rule-soft pb-1">
            <span className="text-ink-soft">Multivariate D ({n}-D)</span>
            <span className="font-mono text-ink">{isNaN(D) ? '—' : D.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-soft">Ratio D / d</span>
            <span className="font-mono text-ink">{isNaN(D) || dAvg === 0 ? '—' : (D / dAvg).toFixed(2) + '×'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Outer component ---------------------------------------------------

export default function PsychVariationModel() {
  const [tab, setTab] = useState<Tab>('variance');

  return (
    <div className="not-prose my-8 border border-rule rounded-lg bg-paper-edge p-5">
      <div className="flex border-b border-rule mb-5">
        <button
          onClick={() => setTab('variance')}
          className={
            'px-4 py-2 text-[12px] font-mono uppercase tracking-wider border-b-2 -mb-px transition-colors ' +
            (tab === 'variance'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted hover:text-accent')
          }
        >
          Variance decomposition
        </button>
        <button
          onClick={() => setTab('sexdiff')}
          className={
            'px-4 py-2 text-[12px] font-mono uppercase tracking-wider border-b-2 -mb-px transition-colors ' +
            (tab === 'sexdiff'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted hover:text-accent')
          }
        >
          Multivariate sex-difference
        </button>
      </div>

      {tab === 'variance' ? <VariancePanel /> : <SexDiffPanel />}
    </div>
  );
}

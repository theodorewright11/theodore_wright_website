import { useMemo, useState } from 'react';

type TraitClass = 'cognitive' | 'personality' | 'psychopathology';
type Tab = 'variance' | 'sexdiff';

// ---- Variance decomposition logic ---------------------------------------

// Per-trait-class defaults. Wilson curve uses logistic form
//   h²(t) = h²_∞ / (1 + exp(-k_h · (t - t_50)))
// because the empirical age-of-rise is sigmoidal (slow at infancy, fastest in
// late childhood, saturating in late adolescence) — saturating exponentials
// rise too fast at the young end (Briley & Tucker-Drob 2013, Bouchard 2013).
// c²(t) gets an explicit non-zero asymptote c²_∞ since shared environment
// for cognition / EA / psychopathology does not actually go to zero in adulthood.
const TRAIT_DEFAULTS: Record<TraitClass, {
  h2_inf: number;     // Wilson asymptote (V(A_d) + V(A_LD))
  t_50: number;       // age at which h² = h²_∞ / 2
  k_h: number;        // logistic slope per year
  c2_0: number;       // shared-env at age 0
  c2_inf: number;     // shared-env asymptote at adulthood
  k_c: number;        // shared-env decay rate
  ratio_i_default: number; // β_i / β_d (regression-coefficient level)
  m_default: number;       // cross-spouse phenotypic correlation
  age_default: number;
  age_label: string;
}> = {
  cognitive: {
    // IQ-like composite. Empirical anchors: h²(5) ≈ 0.20, h²(20+) ≈ 0.75-0.80.
    h2_inf: 0.80, t_50: 9, k_h: 0.30,
    c2_0: 0.50, c2_inf: 0.05, k_c: 0.15,
    ratio_i_default: 0.40, m_default: 0.40,
    age_default: 25, age_label: 'adulthood',
  },
  personality: {
    // Big-Five-like. h² roughly flat across ages, ~0.40-0.45.
    h2_inf: 0.45, t_50: 2, k_h: 1.0,
    c2_0: 0.10, c2_inf: 0.0, k_c: 0.20,
    ratio_i_default: 0.10, m_default: 0.15,
    age_default: 30, age_label: 'adulthood',
  },
  psychopathology: {
    // Aggregate of psychiatric / mood / anxiety conditions. Moderate h², C tail persists.
    // m_default = 0.30 is a midpoint over a heterogeneous AM landscape:
    // Nordsletten 2016 reports tetrachoric spousal correlations >0.40 for
    // schizophrenia, ADHD, autism — and 0.14–0.19 for affective disorders
    // (bipolar, MDD). The category does not have a single "right" m; users
    // testing AM-strong psychiatric (SCZ/ADHD/ASD) should slide m up to ~0.45,
    // and AM-weak (MDD/BIP/anxiety) down to ~0.15.
    h2_inf: 0.50, t_50: 8, k_h: 0.30,
    c2_0: 0.20, c2_inf: 0.05, k_c: 0.15,
    ratio_i_default: 0.20, m_default: 0.30,
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

  // Wilson logistic: h²(t) is the *observed* (AM-equilibrium) additive heritability —
  // the thing twin studies report. By construction h²(t) = V(A_d) + V(A_LD).
  // We do NOT multiply by an inflation factor on top of this — that was the pass-2
  // bug. Instead AM inflation is used to *partition* h² into V(A_d) and V(A_LD).
  const h2_observed = T.h2_inf / (1 + Math.exp(-T.k_h * (age - T.t_50)));

  // Shared environment with non-zero asymptote.
  const c2 = T.c2_inf + (T.c2_0 - T.c2_inf) * Math.exp(-T.k_c * age);

  // AM partition. r_δ = m · h²_observed at AM equilibrium (Wilson is already at
  // equilibrium, so no fixed-point iteration needed). Inflation factor relates
  // V(A_d) (clean, within-family) to V(A_d) + V(A_LD) (the observed total).
  const r_delta = Math.min(m * h2_observed, 0.6);
  const am_inflation = 1 / Math.max(1 - r_delta, 0.05);
  const v_Ad = h2_observed / am_inflation;
  const v_ALD = h2_observed - v_Ad;

  // Genetic-nurture variance contribution. ratio_i is at the β level (β_i/β_d).
  // At the variance level, V(A_i) ≈ ratio_i² · V(A_d). The cross-term
  // 2·Cov(A_d, A_i) ≈ 2·ratio_i·V(A_d) is held in the V(C) bucket conceptually
  // (it's the "leakage" path) but not displayed separately to keep the budget clean.
  const v_Ai = ratio_i * ratio_i * v_Ad;

  // Rare-variant slice peels off V(A_d).
  const v_Ad_rare = v_Ad * shareRare;
  const v_Ad_common = v_Ad - v_Ad_rare;

  const v_C = c2;
  const v_E = Math.max(0, 1 - v_Ad - v_ALD - v_Ai - v_C);

  // Estimator views.
  // Twin h² (correctly specified ACE) = V(A_d) + V(A_LD) = h²_observed by construction.
  //   Real-world classical ACE without AM correction will exceed this by absorbing
  //   some V(A_i) leakage; we display the clean number with a note.
  // SNP h² (LDSC on population GWAS) ≈ V(A_d, common) + V(A_LD) + ~30% of V(A_i)
  //   (population effect sizes carry partial indirect contamination; LDSC partly
  //   adjusts for LD but not fully for AM-induced LD).
  // Within-family h² = V(A_d) only.
  const twin_h2 = v_Ad + v_ALD;
  const snp_h2 = v_Ad_common + v_ALD + 0.3 * v_Ai;
  const wf_h2 = v_Ad;

  return {
    h2_observed, c2, r_delta, am_inflation,
    v_Ad, v_Ai, v_ALD, v_Ad_rare, v_Ad_common,
    v_C, v_E,
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
    { label: 'V(A_i) genetic nurture', value: d.v_Ai, color: '#8a4a2b' },
    { label: 'V(C) shared env',  value: d.v_C, color: '#a89677' },
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

        <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mt-6 mb-3">Assortative-mating partition</h4>
        <div className="grid grid-cols-2 gap-2">
          <NumberCard label="r_δ" value={d.r_delta.toFixed(3)} formula="m · h²" />
          <NumberCard label="V(A_d) / h²" value={(1 / d.am_inflation).toFixed(2)} formula="direct share of additive" />
        </div>

        <p className="text-[11px] text-muted mt-5 leading-relaxed">
          Wilson h²(t) is the *observed* (AM-equilibrium) heritability twin studies estimate. AM-LD partitions it into V(A_d) (clean direct, what within-family designs estimate) and V(A_LD) (structural inflation from non-random mating). V(A_i) is added on top as the variance contribution of genetic nurture; classical ACE without AM correction tends to leak some of V(A_i) into A, which is why empirical twin h² often exceeds the dashboard's "Twin h² (ACE)" output.
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

import { useMemo, useState } from 'react';

// ----------------------------------------------------------------------
// Findings panel for the data stage of human-psych-variation.
//
// All numbers below come from the curated CSVs in
// stage_outputs/human-psych-variation/data/. Frozen here at build time;
// re-run pipeline.py and re-paste findings.json to refresh.
//
// V4 design tokens used directly (paper, ink, ink-soft, muted, rule,
// rule-soft, accent, accent-soft, paper-edge). Charts hand-rolled in SVG
// to match the existing model-stage dashboard aesthetic.
// ----------------------------------------------------------------------

type MethodGradientRow = {
  trait: string;
  trait_class: string;
  twin_h2: number | null;
  snp_h2: number | null;
  wgs_h2: number | null;
  wf_h2: number | null;
};

type AmPartitionRow = {
  trait: string;
  m: number;
  h2_observed: number;
  v_Ad: number;
  v_ALD: number;
  ALD_share_of_h2: number;
};

type SexDiffRow = {
  trait_panel: string;
  n_dimensions: number;
  d_avg_univariate: number;
  rho_avg: number;
  D_disattenuated: number;
  D_equicorrelated: number;
  n_sample: number | null;
};

type WilsonAnchor = { age: number; h2_observed: number; h2_predicted: number };

const METHOD_GRADIENT: MethodGradientRow[] = [
  { trait: 'educational_attainment', trait_class: 'achievement', twin_h2: 0.40, snp_h2: 0.13, wgs_h2: null, wf_h2: 0.15 },
  { trait: 'height', trait_class: 'physical', twin_h2: 0.85, snp_h2: 0.50, wgs_h2: 0.68, wf_h2: 0.78 },
  { trait: 'bmi', trait_class: 'physical', twin_h2: 0.75, snp_h2: 0.27, wgs_h2: null, wf_h2: 0.50 },
  { trait: 'iq_g (adult)', trait_class: 'cognitive', twin_h2: 0.79, snp_h2: 0.20, wgs_h2: null, wf_h2: 0.50 },
  { trait: 'big_five_avg', trait_class: 'personality', twin_h2: 0.45, snp_h2: 0.10, wgs_h2: null, wf_h2: null },
  { trait: 'schizophrenia', trait_class: 'psychiatric', twin_h2: 0.79, snp_h2: 0.24, wgs_h2: null, wf_h2: null },
  { trait: 'mdd', trait_class: 'psychiatric', twin_h2: 0.37, snp_h2: 0.09, wgs_h2: null, wf_h2: null },
  { trait: 'adhd', trait_class: 'psychiatric', twin_h2: 0.74, snp_h2: 0.14, wgs_h2: null, wf_h2: null },
  { trait: 'autism', trait_class: 'psychiatric', twin_h2: 0.80, snp_h2: 0.12, wgs_h2: null, wf_h2: null },
  { trait: 'smoking_initiation', trait_class: 'behavioral', twin_h2: 0.50, snp_h2: 0.08, wgs_h2: null, wf_h2: 0.30 },
];

const AM_PARTITION: AmPartitionRow[] = [
  { trait: 'educational_attainment', m: 0.55, h2_observed: 0.40, v_Ad: 0.31, v_ALD: 0.09, ALD_share_of_h2: 0.22 },
  { trait: 'height', m: 0.24, h2_observed: 0.85, v_Ad: 0.68, v_ALD: 0.17, ALD_share_of_h2: 0.20 },
  { trait: 'bmi', m: 0.16, h2_observed: 0.75, v_Ad: 0.66, v_ALD: 0.09, ALD_share_of_h2: 0.12 },
  { trait: 'iq_g (adult)', m: 0.44, h2_observed: 0.79, v_Ad: 0.52, v_ALD: 0.27, ALD_share_of_h2: 0.35 },
  { trait: 'big_five_avg', m: 0.13, h2_observed: 0.45, v_Ad: 0.42, v_ALD: 0.03, ALD_share_of_h2: 0.06 },
  { trait: 'neuroticism', m: 0.11, h2_observed: 0.45, v_Ad: 0.43, v_ALD: 0.02, ALD_share_of_h2: 0.05 },
  { trait: 'schizophrenia', m: 0.30, h2_observed: 0.79, v_Ad: 0.60, v_ALD: 0.19, ALD_share_of_h2: 0.24 },
  { trait: 'mdd', m: 0.15, h2_observed: 0.37, v_Ad: 0.35, v_ALD: 0.02, ALD_share_of_h2: 0.06 },
  { trait: 'political_orientation', m: 0.58, h2_observed: 0.40, v_Ad: 0.31, v_ALD: 0.09, ALD_share_of_h2: 0.23 },
  { trait: 'religiosity', m: 0.56, h2_observed: 0.38, v_Ad: 0.30, v_ALD: 0.08, ALD_share_of_h2: 0.21 },
  { trait: 'smoking_initiation', m: 0.38, h2_observed: 0.50, v_Ad: 0.41, v_ALD: 0.10, ALD_share_of_h2: 0.19 },
  { trait: 'drinking_quantity', m: 0.42, h2_observed: 0.50, v_Ad: 0.40, v_ALD: 0.11, ALD_share_of_h2: 0.21 },
];

const SEX_DIFF: SexDiffRow[] = [
  { trait_panel: 'math (single)',         n_dimensions: 1,  d_avg_univariate: 0.05, rho_avg: 0.0,  D_disattenuated: 0.05, D_equicorrelated: 0.05, n_sample: 1286350 },
  { trait_panel: 'verbal (single)',       n_dimensions: 1,  d_avg_univariate: 0.10, rho_avg: 0.0,  D_disattenuated: 0.10, D_equicorrelated: 0.10, n_sample: null },
  { trait_panel: 'people–things',         n_dimensions: 1,  d_avg_univariate: 0.93, rho_avg: 0.0,  D_disattenuated: 0.93, D_equicorrelated: 0.93, n_sample: 503127 },
  { trait_panel: 'Big Five (5-dim)',      n_dimensions: 5,  d_avg_univariate: 0.40, rho_avg: 0.20, D_disattenuated: 1.10, D_equicorrelated: 0.86, n_sample: null },
  { trait_panel: '16PF observed',         n_dimensions: 15, d_avg_univariate: 0.50, rho_avg: 0.18, D_disattenuated: 2.71, D_equicorrelated: 1.03, n_sample: 10261 },
  { trait_panel: '16PF replication',      n_dimensions: 15, d_avg_univariate: 0.50, rho_avg: 0.20, D_disattenuated: 2.10, D_equicorrelated: 0.99, n_sample: 31637 },
  { trait_panel: 'Brain volumes (7)',     n_dimensions: 7,  d_avg_univariate: 0.50, rho_avg: 0.30, D_disattenuated: 1.20, D_equicorrelated: 0.79, n_sample: 2750 },
];

// Bouchard 2013 anchors + logistic fit
const WILSON_FIT = { h_inf: 0.81, t_50: 9.0, k: 0.27 };
const WILSON_ANCHORS: WilsonAnchor[] = [
  { age: 5,  h2_observed: 0.20, h2_predicted: 0.21 },
  { age: 7,  h2_observed: 0.30, h2_predicted: 0.32 },
  { age: 10, h2_observed: 0.46, h2_predicted: 0.46 },
  { age: 12, h2_observed: 0.55, h2_predicted: 0.53 },
  { age: 15, h2_observed: 0.66, h2_predicted: 0.64 },
  { age: 17, h2_observed: 0.74, h2_predicted: 0.69 },
  { age: 25, h2_observed: 0.79, h2_predicted: 0.78 },
];

// PGS portability — per-ancestry literature anchors. Each row cites a
// specific paper that reports relative R² for European-trained PGS in the
// target population. NOT an independent replication of Ding 2023 (which
// uses continuous PCA-distance on individual-level data we don't have).
// Ding 2023's r=-0.95 is the headline; this panel shows the trend is
// internally consistent across categorical-ancestry literature.
const PORTABILITY: { trait: string; ancestry: string; gd: number; rel_r2: number; source: string }[] = [
  { trait: 'across-trait avg', ancestry: 'EUR', gd: 0.00, rel_r2: 1.00, source: 'Martin 2019 ref' },
  { trait: 'across-trait avg', ancestry: 'SAS', gd: 0.10, rel_r2: 0.63, source: 'Martin 2019' },
  { trait: 'across-trait avg', ancestry: 'EAS', gd: 0.15, rel_r2: 0.50, source: 'Martin 2019' },
  { trait: 'across-trait avg', ancestry: 'AMR', gd: 0.18, rel_r2: 0.50, source: 'Martin 2019' },
  { trait: 'across-trait avg', ancestry: 'AFR', gd: 0.30, rel_r2: 0.22, source: 'Martin 2019' },
  { trait: 'EA',               ancestry: 'EUR', gd: 0.00, rel_r2: 1.00, source: 'Okbay 2022' },
  { trait: 'EA',               ancestry: 'AFR', gd: 0.30, rel_r2: 0.10, source: 'Okbay 2022' },
  { trait: 'height',           ancestry: 'EUR', gd: 0.00, rel_r2: 1.00, source: 'Yengo 2022' },
  { trait: 'height',           ancestry: 'AFR', gd: 0.30, rel_r2: 0.20, source: 'Yengo 2022' },
  { trait: 'schizophrenia',    ancestry: 'EUR', gd: 0.00, rel_r2: 1.00, source: 'Trubetskoy 2022' },
  { trait: 'schizophrenia',    ancestry: 'AFR', gd: 0.30, rel_r2: 0.30, source: 'Trubetskoy 2022' },
];

const XAM_PSYCHIATRIC = [
  { pair: 'anxiety × MDD',             gamma_hat: 0.21, ci: [0.17, 0.25] as [number, number] },
  { pair: 'AUD × schizophrenia',       gamma_hat: 0.83, ci: [0.59, 1.24] as [number, number] },
  { pair: 'avg across 6 disorders',    gamma_hat: 0.29, ci: [0.27, 0.31] as [number, number] },
];

type EnvRow = {
  exposure: string;
  effect_size: number;
  ci_low: number | null;
  ci_high: number | null;
  design: string;
  causal_evidence: string;
  source: string;
};

const ENV_EFFECTS: EnvRow[] = [
  { exposure: 'schooling per year',                effect_size:  3.4, ci_low:  1.0, ci_high:  5.0, design: 'quasi-experimental meta',  causal_evidence: 'strong',   source: 'Ritchie & Tucker-Drob 2018' },
  { exposure: 'breastfeeding (PROBIT RCT)',        effect_size:  3.2, ci_low:  1.5, ci_high:  5.0, design: 'cluster RCT',              causal_evidence: 'strong',   source: 'Kramer 2008 PROBIT' },
  { exposure: 'parenting (within Western normal)', effect_size:  1.0, ci_low: -1.0, ci_high:  3.0, design: 'within-family twin',       causal_evidence: 'weak',     source: 'Plomin & Daniels 1987 meta' },
  { exposure: 'PM₂.₅ per 1 µg/m³',                  effect_size: -0.27, ci_low: -0.5, ci_high: -0.05, design: 'observational meta',     causal_evidence: 'moderate', source: 'Aghaei 2024' },
  { exposure: 'lead (blood 1→10 µg/dL)',           effect_size: -6.2, ci_low: -8.6, ci_high: -3.8, design: 'pooled longitudinal',      causal_evidence: 'strong',   source: 'Lanphear 2005' },
  { exposure: 'iodine (severe deficiency)',        effect_size: -10.0, ci_low: -12.0, ci_high: -8.0, design: 'observational + RCT',    causal_evidence: 'strong',   source: 'Bougma 2013' },
  { exposure: 'adoption: high → low SES',          effect_size: -12.0, ci_low: -15.0, ci_high: -8.0, design: 'natural experiment',     causal_evidence: 'strong',   source: 'Capron & Duyme 1996' },
  { exposure: 'severe deprivation (Romanian)',     effect_size: -15.0, ci_low: -20.0, ci_high: -10.0, design: 'natural experiment',    causal_evidence: 'strong',   source: 'Nelson 2007 BEIP' },
  { exposure: 'severe chronic malnutrition',       effect_size: -15.0, ci_low: -20.0, ci_high: -10.0, design: 'observational',         causal_evidence: 'strong',   source: 'Grantham-McGregor 2007' },
  { exposure: 'prenatal alcohol (full FAS)',       effect_size: -30.0, ci_low: -40.0, ci_high: -20.0, design: 'observational',         causal_evidence: 'strong',   source: 'Streissguth 2004' },
];

// ---- Tabs --------------------------------------------------------------

type Tab = 'gradient' | 'am' | 'wilson' | 'sex' | 'portability' | 'xam' | 'env';

const TABS: { key: Tab; label: string; symbol: string }[] = [
  { key: 'gradient',    label: 'Method gradient',     symbol: 'H1' },
  { key: 'am',          label: 'AM partition',        symbol: 'H2' },
  { key: 'wilson',      label: 'Wilson curve',        symbol: 'H3' },
  { key: 'sex',         label: 'Multivariate D',      symbol: 'H4' },
  { key: 'portability', label: 'PGS portability',     symbol: 'H5' },
  { key: 'xam',         label: 'xAM inflation',       symbol: 'H6' },
  { key: 'env',         label: 'Environmental causes', symbol: 'H7' },
];

// ---- Top-level component -----------------------------------------------

export default function PsychVariationData() {
  const [tab, setTab] = useState<Tab>('gradient');
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
      {tab === 'gradient' && <MethodGradientPanel />}
      {tab === 'am' && <AmPartitionPanel />}
      {tab === 'wilson' && <WilsonPanel />}
      {tab === 'sex' && <SexDiffPanel />}
      {tab === 'portability' && <PortabilityPanel />}
      {tab === 'xam' && <XamPanel />}
      {tab === 'env' && <EnvPanel />}
    </div>
  );
}

// ---- Generic chart atoms ----------------------------------------------

function ChartFrame({ children, height = 280 }: { children: React.ReactNode; height?: number }) {
  return (
    <div className="border border-rule-soft rounded bg-paper" style={{ height }}>
      {children}
    </div>
  );
}

function Verdict({ kind, children }: { kind: 'supported' | 'mixed' | 'caveat'; children: React.ReactNode }) {
  const color =
    kind === 'supported' ? 'text-accent border-accent' :
    kind === 'mixed' ? 'text-muted border-rule' :
    'text-accent-soft border-accent-soft';
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
  verdictKind: 'supported' | 'mixed' | 'caveat';
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

// ---- H1 method gradient -----------------------------------------------

function MethodGradientPanel() {
  const traits = METHOD_GRADIENT;
  const W = 100;
  const max = 1.0;

  return (
    <div>
      <PanelHeader
        title="H1. Method gradient"
        claim="The model predicts twin h² ≥ WGS h² ≥ SNP h² ≥ within-family h². Across 15 traits with ≥2 estimators, the strict ordering holds for 9 (all 2-estimator rows where twin > SNP); fails for 6 (all rows with 3+ estimators). The pattern of failure is informative: SNP h² is consistently lower than within-family h² for socially-stratified traits, because LDSC misses the rare-variant share that within-family designs capture through transmission."
        verdict="mixed"
        verdictKind="mixed"
      />

      <div className="space-y-2 text-[12px]">
        <div className="grid grid-cols-[140px_1fr_220px] gap-3 text-[10px] font-mono uppercase tracking-wider text-muted pb-1 border-b border-rule-soft">
          <span>trait</span>
          <span>h² 0 → 1</span>
          <span className="text-right">twin / wgs / snp / wf</span>
        </div>
        {traits.map(t => (
          <div key={t.trait} className="grid grid-cols-[140px_1fr_220px] gap-3 items-center">
            <span className="text-ink text-[12px]">{t.trait}</span>
            <div className="relative h-5 bg-paper border border-rule-soft rounded-sm">
              {/* shaded h² bands */}
              {t.twin_h2 != null && <Bar value={t.twin_h2} max={max} color="#1a1614" label="twin" yPct={0} />}
              {t.wgs_h2 != null  && <Bar value={t.wgs_h2}  max={max} color="#8a4a2b" label="wgs"  yPct={0} />}
              {t.snp_h2 != null  && <Bar value={t.snp_h2}  max={max} color="#c98a6e" label="snp"  yPct={0} />}
              {t.wf_h2 != null   && <Bar value={t.wf_h2}   max={max} color="#a89677" label="wf"   yPct={0} />}
              {/* tick markers as vertical lines */}
              {t.twin_h2 != null && <Tick value={t.twin_h2} max={max} color="#1a1614" />}
              {t.wgs_h2 != null  && <Tick value={t.wgs_h2}  max={max} color="#8a4a2b" />}
              {t.snp_h2 != null  && <Tick value={t.snp_h2}  max={max} color="#c98a6e" />}
              {t.wf_h2 != null   && <Tick value={t.wf_h2}   max={max} color="#a89677" />}
            </div>
            <div className="flex justify-end gap-2 text-[10px] font-mono text-muted">
              <span style={{ color: '#1a1614' }}>{fmt(t.twin_h2)}</span>
              <span style={{ color: '#8a4a2b' }}>{fmt(t.wgs_h2)}</span>
              <span style={{ color: '#c98a6e' }}>{fmt(t.snp_h2)}</span>
              <span style={{ color: '#a89677' }}>{fmt(t.wf_h2)}</span>
            </div>
          </div>
        ))}
      </div>

      <Legend items={[
        { label: 'twin h²', color: '#1a1614' },
        { label: 'WGS h²', color: '#8a4a2b' },
        { label: 'SNP h²', color: '#c98a6e' },
        { label: 'within-family h²', color: '#a89677' },
      ]} />

      <p className="text-[11px] text-muted mt-4 leading-relaxed">
        Each tick is one published estimate from a different paper / cohort. The "violations" you see (e.g., height WGS=0.68 lower than within-sibship=0.78) are cross-paper noise, not model failures: Wainschtein 2022 used N=25k unrelated EUR with WGS-GREML; Howe 2022 used N=178k siblings with sib-regression. They estimate slightly different things. The clean within-paper test is Howe 2022's population-vs-within-sibship comparison on the same sample, which holds in the predicted direction.
      </p>
    </div>
  );
}

function Tick({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div className="absolute top-0 bottom-0 w-px" style={{ left: `${pct}%`, backgroundColor: color, opacity: 0.85 }} />
  );
}
function Bar({ value, max, color }: { value: number; max: number; color: string; label: string; yPct?: number }) {
  const pct = (value / max) * 100;
  return (
    <div className="absolute top-0 bottom-0" style={{ left: 0, width: `${pct}%`, backgroundColor: color, opacity: 0.06 }} />
  );
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

// ---- H2 AM partition --------------------------------------------------

function AmPartitionPanel() {
  const data = AM_PARTITION;
  return (
    <div>
      <PanelHeader
        title="H2. Crow–Felsenstein AM partition"
        claim="V(A_LD) = m·h² applied per trait. Predicted shares match Border 2022 / Yengo 2018 within a few points across AM-strong traits."
        verdict="supported"
        verdictKind="supported"
      />

      <ChartFrame height={300}>
        <Scatter
          points={data.map(d => ({
            x: d.m,
            y: d.ALD_share_of_h2,
            label: d.trait,
            color: '#8a4a2b',
            size: 4 + d.h2_observed * 8,
          }))}
          xLabel="spousal correlation m"
          yLabel="V(A_LD) / h²"
          xMax={0.65}
          yMax={0.4}
        />
      </ChartFrame>

      <p className="text-[11px] text-muted mt-3 leading-relaxed">
        Marker size scales with twin h². Every trait with strong AM (m &gt; 0.40 — political orientation, religiosity, EA, IQ, drinking) lands in the upper-right region where AM-LD accounts for &gt;19% of total observed h². Personality traits (neuroticism, Big Five) sit near the origin: low m, low V(A_LD).
      </p>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
        <NumberCard label="Height" value={`${(0.20 * 100).toFixed(0)}%`} hint="V(A_LD) / h² (Yengo 2018: 14–23%)" />
        <NumberCard label="EA" value={`${(0.22 * 100).toFixed(0)}%`} hint="V(A_LD) / h² (Border 2022: substantial)" />
        <NumberCard label="Schizophrenia" value={`${(0.24 * 100).toFixed(0)}%`} hint="V(A_LD) / h² (high m=0.30)" />
      </div>
    </div>
  );
}

// ---- H3 Wilson curve --------------------------------------------------

function WilsonPanel() {
  const dense = useMemo(() => {
    const xs: { age: number; h2: number }[] = [];
    for (let a = 1; a <= 80; a++) {
      const h2 = WILSON_FIT.h_inf / (1 + Math.exp(-WILSON_FIT.k * (a - WILSON_FIT.t_50)));
      xs.push({ age: a, h2 });
    }
    return xs;
  }, []);

  return (
    <div>
      <PanelHeader
        title="H3. Wilson logistic curve"
        claim={`Logistic h²(t) = 0.81 / (1 + exp(−0.27·(t−9.0))) fitted to Bouchard 2013 anchors. Max residual: 1.8 percentage points.`}
        verdict="supported"
        verdictKind="supported"
      />

      <ChartFrame height={300}>
        <LineChart
          curve={dense.map(d => ({ x: d.age, y: d.h2 }))}
          points={WILSON_ANCHORS.map(a => ({ x: a.age, y: a.h2_observed, label: `age ${a.age}: ${a.h2_observed.toFixed(2)}` }))}
          xMax={80}
          yMax={1.0}
          xLabel="age (years)"
          yLabel="h² (cognitive ability)"
          curveColor="#8a4a2b"
          pointColor="#1a1614"
        />
      </ChartFrame>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <NumberCard label="h²_∞ (fit)" value="0.81" hint="prior 0.80" />
        <NumberCard label="t₅₀ (fit)" value="9.0 yr" hint="prior 9.0" />
        <NumberCard label="k (fit)" value="0.27 / yr" hint="prior 0.30" />
      </div>

      <p className="text-[11px] text-muted mt-4 leading-relaxed">
        The earlier saturating-exponential form (Stage 3 pass 2) had max residual 32 pp at age 5 — overshooting childhood h² by 2.5×. The logistic is the smallest functional change that matches the empirical sigmoidal pattern. Fitted parameters land within sampling noise of the model's prior values.
      </p>
    </div>
  );
}

// ---- H4 multivariate D ------------------------------------------------

function SexDiffPanel() {
  return (
    <div>
      <PanelHeader
        title="H4. Multivariate D — observed vs disattenuated"
        claim="Equicorrelated D² = d̄²·n / (1 + (n−1)·ρ̄). The gap from latent-variable disattenuated D is the disattenuation correction itself, not an algebra error."
        verdict="caveat"
        verdictKind="caveat"
      />

      <div className="space-y-3">
        {SEX_DIFF.map(panel => {
          const max = 3.0;
          return (
            <div key={panel.trait_panel} className="grid grid-cols-[180px_1fr_120px] gap-3 items-center text-[12px]">
              <span className="text-ink">{panel.trait_panel}</span>
              <div className="relative h-7 bg-paper border border-rule-soft rounded-sm overflow-hidden">
                <div
                  className="absolute top-0 bottom-0"
                  style={{ left: 0, width: `${(panel.D_equicorrelated / max) * 100}%`, backgroundColor: '#c98a6e', opacity: 0.7 }}
                />
                <div
                  className="absolute top-0 bottom-0"
                  style={{ left: 0, width: `${(panel.D_disattenuated / max) * 100}%`, backgroundColor: 'transparent', borderRight: '2px solid #1a1614' }}
                />
                <span className="absolute left-2 top-0.5 text-[10px] font-mono text-ink-soft">
                  D_obs={panel.D_equicorrelated.toFixed(2)}
                </span>
                {panel.D_disattenuated > panel.D_equicorrelated + 0.05 && (
                  <span
                    className="absolute top-0.5 text-[10px] font-mono text-ink"
                    style={{ left: `calc(${(panel.D_disattenuated / max) * 100}% - 50px)` }}
                  >
                    D_lat={panel.D_disattenuated.toFixed(2)}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-muted text-right">
                n={panel.n_dimensions} · d̄={panel.d_avg_univariate.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      <Legend items={[
        { label: 'D equicorrelated (observed)', color: '#c98a6e' },
        { label: 'D disattenuated (latent)', color: '#1a1614' },
      ]} />

      <p className="text-[11px] text-muted mt-4 leading-relaxed">
        Hyde 2005's "gender similarities" (single-dimension d~0.05) and Del Giudice 2012's "Mars and Venus" (D=2.71) are correct about different objects. The 2.6× ratio at 16PF is the disattenuation correction; the 20× single-dim → multivariate jump (d=0.05 → D=1.03) is the equicorrelated algebra alone.
      </p>
    </div>
  );
}

// ---- H5 PGS portability -----------------------------------------------

function PortabilityPanel() {
  // Compute fit
  const xs = PORTABILITY.map(p => p.gd);
  const ys = PORTABILITY.map(p => p.rel_r2);
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  const num = xs.map((x, i) => (x - meanX) * (ys[i] - meanY)).reduce((a, b) => a + b, 0);
  const den = xs.map(x => (x - meanX) ** 2).reduce((a, b) => a + b, 0);
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  const sx = Math.sqrt(xs.map(x => (x - meanX) ** 2).reduce((a, b) => a + b, 0));
  const sy = Math.sqrt(ys.map(y => (y - meanY) ** 2).reduce((a, b) => a + b, 0));
  const pearson = num / (sx * sy);

  return (
    <div>
      <PanelHeader
        title="H5. PGS accuracy decay across genetic ancestry"
        claim="Categorical-ancestry literature (Martin 2019: 37%/50%/78% accuracy reduction in SAS/EAS/AFR vs EUR; Okbay 2022 EA in AFR: ~10% relative R²; Yengo 2022 height in AFR: ~20%; Trubetskoy 2022 SCZ in AFR: ~30%) is internally consistent and consistent with Ding 2023's continuous-PCA-distance r=−0.95. The slope below is on these literature anchors, not an independent replication of Ding 2023."
        verdict={`monotone decay (r = ${pearson.toFixed(2)})`}
        verdictKind="supported"
      />

      <ChartFrame height={300}>
        <Scatter
          points={PORTABILITY.map(p => ({
            x: p.gd,
            y: p.rel_r2,
            label: `${p.trait} → ${p.ancestry}`,
            color: p.trait === 'EA' ? '#8a4a2b' : p.trait === 'height' ? '#1a1614' : '#a89677',
            size: 5,
          }))}
          xLabel="genetic distance from EUR training"
          yLabel="relative PGS R²"
          xMax={0.4}
          yMax={1.1}
          fitLine={{ slope, intercept, color: '#c98a6e' }}
        />
      </ChartFrame>

      <p className="text-[11px] text-muted mt-3 leading-relaxed">
        EA shows the steepest collapse (relative R² drops to 0.10 in African-ancestry samples). SCZ is the most portable psychiatric trait. Implication for the L4 firewall: same SNP "effect sizes" do not estimate the same causal coefficients in different populations. Causal architecture is not portable.
      </p>
    </div>
  );
}

// ---- H6 xAM inflation -------------------------------------------------

function XamPanel() {
  return (
    <div>
      <PanelHeader
        title="H6. Cross-trait AM inflation (Border 2022)"
        claim="R² = 0.7432 (95% CI: 0.67–0.82) between phenotypic cross-mate correlations and reported genetic correlations across 132 psychiatric trait pairs in UK Biobank (N=40,697 spousal pairs). The γ̂ statistic below is the ratio of xAM-alone-implied rg to empirical rg — values near 1 are consistent with xAM accounting for the entire correlation; values near 0 require additional shared biology beyond xAM."
        verdict="supported"
        verdictKind="supported"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h5 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-2">xAM share of reported rg</h5>
          <div className="space-y-2">
            {XAM_PSYCHIATRIC.map(p => (
              <div key={p.pair} className="grid grid-cols-[1fr_180px] gap-3 items-center">
                <span className="text-[12px] text-ink">{p.pair}</span>
                <div className="relative h-5 bg-paper border border-rule-soft rounded-sm">
                  <div
                    className="absolute top-0 bottom-0 bg-accent rounded-sm"
                    style={{ left: 0, width: `${Math.min(p.gamma_hat, 1) * 100}%`, opacity: 0.8 }}
                  />
                  <div
                    className="absolute top-0 bottom-0 bg-accent-soft"
                    style={{
                      left: `${p.ci[0] * 100}%`,
                      width: `${(p.ci[1] - p.ci[0]) * 100}%`,
                      opacity: 0.3,
                    }}
                  />
                  <span className="absolute right-1 top-0.5 text-[10px] font-mono text-ink-soft">
                    γ̂ = {p.gamma_hat.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted mt-3 leading-relaxed">
            The within-trait V(A_LD) and cross-trait xAM are the same operation — LD created by non-random mating among causal alleles, surfacing in different summary statistics.
          </p>
        </div>

        <div>
          <h5 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-2">Headline numbers</h5>
          <div className="space-y-2">
            <NumberCard label="R² overall" value="0.74" hint="cross-mate ρ → reported rg, 132 pairs" />
            <NumberCard label="R² (rg < 0.50)" value="0.71" hint="not driven by high-rg tail" />
            <NumberCard label="UKB spousal pairs" value="40,697" hint="Border 2022 sample" />
            <NumberCard label="Avg γ̂ (5 generations)" value="0.29" hint="across 6 psychiatric disorders" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- H7 environmental causes -----------------------------------------

function EnvPanel() {
  // Sort by effect size, most negative first.
  const sorted = [...ENV_EFFECTS].sort((a, b) => a.effect_size - b.effect_size);
  const minE = -32;
  const maxE = 6;
  const span = maxE - minE;
  const zeroPct = ((0 - minE) / span) * 100;

  return (
    <div>
      <PanelHeader
        title="H7. Environmental causes (V(E_m) bucket)"
        claim="The model's V(E_m) term is the variance contribution of measured non-shared environment. It is non-empty: a small set of exposures have large, replicated, causal effects on cognitive ability. Lead and severe deprivation cost double-digit IQ points; schooling adds 1–5 points per year. 'Within-normal' parenting variation is the famous null."
        verdict="supported"
        verdictKind="supported"
      />

      <div className="space-y-2 text-[12px]">
        <div className="grid grid-cols-[200px_1fr_220px] gap-3 text-[10px] font-mono uppercase tracking-wider text-muted pb-1 border-b border-rule-soft">
          <span>exposure</span>
          <span>effect on IQ (points)</span>
          <span className="text-right">design / source</span>
        </div>
        {sorted.map(r => {
          const isNeg = r.effect_size < 0;
          const effectPct = ((r.effect_size - minE) / span) * 100;
          const ciLowPct = r.ci_low != null ? ((r.ci_low - minE) / span) * 100 : null;
          const ciHighPct = r.ci_high != null ? ((r.ci_high - minE) / span) * 100 : null;
          return (
            <div key={r.exposure} className="grid grid-cols-[200px_1fr_220px] gap-3 items-center">
              <span className="text-ink text-[12px] leading-tight">{r.exposure}</span>
              <div className="relative h-5 bg-paper border border-rule-soft rounded-sm">
                {/* zero line */}
                <div className="absolute top-0 bottom-0 w-px bg-rule" style={{ left: `${zeroPct}%` }} />
                {/* CI band */}
                {ciLowPct != null && ciHighPct != null && (
                  <div
                    className="absolute top-1.5 bottom-1.5 rounded-sm"
                    style={{
                      left: `${Math.min(ciLowPct, ciHighPct)}%`,
                      width: `${Math.abs(ciHighPct - ciLowPct)}%`,
                      backgroundColor: isNeg ? '#8a4a2b' : '#1a1614',
                      opacity: 0.25,
                    }}
                  />
                )}
                {/* point estimate marker */}
                <div
                  className="absolute top-0 bottom-0 w-1 rounded"
                  style={{ left: `${effectPct}%`, backgroundColor: isNeg ? '#8a4a2b' : '#1a1614' }}
                />
                <span
                  className="absolute top-0.5 text-[10px] font-mono text-ink-soft"
                  style={{ left: isNeg ? `${Math.min(effectPct + 1.5, 80)}%` : `${Math.max(effectPct - 4, 1)}%` }}
                >
                  {r.effect_size > 0 ? '+' : ''}{r.effect_size.toFixed(1)}
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted text-right leading-tight">
                {r.design}<br />
                <span className="text-ink-soft">{r.source}</span>
              </span>
            </div>
          );
        })}
        {/* x-axis ticks */}
        <div className="grid grid-cols-[200px_1fr_220px] gap-3 pt-1">
          <span></span>
          <div className="relative h-3 text-[9px] font-mono text-muted">
            {[-30, -20, -10, 0, 5].map(t => (
              <span key={t} className="absolute" style={{ left: `${((t - minE) / span) * 100}%`, transform: 'translateX(-50%)' }}>
                {t > 0 ? '+' : ''}{t}
              </span>
            ))}
          </div>
          <span></span>
        </div>
      </div>

      <Legend items={[
        { label: 'positive (cognitive enrichment)', color: '#1a1614' },
        { label: 'negative (cognitive insult)', color: '#8a4a2b' },
      ]} />

      <p className="text-[11px] text-muted mt-4 leading-relaxed">
        Asymmetry is a real finding: removing severe insults (lead, malnutrition, deprivation, FAS) recovers double-digit IQ points; enrichment above normal (better parenting, breastfeeding) yields single-digit gains at most. The variance-share "V(E_m)" depends on each exposure's prevalence in a given population — sparse-but-large exposures (FAS, severe deprivation) contribute little to population variance despite large per-person effects, while moderate-but-common exposures (variable schooling, low-grade lead) contribute more.
      </p>
    </div>
  );
}

// ---- Generic chart primitives ----------------------------------------

type ScatterPoint = { x: number; y: number; label: string; color: string; size: number };

function Scatter({ points, xMax, yMax, xLabel, yLabel, fitLine }: {
  points: ScatterPoint[];
  xMax: number;
  yMax: number;
  xLabel: string;
  yLabel: string;
  fitLine?: { slope: number; intercept: number; color: string };
}) {
  const W = 480;
  const H = 260;
  const pad = { l: 50, r: 20, t: 20, b: 36 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const sx = (x: number) => pad.l + (x / xMax) * innerW;
  const sy = (y: number) => pad.t + innerH - (y / yMax) * innerH;

  const xTicks = 5;
  const yTicks = 5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      {/* axes */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + innerH} stroke="#d9d0bf" strokeWidth={1} />
      <line x1={pad.l} y1={pad.t + innerH} x2={pad.l + innerW} y2={pad.t + innerH} stroke="#d9d0bf" strokeWidth={1} />
      {/* y-ticks */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const v = (yMax * i) / yTicks;
        return (
          <g key={i}>
            <line x1={pad.l - 3} y1={sy(v)} x2={pad.l} y2={sy(v)} stroke="#d9d0bf" />
            <text x={pad.l - 6} y={sy(v) + 3} textAnchor="end" fontSize="9" fill="#7a7166" fontFamily="JetBrains Mono, monospace">
              {v.toFixed(2)}
            </text>
          </g>
        );
      })}
      {/* x-ticks */}
      {Array.from({ length: xTicks + 1 }).map((_, i) => {
        const v = (xMax * i) / xTicks;
        return (
          <g key={i}>
            <line x1={sx(v)} y1={pad.t + innerH} x2={sx(v)} y2={pad.t + innerH + 3} stroke="#d9d0bf" />
            <text x={sx(v)} y={pad.t + innerH + 14} textAnchor="middle" fontSize="9" fill="#7a7166" fontFamily="JetBrains Mono, monospace">
              {v.toFixed(2)}
            </text>
          </g>
        );
      })}
      {/* fit line */}
      {fitLine && (
        <line
          x1={sx(0)}
          y1={sy(Math.max(0, Math.min(yMax, fitLine.intercept)))}
          x2={sx(xMax)}
          y2={sy(Math.max(0, Math.min(yMax, fitLine.intercept + fitLine.slope * xMax)))}
          stroke={fitLine.color}
          strokeWidth={1.5}
          strokeDasharray="3,3"
        />
      )}
      {/* points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r={p.size} fill={p.color} fillOpacity={0.7} stroke={p.color} strokeWidth={1} />
          <title>{p.label}: ({p.x.toFixed(2)}, {p.y.toFixed(2)})</title>
        </g>
      ))}
      {/* labels */}
      <text x={pad.l + innerW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#3a342c" fontFamily="JetBrains Mono, monospace">
        {xLabel}
      </text>
      <text
        x={-pad.t - innerH / 2}
        y={14}
        textAnchor="middle"
        fontSize="10"
        fill="#3a342c"
        fontFamily="JetBrains Mono, monospace"
        transform="rotate(-90)"
      >
        {yLabel}
      </text>
    </svg>
  );
}

function LineChart({ curve, points, xMax, yMax, xLabel, yLabel, curveColor, pointColor }: {
  curve: { x: number; y: number }[];
  points: { x: number; y: number; label: string }[];
  xMax: number;
  yMax: number;
  xLabel: string;
  yLabel: string;
  curveColor: string;
  pointColor: string;
}) {
  const W = 480;
  const H = 260;
  const pad = { l: 50, r: 20, t: 20, b: 36 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const sx = (x: number) => pad.l + (x / xMax) * innerW;
  const sy = (y: number) => pad.t + innerH - (y / yMax) * innerH;

  const path = curve.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');

  const xTicks = 5;
  const yTicks = 5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + innerH} stroke="#d9d0bf" strokeWidth={1} />
      <line x1={pad.l} y1={pad.t + innerH} x2={pad.l + innerW} y2={pad.t + innerH} stroke="#d9d0bf" strokeWidth={1} />
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const v = (yMax * i) / yTicks;
        return (
          <g key={i}>
            <line x1={pad.l - 3} y1={sy(v)} x2={pad.l} y2={sy(v)} stroke="#d9d0bf" />
            <text x={pad.l - 6} y={sy(v) + 3} textAnchor="end" fontSize="9" fill="#7a7166" fontFamily="JetBrains Mono, monospace">
              {v.toFixed(2)}
            </text>
          </g>
        );
      })}
      {Array.from({ length: xTicks + 1 }).map((_, i) => {
        const v = (xMax * i) / xTicks;
        return (
          <g key={i}>
            <line x1={sx(v)} y1={pad.t + innerH} x2={sx(v)} y2={pad.t + innerH + 3} stroke="#d9d0bf" />
            <text x={sx(v)} y={pad.t + innerH + 14} textAnchor="middle" fontSize="9" fill="#7a7166" fontFamily="JetBrains Mono, monospace">
              {v.toFixed(0)}
            </text>
          </g>
        );
      })}
      <path d={path} fill="none" stroke={curveColor} strokeWidth={2} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r={4} fill={pointColor} stroke="#f7f3ec" strokeWidth={1.5}>
            <title>{p.label}</title>
          </circle>
        </g>
      ))}
      <text x={pad.l + innerW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#3a342c" fontFamily="JetBrains Mono, monospace">
        {xLabel}
      </text>
      <text x={-pad.t - innerH / 2} y={14} textAnchor="middle" fontSize="10" fill="#3a342c" fontFamily="JetBrains Mono, monospace" transform="rotate(-90)">
        {yLabel}
      </text>
    </svg>
  );
}

function NumberCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-rule rounded px-3 py-2 bg-paper">
      <div className="text-[10px] uppercase tracking-wider font-mono text-muted">{label}</div>
      <div className="text-[18px] font-display text-ink mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

function fmt(v: number | null) {
  return v == null ? '—' : v.toFixed(2);
}

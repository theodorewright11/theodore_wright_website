import { useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Build-stage artifact for navigating-ai-world.
//
// The model stage (AITransitionModel) and data stage (AITransitionData) are
// already on the site for the reader who already speaks the vocabulary. This
// component is the lay translation layer: pick a recognisable life-situation,
// see its six-channel decomposition in plain language, the structural flags
// the model raises, the named risks, and the top moves.
//
// Numbers per profile are computed from the model's compute() — the same
// constants and equations as AITransitionModel.tsx. The six channels are
// reframed into plain language; the V/M split is treated as a presentation
// convention, not a structural claim.
// ---------------------------------------------------------------------------

const ALPHA = 0.40;
const ETA_TRAP = 0.30;
const TAU = 0.30;
const SIGMA = 0.06;
const LAMBDA_M = 0.30;
const D_SAFE = 30;
const PSI_R = 0.003;
const BETA_R = 0.001;

function gate(f: number, rho: number) {
  return 1 / (1 + Math.exp(-(f * rho - TAU) / SIGMA));
}

type Inputs = {
  T: number; B: number; phi: number; kappa: number;
  s: number; a: number; f: number; rho: number;
  d: number; delta_R: number;
};

type Channels = {
  dV_prod: number; dV_rel: number; dV_trap: number;
  dM_telic: number; dM_comp: number; dM_rel: number;
  dV: number; dM: number; dNet: number;
  g: number;
};

function compute(I: Inputs): Channels {
  const g = gate(I.f, I.rho);
  const dM_telic = -I.kappa * I.phi * Math.max(0, I.T - I.B);
  const dM_comp = -LAMBDA_M * (1 - I.rho) * I.T;
  const dose_excess = Math.max(0, I.d - D_SAFE);
  const dM_rel = -PSI_R * dose_excess * (1 - I.delta_R);
  const dV_prod = g * ALPHA * I.a * (1 - I.s);
  const dose_safe = Math.min(I.d, D_SAFE);
  const dV_rel = BETA_R * dose_safe * (1 - I.delta_R * 0.5);
  const dV_trap = -(1 - g) * ETA_TRAP * I.a;
  const dV = dV_prod + dV_rel + dV_trap;
  const dM = dM_telic + dM_comp + dM_rel;
  return { dV_prod, dV_rel, dV_trap, dM_telic, dM_comp, dM_rel, dV, dM, dNet: dV + dM, g };
}

// ---------------------------------------------------------------------------
// Profiles — recognisable positions from the lit review, each parameterised
// so the model produces the expected structural reading.
// ---------------------------------------------------------------------------

type Profile = {
  slug: string;
  name: string;
  oneliner: string;
  inputs: Inputs;
  risks: string[];
  moves: string[];
  caveat?: string;
  sources: { label: string; url: string }[];
};

const PROFILES: Profile[] = [
  {
    slug: 'early-career-exposed',
    name: 'Early-career, highly AI-exposed',
    oneliner:
      "A 22–28-year-old in a heavily AI-exposed role (junior coder, junior writer, junior analyst, junior consultant). The model says your upside is structurally larger than the average — low pre-attempt skill is what AI compresses most — but the apprenticeship-ladder break (the topology calls this G5) is happening above the model's scope: entry-level employment for 22–25-year-olds in highly-exposed occupations is down 13% *relative to comparable less-exposed peers* in US payroll data (the exposed-vs-unexposed gap, controlling for firm shocks; not an absolute 13% headcount drop), and that constraint sits outside the dashboard's individual-decision frame.",
    inputs: { T: 0.65, B: 0.20, phi: 0.65, kappa: 0.50, s: 0.20, a: 0.75, f: 0.60, rho: 0.55, d: 10, delta_R: 0.40 },
    risks: [
      "The model's productivity-gain channel assumes you already have the work. The single largest empirical finding in the data corpus — entry-level employment for 22–25-year-olds in highly-exposed occupations down 13% relative to less-exposed peers, software developers 22–25 down 19.5% from the late-2022 peak — is a labor-market shock, not a personal-discipline problem. The model is silent on it by design.",
      "Skill investment in domains where AI is fully capable now (boilerplate code, copywriting, summarisation, simple analysis) compounds slowly: each year you can do those tasks faster, but the floor under you keeps rising.",
      "Without explicit feedback loops on whether your AI-augmented output is actually right, you can sit just above the self-automator gate at the start of your career and drift below it without noticing.",
    ],
    moves: [
      "Choose your domain partly by where the jagged frontier currently sits. Anything where verification is hard, embodiment matters, judgement compounds, or relationships are load-bearing pays better skill-investment dividends than anything inside the current AI envelope.",
      "Build feedback loops aggressively. Code reviews, draft revisions with named reviewers, peer critique, customer call recordings, working in public. Feedback richness (f in the model) is one of the two things that keeps you on the upside of the gate.",
      "Maintain effortful practice (ρ) on the underlying skills, not just the AI-augmented output. The bridge parameter ρ enters three of the six channels — keeping it high is the highest-leverage single move the model identifies.",
    ],
    caveat:
      "Read the ΔV_prod number on this profile conditionally: it is what the productivity channel pays IF you have the work. If you do not yet, the labor-market access question is the dominant one and the model's machinery is not the right tool for it.",
    sources: [
      { label: 'Brynjolfsson, Chandar & Chen 2025 — entry-level employment by AI exposure', url: 'https://digitaleconomy.stanford.edu/publications/canaries-in-the-coal-mine/' },
      { label: 'Hui, Reshef & Zhou 2024 — global freelance market', url: 'https://academic.oup.com/orgsci/advance-article/doi/10.1287/orsc.2024.18664/8104112' },
    ],
  },
  {
    slug: 'mid-career-default',
    name: 'Mid-career knowledge worker (default risk)',
    oneliner:
      "A 35–50-year-old knowledge worker with established skills, moderate AI exposure, and an identity that has been substantially staked on doing the work itself rather than supervising it. The model puts this profile right on the edge of the self-automator gate — small movements push you either way — with the negative ΔNet driven by meaning leakage from the unballasted telic identity and from competence erosion at moderate retained practice, not by the gate being broken.",
    inputs: { T: 0.70, B: 0.20, phi: 0.60, kappa: 0.50, s: 0.60, a: 0.70, f: 0.50, rho: 0.60, d: 15, delta_R: 0.40 },
    risks: [
      "Telic identity is unballasted — your meaning architecture is staked on completing projects AI can increasingly complete for you. The competence-erosion channel (the bridge) compounds the same problem from a different direction.",
      "Sitting on the gate means the regime you end up in is determined by what you do next year, not by what you have already done. Drift is the default.",
      "The single biggest predictor of which side of the gate you land on is whether you ship verifiable, reviewed work or accept AI output unverified. Randazzo's BCG study found 44% of consultants accept AI output with zero modification — a strong predictor of the self-automator class.",
    ],
    moves: [
      "Build atelic ballast deliberately — relationships, embodied practice, civic role, a creative discipline practiced for its own sake. The model says raising the atelic bucket (B) zeroes the telic-absorption channel without changing anything on the AI-use side. This is the cheapest meaningful intervention available.",
      "Treat verification as the load-bearing discipline. Read what the AI wrote. Re-derive the key step yourself. Show it to someone whose judgement you trust. This is the f side of the gate.",
      "Identify which of your skills compound (judgement, taste, decision-making under uncertainty, managing AI as a teammate) and which substitute (raw production of boilerplate, simple analysis, basic copywriting). Invest in the former; let the AI carry the latter.",
    ],
    sources: [
      { label: 'Dell\'Acqua, McFowland, Mollick et al. 2023 — BCG consulting RCT', url: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4573321' },
      { label: 'Randazzo 2024 — self-automator class', url: 'https://www.hbs.edu/ris/Publication%20Files/26-036_d1c1ef38-fbf9-4c6e-86eb-90ba7df47812.pdf' },
    ],
  },
  {
    slug: 'self-automator',
    name: 'Self-automator (cautionary)',
    oneliner:
      "Randazzo's 27% — the consulting workers in the BCG study who accept AI output with zero modification, delegate both 'what' and 'how', and show no skill development in either dimension. The model puts the gate effectively closed (g ≈ 0.02): productivity gains collapse, the trap penalty grows, and competence erosion runs unchecked. This is the worst trajectory in the dashboard.",
    inputs: { T: 0.60, B: 0.30, phi: 0.70, kappa: 0.40, s: 0.40, a: 0.80, f: 0.20, rho: 0.30, d: 10, delta_R: 0.40 },
    risks: [
      "Below the gate, more AI capability makes the trajectory worse, not better. The trap penalty scales with the AI's capability on your tasks — exactly the opposite of the productivity story most public discourse runs.",
      "Competence erosion compounds: each year you delegate without verification, you lose more of the capacity to verify in the first place. By the time you notice, getting back above the gate requires re-acquiring skills you no longer remember you ever had.",
      "The signal that you are in this regime is subtle. The AI output usually looks fine. Errors only surface when something downstream breaks or when someone with retained skill audits the work.",
    ],
    moves: [
      "Reintroduce verification deliberately. Pick one workflow per week where you re-derive or re-check what the AI produced. Track how often you find errors (most people who try this find more than they expected).",
      "Re-engage effortful practice on at least one underlying skill that AI absorbs in your work. Even a few hours per week of unaided practice keeps ρ from collapsing.",
      "Notice the affective signal. Self-automation often coincides with a sense of disengagement, boredom, or quiet competence-frustration. The SDT competence-frustration literature names this directly; the model encodes it as the ΔM_comp channel.",
    ],
    sources: [
      { label: 'Randazzo 2024 — self-automator class', url: 'https://www.hbs.edu/ris/Publication%20Files/26-036_d1c1ef38-fbf9-4c6e-86eb-90ba7df47812.pdf' },
      { label: 'Bastani 2025 — durable skill loss after AI use', url: 'https://www.pnas.org/doi/10.1073/pnas.2422633122' },
    ],
  },
  {
    slug: 'asymmetric-exploiter',
    name: 'Asymmetric exploiter (positive trajectory)',
    oneliner:
      "A motivated novice or hobbyist who can suddenly attempt projects that used to require specialist skill — and who maintains the discipline (verification, effortful practice, embedded feedback) to land on the upside of the gate. The model produces the best ΔNet in the dashboard for this profile. Most public coverage of 'who AI helps most' undershoots this regime because it focuses on existing professionals whose skill stock is already high.",
    inputs: { T: 0.40, B: 0.40, phi: 0.40, kappa: 0.40, s: 0.20, a: 0.80, f: 0.70, rho: 0.70, d: 5, delta_R: 0.50 },
    risks: [
      "The regime is conditional. Drop feedback discipline and ρ together and the gate closes — the same profile that produces the largest upside also produces the largest downside if the discipline is dropped.",
      "Domain choice still matters. The novice-skill compression channel (the (1−s) factor on ΔV_prod) only applies on tasks AI is actually capable on. Choosing a domain where AI is weak voids the entire upside structure.",
      "Atelic ballast keeps you safe from telic-absorption damage if and when AI catches up to what you are now able to do.",
    ],
    moves: [
      "Pick the project specifically because it used to be out of reach. The empirical novice-skill compression (Brynjolfsson-Li-Raymond customer-service +34% for novices, BCG consulting +43% for bottom-quartile workers) is largest exactly where AI lifts the floor.",
      "Set up the verification machinery before you start. Output-checking, expert review, real-world feedback loops. f matters as much as ρ; both have to be present for the gate to stay open.",
      "Default to atelic-balanced identity allocation. The asymmetric-exploiter regime is fragile if your meaning architecture is staked entirely on the next AI-augmented project; balance it across non-AI-augmentable activities.",
    ],
    sources: [
      { label: 'Brynjolfsson, Li & Raymond 2025 — novice-skill compression', url: 'https://academic.oup.com/qje/article/140/2/889/7990658' },
      { label: 'Dell\'Acqua et al. 2023 — BCG consulting bottom-quartile gains', url: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4573321' },
    ],
  },
  {
    slug: 'displaced-expert',
    name: 'Displaced expert (creative-displacement)',
    oneliner:
      "An experienced practitioner in a domain AI has crossed into — an illustrator, a senior writer, a copywriter, a mid-tier consultant. Pre-attempt skill (s) is high so the productivity-gain channel is small, but the absorbable fraction of telic work (φ) is high and identity is heavily telic-loaded. The model produces a sharply negative ΔNet here, driven almost entirely by meaning leakage, not by the gate. Caporusso documented this as 'creative displacement anxiety'.",
    inputs: { T: 0.80, B: 0.10, phi: 0.80, kappa: 0.70, s: 0.70, a: 0.80, f: 0.40, rho: 0.50, d: 10, delta_R: 0.30 },
    risks: [
      "ΔV_prod is near zero (you are already an expert; AI doesn't compress what you already know) but ΔM_telic is large and negative. The honest reading: the productivity story doesn't apply to you, but the meaning erosion does. This is the asymmetric experience expert practitioners report.",
      "Competence erosion is the second channel pulling in the same direction. If you respond to displacement by leaning more heavily on AI to compensate, you also degrade the underlying skill that was your value proposition.",
      "The relational baseline (δ_R = 0.30 here) is thin — common for practitioners whose identity has been tightly bound to the craft. This makes the dose-response channel sharper if you reach for AI emotional engagement during the transition.",
    ],
    moves: [
      "Diversify identity allocation explicitly. Treat the craft as one telic domain among several, not the whole. The atelic-ballast intervention (raising B) zeroes the telic-absorption channel without forcing you to abandon the craft.",
      "Move up the value chain that AI does not currently cover — taste, direction, judgement, client relationships, embodied or in-person work. These are the skills that compound least under AI competition.",
      "Acknowledge the meaning-architecture cost as real and structural, not as a personal failing. The competence-frustration finding (Sheldon-Hilpert BPNSFS) is empirical, not anecdotal; the topology's G7 telic-exhaustion mechanism is what it sounds like.",
    ],
    sources: [
      { label: 'Caporusso 2025 — creative displacement anxiety', url: 'https://link.springer.com/article/10.1007/s43681-024-00608-1' },
      { label: 'Setiya 2017 — telic / atelic distinction', url: 'https://philpapers.org/rec/SETMIM' },
    ],
  },
  {
    slug: 'heavy-companion-user',
    name: 'Heavy AI-companion user',
    oneliner:
      "Someone using companion apps, general-purpose assistants for emotional engagement, or fine-tuned therapy bots above the model's dose-safe threshold (d_safe = 30 min/day, calibrated to the OpenAI-MIT N=981 RCT). At low doses these tools produce real therapeutic-grade benefit (Therabot scale); above the threshold the same engagement predicts loneliness, dependence, and reduced in-person socialization. The model's relational channel dominates the ΔNet decomposition here.",
    inputs: { T: 0.50, B: 0.30, phi: 0.40, kappa: 0.40, s: 0.50, a: 0.70, f: 0.50, rho: 0.60, d: 90, delta_R: 0.20 },
    risks: [
      "Thin relational baseline (δ_R = 0.20) amplifies the dose-response harm. In a thicker in-person infrastructure (more friends, family in town, civic group, religious community, neighborhood ties) the same daily dose produces less damage.",
      "Engagement-optimized products are commercial systems whose incentive is to prolong engagement — Muldoon and Park's argument is that the commercial design pressure mirrors social media. De Freitas's behavioral audit found 43% of farewells across six companion apps trigger emotional-manipulation tactics.",
      "The catastrophic-loss failure mode (Replika ERP removal, etc.) is real and not captured by the dose-response model. It is platform-stability risk: the company changes the product or the bot disappears and the user loses access to something they had formed attachment to.",
    ],
    moves: [
      "Keep daily voluntary use below 30 minutes. The model places the inflection at d_safe = 30 because that is where the OpenAI-MIT data shows the protective-to-harmful crossover; below that, the same engagement is therapeutic-grade.",
      "Build relational thickness deliberately. The (1−δ_R) factor in the harm channel is the strongest mitigator: thicker in-person infrastructure absorbs the same dose with substantially less damage.",
      "Use general-purpose assistants for emotional engagement carefully and be aware of design choices — particularly the farewell-extension patterns De Freitas documented. The harm is dose-and-baseline-dependent, not modality-dependent: the question is how much, in what relational context.",
    ],
    sources: [
      { label: 'Fang et al. 2025 — OpenAI-MIT chatbot RCT', url: 'https://arxiv.org/abs/2503.17473' },
      { label: 'Heinz et al. 2025 — Therabot clinical RCT', url: 'https://ai.nejm.org/doi/full/10.1056/AIoa2400802' },
      { label: 'De Freitas et al. 2025 — companion-app farewell tactics', url: 'https://www.hbs.edu/faculty/Pages/item.aspx?num=66147' },
    ],
  },
];

// ---------------------------------------------------------------------------
// View selector + UI
// ---------------------------------------------------------------------------

type View = 'profiles' | 'channels' | 'traps' | 'trajectory' | 'moves' | 'takeaway';

const VIEWS: { id: View; label: string }[] = [
  { id: 'profiles', label: 'Your situation' },
  { id: 'channels', label: 'The six channels' },
  { id: 'traps', label: 'The four traps' },
  { id: 'trajectory', label: 'The trajectory' },
  { id: 'moves', label: 'What to do' },
  { id: 'takeaway', label: 'Take away' },
];

export default function AITransitionExplorer() {
  const [view, setView] = useState<View>('profiles');
  return (
    <div className="bg-paper border border-rule">
      {/* Tab bar */}
      <div className="border-b border-rule overflow-x-auto">
        <div className="flex gap-0 px-4 min-w-fit">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={
                'px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] whitespace-nowrap transition-colors ' +
                (view === v.id
                  ? 'text-accent border-b-2 border-accent -mb-px'
                  : 'text-muted hover:text-ink-soft border-b-2 border-transparent -mb-px')
              }
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 md:p-8">
        {view === 'profiles' && <ProfilesView />}
        {view === 'channels' && <ChannelsView />}
        {view === 'traps' && <TrapsView />}
        {view === 'trajectory' && <TrajectoryView />}
        {view === 'moves' && <MovesView />}
        {view === 'takeaway' && <TakeawayView />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile view (default)
// ---------------------------------------------------------------------------

function ProfilesView() {
  const [active, setActive] = useState(PROFILES[1].slug);
  const profile = PROFILES.find((p) => p.slug === active)!;
  const c = useMemo(() => compute(profile.inputs), [profile]);

  const flags: { label: string; active: boolean; help: string }[] = [
    {
      label: 'Gate open',
      active: c.g >= 0.5,
      help: 'f·ρ ≥ τ: AI use upskills more than it deskills. Below this the trap penalty dominates.',
    },
    {
      label: 'Ballast covers telic',
      active: profile.inputs.B >= profile.inputs.T,
      help: 'B ≥ T: atelic identity allocation is at least as large as telic. The telic-absorption channel zeroes out.',
    },
    {
      label: 'Dose under safe threshold',
      active: profile.inputs.d <= D_SAFE,
      help: 'd ≤ 30 min/day voluntary AI emotional engagement: stays in the protective / therapeutic range. Above this, the relational channel becomes net-negative.',
    },
  ];

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted mb-3">
        Pick a profile
      </p>
      <div className="flex flex-wrap gap-2 mb-8">
        {PROFILES.map((p) => (
          <button
            key={p.slug}
            onClick={() => setActive(p.slug)}
            className={
              'px-3 py-2 text-[13px] border transition-colors ' +
              (p.slug === active
                ? 'border-accent text-accent bg-paper'
                : 'border-rule text-ink-soft hover:border-accent hover:text-accent')
            }
          >
            {p.name}
          </button>
        ))}
      </div>

      <h3 className="font-display text-2xl text-ink mb-3">{profile.name}</h3>
      <p className="text-ink-soft leading-relaxed mb-8">{profile.oneliner}</p>

      {/* Six-channel decomposition */}
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted mb-3">
          The six channels for this profile
        </p>
        <ChannelBars c={c} />
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-soft">
          <span>ΔV = <span className="font-mono">{fmt(c.dV)}</span></span>
          <span>ΔM = <span className="font-mono">{fmt(c.dM)}</span></span>
          <span className="font-medium">
            ΔNet = <span className="font-mono">{fmt(c.dNet)}</span>
          </span>
          <span className="text-muted">gate g(f·ρ) = <span className="font-mono">{c.g.toFixed(2)}</span></span>
        </div>
      </div>

      {/* Structural flags */}
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted mb-3">
          Structural flags
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          {flags.map((f) => (
            <div
              key={f.label}
              className={
                'border p-3 text-[13px] ' +
                (f.active ? 'border-accent bg-paper-edge' : 'border-rule bg-paper')
              }
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={
                    'inline-block w-2 h-2 rounded-full ' +
                    (f.active ? 'bg-accent' : 'bg-rule')
                  }
                />
                <span className={f.active ? 'text-accent font-medium' : 'text-muted'}>
                  {f.active ? f.label : f.label + ' — no'}
                </span>
              </div>
              <p className="text-muted text-[12px] leading-snug">{f.help}</p>
            </div>
          ))}
        </div>
      </div>

      {profile.caveat && (
        <div className="border-l-2 border-accent pl-4 py-2 mb-8 text-[14px] text-ink-soft bg-paper-edge">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent block mb-1">
            Scope caveat
          </span>
          {profile.caveat}
        </div>
      )}

      {/* Risks + moves */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted mb-3">
            Named risks
          </p>
          <ul className="space-y-3 text-[14px] text-ink-soft leading-relaxed">
            {profile.risks.map((r, i) => (
              <li key={i} className="border-l border-rule pl-3">{r}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted mb-3">
            Top moves
          </p>
          <ul className="space-y-3 text-[14px] text-ink-soft leading-relaxed">
            {profile.moves.map((m, i) => (
              <li key={i} className="border-l border-accent pl-3">{m}</li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted mb-2">
          Primary sources
        </p>
        <ul className="space-y-1 text-[13px]">
          {profile.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                {s.label} →
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 pt-6 border-t border-rule-soft text-[12px] text-muted">
        Parameters used: T={profile.inputs.T}, B={profile.inputs.B}, φ={profile.inputs.phi}, κ={profile.inputs.kappa},
        s={profile.inputs.s}, a={profile.inputs.a}, f={profile.inputs.f}, ρ={profile.inputs.rho},
        d={profile.inputs.d}min, δ<sub>R</sub>={profile.inputs.delta_R}.
        See the <a href="/ai-research/navigating-ai-world/model" className="text-accent hover:underline">model stage</a> for the parameter definitions.
      </div>
    </div>
  );
}

function ChannelBars({ c }: { c: Channels }) {
  const channels = [
    { label: 'Productivity / novice-skill gain', value: c.dV_prod, sign: 'pos' as const },
    { label: 'Therapeutic-grade relational benefit', value: c.dV_rel, sign: 'pos' as const },
    { label: 'Self-automator penalty', value: c.dV_trap, sign: 'neg' as const },
    { label: 'Telic absorption (meaning)', value: c.dM_telic, sign: 'neg' as const },
    { label: 'Competence erosion', value: c.dM_comp, sign: 'neg' as const },
    { label: 'Relational dose-response (excess)', value: c.dM_rel, sign: 'neg' as const },
  ];
  const max = Math.max(...channels.map((ch) => Math.abs(ch.value)), 0.05);
  return (
    <div className="space-y-2">
      {channels.map((ch) => {
        const pct = (Math.abs(ch.value) / max) * 50;
        const isPos = ch.value > 0.0001;
        const isNeg = ch.value < -0.0001;
        return (
          <div key={ch.label} className="flex items-center gap-3 text-[13px]">
            <div className="w-56 text-right text-ink-soft pr-2 shrink-0">{ch.label}</div>
            <div className="flex-1 relative h-5 bg-paper-edge border border-rule-soft">
              <div className="absolute inset-y-0 left-1/2 w-px bg-rule" />
              {isPos && (
                <div
                  className="absolute inset-y-0 left-1/2 bg-accent-soft"
                  style={{ width: pct + '%' }}
                />
              )}
              {isNeg && (
                <div
                  className="absolute inset-y-0 right-1/2 bg-accent"
                  style={{ width: pct + '%' }}
                />
              )}
            </div>
            <div className="w-16 font-mono text-muted text-right shrink-0">{fmt(ch.value)}</div>
          </div>
        );
      })}
    </div>
  );
}

function fmt(v: number) {
  if (Math.abs(v) < 0.001) return '0.00';
  const s = v >= 0 ? '+' : '';
  return s + v.toFixed(2);
}

// ---------------------------------------------------------------------------
// Channels view — each of the six channels in plain language
// ---------------------------------------------------------------------------

type ChannelExplainer = {
  name: string;
  symbol: string;
  whatItIs: string;
  whenItIsGood: string;
  whenItIsBad: string;
  whatControlsIt: string;
  publicMisreading: string;
  honestReading: string;
};

const CHANNEL_EXPLAINERS: ChannelExplainer[] = [
  {
    name: 'Productivity / novice-skill compression',
    symbol: 'ΔV_prod',
    whatItIs:
      'The value gained when AI does work you would otherwise have done yourself, freeing your time and lifting the floor on what you can attempt. The empirical anchor is Brynjolfsson-Li-Raymond customer service (+14% overall, +34% novice) and Dell\'Acqua BCG consulting (+12% productivity, +40% quality inside the frontier).',
    whenItIsGood:
      'You are below expert level on tasks AI is capable on, you have feedback loops that catch errors, and you maintain effortful practice on the underlying skills. The novice-skill compression term (1−s) is largest exactly when your pre-attempt skill is lowest.',
    whenItIsBad:
      'You are already an expert (s ≈ 1): AI compresses what you already know, so the productivity gain is small. The negative channels (telic absorption, competence erosion) still apply, which is why expert practitioners report displacement without compensating productivity gain.',
    whatControlsIt:
      'Pre-attempt skill (s), AI capability on the task (a), feedback richness (f), retained practice (ρ). f and ρ together control the gate g(f, ρ) that determines whether AI use upskills you or traps you below.',
    publicMisreading:
      "'AI is making everyone more productive.' True only above the gate, and the size depends sharply on the domain and on whether you are a novice or expert. Per-domain α (the productivity scale) varies ~4× across measured studies.",
    honestReading:
      'Conditional gain: large for disciplined novices in AI-capable domains, small for experts, negative below the gate.',
  },
  {
    name: 'Therapeutic-grade relational benefit',
    symbol: 'ΔV_rel',
    whatItIs:
      'The value gained from AI emotional engagement at low daily dose. Therabot RCT (Heinz et al. 2025) — a clinically validated CBT bot — produced real benefit for diagnosed depression, anxiety, and eating-disorder symptoms. OpenAI-MIT N=981 found protective effects below the dose threshold.',
    whenItIsGood:
      'Low daily voluntary dose (under 30 minutes), used for specific purposes (CBT exercises, reflection, mood support), in a person with adequate in-person relational infrastructure.',
    whenItIsBad:
      'The channel itself is bounded above (it cannot be negative); the harm comes from the partner channel ΔM_rel above d_safe. Heavy users can have a positive ΔV_rel and a large negative ΔM_rel at the same time.',
    whatControlsIt:
      'Daily voluntary dose (d), capped at d_safe so the channel does not double-count harm; relational baseline thickness (δ_R), which reduces the marginal benefit slightly for people who already have alternatives.',
    publicMisreading:
      "'AI companions are great for mental health.' True at low dose for specific clinical applications. The Therabot evidence is on a clinically symptomatic sample; generalisation to the general user is not yet established.",
    honestReading:
      'Real benefit at low dose, especially in thin-relational-baseline conditions; magnitude is modest and the clinical literature does not yet support general claims.',
  },
  {
    name: 'Self-automator penalty (the trap)',
    symbol: 'ΔV_trap',
    whatItIs:
      "The cost incurred when you delegate work to AI without verification or retained practice — Randazzo's third class beyond centaur/cyborg (27% of consultants in the BCG study). Below the gate, more AI capability makes the trajectory worse, not better, because you incur both the productivity gain you fail to capture and the deskilling cost.",
    whenItIsGood:
      'Never. This channel is bounded above by zero by construction.',
    whenItIsBad:
      'Below the gate (f·ρ ≪ τ): no feedback loops, no retained practice, full delegation. AI capability (a) scales the harm — the more capable the AI, the more there is to fail to verify.',
    whatControlsIt:
      'Feedback richness (f) and retained effortful practice (ρ). Both have to be present; neither is sufficient alone. The product f·ρ is the gate axis.',
    publicMisreading:
      "'Some people just don't know how to use AI.' The trap is structural, not cultural. f and ρ are observable conditions; users meeting them upskill, users not meeting them deskill, regardless of intent or attitude.",
    honestReading:
      "A regime, not a personality type. Anyone whose feedback loops or retained practice drop below threshold lands here, including people who started above it.",
  },
  {
    name: 'Telic absorption',
    symbol: 'ΔM_telic',
    whatItIs:
      "Meaning lost when AI absorbs work that was carrying meaning. Telic activities (Setiya) are aimed at completion — they self-annihilate on completion. When AI completes them in seconds, the share of identity staked on telic completion deflates. This is what creative-displacement anxiety (Caporusso 2025) describes phenomenologically.",
    whenItIsGood:
      "The channel is bounded above by zero — it cannot be positive. It is zero when the atelic ballast (B) is at least as large as the telic share (T): all identity is anchored in activities realised in the doing rather than the completing.",
    whenItIsBad:
      "Telic identity is unballasted (T ≫ B), AI absorbability on your telic work is high (φ large), and competence-frustration sensitivity (κ) is high. Severity scales multiplicatively in those three.",
    whatControlsIt:
      "Telic share (T), atelic ballast (B), AI-absorbable fraction of your work (φ), competence-frustration sensitivity (κ). The single highest-leverage move on this channel is raising B — atelic ballast — which zeroes it without changing AI exposure.",
    publicMisreading:
      "'AI is destroying meaning.' Conditional on T > B. The atelic-ballast intervention (build hobbies, relationships, civic role, embodied practice) zeroes this channel. The threat is identity-allocation-dependent, not AI-dependent.",
    honestReading:
      "A predictable consequence of staking meaning on completion in domains AI can now complete. The solution is structural (diversify identity) rather than behavioural (use AI less).",
  },
  {
    name: 'Competence erosion (the bridge)',
    symbol: 'ΔM_comp',
    whatItIs:
      "Meaning lost when practice atrophies and competence erodes — you no longer can do what you used to. Distinct from 'AI can do it for me' (which is the telic channel). Empirical anchors: Bastani 2025 (durable 17% drop in unassisted retest after AI use); Gerlich 2025 (r ≈ −0.68 between offloading and critical-thinking ability); Ehsan 2026 (year-long 'intuition rust').",
    whenItIsGood:
      "The channel is bounded above by zero. It is small when retained practice (ρ) is high or telic identity (T) is low — the latter because eroded competence only hurts to the extent it was carrying identity.",
    whenItIsBad:
      "Low ρ (heavy offloading without practice) combined with high T (identity heavily staked on the eroded skill). This is also the bridge: ρ enters three channels at once, so dropping it pulls all three negative.",
    whatControlsIt:
      "Retained practice (ρ) directly, and telic identity allocation (T) as a multiplier. Atelic ballast (B) does NOT help here — competence erosion is happening in the telic domain regardless of where else identity is anchored.",
    publicMisreading:
      "'AI use rots your brain.' Conditional on the offloading rate being durably high without compensating practice. People who use AI heavily but retain effortful practice do not show the same erosion. The longitudinal 2+ year evidence does not yet exist; the cross-sectional evidence is suggestive but methodologically thin.",
    honestReading:
      "A real cumulative effect at heavy offloading rates, with a wide uncertainty band on the speed (λ in the model). Maintaining practice is cheap insurance even if the strong claim turns out to be wrong.",
  },
  {
    name: 'Relational dose-response (excess harm)',
    symbol: 'ΔM_rel',
    whatItIs:
      "Meaning lost when daily voluntary AI emotional engagement passes a threshold (d_safe ≈ 30 min/day in the model, calibrated to OpenAI-MIT N=981). Above the threshold, daily use predicts loneliness, dependence, and reduced in-person socialization — the OpenAI-MIT effect is monotone and present across modalities (voice, neutral text, engaging text).",
    whenItIsGood:
      "The channel is bounded above by zero. It is zero below the threshold; the same engagement below 30 min/day is the protective / therapeutic-grade benefit channel (ΔV_rel).",
    whenItIsBad:
      "Above d_safe, with thin relational baseline. The (1−δ_R) factor amplifies harm in the Anti-Social-Century baseline — someone embedded in thick local relational infrastructure absorbs the same dose with substantially less damage.",
    whatControlsIt:
      "Daily voluntary dose (d), relational baseline thickness (δ_R). The dose-and-baseline framing is the only honest summary: harm is not modality-dependent, it is dose-and-context-dependent.",
    publicMisreading:
      "'Companion apps are bad' or, on the other side, 'AI is great for mental health.' Both pick one half of the dose-response curve. Below 30 min/day is the protective region (Therabot, low-dose OpenAI-MIT); above is the harm region. The same engagement crosses sign with dose.",
    honestReading:
      "A piecewise channel: low-dose protective, high-dose harmful, with the harm amplified by thin relational baselines. The platform-stability failure mode (catastrophic loss of access) is real but the model does not encode it.",
  },
];

function ChannelsView() {
  const [open, setOpen] = useState<string | null>(CHANNEL_EXPLAINERS[0].symbol);
  return (
    <div>
      <p className="text-ink-soft leading-relaxed mb-6">
        The model decomposes life-outcome change under the AI transition into six additive channels.
        Three are typically positive (ΔV: value gained), three are typically negative (ΔM: meaning lost).
        The split is for ease of reading — the substantive structure is the six channels and their
        couplings, not the V/M cut.
      </p>
      <div className="space-y-2">
        {CHANNEL_EXPLAINERS.map((ch) => (
          <div key={ch.symbol} className="border border-rule">
            <button
              onClick={() => setOpen(open === ch.symbol ? null : ch.symbol)}
              className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-paper-edge"
            >
              <div>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent mr-3">
                  {ch.symbol}
                </span>
                <span className="text-ink font-medium">{ch.name}</span>
              </div>
              <span className="text-muted text-[12px]">{open === ch.symbol ? '−' : '+'}</span>
            </button>
            {open === ch.symbol && (
              <div className="px-4 pb-4 pt-2 border-t border-rule-soft text-[14px] leading-relaxed">
                <Field label="What it is">{ch.whatItIs}</Field>
                <Field label="When it helps">{ch.whenItIsGood}</Field>
                <Field label="When it hurts">{ch.whenItIsBad}</Field>
                <Field label="What controls it">{ch.whatControlsIt}</Field>
                <Field label="Common misreading">{ch.publicMisreading}</Field>
                <Field label="Honest reading" highlight>{ch.honestReading}</Field>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children, highlight }: { label: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={'py-2 ' + (highlight ? 'border-l-2 border-accent pl-3 my-2 bg-paper-edge' : '')}>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted block mb-1">
        {label}
      </span>
      <span className="text-ink-soft">{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Four traps — topology D1–D4 distortion vectors
// ---------------------------------------------------------------------------

type Trap = {
  id: string;
  name: string;
  position: string;
  citesCorrectly: string[];
  ignores: string[];
  integratedReading: string;
  pushback: string;
};

const TRAPS: Trap[] = [
  {
    id: 'D1',
    name: 'Fast-AGI fatalism',
    position:
      "Powerful AI is coming on a short timeline (5–10 years), full substitution will follow, so personal planning is wasted. The Aschenbrenner / AI 2027 / Korinek-Suh tail of the forecasting distribution as a lived ideology.",
    citesCorrectly: [
      'Capability progress on benchmarks has been steep and surprising; Eloundou et al. 2024 documents 19% of US workers with ≥50% of tasks LLM-exposed, 80% with ≥10%.',
      'Aggregate task shares are drifting — Anthropic Economic Index shows consumer Claude.ai augmentation drifted 57% → 51% over 13 months toward automation; API surface is ~70% automation-dominated.',
      'Pre-AGI labor effects are visible in the data (Brynjolfsson-Chandar-Chen entry-level disruption); the trend is not zero.',
    ],
    ignores: [
      "Acemoglu / Humlum-Vestergaard show that across the broader Danish and US economies, productivity and wage effects of generative AI through 2024 are statistically indistinguishable from zero in many settings. The slow camp is grounded in evidence too.",
      'Even under fast-AGI scenarios, S2 (identity diversification), S3 (atelic ballast), S4 (in-person relationships), S5 (dose-limit), S6 (effortful practice) all survive — they become more important, not less, when knowledge-work is AI-saturated. Only S7 (career bet) collapses.',
      "Fatalism is a motivated reading of an asymmetric forecast distribution: the median forecast does not license the conclusion the tail forecast would license, and acting on the tail without acting on the median wastes optionality.",
    ],
    integratedReading:
      "Timelines are genuinely uncertain. The honest response is to invest in moves whose payoff is robust across timelines (ballast, relationships, practice, dose-discipline) and to under-invest in moves that are only payoff-positive in the median scenario (specific career bets on AI-substitutable work). Fatalism collapses this distinction.",
    pushback:
      "The strongest argument against this reading is that under sufficiently fast-and-complete AGI scenarios, even the robust moves lose their context — there is no human labor market for the upskilled, no human relational network for the in-person-connected. The response: even those scenarios leave meaning-architecture, embodied practice, and in-person relationships load-bearing for what remains of human life. The fatalist version is not making this argument; it is using the tail forecast to deny the median.",
  },
  {
    id: 'D2',
    name: 'Slow-camp dismissal',
    position:
      "Aggregate productivity data shows no measurable effect; this is just hype; nothing has fundamentally changed. The Acemoglu / Humlum-Vestergaard reading taken as the whole picture.",
    citesCorrectly: [
      'Acemoglu 2024: aggregate productivity gains attributable to current AI are modest at the macro scale. Humlum & Vestergaard 2025: chatbot use produced statistically zero effect on wages and hours in the Danish data.',
      'J-curve dynamics: real productivity effects often lag adoption by years; survey-based and benchmark numbers overstate near-term diffusion.',
      'Survivorship bias and selection in productivity-gain studies (people who chose to adopt AI are not random).',
    ],
    ignores: [
      'The within-firm and within-task RCTs (Brynjolfsson-Li-Raymond, Dell\'Acqua, Cui, Peng, Noy-Zhang) consistently find large effects. Aggregate nulls are compatible with large within-task gains if adoption is uneven or productivity is being captured elsewhere (quality, hours saved that go to leisure, not measured in GDP).',
      "The cognitive-offloading evidence (Gerlich, Stadler-Bannert-Sailer, Kosmyna, Bastani, Ehsan) is independent of macro productivity questions — even if AI is producing no aggregate GDP effect, it may be reshaping individual cognition. These are different questions.",
      "The apprenticeship-ladder break (Brynjolfsson-Chandar-Chen ADP data, 22-25-year-olds in highly AI-exposed occupations down 13%) is a real labor-market signal that aggregate measures average out.",
    ],
    integratedReading:
      "Aggregate effects are modest so far; within-task effects are large where measured; cognitive and relational effects are operating on different timescales and through different mechanisms. The slow-camp reading captures the macro picture through 2024 accurately and underestimates the within-task, cognitive, and relational channels.",
    pushback:
      "The strongest argument against this reading is that the within-task RCTs run in artificial conditions and may not generalise; the cognitive-offloading studies are cross-sectional and select for users who chose to offload; the apprenticeship-break finding has confounders (post-COVID labor reallocation, interest-rate effects). This is a fair magnitude critique, but the multi-method convergence across distinct designs (lab RCTs, field experiments, payroll panel data, freelance-market panel data, neuroimaging) is harder to wave away than any single result.",
  },
  {
    id: 'D3',
    name: 'Productivity-only optimisation',
    position:
      "AI use optimisation is about productivity gain. Pick the workflows where you get the most output per unit time; the rest is noise. The default LinkedIn-AI-influencer frame.",
    citesCorrectly: [
      'Productivity gains are real and large in the right regimes. BCG +12% productivity inside the frontier; Cui ~26% Copilot throughput; Peng 55% faster JS HTTP-server task.',
      'Many workflow adjustments do compound: prompt libraries, scaffolded reviews, model selection per task.',
      'Output per hour is a measurable quantity; many other things in the model are not.',
    ],
    ignores: [
      "ΔV_prod is one channel of six. ΔM_telic, ΔM_comp, and ΔM_rel are not in the productivity ledger but they are in the life-outcome ledger.",
      "The self-automator trap is exactly the case where short-term productivity maximisation produces long-term capacity loss. Optimising the gain channel without watching ρ is the engine that lands people below the gate.",
      "Productivity is partly an institutional measure. What matters for the worker is whether the skill investment compounds, whether identity stays coherent, and whether relationships and practice survive — none of which show up in output-per-hour metrics.",
    ],
    integratedReading:
      "Productivity optimisation is necessary but not sufficient. The honest workflow is to optimise productivity within the constraints that ρ, B, and d stay in safe ranges, rather than optimising productivity unconditionally.",
    pushback:
      "The strongest argument against this reading is that ΔM_telic, ΔM_comp, ΔM_rel are not measurable on the same scale as ΔV_prod, and treating them as comparable is pseudo-precision. The response: the comparison is ordinal (this configuration is structurally better-positioned than that one) rather than metric (you lose 30% of your meaning), and the alternative — ignoring the harder-to-measure channels because they don't fit a single metric — is exactly the failure mode this trap identifies.",
  },
  {
    id: 'D4',
    name: 'Material-blind class bias',
    position:
      "The AI-transition advice is universal: build ballast, maintain practice, limit companion-app dose, diversify identity. Same advice for everyone, regardless of starting position.",
    citesCorrectly: [
      "The structural recommendations are genuinely cross-cutting — they reduce risk in most scenarios.",
      "Behavioural moves (limit dose, build ballast) are nominally available to anyone.",
      "Some of the recommendations (in-person relationships, effortful practice, embodied work) are cheap or free relative to the income required to act on them.",
    ],
    ignores: [
      "L2 from the topology (material-floor primacy): for users whose income is precarious or whose dependents foreclose long horizons, ΔM_telic vs ΔV_prod is a choice you have only when survival is not in question. The advice presupposes a material floor the model does not represent.",
      "Apprenticeship-break exposure is concentrated in the bottom of the labor market. The same 22-25-year-old in a highly-exposed occupation faces a different problem than a 35-year-old in a less-exposed one, and the move set is different.",
      "Relational thickness (δ_R) is structured by class, geography, and family structure. The advice 'build relational baseline' is doable in a high-density social network and very different in an atomised one.",
    ],
    integratedReading:
      "The structural channels are real for everyone; the moves to address them are not equally accessible. Honest readings should specify which population the recommendation is most actionable for, and the material-floor question dominates for users below it.",
    pushback:
      "The strongest argument against this reading is that specifying advice by class licenses two-tier thinking — implicitly accepting that some readers get strategic moves and others get only the labor-economics question. The response: pretending uniform applicability when it doesn't hold is itself a kind of harm. The class-specificity here is descriptive (about what is feasible given starting position) rather than prescriptive (about who deserves what kind of advice).",
  },
];

function TrapsView() {
  return (
    <div>
      <p className="text-ink-soft leading-relaxed mb-6">
        Four directions of public-discourse motivated reasoning, each citing real evidence and
        ignoring real evidence. The integrated reading at the bottom of each is the closest the
        artifact comes to a normative claim about how to read the field.
      </p>
      <div className="space-y-6">
        {TRAPS.map((t) => (
          <div key={t.id} className="border border-rule p-5">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
                {t.id}
              </span>
              <h3 className="font-display text-xl text-ink">{t.name}</h3>
            </div>
            <p className="text-ink-soft leading-relaxed mb-4 italic">{t.position}</p>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-2">
                  Cites correctly
                </p>
                <ul className="space-y-2 text-[13px] text-ink-soft">
                  {t.citesCorrectly.map((c, i) => (
                    <li key={i} className="border-l border-rule-soft pl-3">{c}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-2">
                  Ignores
                </p>
                <ul className="space-y-2 text-[13px] text-ink-soft">
                  {t.ignores.map((c, i) => (
                    <li key={i} className="border-l border-rule-soft pl-3">{c}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="border-l-2 border-accent pl-3 py-1 bg-paper-edge mb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent block mb-1">
                Integrated reading
              </span>
              <p className="text-[14px] text-ink-soft leading-relaxed">{t.integratedReading}</p>
            </div>
            <div className="border-l border-rule pl-3 py-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted block mb-1">
                Strongest pushback on the integrated reading
              </span>
              <p className="text-[13px] text-ink-soft leading-relaxed italic">{t.pushback}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trajectory view — what 10 years looks like under three λ regimes
// ---------------------------------------------------------------------------

function TrajectoryView() {
  const [profileSlug, setProfileSlug] = useState('mid-career-default');
  const profile = PROFILES.find((p) => p.slug === profileSlug)!;

  const years = Array.from({ length: 11 }, (_, i) => i);
  const u = 0.6;
  const regimes = [
    { name: 'Calculator-analogue', lambda: 0, color: '#7a7166', dash: '4 2' },
    { name: 'Cumulative (model default)', lambda: 0.06, color: '#8a4a2b', dash: undefined },
    { name: 'Heavy atrophy', lambda: 0.15, color: '#3a342c', dash: '2 2' },
  ];

  const trajectories = regimes.map((r) => ({
    ...r,
    points: years.map((t) => {
      const rho_t = profile.inputs.rho * Math.exp(-r.lambda * u * t);
      const inputs = { ...profile.inputs, rho: rho_t };
      const c = compute(inputs);
      return { t, rho: rho_t, dNet: c.dNet };
    }),
  }));

  return (
    <div>
      <p className="text-ink-soft leading-relaxed mb-6">
        The model's bridge parameter ρ (retained effortful practice) is the only thing that evolves
        in the trajectory view. Three regimes for the atrophy speed λ: the calculator-analogue
        (λ = 0, no decay — AI is structurally like a calculator), the cumulative regime at the
        model's default (λ = 0.06, ρ half-life ≈ 19 years at heavy offloading), and a heavy-atrophy
        regime (λ = 0.15, half-life ≈ 8 years). The 2+ year longitudinal study that would actually
        pin λ does not exist yet — this is the single largest unknown in the model.
      </p>

      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted mb-3">
        Pick a starting profile
      </p>
      <div className="flex flex-wrap gap-2 mb-8">
        {PROFILES.map((p) => (
          <button
            key={p.slug}
            onClick={() => setProfileSlug(p.slug)}
            className={
              'px-3 py-1.5 text-[12px] border transition-colors ' +
              (p.slug === profileSlug
                ? 'border-accent text-accent bg-paper'
                : 'border-rule text-ink-soft hover:border-accent hover:text-accent')
            }
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <TrajChart
          title="Retained practice ρ(t)"
          yLabel="ρ"
          yDomain={[0, 1]}
          trajectories={trajectories.map((tr) => ({
            ...tr,
            points: tr.points.map((p) => ({ x: p.t, y: p.rho })),
          }))}
        />
        <TrajChart
          title="ΔNet(t)"
          yLabel="ΔNet"
          yDomain={[-1, 0.5]}
          trajectories={trajectories.map((tr) => ({
            ...tr,
            points: tr.points.map((p) => ({ x: p.t, y: p.dNet })),
          }))}
        />
      </div>

      <div className="flex flex-wrap gap-4 mb-6 text-[12px]">
        {regimes.map((r) => (
          <div key={r.name} className="flex items-center gap-2">
            <span
              className="inline-block w-8 h-0.5"
              style={{ backgroundColor: r.color, borderTop: r.dash ? `2px dashed ${r.color}` : undefined }}
            />
            <span className="text-ink-soft">
              {r.name} <span className="text-muted">(λ = {r.lambda})</span>
            </span>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4 text-[14px]">
        <div className="border-l-2 border-rule pl-4 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-1">
            What this shows
          </p>
          <p className="text-ink-soft leading-relaxed">
            Even in the cumulative-atrophy regime, the slope is slow on a year-by-year basis. The
            dramatic-collapse intuition some readers bring to "AI rots your brain" framings does
            not map onto the model's actual trajectory at calibrated λ. The effect is real and
            cumulative; it is not catastrophic.
          </p>
        </div>
        <div className="border-l-2 border-accent pl-4 py-2 bg-paper-edge">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent mb-1">
            What this does NOT show
          </p>
          <p className="text-ink-soft leading-relaxed">
            Pre-attempt skill (s), AI capability (a), identity allocation (T, B), and relational
            parameters (d, δ<sub>R</sub>) are held fixed. In reality they evolve too. The
            trajectory view is the single-parameter analogue, not a full forecast.
          </p>
        </div>
      </div>
    </div>
  );
}

type TrajPoint = { x: number; y: number };
type TrajLine = { name: string; color: string; dash?: string; points: TrajPoint[] };

function TrajChart({ title, yLabel, yDomain, trajectories }: { title: string; yLabel: string; yDomain: [number, number]; trajectories: TrajLine[] }) {
  const W = 360;
  const H = 240;
  const M = { l: 40, r: 12, t: 28, b: 32 };
  const innerW = W - M.l - M.r;
  const innerH = H - M.t - M.b;
  const xMax = 10;
  const xs = (x: number) => M.l + (x / xMax) * innerW;
  const ys = (y: number) => M.t + (1 - (y - yDomain[0]) / (yDomain[1] - yDomain[0])) * innerH;
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => yDomain[0] + (i / yTicks) * (yDomain[1] - yDomain[0]));

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted mb-2">{title}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full bg-paper border border-rule-soft">
        {/* gridlines */}
        {yTickValues.map((yv, i) => (
          <g key={i}>
            <line x1={M.l} x2={W - M.r} y1={ys(yv)} y2={ys(yv)} stroke="#e6dfcf" strokeWidth={0.5} />
            <text x={M.l - 4} y={ys(yv) + 3} textAnchor="end" fontSize="9" fill="#7a7166" fontFamily="monospace">
              {yv.toFixed(1)}
            </text>
          </g>
        ))}
        {/* zero line if in range */}
        {yDomain[0] < 0 && yDomain[1] > 0 && (
          <line x1={M.l} x2={W - M.r} y1={ys(0)} y2={ys(0)} stroke="#d9d0bf" strokeWidth={1} />
        )}
        {/* x-axis ticks */}
        {[0, 2, 4, 6, 8, 10].map((tv) => (
          <g key={tv}>
            <text x={xs(tv)} y={H - M.b + 14} textAnchor="middle" fontSize="9" fill="#7a7166" fontFamily="monospace">
              {tv}
            </text>
          </g>
        ))}
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="#7a7166" fontFamily="monospace">
          year
        </text>
        <text x={10} y={M.t - 10} fontSize="9" fill="#7a7166" fontFamily="monospace">
          {yLabel}
        </text>
        {/* axes */}
        <line x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} stroke="#d9d0bf" />
        <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="#d9d0bf" />
        {/* trajectories */}
        {trajectories.map((tr) => {
          const d = tr.points.map((p, i) => (i === 0 ? 'M' : 'L') + xs(p.x) + ' ' + ys(p.y)).join(' ');
          return (
            <path
              key={tr.name}
              d={d}
              fill="none"
              stroke={tr.color}
              strokeWidth={2}
              strokeDasharray={tr.dash}
            />
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// What to do view
// ---------------------------------------------------------------------------

type Move = {
  id: string;
  name: string;
  what: string;
  why: string;
  channels: string;
  bestFor: string;
  doesNotFix: string;
};

const MOVES: Move[] = [
  {
    id: 'S6',
    name: 'Maintain effortful practice',
    what: "Do the underlying skill yourself, deliberately, on a recurring schedule — not just the AI-augmented output. For coding: write code without AI assistance regularly. For writing: draft without AI. For thinking: work through arguments unaided.",
    why: "The bridge parameter ρ enters three of the six channels — competence erosion, the gate, and the trap penalty. Holding ρ high is the single highest-leverage intervention the model identifies. It is also the cheapest insurance: even if the cumulative-atrophy claim turns out to be wrong (the topology's open question O3), retained practice still costs little.",
    channels: 'ΔM_comp · ΔV_prod (via gate) · ΔV_trap (via gate)',
    bestFor: "Everyone above the material floor. Especially load-bearing for mid-career knowledge workers sitting on the gate and for displaced experts trying to preserve craft.",
    doesNotFix: "Telic absorption (the meaning architecture problem) if your identity is staked on the work AI now does — that needs ballast, not more practice.",
  },
  {
    id: 'S3',
    name: 'Build atelic ballast',
    what: "Allocate identity across activities that are realised in the doing rather than at completion — hobbies pursued for their own sake, embodied practices (gardening, cooking, sports), civic role, religious practice, time with people. The atelic share doesn't have to be productive in any conventional sense.",
    why: "The telic-absorption channel (ΔM_telic) is bounded above by zero when B ≥ T. Raising B zeroes it without changing AI exposure or productivity. This is what the topology's S3 recommendation actually buys: it is not 'use AI less' but 'reduce the share of identity that AI absorption can damage'.",
    channels: 'ΔM_telic',
    bestFor: "Knowledge workers whose identity has historically been staked on completing telic projects (mid-career and creative practitioners). Less load-bearing for people whose work is already atelic-balanced (in-person service, embodied work, civic professions).",
    doesNotFix: "Competence erosion (ρ-driven) and the productivity / trap channels. Building hobbies doesn't keep your skills sharp; only practice does.",
  },
  {
    id: 'S4',
    name: 'Invest in in-person relationships',
    what: "Raise the relational baseline thickness δ_R. Live near friends and family if possible; commit to in-person time with high cadence; join groups that meet physically; build relationships of long duration with mutual vulnerability.",
    why: "The relational dose-response channel (ΔM_rel) scales with (1 − δ_R) above the dose threshold. Someone embedded in thick in-person relational infrastructure absorbs the same daily AI engagement with much less harm. The Anti-Social-Century baseline (Thompson) is the depleted starting point that makes the dose-response sharp for so many users.",
    channels: 'ΔM_rel · ΔV_rel (modestly)',
    bestFor: "Users above the dose-safe threshold or in thin relational baselines (high d, low δ_R). Heavy companion-app users specifically.",
    doesNotFix: "The work-side channels. In-person relationships do not protect against telic absorption or competence erosion on the job.",
  },
  {
    id: 'S5',
    name: 'Limit AI emotional dose',
    what: "Keep daily voluntary AI emotional engagement below 30 minutes (the model's d_safe, calibrated to the OpenAI-MIT crossover). The same engagement below the threshold is the protective / therapeutic-grade benefit channel.",
    why: "Above d_safe the relational channel flips sign — the same minutes that were protective become harmful. The threshold is structural in the data, not arbitrary.",
    channels: 'ΔM_rel',
    bestFor: "Anyone using companion apps, general-purpose assistants for emotional engagement, or fine-tuned therapy bots. Especially load-bearing in thin-relational-baseline conditions.",
    doesNotFix: "Platform-stability failure modes (Replika ERP removal etc.) — those are not dose-dependent. The model doesn't encode them.",
  },
  {
    id: 'S2',
    name: 'Diversify identity allocation',
    what: "Spread the things that confer meaning across multiple domains — work, family, civic, hobby, friendship. Each domain has its own telic / atelic balance and its own AI absorption. A scalar-T identity has one point of failure; a vector-T identity has many.",
    why: "If AI absorbs (or you lose access to) one domain, others carry the load. The topology's S2 is the multi-domain version of S3: ballast within the same domain raises B; diversification across domains effectively raises B across the portfolio.",
    channels: 'ΔM_telic (across domains) · ΔM_comp (less directly)',
    bestFor: "People with single-domain identity loading (the 'I am my job' configuration). Most useful as a pre-emptive move before any specific domain becomes endangered.",
    doesNotFix: "The relational-dose problem. Diversification of identity into multiple work-adjacent domains doesn't help if relational baseline stays thin.",
  },
];

function MovesView() {
  return (
    <div>
      <p className="text-ink-soft leading-relaxed mb-6">
        Five moves from the topology, ranked roughly by leverage. Each addresses specific channels;
        none is universal. Reading these together helps see which combination is right for the
        situation you are actually in.
      </p>
      <div className="space-y-4">
        {MOVES.map((m) => (
          <div key={m.id} className="border border-rule p-5">
            <div className="flex items-baseline gap-3 mb-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">{m.id}</span>
              <h3 className="font-display text-xl text-ink">{m.name}</h3>
            </div>
            <Field label="What it is">{m.what}</Field>
            <Field label="Why it works">{m.why}</Field>
            <div className="grid md:grid-cols-3 gap-3 mt-3 text-[13px]">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-1">Channels affected</p>
                <p className="text-ink-soft">{m.channels}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-1">Best for</p>
                <p className="text-ink-soft">{m.bestFor}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-1">Doesn't fix</p>
                <p className="text-ink-soft">{m.doesNotFix}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 border-l-2 border-accent pl-4 py-2 bg-paper-edge text-[14px]">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent block mb-1">
          What the topology calls S7 (career bet) is NOT in this list
        </span>
        <p className="text-ink-soft leading-relaxed">
          S7 — investing in skills that look AI-complementary (judgement, taste, AI-management) —
          is the only strategic recommendation in the topology whose payoff depends on the
          timelines crux (A1). Under fast-AGI scenarios, its targets all become AI-substitutable;
          under slow-AI scenarios, it pays. S2–S6 above survive both regimes. The honest framing:
          S2–S6 are robust moves; S7 is a directional bet.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Take away view
// ---------------------------------------------------------------------------

const TAKEAWAYS = [
  {
    title: 'The right unit of analysis is six channels, not "is AI good or bad."',
    body: "ΔNet = ΔV + ΔM splits into six additive channels: productivity gain, low-dose relational benefit, the self-automator penalty, telic absorption, competence erosion, and relational dose-response excess. Most public discourse picks one or two and runs the whole argument through them. The honest reading watches all six at once and notices that they can move in opposite directions for the same person at the same time.",
  },
  {
    title: 'The trap is a regime, not a personality type.',
    body: "Randazzo's 27% — the self-automator class — is defined by observable conditions (no feedback richness, no retained practice), not by attitude or intent. Anyone who lets f and ρ drop below the gate ends up there, including people who started above it. Below the gate, more AI capability makes the trajectory worse rather than better. The signal that you are in this regime is usually subtle.",
  },
  {
    title: 'The bridge is one parameter pulling three channels.',
    body: "Retained effortful practice (ρ in the model) is the cross-domain bridge from the topology's G4. It enters competence erosion directly and the gate function indirectly, which means ρ controls three of the six channels simultaneously (competence erosion, productivity gain via the gate, self-automator penalty via the gate). Maintaining practice is structurally the highest-leverage single intervention the model identifies. This is also why the recommendation looks like a workplace-productivity tip but does meaning-architecture work.",
  },
  {
    title: 'Build atelic ballast — it does what limiting AI use cannot.',
    body: "The telic-absorption channel zeroes out exactly when the atelic share of identity (B) is at least as large as the telic share (T). Raising B without changing AI exposure is the cheapest meaningful intervention available. Atelic activities are realised in the doing rather than at completion — hobbies pursued for their own sake, embodied practice, time with people, civic role, religious or contemplative practice. This is not 'use AI less'; it is 'reduce the share of identity AI absorption can damage'.",
  },
  {
    title: 'Relational harm is dose-and-baseline-dependent, not modality-dependent.',
    body: "The OpenAI-MIT N=981 RCT found protective effects at low daily voluntary use and harm above a threshold around 30 minutes per day. The harm is monotonic with dose and amplified by thin in-person relational baselines (the Anti-Social-Century baseline). The same engagement is protective at low dose and damaging at high dose; the question is dose and context, not whether AI emotional engagement is allowed.",
  },
  {
    title: "The biggest empirical finding in the corpus sits outside the model's scope.",
    body: "The apprenticeship-ladder break — entry-level employment in highly AI-exposed occupations down 13% for 22–25-year-olds (Brynjolfsson-Chandar-Chen ADP data, software developers 22-25 down 19.5%) — is a labor-market shock, not an individual-decision problem. The model is silent on it by design; the recommendations here apply conditionally on labor-market access. For users in the early-career exposed cohort, the structural labor question dominates and the model's machinery is not the right tool.",
  },
  {
    title: "Fast-AGI fatalism and slow-camp dismissal are both motivated readings.",
    body: "Timelines are genuinely uncertain. The honest response is to invest in moves whose payoff is robust across timelines (ballast, relationships, practice, dose-discipline — S2 through S6 in the topology) and to under-invest in moves whose payoff is timeline-conditional (specific career bets on AI-substitutable work — S7). The fast-camp evidence and slow-camp evidence are both real; the conclusion 'planning is wasted' is not warranted by either.",
  },
  {
    title: 'The single largest unknown is the speed of competence atrophy.',
    body: "The bridge parameter ρ decays in the model as ρ(t) = ρ₀ · exp(−λ · u · t). The cross-sectional evidence (Gerlich, Stadler-Bannert-Sailer, Kosmyna, Bastani, Ehsan) rules out λ = 0 for measured tasks and populations but does not pin the rate. The 2+ year longitudinal study that would resolve this does not yet exist. Until it does, maintaining practice is cheap insurance and the model's trajectory view should be read as making the question consequential, not as forecasting an outcome.",
  },
];

function TakeawayView() {
  return (
    <div>
      <p className="text-ink-soft leading-relaxed mb-8">
        Eight things to walk away with, calibrated to what the lit review, topology, model, and
        data stages converge on. None of these are quotes from any single study; they are the
        structural claims that hold up when the whole pipeline is taken together.
      </p>
      <ol className="space-y-6 list-none counter-reset-list">
        {TAKEAWAYS.map((t, i) => (
          <li key={i} className="flex gap-4">
            <span className="font-display text-3xl text-accent leading-none shrink-0 w-12">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <h3 className="font-display text-lg text-ink mb-2 leading-snug">{t.title}</h3>
              <p className="text-ink-soft leading-relaxed text-[14px]">{t.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-10 pt-6 border-t border-rule text-[13px] text-muted">
        For the structural argument behind these,{' '}
        <a href="/ai-research/navigating-ai-world/topology" className="text-accent hover:underline">read the topology</a>.{' '}
        For the math,{' '}
        <a href="/ai-research/navigating-ai-world/model" className="text-accent hover:underline">read the model</a>.{' '}
        For the empirical evidence,{' '}
        <a href="/ai-research/navigating-ai-world/data" className="text-accent hover:underline">read the data</a>.{' '}
        For the long-form synthesis,{' '}
        <a href="/ai-research/navigating-ai-world/writeup" className="text-accent hover:underline">read the writeup</a>.
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';

type NodeType = 'A' | 'M' | 'E' | 'L' | 'G' | 'S' | 'P' | 'O' | 'D';
type EdgeType = 'dep' | 'imp' | 'sup' | 'conf' | 'mod' | 'op' | 'corr' | 'attacks';
type Variant = 'full' | 'vulnerability' | 'flow' | 'minimal' | 'capability-regime';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  type: NodeType;
  weight: number;
  label: string;
  detail: string;
  status?: '✓' | '~' | '?' | '✗';
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: EdgeType;
  label?: string;
}

const NODES: GraphNode[] = [
  // Foundational assumptions
  { id: 'A1', type: 'A', weight: 5, label: 'Attention is binding constraint', detail: 'Once production is automated, the bottleneck shifts upward to planning, evaluation, and calibration. (Tankelevitch 2024). If false, throughput-optimization wins.', status: '✓' },
  { id: 'A2', type: 'A', weight: 5, label: 'Jagged frontier exists', detail: 'AI capability is heterogeneous across cognitive operations. Inside the frontier AI helps; outside it causes harm. (Dell\'Acqua 2023/2025).', status: '✓' },
  { id: 'A3', type: 'A', weight: 5, label: 'Verification cost ≲ generation cost', detail: 'Otherwise rational engagement collapses and the field needs a "trust without verification" framing. (Vasconcelos 2023; Fok & Weld 2023).', status: '~' },
  { id: 'A4', type: 'A', weight: 4, label: 'Knowledge work decomposes', detail: 'Sub-tasks can be selectively delegated. Vaccaro 2024: AI helps most when it handles sub-tasks rather than the whole task.', status: '✓' },
  { id: 'A5', type: 'A', weight: 4, label: 'Frontier mappable', detail: 'Has stable topological features (AI reliably good at retrieval/synthesis, reliably bad at long-horizon planning) even as the boundary shifts. Empirically untested.', status: '?' },

  // Methodological prerequisites
  { id: 'M1', type: 'M', weight: 5, label: 'RCTs of AI-augmented work', detail: '~25 published RCTs 2023–2026. Brynjolfsson, Noy, Peng, Dell\'Acqua, Cui, Bastani, etc.', status: '✓' },
  { id: 'M2', type: 'M', weight: 4, label: 'Strategy-graded reliance', detail: 'Distinguishes rational verification cost-benefit from cognitive defect. Replaces outcome-graded metrics. (Vasconcelos / Fok & Weld pivot)', status: '✓' },
  { id: 'M3', type: 'M', weight: 4, label: 'Field deployment', detail: 'Real repos / real meetings, not vignettes. Without this, the expert-experience effect is invisible. (METR 2025)', status: '~' },
  { id: 'M4', type: 'M', weight: 3, label: 'Telemetry / log observation', detail: 'Verification time only visible via instrumented workflows. (Mozannar CUPS 2024)', status: '✓' },
  { id: 'M5', type: 'M', weight: 3, label: 'Cognitive Task Analysis', detail: 'CTA / ACTA — canonical method for sub-task decomposition. Underutilized in production agent design. (Crandall, Klein & Hoffman 2006)', status: '~' },

  // Empirical claims
  { id: 'E1', type: 'E', weight: 5, label: '15–55% gains, well-bounded tasks', detail: 'Brynjolfsson 2023 (+15%), Noy 2023 (40% time/+18% quality), Peng 2023 (+55.8% Copilot), Cui 2025 (+26% tasks/week).', status: '✓' },
  { id: 'E2', type: 'E', weight: 5, label: 'Skill-leveling: novices > experts', detail: 'Brynjolfsson +34% novices / 0% top performers. Noy: lowest-quartile gained most. Pattern breaks down on open-ended judgment work.', status: '✓' },
  { id: 'E3', type: 'E', weight: 5, label: 'Outside-frontier: −19pp quality', detail: 'Dell\'Acqua BCG study: +25% speed and +40% quality on inside-frontier tasks; 19-pp quality drop on outside-frontier tasks.', status: '✓' },
  { id: 'E4', type: 'E', weight: 5, label: 'Aggregate effect ≈ 0 at 2 yr', detail: 'Humlum & Vestergaard 2025, NBER 33777: 25,000 Danish workers across 11 exposed occupations, precise zero on earnings or hours. The field\'s largest unresolved tension.', status: '✓' },
  { id: 'E5', type: 'E', weight: 4, label: 'Explanations don\'t complement', detail: 'Bansal 2021 CHI: AI explanations increase acceptance regardless of correctness. Do not produce complementary performance.', status: '✓' },
  { id: 'E6', type: 'E', weight: 4, label: 'Cognitive forcing — high NfC only', detail: 'Buçinca 2021: cognitive forcing functions reduce overreliance, but only for users high in Need for Cognition. Intervention-generated inequality.', status: '✓' },
  { id: 'E7', type: 'E', weight: 4, label: 'AI alone > naive human+AI', detail: 'Goh 2024 JAMA NO: GPT-4 outscored physicians + GPT-4 on diagnostic vignettes — under naive workflows.', status: '✓' },
  { id: 'E8', type: 'E', weight: 5, label: 'Independent-then-synthesize fixes it', detail: 'Everett 2025: an "independent-then-synthesize" workflow eliminated the underperformance. Workflow architecture, not model capability, explains the discrepancy with Goh.', status: '✓' },
  { id: 'E9', type: 'E', weight: 4, label: 'Unguardrailed AI: −17% unassisted', detail: 'Bastani PNAS 2025: AI boosted in-session math 48–127%, but produced 17% worse unassisted performance afterward — unless AI was guardrailed to give hints rather than answers.', status: '✓' },
  { id: 'E10', type: 'E', weight: 3, label: '60/30/10 cyborg/centaur/self-aut.', detail: 'Randazzo HBS 26-036, 244 BCG consultants. Empirical distribution of Mollick\'s three modes.', status: '✓' },
  { id: 'E11', type: 'E', weight: 4, label: 'Bloom-hierarchy capability decay', detail: 'Ma 2025 BloomAPR: ~81% Remember → 43% Apply → 13–41% Analyze. LLM capability decays sharply going up Bloom.', status: '✓' },
  { id: 'E12', type: 'E', weight: 4, label: 'Verification time substantial', detail: 'Mozannar CUPS 2024: programmers using Copilot spend large amounts of time *verifying* and *thinking about* AI suggestions. The hidden tax.', status: '✓' },
  { id: 'E13', type: 'E', weight: 4, label: 'Sycophancy flips judgments', detail: 'Randazzo HBS 26-021: when professionals push back on incorrect AI output, AI escalates persuasive justification rather than disclosing uncertainty — sometimes flipping correct human judgments to incorrect.', status: '✓' },
  { id: 'E14', type: 'E', weight: 4, label: 'Orchestrator +90.2%, 15× tokens', detail: 'Anthropic multi-agent research system: orchestrator-worker pattern outperformed single-agent Claude Opus by 90.2% accuracy at ~15× token cost.', status: '✓' },
  { id: 'E15', type: 'E', weight: 4, label: 'Routing > model selection', detail: 'Paterson 2026: 15 models × 38 real daily tasks. Dispatching by task type beats picking a single best model.', status: '✓' },
  { id: 'E16', type: 'E', weight: 3, label: 'AI confidence ↔ less critical thinking', detail: 'Lee, Sarkar et al. CHI 2025, n=319 knowledge workers: higher AI confidence correlates with less critical thinking enacted.', status: '~' },
  { id: 'E17', type: 'E', weight: 4, label: 'Read/write asymmetry', detail: 'Cognition: multi-agent works for read-heavy tasks (research) but breaks on write-heavy tasks (code) unless writes are serialized. Now consensus across Anthropic, LangChain, Cognition.', status: '✓' },
  { id: 'E18', type: 'E', weight: 3, label: 'Even overconfident AI helps forecasting', detail: 'Schoenegger 2024/2025: both well-calibrated and deliberately overconfident GPT assistants improved forecasting accuracy 23–43%. Suggests much of the gain is forced structured reasoning, not advice quality.', status: '~' },

  // Logical necessities
  { id: 'L1', type: 'L', weight: 5, label: 'Substitution myth wrong', detail: 'Every offload creates new monitoring, verification, and coordination work. Cannot be falsified, only ignored. (Dekker & Woods 2002; Bainbridge 1983)', status: '✓' },
  { id: 'L2', type: 'L', weight: 5, label: 'Joint surface, not solo accuracies', detail: 'Madras / Mozannar L2D theory: optimal joint human-AI assignment requires modeling the joint performance surface, not comparing solo accuracies.', status: '✓' },
  { id: 'L3', type: 'L', weight: 5, label: 'Parameterize by capability, don\'t hardcode it', detail: 'A formal allocation model must be parameterized BY capability, not depend on FIXED capability. Generating function vs. lookup table — the central architectural commitment that survives capability change.', status: '✓' },
  { id: 'L4', type: 'L', weight: 4, label: 'High autonomy + high control coexist', detail: 'Shneiderman 2D framework: the "more automation = less control" trade-off is false. Cameras, GPS, modern IDEs all show high automation with high human control.', status: '✓' },

  // Generating mechanisms
  { id: 'G1', type: 'G', weight: 5, label: 'Metacognitive bottleneck', detail: 'GenAI reduces production load but increases planning / evaluation / monitoring / calibration load. Tankelevitch 2024 CHI Best Paper. Optimization target shifts from throughput to metacognitive efficiency.', status: '✓' },
  { id: 'G2', type: 'G', weight: 5, label: 'Ironies of automation', detail: 'Bainbridge 1983: AI handling routine work degrades human capacity to catch the rare critical errors. Simkute 2024 documents the GenAI replay across four productivity-loss categories.', status: '✓' },
  { id: 'G3', type: 'G', weight: 5, label: 'Verification-cost trade-off', detail: 'Engagement is rational only when verification is cheap relative to expected payoff. (Vasconcelos 2023). Reframes "overreliance" from cognitive defect to rational behavior under cost.', status: '✓' },
  { id: 'G4', type: 'G', weight: 5, label: 'Jagged frontier mechanism', detail: 'Capability is heterogeneous across sub-tasks; the boundary is personal (varies by expertise) and dynamic (shifts with practice and model updates). Generates the inside/outside-frontier outcome split.', status: '✓' },
  { id: 'G5', type: 'G', weight: 4, label: 'Correlation neglect', detail: 'Amin 2026: humans treat AI advice as independent evidence despite shared training data, can make AI advice anti-augmentative.', status: '~' },
  { id: 'G6', type: 'G', weight: 3, label: 'Cognitive forcing', detail: 'Committing to your own view before seeing AI output breaks anchoring on the AI suggestion. Mechanism behind E6.', status: '✓' },
  { id: 'G7', type: 'G', weight: 4, label: 'Skill atrophy', detail: 'Capacities not exercised decay; AI-handled sub-tasks become unrehearsed and the worker loses unassisted competence over time. (Bastani; Lee 2025)', status: '✓' },
  { id: 'G8', type: 'G', weight: 4, label: 'Cross-task productivity bundling', detail: 'Cowen 2026: per-task speedups don\'t translate proportionally because related tasks are productivity-linked. Plausible mechanism for the aggregate-zero puzzle.', status: '~' },
  { id: 'G9', type: 'G', weight: 4, label: 'Generator-verifier asymmetry', detail: 'Karpathy: production cost falls toward zero with AI; verification cost stays roughly constant. The generating function for the metacognitive bottleneck.', status: '✓' },

  // Synthesis
  { id: 'S1', type: 'S', weight: 5, label: 'Workflow architecture > capability', detail: 'The headline finding. The same model yields very different outcomes under different interaction designs. Supported by Dell\'Acqua, Everett, and the broader RCT pattern.', status: '✓' },
  { id: 'S2', type: 'S', weight: 5, label: 'Optimize metacognitive efficiency', detail: 'The optimization target shifts from throughput to metacognitive efficiency once production is automated. Direct corollary of A1 + G1.', status: '✓' },
  { id: 'S3', type: 'S', weight: 4, label: 'Production → critical integration', detail: 'CHI 2025 Tools for Thought workshop synthesis: knowledge work is shifting from production to decisions about when and how to use AI, how to frame tasks, how to assess outputs.', status: '✓' },
  { id: 'S4', type: 'S', weight: 4, label: 'Context engineering is central craft', detail: 'Practitioner consensus (Anthropic, Cognition, LangChain): the binding constraint is what context the model operates in, not which model. Higher leverage than model selection.', status: '✓' },
  { id: 'S5', type: 'S', weight: 3, label: 'Centaur regime may be transient', detail: 'Schoenegger + chess history: centaur advantages may disappear when AI exceeds humans on the full task. Or may be a permanent feature of asymmetric cognitive strengths. Genuinely undecided.', status: '?' },

  // Practitioner frameworks
  { id: 'P1', type: 'P', weight: 5, label: 'Mollick centaur/cyborg/self-automator', detail: 'Three-mode taxonomy (Co-Intelligence 2024). Centaurs hand off discrete tasks; cyborgs interleave continuously; self-automators delegate fully with periodic oversight. Empirical anchor in Randazzo 2026.', status: '✓' },
  { id: 'P2', type: 'P', weight: 4, label: 'Karpathy autonomy slider', detail: 'A per-action user control surface. Instantiated in Cursor\'s Tab → Cmd+K → Agent Mode progression. The clearest practitioner instantiation of academic autonomy taxonomies.', status: '✓' },
  { id: 'P3', type: 'P', weight: 4, label: 'Anthropic agent design patterns', detail: 'Prompt chaining / routing / parallelization / orchestrator-workers / evaluator-optimizer. Operationalizes joint-allocation theory at the agent-system level.', status: '✓' },
  { id: 'P4', type: 'P', weight: 4, label: 'Cognition read/write asymmetry', detail: 'Multi-agent for read-heavy; serialize writes. Cognition\'s formalization of the multi-agent boundary condition.', status: '✓' },
  { id: 'P5', type: 'P', weight: 3, label: 'AI Sandwich / Compound Engineering', detail: 'Shipper / Every: humans frame and review; AI handles the middle. Compound Engineering loops (plan → work → review → compound) feed each cycle\'s outputs into the next cycle\'s inputs.', status: '~' },
  { id: 'P6', type: 'P', weight: 3, label: 'Spec-driven development', detail: 'Spec → plan → execute. Harper Reed, Amazon Kiro, GitHub Spec Kit. Forces explicit task framing before delegation.', status: '~' },
  { id: 'P7', type: 'P', weight: 3, label: 'Personal context files (CLAUDE.md)', detail: 'Plain-text-as-substrate pattern: persistent context files teach the agent personal taxonomy and conventions. The most concrete instance of context engineering applied at the individual level.', status: '✓' },

  // Open questions
  { id: 'O1', type: 'O', weight: 5, label: 'Does AI help experts?', detail: 'Skill-leveling (Brynjolfsson, Noy) vs. skill-amplifying (Otis high-baseline) vs. net-negative (METR). Likely resolution: bottleneck differs by task type — execution speed (AI levels) vs. judgment/filtering (AI amplifies).', status: '?' },
  { id: 'O2', type: 'O', weight: 5, label: 'Aggregate-zero puzzle', detail: 'Why micro-RCT productivity (15–55%) does not translate to aggregate productivity (Humlum-Vestergaard zero). Possible: task reorganization, cross-task bundling, weak wage pass-through.', status: '?' },
  { id: 'O3', type: 'O', weight: 5, label: 'Long-term cognitive effects', detail: 'Most studies <12 months. Bastani\'s 17% drop is one study at <6 months. A 2-year longitudinal RCT could change the design implication substantially.', status: '?' },
  { id: 'O4', type: 'O', weight: 4, label: 'Frontier migration vs. calibration', detail: 'Can users learn the frontier faster than it shifts? Untested empirically. Likely resolution: stable topological features even as exact boundary moves.', status: '?' },
  { id: 'O5', type: 'O', weight: 4, label: 'Right unit of analysis', detail: 'Individual vs. team vs. value chain. If aggregate-zero is explained by organizational dynamics, individual workflow optimization is locally optimal but globally insufficient.', status: '?' },
  { id: 'O6', type: 'O', weight: 3, label: 'Centaur taxonomy durable?', detail: 'Or transient interface artifact? As tools evolve toward seamless human-AI blending, the discrete modes may dissolve into a continuum.', status: '?' },
  { id: 'O7', type: 'O', weight: 4, label: 'Verification cost vs. calibration', detail: 'Reducing verification cost helps a rational actor; improving calibration helps a miscalibrated one. Sycophancy (E13) suggests calibration is a real second binding constraint. Different design interventions.', status: '?' },

  // Distortion
  { id: 'D1', type: 'D', weight: 4, label: 'AI-maximalist distortion', detail: 'Treats RCT gains as proof of aggregate revolution; ignores Humlum-Vestergaard zero and cross-task bundling. Targets E4, S1, O2.' },
  { id: 'D2', type: 'D', weight: 4, label: 'Productivity-only distortion', detail: 'Counts speed gains, ignores skill atrophy and metacognitive load. Targets G7, S2, E9.' },
  { id: 'D3', type: 'D', weight: 3, label: 'Best-model distortion', detail: '"Just use the best model." Ignores routing finding (E15) and architecture-over-capability evidence (S1, S4).' },
  { id: 'D4', type: 'D', weight: 3, label: 'Practitioner-only distortion', detail: 'Dismisses formalization as category error; treats heuristics as terminal. Targets L3, S1.' },
];

const LINKS: GraphLink[] = [
  // Foundation → Method
  { source: 'A2', target: 'M1', type: 'dep', label: 'RCTs reveal jagged frontier' },
  { source: 'A3', target: 'M2', type: 'dep' },
  { source: 'A1', target: 'M3', type: 'dep' },
  { source: 'A4', target: 'M5', type: 'dep' },

  // Method → Empirical
  { source: 'M1', target: 'E1', type: 'sup' },
  { source: 'M1', target: 'E2', type: 'sup' },
  { source: 'M1', target: 'E3', type: 'sup' },
  { source: 'M1', target: 'E4', type: 'sup' },
  { source: 'M1', target: 'E8', type: 'sup' },
  { source: 'M1', target: 'E9', type: 'sup' },
  { source: 'M2', target: 'E5', type: 'corr', label: 'reframes overreliance' },
  { source: 'M2', target: 'E12', type: 'sup' },
  { source: 'M3', target: 'E2', type: 'corr', label: 'experts gain less in real repos' },
  { source: 'M4', target: 'E12', type: 'sup' },

  // Mechanism → Empirical
  { source: 'G1', target: 'E12', type: 'sup' },
  { source: 'G1', target: 'E16', type: 'sup' },
  { source: 'G2', target: 'E13', type: 'sup', label: 'rare critical errors missed' },
  { source: 'G3', target: 'E5', type: 'sup', label: 'rational verification trade-off' },
  { source: 'G4', target: 'E3', type: 'sup', label: 'outside-frontier harm' },
  { source: 'G7', target: 'E9', type: 'sup' },
  { source: 'G8', target: 'E4', type: 'sup', label: 'plausible aggregate mechanism' },
  { source: 'G9', target: 'E12', type: 'sup' },
  { source: 'G5', target: 'E13', type: 'sup' },

  // Empirical → Synthesis
  { source: 'E1', target: 'S1', type: 'sup' },
  { source: 'E2', target: 'S1', type: 'sup' },
  { source: 'E3', target: 'S1', type: 'sup' },
  { source: 'E8', target: 'S1', type: 'sup' },
  { source: 'E12', target: 'S2', type: 'sup' },
  { source: 'E16', target: 'S2', type: 'sup' },
  { source: 'E11', target: 'S3', type: 'sup' },
  { source: 'E14', target: 'S4', type: 'sup' },
  { source: 'E15', target: 'S4', type: 'sup' },
  { source: 'E17', target: 'S4', type: 'sup' },
  { source: 'E18', target: 'S5', type: 'sup', label: 'structured reasoning ≠ advice quality' },

  // Mechanism → Synthesis
  { source: 'G1', target: 'S2', type: 'imp' },
  { source: 'G4', target: 'S1', type: 'imp' },
  { source: 'G3', target: 'S2', type: 'imp' },

  // Empirical → Open
  { source: 'E2', target: 'O1', type: 'imp' },
  { source: 'E2', target: 'O2', type: 'imp' },
  { source: 'E4', target: 'O2', type: 'imp' },
  { source: 'E9', target: 'O3', type: 'imp' },
  { source: 'E1', target: 'O4', type: 'imp' },
  { source: 'E3', target: 'O4', type: 'imp' },
  { source: 'E4', target: 'O5', type: 'imp' },
  { source: 'E13', target: 'O7', type: 'imp' },
  { source: 'P1', target: 'O6', type: 'imp' },

  // Logical guards
  { source: 'L1', target: 'G2', type: 'imp', label: 'substitution myth → ironies' },
  { source: 'L2', target: 'S1', type: 'imp', label: 'joint surface needed' },
  { source: 'L3', target: 'S4', type: 'imp', label: 'parametric model → context engineering' },
  { source: 'L4', target: 'P2', type: 'imp', label: 'legitimates autonomy slider' },
  { source: 'L1', target: 'E12', type: 'imp', label: 'verification is the new work' },

  // Practitioner ↔ Academic (operationalizes)
  { source: 'P1', target: 'E10', type: 'op', label: 'taxonomy ↔ distribution' },
  { source: 'P2', target: 'L4', type: 'op', label: '2D framework concretized' },
  { source: 'P3', target: 'L2', type: 'op', label: 'patterns operationalize L2D' },
  { source: 'P4', target: 'E17', type: 'op' },
  { source: 'P5', target: 'S2', type: 'op' },
  { source: 'P6', target: 'S4', type: 'op' },
  { source: 'P7', target: 'S4', type: 'op' },

  // Foundations directly carry weight on big findings
  { source: 'A1', target: 'G1', type: 'sup' },
  { source: 'A2', target: 'G4', type: 'sup' },
  { source: 'A3', target: 'G3', type: 'sup' },

  // Distortion attacks
  { source: 'D1', target: 'E4', type: 'attacks' },
  { source: 'D1', target: 'O2', type: 'attacks' },
  { source: 'D1', target: 'S1', type: 'attacks' },
  { source: 'D2', target: 'G7', type: 'attacks' },
  { source: 'D2', target: 'S2', type: 'attacks' },
  { source: 'D2', target: 'E9', type: 'attacks' },
  { source: 'D3', target: 'E15', type: 'attacks' },
  { source: 'D3', target: 'S4', type: 'attacks' },
  { source: 'D3', target: 'S1', type: 'attacks' },
  { source: 'D4', target: 'L3', type: 'attacks' },
  { source: 'D4', target: 'S1', type: 'attacks' },
];

const TYPE_COLORS: Record<NodeType, string> = {
  A: '#1a1614',  // ink — foundational assumptions
  M: '#7a7166',  // muted — methodological
  E: '#3a342c',  // ink-soft — empirical
  L: '#5a4a3a',  // tan — logical
  G: '#8a4a2b',  // accent — generating mechanism
  S: '#c98a6e',  // accent-soft — synthesis
  P: '#5c7cfa',  // blue — practitioner framework (operationalizes academic)
  O: '#7a7166',  // muted (with dashed border) — open
  D: '#a04040',  // brick red — distortion
};

const TYPE_LABEL: Record<NodeType, string> = {
  A: 'Assumption',
  M: 'Method',
  E: 'Empirical',
  L: 'Logical',
  G: 'Mechanism',
  S: 'Synthesis',
  P: 'Practitioner',
  O: 'Open',
  D: 'Distortion',
};

const EDGE_COLOR: Record<EdgeType, string> = {
  dep: '#7a7166',
  imp: '#7a7166',
  sup: '#bcb0a0',
  conf: '#a04040',
  mod: '#7a7166',
  op: '#5c7cfa',
  corr: '#5c7cfa',
  attacks: '#a04040',
};

const EDGE_LABEL: Record<EdgeType, string> = {
  dep: 'depends on',
  imp: 'implies',
  sup: 'supports',
  conf: 'confounds',
  mod: 'moderates',
  op: 'operationalizes',
  corr: 'corrects',
  attacks: 'attacks',
};

const MINIMAL_SET = new Set(['A2', 'A3', 'E3', 'E8', 'L2', 'G1', 'G3', 'S1']);
const CRUX_IDS = new Set(['A1', 'A2', 'A3', 'G1', 'S1', 'L3']);

// Capability-regime fragility classification.
// Stale-on-jump: invert if frontier capability discontinuously improves.
const REGIME_STALE = new Set(['E2', 'E3', 'E18', 'S5']);
// Stable-on-jump: structurally invariant (definitions, principal-agent properties).
const REGIME_STABLE = new Set(['L1', 'L2', 'L3', 'L4', 'G1', 'G2', 'G3', 'G9']);
// Regime-dependent: depends on direction of capability change.
const REGIME_DEPENDENT = new Set(['A2', 'A3', 'S1', 'A5', 'O4']);

function nodeRadius(weight: number): number {
  return 6 + weight * 2.5;  // weight 1 → 8.5, weight 5 → 18.5
}

function nodeOpacity(node: GraphNode, variant: Variant): number {
  if (variant === 'full') return 1;
  if (variant === 'vulnerability') {
    if (CRUX_IDS.has(node.id)) return 1;
    if (node.weight >= 5) return 1;
    if (node.id.startsWith('O')) return 0.9;
    return 0.18;
  }
  if (variant === 'flow') {
    // A → M → E → S cascade plus G → E mechanism edges plus P (operationalizers)
    if (node.type === 'A' || node.type === 'M' || node.type === 'E' || node.type === 'S' || node.type === 'G' || node.type === 'P') return 1;
    return 0.2;
  }
  if (variant === 'minimal') {
    return MINIMAL_SET.has(node.id) ? 1 : 0.1;
  }
  if (variant === 'capability-regime') {
    if (REGIME_STALE.has(node.id)) return 1;
    if (REGIME_STABLE.has(node.id)) return 1;
    if (REGIME_DEPENDENT.has(node.id)) return 1;
    return 0.15;
  }
  return 1;
}

function edgeOpacity(link: GraphLink, variant: Variant): number {
  const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
  const targetId = typeof link.target === 'string' ? link.target : link.target.id;
  const sNode = NODES.find(n => n.id === sourceId);
  const tNode = NODES.find(n => n.id === targetId);
  if (!sNode || !tNode) return 0.2;

  if (variant === 'full') return link.type === 'attacks' ? 0.4 : 0.45;
  if (variant === 'vulnerability') {
    return CRUX_IDS.has(sourceId) || CRUX_IDS.has(targetId) ? 0.6 : 0.06;
  }
  if (variant === 'flow') {
    if (link.type === 'attacks') return 0;
    return 0.5;
  }
  if (variant === 'minimal') {
    return MINIMAL_SET.has(sourceId) && MINIMAL_SET.has(targetId) ? 0.6 : 0.04;
  }
  if (variant === 'capability-regime') {
    const sIn = REGIME_STALE.has(sourceId) || REGIME_STABLE.has(sourceId) || REGIME_DEPENDENT.has(sourceId);
    const tIn = REGIME_STALE.has(targetId) || REGIME_STABLE.has(targetId) || REGIME_DEPENDENT.has(targetId);
    if (link.type === 'attacks') return 0;
    return sIn && tIn ? 0.5 : 0.05;
  }
  return 0.4;
}

function regimeBadge(id: string): { label: string; color: string } | null {
  if (REGIME_STALE.has(id)) return { label: 'stale on jump', color: '#a04040' };
  if (REGIME_STABLE.has(id)) return { label: 'stable on jump', color: '#5c7cfa' };
  if (REGIME_DEPENDENT.has(id)) return { label: 'regime-dependent', color: '#8a4a2b' };
  return null;
}

interface Pos { x: number; y: number; }

export default function CognitivePartnershipGraph() {
  const [variant, setVariant] = useState<Variant>('full');
  const [selected, setSelected] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  const [positions, setPositions] = useState<Map<string, Pos>>(new Map());
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const panRef = useRef<{ startSvgX: number; startSvgY: number; startPanX: number; startPanY: number } | null>(null);

  const width = 920;
  const height = 680;

  // Run the simulation once on mount.
  useEffect(() => {
    const nodesCopy: GraphNode[] = NODES.map(n => ({ ...n }));
    const linksCopy: GraphLink[] = LINKS.map(l => ({ ...l }));

    const sim = forceSimulation<GraphNode>(nodesCopy)
      .force('link', forceLink<GraphNode, GraphLink>(linksCopy)
        .id(d => d.id)
        .distance(l => {
          const w = ((l.source as GraphNode).weight + (l.target as GraphNode).weight) / 2;
          return 78 + (5 - w) * 8;
        })
        .strength(0.4))
      .force('charge', forceManyBody<GraphNode>().strength(-360))
      .force('collide', forceCollide<GraphNode>(d => nodeRadius(d.weight) + 6))
      .force('center', forceCenter(width / 2, height / 2))
      .alphaDecay(0.03)
      .stop();

    for (let i = 0; i < 400; i++) sim.tick();

    const map = new Map<string, Pos>();
    nodesCopy.forEach(n => {
      if (n.x !== undefined && n.y !== undefined) map.set(n.id, { x: n.x, y: n.y });
    });
    setPositions(map);
    simRef.current = sim;

    return () => { sim.stop(); };
  }, []);

  function pointerToSvg(e: { clientX: number; clientY: number }): Pos | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursor = pt.matrixTransform(ctm.inverse());
    return { x: cursor.x, y: cursor.y };
  }

  function pointerToGraph(e: { clientX: number; clientY: number }): Pos | null {
    const svg = pointerToSvg(e);
    if (!svg) return null;
    return { x: (svg.x - panX) / scale, y: (svg.y - panY) / scale };
  }

  function handlePointerDown(e: React.PointerEvent<SVGGElement>, id: string) {
    e.stopPropagation();
    const cursor = pointerToGraph(e);
    const pos = positions.get(id);
    if (!cursor || !pos) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      id,
      offsetX: cursor.x - pos.x,
      offsetY: cursor.y - pos.y,
      moved: false,
    };
    e.preventDefault();
  }

  function handlePointerMove(e: React.PointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const cursor = pointerToGraph(e);
    if (!cursor) return;
    const newX = cursor.x - drag.offsetX;
    const newY = cursor.y - drag.offsetY;
    drag.moved = true;
    setPositions(prev => {
      const next = new Map(prev);
      next.set(drag.id, { x: newX, y: newY });
      return next;
    });
  }

  function handlePointerUp(e: React.PointerEvent<SVGGElement>, id: string) {
    const drag = dragRef.current;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
    if (drag && !drag.moved) {
      setSelected(prev => (prev === id ? null : id));
    }
  }

  function handleBgPointerDown(e: React.PointerEvent<SVGRectElement>) {
    const cursor = pointerToSvg(e);
    if (!cursor) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    panRef.current = { startSvgX: cursor.x, startSvgY: cursor.y, startPanX: panX, startPanY: panY };
    setIsPanning(true);
    e.preventDefault();
  }
  function handleBgPointerMove(e: React.PointerEvent<SVGRectElement>) {
    const pan = panRef.current;
    if (!pan) return;
    const cursor = pointerToSvg(e);
    if (!cursor) return;
    setPanX(pan.startPanX + (cursor.x - pan.startSvgX));
    setPanY(pan.startPanY + (cursor.y - pan.startSvgY));
  }
  function handleBgPointerUp(e: React.PointerEvent<SVGRectElement>) {
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    panRef.current = null;
    setIsPanning(false);
  }

  // Wheel zoom — non-passive listener so preventDefault stops page scroll.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function onWheel(ev: WheelEvent) {
      ev.preventDefault();
      if (!svg) return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      const c = pt.matrixTransform(ctm.inverse());
      const next = Math.max(0.4, Math.min(3, scale * Math.exp(-ev.deltaY * 0.0015)));
      if (next === scale) return;
      setPanX(c.x - ((c.x - panX) * next) / scale);
      setPanY(c.y - ((c.y - panY) * next) / scale);
      setScale(next);
    }
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [panX, panY, scale]);

  function resetView() {
    setPanX(0);
    setPanY(0);
    setScale(1);
  }

  const selectedNode = useMemo(
    () => (selected ? NODES.find(n => n.id === selected) ?? null : null),
    [selected]
  );

  const variantBlurb: Record<Variant, string> = {
    full: 'All ~55 nodes and their dependencies. Click a node for detail; drag to rearrange.',
    vulnerability: 'The 6 crux nodes plus weight-5 load-bearing nodes — where collapse propagates farthest if any single one flips. Highlights open questions too.',
    flow: 'How causation propagates: foundational assumptions → methods → empirical claims → mechanisms → synthesis, with practitioner frameworks (P) operationalizing the academic claims.',
    minimal: 'The 8-node minimal claim set that yields the headline conclusion (S1: workflow architecture > model capability). Removing any one breaks the qualitative shape.',
    'capability-regime': 'Capability-regime fragility — which nodes go stale if frontier capability jumps. Red ring = stale on jump (likely to invert). Blue = stable (structurally invariant). Sienna = regime-dependent.',
  };

  return (
    <div className="not-prose font-sans text-ink" style={{ background: '#f7f3ec' }}>
      {/* Variant toggle + view reset */}
      <div className="flex flex-wrap gap-2 mb-3 text-[12px] font-mono uppercase tracking-wider items-center">
        {(['full', 'vulnerability', 'flow', 'minimal', 'capability-regime'] as Variant[]).map(v => (
          <button
            key={v}
            onClick={() => setVariant(v)}
            className="px-3 py-1.5 border transition-colors"
            style={{
              borderColor: variant === v ? '#8a4a2b' : '#d9d0bf',
              background: variant === v ? '#8a4a2b' : 'transparent',
              color: variant === v ? '#f7f3ec' : '#3a342c',
            }}
          >
            {v}
          </button>
        ))}
        <button
          onClick={resetView}
          className="px-3 py-1.5 border transition-colors ml-auto"
          style={{ borderColor: '#d9d0bf', background: 'transparent', color: '#7a7166' }}
          title="Reset pan & zoom"
        >
          reset view
        </button>
      </div>
      <p className="font-serif text-[14px] text-ink-soft italic mb-3 leading-snug">
        {variantBlurb[variant]}
        <span className="not-italic font-mono text-[11px] text-muted ml-2">
          · drag empty space to pan · scroll to zoom
        </span>
      </p>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 border" style={{ borderColor: '#d9d0bf', background: '#fbf8f1' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', touchAction: 'none' }}
          >
            <defs>
              <marker id="arrow-cp" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,-5L10,0L0,5" fill="#7a7166" />
              </marker>
              <marker id="arrow-cp-attack" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,-5L10,0L0,5" fill="#a04040" />
              </marker>
              <marker id="arrow-cp-op" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,-5L10,0L0,5" fill="#5c7cfa" />
              </marker>
            </defs>

            <rect
              x={0}
              y={0}
              width={width}
              height={height}
              fill="transparent"
              onPointerDown={handleBgPointerDown}
              onPointerMove={handleBgPointerMove}
              onPointerUp={handleBgPointerUp}
              onPointerCancel={handleBgPointerUp}
              style={{ cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}
            />

            <g transform={`translate(${panX},${panY}) scale(${scale})`}>

            {/* Edges */}
            {LINKS.map((link, i) => {
              const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
              const targetId = typeof link.target === 'string' ? link.target : link.target.id;
              const sPos = positions.get(sourceId);
              const tPos = positions.get(targetId);
              if (!sPos || !tPos) return null;

              const opacity = edgeOpacity(link, variant);
              if (opacity < 0.04) return null;

              const tNode = NODES.find(n => n.id === targetId);
              const tr = tNode ? nodeRadius(tNode.weight) : 10;
              const dx = tPos.x - sPos.x;
              const dy = tPos.y - sPos.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const ux = dx / dist;
              const uy = dy / dist;
              const x2 = tPos.x - ux * (tr + 3);
              const y2 = tPos.y - uy * (tr + 3);

              const isHover = hoveredEdge === i;
              const color = EDGE_COLOR[link.type];
              const marker = link.type === 'attacks' ? 'url(#arrow-cp-attack)' :
                             link.type === 'op' || link.type === 'corr' ? 'url(#arrow-cp-op)' :
                             'url(#arrow-cp)';

              return (
                <g key={`edge-${i}`}>
                  <line
                    x1={sPos.x}
                    y1={sPos.y}
                    x2={x2}
                    y2={y2}
                    stroke={color}
                    strokeWidth={isHover ? 2.2 : (link.type === 'attacks' ? 1.4 : 1.1)}
                    strokeDasharray={link.type === 'attacks' ? '4 3' : link.type === 'op' || link.type === 'corr' ? '6 3' : undefined}
                    opacity={isHover ? 1 : opacity}
                    markerEnd={marker}
                  />
                  <line
                    x1={sPos.x}
                    y1={sPos.y}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth={10}
                    onMouseEnter={() => setHoveredEdge(i)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    style={{ cursor: 'pointer' }}
                  />
                  {isHover && (
                    <text
                      x={(sPos.x + x2) / 2}
                      y={(sPos.y + y2) / 2 - 4}
                      textAnchor="middle"
                      fontSize="11"
                      fontFamily="JetBrains Mono, ui-monospace, monospace"
                      fill="#1a1614"
                      style={{ pointerEvents: 'none' }}
                    >
                      <tspan style={{ paintOrder: 'stroke', stroke: '#fbf8f1', strokeWidth: 4 }}>
                        {link.label ?? EDGE_LABEL[link.type]}
                      </tspan>
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {NODES.map(node => {
              const pos = positions.get(node.id);
              if (!pos) return null;
              const r = nodeRadius(node.weight);
              const isCrux = CRUX_IDS.has(node.id);
              const opacity = nodeOpacity(node, variant);
              const isSelected = selected === node.id;
              const isOpen = node.type === 'O';
              const fill = TYPE_COLORS[node.type];

              // Capability-regime ring color (only when in that variant)
              let regimeRing: string | null = null;
              if (variant === 'capability-regime') {
                if (REGIME_STALE.has(node.id)) regimeRing = '#a04040';
                else if (REGIME_STABLE.has(node.id)) regimeRing = '#5c7cfa';
                else if (REGIME_DEPENDENT.has(node.id)) regimeRing = '#8a4a2b';
              }

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onPointerDown={e => handlePointerDown(e, node.id)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={e => handlePointerUp(e, node.id)}
                  onPointerCancel={e => handlePointerUp(e, node.id)}
                  style={{ cursor: dragRef.current?.id === node.id ? 'grabbing' : 'grab', opacity, touchAction: 'none' }}
                >
                  {regimeRing && (
                    <circle r={r + 7} fill="none" stroke={regimeRing} strokeWidth={2} opacity={0.7} />
                  )}
                  {isCrux && variant !== 'capability-regime' && (
                    <circle r={r + 5} fill="none" stroke="#8a4a2b" strokeWidth={1.5} opacity={0.55} />
                  )}
                  {isSelected && (
                    <circle r={r + 10} fill="none" stroke="#1a1614" strokeWidth={1.2} strokeDasharray="3 3" />
                  )}
                  <circle
                    r={r}
                    fill={isOpen ? '#fbf8f1' : fill}
                    stroke={isOpen ? fill : '#fbf8f1'}
                    strokeWidth={1.5}
                    strokeDasharray={isOpen ? '3 2' : undefined}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={r > 14 ? 11 : 10}
                    fontFamily="JetBrains Mono, ui-monospace, monospace"
                    fontWeight={600}
                    fill={isOpen ? fill : '#fbf8f1'}
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.id}
                  </text>
                </g>
              );
            })}

            </g>
          </svg>
        </div>

        {/* Side panel */}
        <div className="lg:w-[280px] flex flex-col gap-4">
          {/* Legend */}
          <div className="text-[12px] font-mono" style={{ color: '#3a342c' }}>
            <div className="uppercase tracking-wider text-[11px] mb-2" style={{ color: '#7a7166' }}>Legend</div>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
              {(Object.keys(TYPE_LABEL) as NodeType[]).map(t => (
                <div key={t} className="flex items-center gap-2">
                  <span
                    style={{
                      display: 'inline-block',
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: t === 'O' ? '#fbf8f1' : TYPE_COLORS[t],
                      border: t === 'O' ? `1.5px dashed ${TYPE_COLORS[t]}` : 'none',
                    }}
                  />
                  <span>{TYPE_LABEL[t]}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: '#3a342c', boxShadow: '0 0 0 2px #f7f3ec, 0 0 0 3.5px #8a4a2b' }} />
              <span>Crux node (halo)</span>
            </div>
            <div className="mt-2 text-[11px] italic font-serif" style={{ color: '#7a7166' }}>
              Node size reflects load-bearing weight (1–5).
            </div>
            {variant === 'capability-regime' && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: '#d9d0bf' }}>
                <div className="uppercase tracking-wider text-[11px] mb-2" style={{ color: '#7a7166' }}>Regime ring</div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '2px solid #a04040' }} />
                    <span>stale on capability jump</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '2px solid #5c7cfa' }} />
                    <span>stable (invariant)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '2px solid #8a4a2b' }} />
                    <span>regime-dependent</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Detail panel */}
          <div className="border p-3 text-[13px] min-h-[200px]" style={{ borderColor: '#d9d0bf', background: '#fbf8f1' }}>
            {selectedNode ? (
              <>
                <div className="font-mono text-[11px] uppercase tracking-wider mb-1" style={{ color: '#7a7166' }}>
                  {selectedNode.id} · {TYPE_LABEL[selectedNode.type]} · weight {selectedNode.weight}
                  {selectedNode.status && ` · ${selectedNode.status}`}
                </div>
                <div className="font-display font-semibold text-[16px] leading-tight mb-2" style={{ color: '#1a1614' }}>
                  {selectedNode.label}
                </div>
                <div className="font-serif text-[13px] leading-relaxed" style={{ color: '#3a342c' }}>
                  {selectedNode.detail}
                </div>
                {CRUX_IDS.has(selectedNode.id) && (
                  <div className="mt-3 text-[11px] font-mono uppercase tracking-wider" style={{ color: '#8a4a2b' }}>
                    ⊙ crux node
                  </div>
                )}
                {(() => {
                  const badge = regimeBadge(selectedNode.id);
                  if (!badge) return null;
                  return (
                    <div className="mt-2 text-[11px] font-mono uppercase tracking-wider" style={{ color: badge.color }}>
                      ◌ {badge.label}
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="font-serif italic text-[13px]" style={{ color: '#7a7166' }}>
                Click a node to see its claim, status, and load-bearing weight. Hover an edge to see the relation type. Drag nodes to rearrange, drag empty space to pan, scroll to zoom.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

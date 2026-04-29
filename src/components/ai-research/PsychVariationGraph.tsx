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

type NodeType = 'A' | 'M' | 'E' | 'L' | 'G' | 'S' | 'O' | 'D';
type EdgeType = 'dep' | 'imp' | 'sup' | 'conf' | 'mod' | 'dev' | 'corr' | 'attacks';
type Variant = 'full' | 'vulnerability' | 'flow' | 'minimal' | 'politicization';

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
  { id: 'A1', type: 'A', weight: 5, label: 'Twin method valid', detail: 'EEA approximately holds; SNP-h² convergence supports.', status: '✓' },
  { id: 'A2', type: 'A', weight: 5, label: 'GWAS signal real', detail: 'Reflects genetic effects, not just stratification or AM artifact.', status: '✓' },
  { id: 'A3', type: 'A', weight: 5, label: 'g exists', detail: 'Positive manifold across cognitive tests is among psychology\'s most replicated findings.', status: '✓' },
  { id: 'A4', type: 'A', weight: 3, label: 'Findings apply to the population sampled', detail: 'A heritability number applies to the group it was estimated in, not to individuals or other populations. Distinct from L1 (which is the algebraic form): A4 is about scope of claim, L1 is about mathematical form.', status: '✓' },
  { id: 'A6', type: 'A', weight: 3, label: 'Variation is dimensional', detail: 'Most psychological variation is continuous, not taxonic. Severe psychiatric tail partly violates.', status: '~' },

  // Methodological prerequisites
  { id: 'M3', type: 'M', weight: 5, label: 'GWAS at scale (≥100k–1M)', detail: 'Hyper-polygenic architecture only detectable at very large N.', status: '✓' },
  { id: 'M4', type: 'M', weight: 5, label: 'Within-family designs', detail: 'Sibling FE, MZ-discordant, parent-offspring trios. Control between-family confounds. Howe et al. 2022 extended within-sibship GWAS to 178k siblings × 25 phenotypes — within-sibship estimates were systematically smaller than population estimates for height, EA, cognitive ability, depressive symptoms, smoking. Now mature beyond just educational attainment.', status: '✓' },
  { id: 'M9', type: 'M', weight: 4, label: 'Whole-genome sequencing', detail: 'Captures rare variants. Wainschtein 2022 closed missing-h² gap for height. Wainschtein et al. 2025 (Nature) extended this: WGS in ~500k UK Biobank captures ~88% of pedigree-based narrow-sense heritability across many traits (20% rare + 68% common). The "missing heritability" problem is now substantially resolved for many phenotypes.', status: '✓' },

  // Empirical claims
  { id: 'E1', type: 'E', weight: 5, label: 'Mean trait h² ≈ 0.49', detail: 'Polderman 2015 meta-analysis, 17,804 traits, 14.5M twin pairs.', status: '✓' },
  { id: 'E2', type: 'E', weight: 5, label: 'C ≈ 0 for adult personality', detail: 'Shared family environment effectively zero by adulthood. Exceptions: education, religiosity, politics.', status: '✓' },
  { id: 'E3', type: 'E', weight: 4, label: 'Wilson Effect', detail: 'IQ h² rises from ~0.20 (age 5) to ~0.80 (adulthood); shared-env drops to ~0.', status: '✓' },
  { id: 'E4', type: 'E', weight: 5, label: 'Hyper-polygenic architecture', detail: 'Thousands of small-effect variants per trait. Turkheimer\'s 4th Law.', status: '✓' },
  { id: 'E5', type: 'E', weight: 4, label: 'Candidate genes failed', detail: '5-HTTLPR×stress and similar findings did not replicate at scale.', status: '✗' },
  { id: 'E6', type: 'E', weight: 5, label: 'Within-family PGS ≈ ½ population', detail: 'Genetic nurture: ~half of population PGS prediction is environmentally mediated by similar parents.', status: '✓' },
  { id: 'E7', type: 'E', weight: 5, label: 'Cross-trait AM inflates rg', detail: 'Border 2022: xAM explains R²=74% of variance in genetic correlation estimates.', status: '✓' },
  { id: 'E8', type: 'E', weight: 4, label: 'Lead → IQ', detail: 'Blood lead 1-10 µg/dL → −6.2 IQ points. Lanphear 2005.', status: '✓' },
  { id: 'E9', type: 'E', weight: 4, label: 'Schooling → IQ (~3.4 pts/yr)', detail: 'Ritchie & Tucker-Drob 2018, 142 effect sizes, durable into old age.', status: '✓' },
  { id: 'E10', type: 'E', weight: 4, label: 'Multivariate sex Δ: D ≈ 2.71', detail: 'Del Giudice 2012; ~10% personality overlap. Method-sensitive.', status: '~' },
  { id: 'E11', type: 'E', weight: 4, label: 'People-things Δ: d ≈ 0.93', detail: 'Su 2009. Largest documented sex difference in psychology.', status: '✓' },
  { id: 'E14', type: 'E', weight: 4, label: 'Gender Equality Paradox', detail: 'Sex differences in personality, preferences, depression, STEM larger in egalitarian/wealthy countries. Herlitz et al. 2025 systematic review (54 articles, 27 meta-analyses) confirmed the pattern across personality, verbal abilities, episodic memory, and negative emotions — pattern replication has strengthened. Mechanism still contested (innate-expression vs reference-group artifact vs wealth confound).', status: '~' },
  { id: 'E15', type: 'E', weight: 4, label: 'Psych disorders heritable + polygenic', detail: 'h² 0.35–0.85; SNP-h² 0.09–0.24; SCZ has 287 loci.', status: '✓' },
  { id: 'E16', type: 'E', weight: 4, label: 'Cross-disorder rg', detail: 'Substantial genetic correlations across psychiatric disorders. Magnitude post-AM correction is open.', status: '~' },
  { id: 'E17', type: 'E', weight: 3, label: 'p factor', detail: 'General psychopathology factor analogous to g. Statistical: ✓; interpretation: contested.', status: '~' },
  { id: 'E18', type: 'E', weight: 4, label: 'Positive manifold', detail: 'Every cognitive test correlates positively with every other. Spearman 1904, replicated countless times.', status: '✓' },
  { id: 'E22', type: 'E', weight: 4, label: 'Within-pop ≠ between-pop', detail: 'h² within a population gives no info about between-pop mean differences. Lewontin\'s logical point.', status: '✓' },
  { id: 'E23', type: 'E', weight: 4, label: 'PGS portability decays continuously', detail: 'Ding et al. 2023 (Nature): Pearson r = −0.95 between genetic distance and PGS accuracy across 84 traits. Reframes the older "discrete ancestry-group drop" picture (Martin 2019; Mostafavi 2020) — the decay is continuous along genetic distance from training population, not a step function across continental ancestries.', status: '✓' },
  { id: 'E25', type: 'E', weight: 2, label: 'Scarr-Rowe weakening further', detail: 'SES × heritability interaction (more genetic expression in higher-SES). Already failed to replicate outside US (Tucker-Drob & Bates 2016). Ghirardi et al. 2024 (Netherlands Twin Register) found 39/42 PGI×SES interactions in education NEGATIVE (compensatory direction); only 1 marginal positive. Picture in 2026: Scarr-Rowe is failing; the "compensatory hypothesis" (more genetic expression in low-SES) is the better-supported pattern for education.', status: '✗' },
  { id: 'E29', type: 'E', weight: 4, label: 'Big Five h² 0.40–0.60', detail: 'Cross-cultural replication for E/A/C; full Big Five in Indo-European; Tsimane qualifier.', status: '~' },
  { id: 'E30', type: 'E', weight: 4, label: 'Cumulative continuity', detail: 'Rank-order personality stability rises from ~0.31 in childhood to ~0.74 by midlife.', status: '✓' },

  // Logical necessities
  { id: 'L1', type: 'L', weight: 5, label: 'h² is a variance ratio', detail: 'Definitional; cannot partition individual phenotypes. Misinterpretation is the most common public error.', status: '✓' },
  { id: 'L4', type: 'L', weight: 5, label: 'Lewontin firewall', detail: 'Within-pop h² provides ZERO information about between-pop mean differences. Logical, not empirical — cannot be falsified, only ignored.', status: '✓' },

  // Mechanisms
  { id: 'G1', type: 'G', weight: 4, label: 'Active rGE / niche-picking', detail: 'People select environments matching genetic propensities. Drives Wilson Effect amplification.', status: '✓' },
  { id: 'G2', type: 'G', weight: 5, label: 'Passive rGE / genetic nurture', detail: 'Parents transmit genes AND correlated environments. Reframes ~50% of "genetic" effect as environmental (Wang 2021 / Isungset 2022 confirm). Nivard et al. 2024 found indirect genetic effects extend BEYOND the nuclear family — dynastic / extended-family / community processes contribute, so the "parents transmit gene + correlated environment" framing actually understates the spread.', status: '✓' },
  { id: 'G5', type: 'G', weight: 4, label: 'AM → LD induction', detail: 'Assortative mating creates linkage among causal variants → inflates h² and PGS.', status: '✓' },
  { id: 'G6', type: 'G', weight: 5, label: 'Cross-trait AM → spurious rg', detail: 'xAM creates genetic correlations between phenotypes with distinct genetic bases. Confounds p-factor / shared-biology stories.', status: '✓' },
  { id: 'G7', type: 'G', weight: 4, label: 'Stochastic developmental noise', detail: 'Dominant source of non-shared environment (~50% of personality variance). Not yet mechanistically characterized.', status: '~' },

  // Synthesis
  { id: 'S1', type: 'S', weight: 5, label: 'Coupled developmental system', detail: '"Genes vs environment" is the wrong frame. Genome × rGE × AM × few large environmental insults × stochastic noise × culture × developmental unfolding.', status: '✓' },
  { id: 'S2', type: 'S', weight: 5, label: 'h² gradient by method', detail: 'Twin h² ≥ SNP h² ≥ within-family h². Gaps decompose into AM, rGE, rare-variant components.', status: '✓' },
  { id: 'S5', type: 'S', weight: 4, label: 'CHC ↔ HiTOP, g ↔ p', detail: 'Two parallel hierarchies (cognition / psychopathology) connected at top by inverse g↔p genetic correlation.', status: '~' },
  { id: 'S6', type: 'S', weight: 4, label: 'Developmental cascade', detail: 'Temperament → personality → outcomes. h² ↑, shared-env ↓ across lifespan.', status: '✓' },

  // Open
  { id: 'O1', type: 'O', weight: 5, label: 'PGS interpretation', detail: 'Plomin "causal genetic" vs Turkheimer "weak explanation". Both compatible with current data. Determines what PGS *means*.', status: '?' },
  { id: 'O3', type: 'O', weight: 4, label: 'GEP mechanism', detail: 'Innate-expression release vs reference-group artifact vs wealth confound. Pattern robust; cause unsettled.', status: '?' },
  { id: 'O4', type: 'O', weight: 5, label: 'Between-pop genetics', detail: 'Currently scientifically UNANSWERABLE. PGS portability too poor; cross-ancestry GWAS at scale don\'t exist. Honest position: unresolved, not settled in either direction.', status: '?' },
  { id: 'O7', type: 'O', weight: 5, label: 'AM-correction magnitude', detail: 'Share of cross-disorder rg matrix that survives AM correction. Active research. Ma, Wang, Border et al. 2024 (Am J Hum Genet) introduced LAVA-Knock — a local-genetic-correlation method that reduces xAM-induced bias across 630 trait pairs. Methods to give the answer are now emerging, not just to flag the problem. Field-wide answer likely in 2-3 years.', status: '?' },

  // Distortion
  { id: 'D1', type: 'D', weight: 4, label: 'Blank-slate distortion', detail: 'Targets A1, E1, E10–E14. Move: dismiss twin studies, oversell transgenerational epigenetics, minimize sex differences via univariate-only framing.' },
  { id: 'D2', type: 'D', weight: 4, label: 'Hereditarian distortion', detail: 'Targets L4, E22, E23, O4. Move: ignore Lewontin, treat g-loadedness of gaps as evidence of genetic etiology, ignore PGS portability collapse.' },
  { id: 'D3', type: 'D', weight: 3, label: '"Gender similarities" distortion', detail: 'Targets E10, E11, E14. Move: cite math d=0.05 selectively, obscure D=2.71 multivariate, minimize d=0.93 interest gap.' },
  { id: 'D4', type: 'D', weight: 3, label: 'Pop-evpsych distortion', detail: 'Targets A6, L7, E10–E14. Move: extrapolate small ds to categorical claims, treat dimensional differences as taxonic.' },
];

const LINKS: GraphLink[] = [
  // Foundation → method
  { source: 'A1', target: 'M3', type: 'dep' },
  { source: 'A1', target: 'M4', type: 'dep' },
  { source: 'A2', target: 'M3', type: 'dep' },
  { source: 'A2', target: 'M4', type: 'dep' },
  { source: 'A2', target: 'M9', type: 'dep' },

  // Method → empirical
  { source: 'M3', target: 'E4', type: 'sup' },
  { source: 'M3', target: 'E15', type: 'sup' },
  { source: 'M4', target: 'E6', type: 'sup' },
  { source: 'M4', target: 'E7', type: 'sup' },
  { source: 'M9', target: 'E1', type: 'corr', label: 'closes missing-h² gap' },

  // A1 directly supports the heritability findings.
  // (We do NOT add A3 → E18: the empirical pattern E18 supports the assumption A3,
  //  not the other way around. See E18 → A3 below.)
  { source: 'A1', target: 'E1', type: 'sup' },
  { source: 'A1', target: 'E2', type: 'sup' },
  { source: 'A1', target: 'E3', type: 'sup' },
  { source: 'A1', target: 'E25', type: 'sup' },
  { source: 'A1', target: 'E29', type: 'sup' },

  // Mechanisms → empirical patterns
  { source: 'G1', target: 'E3', type: 'sup', label: 'niche-picking drives Wilson' },
  { source: 'G2', target: 'E6', type: 'sup' },
  { source: 'G5', target: 'E1', type: 'conf', label: 'AM inflates h²' },
  { source: 'G6', target: 'E16', type: 'conf', label: 'xAM → spurious rg' },
  { source: 'G6', target: 'E17', type: 'conf' },

  // Empirical → assumption: positive manifold IS the empirical evidence for g
  { source: 'E18', target: 'A3', type: 'sup' },
  // Candidate-gene collapse is consistent with hyper-polygenic architecture but does not strictly imply it.
  { source: 'E5', target: 'E4', type: 'sup', label: 'absence of large hits ↔ polygenic' },

  // Empirical → synthesis
  { source: 'E1', target: 'S1', type: 'sup' },
  { source: 'E2', target: 'S1', type: 'sup' },
  { source: 'E4', target: 'S1', type: 'sup' },
  { source: 'E6', target: 'S1', type: 'sup' },
  { source: 'E7', target: 'S1', type: 'sup' },
  { source: 'E8', target: 'S1', type: 'sup' },
  { source: 'E9', target: 'S1', type: 'sup' },
  { source: 'E1', target: 'S2', type: 'sup' },
  { source: 'E6', target: 'S2', type: 'sup' },
  { source: 'E15', target: 'S5', type: 'sup' },
  { source: 'E16', target: 'S5', type: 'sup' },
  { source: 'E17', target: 'S5', type: 'sup' },
  { source: 'E18', target: 'S5', type: 'sup' },
  { source: 'E3', target: 'S6', type: 'sup' },
  { source: 'E30', target: 'S6', type: 'sup' },
  { source: 'E29', target: 'S6', type: 'sup' },

  // Logical guards. L1 and L4 do not change the magnitude of E nodes (so 'mod' is wrong);
  // they constrain how downstream claims can be interpreted, which we encode as 'imp'
  // with an explicit label.
  { source: 'L1', target: 'E1', type: 'imp', label: 'constrains interpretation' },
  { source: 'L4', target: 'E22', type: 'imp', label: 'E22 is the applied form of L4' },
  { source: 'L4', target: 'O4', type: 'imp', label: 'makes O4 currently unanswerable' },
  { source: 'A6', target: 'S5', type: 'imp', label: 'dimensional view shapes hierarchy' },

  // Open questions sit downstream of crux nodes
  { source: 'E6', target: 'O1', type: 'imp', label: 'PGS interpretation' },
  { source: 'E14', target: 'O3', type: 'imp' },
  { source: 'E22', target: 'O4', type: 'imp' },
  { source: 'E23', target: 'O4', type: 'imp' },
  { source: 'E7', target: 'O7', type: 'imp' },
  { source: 'G6', target: 'O7', type: 'imp' },

  // Methodological corrections
  { source: 'M4', target: 'E1', type: 'corr', label: 'within-family halves estimate' },

  // Distortion attacks
  { source: 'D1', target: 'A1', type: 'attacks' },
  { source: 'D1', target: 'E1', type: 'attacks' },
  { source: 'D1', target: 'E10', type: 'attacks' },
  { source: 'D1', target: 'E11', type: 'attacks' },
  { source: 'D1', target: 'E14', type: 'attacks' },
  { source: 'D2', target: 'L4', type: 'attacks' },
  { source: 'D2', target: 'E22', type: 'attacks' },
  { source: 'D2', target: 'E23', type: 'attacks' },
  { source: 'D2', target: 'O4', type: 'attacks' },
  { source: 'D3', target: 'E10', type: 'attacks' },
  { source: 'D3', target: 'E11', type: 'attacks' },
  { source: 'D3', target: 'E14', type: 'attacks' },
  { source: 'D4', target: 'A6', type: 'attacks' },
  { source: 'D4', target: 'E10', type: 'attacks' },
];

const TYPE_COLORS: Record<NodeType, string> = {
  A: '#1a1614',  // ink — foundational assumptions
  M: '#7a7166',  // muted — methodological
  E: '#3a342c',  // ink-soft — empirical
  L: '#5a4a3a',  // tan-ish — logical
  G: '#8a4a2b',  // accent — generating mechanism
  S: '#c98a6e',  // accent-soft — synthesis
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
  O: 'Open',
  D: 'Distortion',
};

const EDGE_COLOR: Record<EdgeType, string> = {
  dep: '#7a7166',
  imp: '#7a7166',
  sup: '#bcb0a0',
  conf: '#a04040',
  mod: '#7a7166',
  dev: '#7a7166',
  corr: '#5c7cfa',
  attacks: '#a04040',
};

const EDGE_LABEL: Record<EdgeType, string> = {
  dep: 'depends on',
  imp: 'implies',
  sup: 'supports',
  conf: 'confounds',
  mod: 'moderates',
  dev: 'develops into',
  corr: 'corrects',
  attacks: 'attacks',
};

const MINIMAL_SET = new Set(['E1', 'E4', 'E6', 'E7', 'E8', 'L4', 'G7', 'A6']);
const CRUX_IDS = new Set(['A1', 'A2', 'A3', 'G2', 'G6', 'L4']);

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
    // Highlight A → M → E → S cascade plus G → E mechanism edges
    if (node.type === 'A' || node.type === 'M' || node.type === 'E' || node.type === 'S' || node.type === 'G') return 1;
    return 0.2;
  }
  if (variant === 'minimal') {
    return MINIMAL_SET.has(node.id) ? 1 : 0.1;
  }
  if (variant === 'politicization') {
    if (node.type === 'D') return 1;
    // light up the targets of distortions
    const targeted = new Set<string>();
    for (const link of LINKS) {
      if (link.type === 'attacks') {
        const t = typeof link.target === 'string' ? link.target : link.target.id;
        targeted.add(t);
      }
    }
    return targeted.has(node.id) ? 0.95 : 0.12;
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
  if (variant === 'politicization') {
    return link.type === 'attacks' ? 0.85 : 0.05;
  }
  return 0.4;
}

interface Pos { x: number; y: number; }

export default function PsychVariationGraph() {
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
  const height = 640;

  // Run the simulation once on mount.
  useEffect(() => {
    const nodesCopy: GraphNode[] = NODES.map(n => ({ ...n }));
    const linksCopy: GraphLink[] = LINKS.map(l => ({ ...l }));

    const sim = forceSimulation<GraphNode>(nodesCopy)
      .force('link', forceLink<GraphNode, GraphLink>(linksCopy)
        .id(d => d.id)
        .distance(l => {
          const w = ((l.source as GraphNode).weight + (l.target as GraphNode).weight) / 2;
          return 80 + (5 - w) * 8;
        })
        .strength(0.4))
      .force('charge', forceManyBody<GraphNode>().strength(-380))
      .force('collide', forceCollide<GraphNode>(d => nodeRadius(d.weight) + 6))
      .force('center', forceCenter(width / 2, height / 2))
      .alphaDecay(0.03)
      .stop();

    // Run for fixed ticks for deterministic layout.
    for (let i = 0; i < 400; i++) sim.tick();

    const map = new Map<string, Pos>();
    nodesCopy.forEach(n => {
      if (n.x !== undefined && n.y !== undefined) map.set(n.id, { x: n.x, y: n.y });
    });
    setPositions(map);
    simRef.current = sim;

    return () => { sim.stop(); };
  }, []);

  // Convert pointer screen coordinates into the SVG's viewBox coordinate system.
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

  // Convert pointer to graph coordinates (the inner <g>'s coord system before pan/scale).
  function pointerToGraph(e: { clientX: number; clientY: number }): Pos | null {
    const svg = pointerToSvg(e);
    if (!svg) return null;
    return { x: (svg.x - panX) / scale, y: (svg.y - panY) / scale };
  }

  // Pointer-capture drag on each node. The `<g>` captures the pointer on down,
  // then receives all subsequent move/up events even if the cursor leaves the
  // shape — the standard fix for "drag stops working halfway."
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
    // Treat as a click (toggle selection) only if the user did not actually drag.
    if (drag && !drag.moved) {
      setSelected(prev => (prev === id ? null : id));
    }
  }

  // Pan: pointer-down on the background rect translates the inner <g>.
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

  // Wheel: zoom around the cursor so its graph point stays fixed.
  // React's onWheel is passive by default in React 17+, which means preventDefault()
  // inside the synthetic handler is ignored and the page scrolls. We attach the
  // listener imperatively with { passive: false } so we can stop the page scroll.
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
    full: 'All ~50 nodes and their dependencies. Click a node for detail; drag to rearrange.',
    vulnerability: 'The 6 crux nodes plus weight-5 load-bearing nodes — where collapse propagates farthest if any single one flips.',
    flow: 'How causation propagates: foundational assumptions → methods → empirical claims → synthesis, with mechanism edges (G nodes) showing how patterns are generated.',
    minimal: 'The 8-node minimal claim set that yields the integrated picture. Removing any one breaks the qualitative shape.',
    politicization: 'Distortion vectors (D nodes) and the empirical/logical claims they target. All four directions select against the same evidence base — the integrated picture requires holding it all at once.',
  };

  return (
    <div className="not-prose font-sans text-ink" style={{ background: '#f7f3ec' }}>
      {/* Variant toggle + view reset */}
      <div className="flex flex-wrap gap-2 mb-3 text-[12px] font-mono uppercase tracking-wider items-center">
        {(['full', 'vulnerability', 'flow', 'minimal', 'politicization'] as Variant[]).map(v => (
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
              <marker id="arrow" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,-5L10,0L0,5" fill="#7a7166" />
              </marker>
              <marker id="arrow-attack" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,-5L10,0L0,5" fill="#a04040" />
              </marker>
              <marker id="arrow-corr" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,-5L10,0L0,5" fill="#5c7cfa" />
              </marker>
            </defs>

            {/* Pan capture surface — sits behind nodes/edges in render order so node clicks still hit nodes. */}
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

              // Trim line so arrowhead lands on node edge.
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
              const marker = link.type === 'attacks' ? 'url(#arrow-attack)' :
                             link.type === 'corr' ? 'url(#arrow-corr)' :
                             'url(#arrow)';

              return (
                <g key={`edge-${i}`}>
                  <line
                    x1={sPos.x}
                    y1={sPos.y}
                    x2={x2}
                    y2={y2}
                    stroke={color}
                    strokeWidth={isHover ? 2.2 : (link.type === 'attacks' ? 1.4 : 1.1)}
                    strokeDasharray={link.type === 'attacks' ? '4 3' : link.type === 'corr' ? '6 3' : undefined}
                    opacity={isHover ? 1 : opacity}
                    markerEnd={marker}
                  />
                  {/* Wider invisible hit area for hover */}
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
                  {isCrux && (
                    <circle r={r + 5} fill="none" stroke="#8a4a2b" strokeWidth={1.5} opacity={0.55} />
                  )}
                  {isSelected && (
                    <circle r={r + 8} fill="none" stroke="#1a1614" strokeWidth={1.2} strokeDasharray="3 3" />
                  )}
                  <circle
                    r={r}
                    fill={isOpen ? '#fbf8f1' : fill}
                    stroke={isOpen ? fill : '#fbf8f1'}
                    strokeWidth={isOpen ? 1.5 : 1.5}
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

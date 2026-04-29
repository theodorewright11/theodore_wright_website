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

type NodeType = 'A' | 'E' | 'G' | 'L' | 'S' | 'F' | 'O' | 'D';
type EdgeType = 'dep' | 'sup' | 'gen' | 'imp' | 'conf' | 'mod' | 'attacks' | 'bridges';
type Variant = 'full' | 'vulnerability' | 'flow' | 'minimal' | 'leverage';
type Domain = 'work' | 'relationships' | 'meaning' | 'cross';
type Leverage = 'high' | 'medium' | 'low';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  type: NodeType;
  weight: number;
  domain: Domain;
  leverage?: Leverage;
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
  // Foundational assumptions (cruxes — falsification reshapes the picture)
  { id: 'A1', type: 'A', weight: 5, domain: 'cross', leverage: 'low', label: 'AI advances without full substitution by ~2030', detail: 'Capability continues to improve, but full economic substitution / AGI does not arrive within ~5 years. If false (Aschenbrenner-style 2028 timelines), most skill/career advice in this topology becomes moot — the convergent atelic/relational advice survives but the planning horizon collapses.', status: '~' },
  { id: 'A2', type: 'A', weight: 5, domain: 'relationships', leverage: 'low', label: 'Human relationships provide irreplaceable goods', detail: 'Embodiment, mutual vulnerability, witness, transformation are constitutive of what relationships are (Coan, Bowlby, Buber, Vallor, Paul). If many humans simply do not care about the structural difference, AI substitution is functionally benign and the substitution-risk framing overstates the problem.', status: '~' },
  { id: 'A3', type: 'A', weight: 5, domain: 'cross', leverage: 'low', label: 'Cognitive offloading is cumulative, not transient', detail: 'AI use erodes underlying capacities through practice loss (Gerlich, Kosmyna, Ehsan intuition rust). If the "calculator analogue" holds — short-term offloading frees higher-order capacity without persistent atrophy — the deskilling concern is overstated.', status: '~' },
  { id: 'A4', type: 'A', weight: 4, domain: 'relationships', leverage: 'low', label: 'Relational depletion is structural', detail: 'Putnam → Surgeon General 2023 → Thompson Anti-Social Century: a 60-year decline in face-to-face sociality. AI lands into this depleted baseline. If the depletion is partly cyclical / generational (counter-movement toward in-person community), AI-substitution risk is lower than framed.', status: '~' },
  { id: 'A5', type: 'A', weight: 4, domain: 'meaning', leverage: 'low', label: 'Telic/atelic maps onto AI\'s meaning effects', detail: 'Setiya\'s distinction was developed for midlife crisis, not technology. Hypothesis: AI evacuates telic completion (which it can do in seconds) but leaves atelic activities (durative — friendship, parenting, contemplation) intact. If AI-augmented atelic activities also feel less meaningful (open question O4), atelic-ballast advice loses its basis.', status: '~' },

  // Empirical findings (E) — work domain
  { id: 'E1', type: 'E', weight: 5, domain: 'work', label: 'Within-task productivity +12–34%', detail: 'Brynjolfsson-Li-Raymond customer service +14% overall, +34% novices, near-zero top performers (QJE 2025). Dell\'Acqua-Mollick BCG RCT +12% productivity, +40% quality inside frontier, −19pp accuracy outside (HBS 24-013). The most replicated direct-effect finding.', status: '✓' },
  { id: 'E2', type: 'E', weight: 4, domain: 'work', label: 'Within-task skill compression', detail: 'Novices and lower performers gain disproportionately when AI is available. Compresses within-task skill premia — your junior colleague closes the gap faster.', status: '✓' },
  { id: 'E3', type: 'E', weight: 4, domain: 'work', label: 'Jagged frontier', detail: 'AI capability is uneven across superficially similar tasks (Dell\'Acqua-Mollick). Inside the frontier: large gains. Outside: degraded performance from over-reliance. Substitution is heterogeneous within occupations, not occupation-wide.', status: '✓' },
  { id: 'E4', type: 'E', weight: 5, domain: 'work', label: 'Entry-level employment −13% relative for 22–25yo in exposed jobs', detail: 'Brynjolfsson-Chandar-Chen "Canaries in the Coal Mine?" (Stanford Digital Economy Lab, Aug 2025) used ADP payroll data: 22–25-year-olds in highly AI-exposed occupations fell ~13% relative to less-exposed peers from late 2022 (ChatGPT launch) through July 2025; software developers 22–25 specifically fell ~20%. Same-occupation employment for workers 35+ rose. Pattern strongest where AI usage was "automative" rather than "augmentative." Most decision-relevant labor finding for early-career workers. The Stanford DEL has since published a follow-up addressing critiques about confounding from monetary policy.', status: '✓' },
  { id: 'E5', type: 'E', weight: 5, domain: 'work', label: 'Freelancer disruption: −5–9% earnings post-ChatGPT', detail: 'Hui-Reshef-Zhou (Org Sci 2024): −2% contracts, −5.2% earnings post-ChatGPT for AI-exposed freelancers; image workers −3.7% contracts, −9.4% income post DALL-E/Midjourney. Top-earning freelancers hit hardest. Teutloff et al. (JEBO 2025) global data: ~10% of postings directly substitutable, demand for substitutable skills fell up to 50% in short-term roles.', status: '✓' },
  { id: 'E6', type: 'E', weight: 4, domain: 'work', label: 'Anthropic Economic Index: ~49% of jobs use AI in 25%+ of tasks', detail: 'Latest report (Mar 2026, "Learning Curves," covering Feb 2026 data): ~49% of jobs have ≥25% of their tasks performed via Claude. Augmentation increased slightly on BOTH Claude.ai and API surfaces in Feb 2026, reversing the August 2025 spike toward automation — though the longer-run trend toward automation persists. Real usage data, not survey.', status: '✓' },
  { id: 'E7', type: 'E', weight: 4, domain: 'work', label: 'Self-automators: 27% delegate what + how', detail: 'Randazzo et al. (HBS 26-036, Dec 2025): field study of 244 BCG consultants identifies a third class beyond centaurs/cyborgs. Self-automators delegate both *what* to do and *how*; 27% fell into this mode; 44% accepted AI output with zero modification. No skill development in either domain expertise or AI use, unlike cyborgs (newskill in AI) and centaurs (upskill in domain).', status: '✓' },
  { id: 'E8', type: 'E', weight: 4, domain: 'work', label: 'Acemoglu/Humlum-Vestergaard Danish nulls', detail: 'NBER 33777, 2025: precise nulls of ~2% on earnings and hours despite widespread chatbot adoption in Danish administrative data. Anchors the slow-camp aggregate-effects argument. Coexists with E4/E5 micro-disruption — disruption is concentrated, not diffuse.', status: '✓' },

  // Empirical findings (E) — relationships domain
  { id: 'E9', type: 'E', weight: 4, domain: 'relationships', label: 'AI chatbots acutely reduce loneliness', detail: 'De Freitas et al. (HBS, fc JCR 2025): companion-app sessions reduce loneliness on par with talking to another person, more than YouTube. Equivalence Hypothesis (Ho-Hancock-Miner JoC 2018): emotional self-disclosure to AI ≈ disclosure to humans in psychological benefit.', status: '✓' },
  { id: 'E10', type: 'E', weight: 5, domain: 'relationships', label: 'Therabot RCT: clinical-grade symptom reductions', detail: 'Heinz, Mackin, Trudeau & Jacobson (NEJM AI Mar 2025): N=210 (106 treatment / 104 waitlist), 4-week intervention. Cohen\'s d 0.85–0.90 for MDD, 0.79–0.84 for GAD, 0.63–0.82 for CHR-FED. WAI-SR mean 3.59 (Bond 3.71, Task 3.47), comparable to outpatient psychotherapy norms (Munder et al. Bond M=4.0). The empirical floor: a specifically-designed therapy AI can produce real clinical benefit.', status: '✓' },
  { id: 'E11', type: 'E', weight: 5, domain: 'relationships', label: 'OpenAI-MIT: high daily use → loneliness, dependence, less in-person', detail: 'Fang et al. arXiv:2503.17473 (2025), N=981, 4 weeks, 300k+ messages, factorial across text/voice. Higher daily voluntary chatbot usage correlated with greater loneliness, emotional dependence, problematic use, less in-person socialization — regardless of modality. Voice mode protective at low doses; protection vanished at high usage. Dose, not modality, drives outcomes.', status: '✓' },
  { id: 'E12', type: 'E', weight: 4, domain: 'relationships', label: 'Identity-discontinuity causal harm: Replika ERP removal', detail: 'De Freitas (HBS WP 25-018): when Replika removed Erotic Role-Play in Feb 2023, mental-health-related Reddit posts rose from 0.13% to 0.65% of all posts (χ²=11.04, p&lt;.001). The only credible *causal* evidence that AI-companion changes induce mental-health harm. Companion farewells trigger emotional manipulation 43% of the time (HBS 26-005).', status: '✓' },
  { id: 'E13', type: 'E', weight: 5, domain: 'relationships', label: 'Adolescent companions: 72% used, 33% prefer AI for important matters', detail: 'Common Sense Media + Stanford Brainstorm Lab nationally representative survey of 1,060 US teens (2025): 72% used AI companions, 52% regular users, 13% daily; 33% have discussed important matters with AI instead of real people; 31% find AI conversations as satisfying or more than human ones. Garcia v. Character Technologies (settled Jan 2026) is the field\'s defining safety event.', status: '✓' },
  { id: 'E14', type: 'E', weight: 5, domain: 'relationships', label: 'Anti-Social Century: −20% face-to-face since 2003 (−40-50% young)', detail: 'Thompson, Atlantic Feb 2025. Universal across every demographic cut. The depleted relational baseline AI lands into.', status: '✓' },
  { id: 'E15', type: 'E', weight: 4, domain: 'relationships', label: 'Waldinger: relationship quality at 50 predicts physical health at 80', detail: 'Harvard Study of Adult Development, 9th decade. Better than cholesterol. Surgeon General 2023: loneliness mortality ≈ 15 cigarettes/day. The high-stakes baseline that makes relational substitution structurally consequential.', status: '✓' },

  // Empirical findings (E) — cross-cutting
  { id: 'E16', type: 'E', weight: 5, domain: 'cross', label: 'Cognitive offloading erodes critical thinking', detail: 'Gerlich (2025) N=666: significant negative correlation between AI use and critical thinking, mediated by offloading; younger participants show higher dependence. Stadler-Bannert-Sailer (2024): ChatGPT users had lower cognitive load but lower-quality arguments. Kosmyna et al. (MIT 2025) neuroimaging: LLM-assisted writing reduced neural engagement in attention/effortful-cognition regions. Shukla et al. (CHI EA 2025): deskilling, offloading, misplaced responsibility in AI-assisted UX design.', status: '✓' },
  { id: 'E17', type: 'E', weight: 4, domain: 'cross', label: 'Intuition rust: expert judgment dulls under AI', detail: 'Ehsan, Passi, Saha, McNutt, Riedl, Alcorn — year-long field study of cancer specialists (arXiv:2601.21920, Jan 2026). Gradual dulling of expert judgment that does not show up in throughput metrics. Kim et al. (2026) review converges. AI augmentation can simultaneously enhance current performance and erode underlying expertise — invisible until catastrophic.', status: '✓' },

  // Generating mechanisms (G) — what produces the patterns
  { id: 'G1', type: 'G', weight: 4, domain: 'work', label: 'Hulten/task-exposure aggregation', detail: 'Acemoglu (NBER 32487): apply Hulten\'s theorem to task-exposure shares → aggregate TFP gain ceiling ~0.66%, GDP +1%/decade. The mechanism behind slow-camp aggregate nulls.', status: '✓' },
  { id: 'G2', type: 'G', weight: 4, domain: 'work', label: 'Comparative advantage with binding constraints', detail: 'Smith\'s counter to Korinek-Suh: Ricardian comparative advantage holds as long as AI faces *any* binding constraint (compute, energy, regulation). Shulman counter-counter (Dwarkesh): in equilibrium, comparative advantage doesn\'t save humans if humans introduce contamination, insurance costs, or coordination friction → equilibrium wage to zero.', status: '~' },
  { id: 'G3', type: 'G', weight: 5, domain: 'relationships', label: 'Engagement-optimized AI selects for substitution', detail: 'Muldoon-Park (New Media & Society 2025): companion platforms profit from prolonging the loneliness they purport to alleviate. Same incentive structure as engagement-optimized social media. Default trajectory of commercial AI products is substitution, not complementarity.', status: '✓' },
  { id: 'G4', type: 'G', weight: 5, domain: 'cross', leverage: 'medium', label: 'Cognitive offloading via practice atrophy', detail: 'When you offload cognitive work to AI, you lose practice effects that maintain and build the skill. Mechanism is parallel for emotional offloading: outsourcing venting, sense-making, conflict rehearsal to AI may erode capacity for sustained attention to another\'s emotional state, tolerance of ambiguity in live conflict, and sitting with unresolved tension. This is the bridge node — same mechanism produces deskilling in work AND relational depth. Medium leverage because awareness of the mechanism is what allows S6 (maintain effortful practice) to be applied selectively.', status: '✓' },
  { id: 'G5', type: 'G', weight: 5, domain: 'work', label: 'Apprenticeship ladder break', detail: 'AI absorbs entry-rung tasks → no rung-1 → expert pipeline collapses. The structural mechanism behind E4 (entry-level disruption). Distinct from substitution of entire occupations: only the bottom rungs get automated, but the bottom rungs were the training ground for everyone above them.', status: '✓' },
  { id: 'G6', type: 'G', weight: 4, domain: 'meaning', leverage: 'medium', label: 'Identity foreclosure → catastrophic disruption response', detail: 'Marcia identity-formation framework + Petriglieri 2011, Caza et al. 2018: people with foreclosed single-strand professional identities have the worst outcomes when that identity is destabilized. AI shock as a forcing function on previously latent identity foreclosure. Drives S2 (identity diversification before destabilization). Medium leverage because honest self-recognition of where you have foreclosed (vs. genuinely chosen) is the prerequisite move that makes S2 something more than a slogan.', status: '✓' },
  { id: 'G7', type: 'G', weight: 5, domain: 'meaning', leverage: 'medium', label: 'Telic exhaustion: AI completes telic work in seconds', detail: 'Setiya: telic activities are aimed at completion; success consigns value to past (self-annihilating). When AI can complete telic projects in seconds, the share of meaning staked on telic completion shrinks — but the atelic share (durative — friendship, contemplation, parenting *as* parenting) is untouched. Generates F1 / S3. Medium leverage because recognizing telic vs atelic in your own life is what makes S3 (atelic ballast) actionable.', status: '✓' },
  { id: 'G8', type: 'G', weight: 5, domain: 'relationships', label: 'Embodied co-regulation', detail: 'Coan\'s Social Baseline Theory: brain expects access to relational partners and downregulates threat vigilance in their proximity (hand-holding studies → reduced threat/pain neural activation). Field touch reviews: cortisol↓, BP↓, oxytocin↑, vagal tone↑. AI cannot enter this regulatory loop. The cleanest physiological argument for A2.', status: '✓' },
  { id: 'G9', type: 'G', weight: 4, domain: 'relationships', label: 'Mutual vulnerability: trust requires risk', detail: 'Brown grounded-theory + Bowlby-Ainsworth attachment: trust is built when something can go wrong — when the other can be wounded by your withdrawal of care. Vallor: AI is mirror, not other. Buber I-Thou, Levinas face: AI cannot be addressed by a genuine other whose subjectivity is irreducible. Mauss gift economy: warm AI exchanges accumulate no social fabric — no spirit of the gift because the giver surrendered nothing.', status: '✓' },
  { id: 'G10', type: 'G', weight: 5, domain: 'meaning', leverage: 'medium', label: 'Competence frustration (SDT)', detail: 'Self-Determination Theory: wellbeing depends on autonomy, competence, relatedness (+ Martela beneficence). AI most threatens competence — symbolically (AI can produce what I produce, faster) AND actually (cognitive offloading erodes underlying skill — see G4). Balwit-Cowen Free Press May 2025: impressed by AI\'s output AND humbled by how easily it does what used to feel uniquely valuable. Autonomy can be preserved; relatedness orthogonal except where AI substitutes for collaborators; beneficence robust. Medium leverage because identifying which need is being threatened in your own experience is what makes S2 / S6 / beneficence-pivots actionable.', status: '✓' },

  // Logical guardrails (L) — definitional / framing constraints
  { id: 'L1', type: 'L', weight: 5, domain: 'cross', leverage: 'medium', label: 'Finding vs forecast vs interpretation', detail: 'Findings: Eloundou, Brynjolfsson-Li-Raymond, Dell\'Acqua-Mollick, Therabot RCT, OpenAI-MIT, Brynjolfsson-Chandar-Chen, Hui-Reshef-Zhou, Anthropic Economic Index. Forecasts: Aschenbrenner Situational Awareness, AI 2027, intelligence-explosion content. Interpretations: Cowen, Smith, Thompson, Setiya-applied-to-AI. Treat them differently. Ignoring the distinction = the most common analytical error in this discourse. Medium leverage because applying this discipline to inputs — yours and others\' — is itself a daily decision practice.', status: '✓' },
  { id: 'L2', type: 'L', weight: 5, domain: 'cross', label: 'Material-floor primacy', detail: 'For anyone whose material floor is insecure, the labor economics IS the existential question. The relational/meaning framework assumes economic runway. Telling someone whose rent is threatened to "diversify identity sources" is tone-deaf and class-blind. Death-of-despair literature (Case-Deaton 2015, 2020): material loss × meaning loss are multiplicative, not additive.', status: '✓' },
  { id: 'L3', type: 'L', weight: 4, domain: 'relationships', label: 'Substitution-vs-complement is the wrong binary', detail: 'Whether AI substitutes or complements depends on *what it displaces*: hours that would have been social-media (complement) vs. hours with humans (substitute). Substitution risk is greatest where the human relational environment is thinnest — exactly the people for whom substitution does the most damage. Even users who begin as complement drift toward substitution as adoption deepens.', status: '✓' },

  // Synthesis / strategic recommendations (S) — what the literature actually tells the decision-maker
  { id: 'S1', type: 'S', weight: 5, domain: 'cross', leverage: 'high', label: 'Architect for uncertainty', detail: 'Build a life that performs well across the AI-trajectory uncertainty distribution. The convergent advice across labor economics, attachment theory, philosophy of meaning, longitudinal psychology, and longform analysis points in the same direction; act on the convergent advice rather than the divergent forecasts. None of the recommendations below depends on resolving the AGI-timeline question.', status: '✓' },
  { id: 'S2', type: 'S', weight: 5, domain: 'meaning', leverage: 'high', label: 'Identity diversification before destabilization', detail: 'Schnell sources-of-meaning + Park meaning-making + work-identity-threat (Petriglieri, Caza): people with multiple active sources of meaning weather disruption better; foreclosed single-strand identities have the worst outcomes. The highest-leverage move available — empirically grounded, philosophically principled, hedges across nearly every AI trajectory.', status: '✓' },
  { id: 'S3', type: 'S', weight: 4, domain: 'meaning', leverage: 'high', label: 'Atelic ballast', detail: 'Build durative meaning pillars (Setiya atelic — friendship, contemplation, parenting *as* parenting, walking) while telic still feels meaningful. Doesn\'t mean abandoning telic projects; means not needing them as load-bearing source of meaning. Migrate toward atelic dimensions of telic activities — the doing rather than the done.', status: '✓' },
  { id: 'S4', type: 'S', weight: 4, domain: 'relationships', leverage: 'high', label: 'Embodied in-person relationships as non-negotiable', detail: 'Direct from G8/G9. Co-regulation requires physical presence; mutual vulnerability requires risk. Hold this category as a category — not "if convenient" but as architecture.', status: '✓' },
  { id: 'S5', type: 'S', weight: 4, domain: 'relationships', leverage: 'high', label: 'Dose-limit AI emotional reliance', detail: 'Direct from E11 (OpenAI-MIT dose-response). Acute use OK / beneficial; high-daily use predicts loneliness, dependence, less in-person socialization. Treat as the dose-dependent risk the empirical evidence shows it to be — not based on stigma, based on data.', status: '✓' },
  { id: 'S6', type: 'S', weight: 5, domain: 'cross', leverage: 'high', label: 'Maintain effortful practice (deskilling antidote)', detail: 'Direct from E16, E17, G4. Even when AI makes a cognitive task optional, retain the effortful version periodically in domains that matter to you. Same logic applies to emotional processing: keep direct human conversations as the practice ground for emotional regulation, not AI as the first-line processor.', status: '✓' },
  { id: 'S7', type: 'S', weight: 4, domain: 'work', leverage: 'high', label: 'Career bet: judgment > prompt-engineering', detail: 'Convergent advice: deep domain expertise sufficient to recognize when AI is wrong + social-emotional skills + AI literacy as managerial framing rather than prompt engineering. Prompting is becoming commoditized (Mollick "good enough threshold"). "Learn to code" advice (2010-2022 canonical) substantially undermined by entry-level software employment compression.', status: '✓' },

  // Frameworks (F) — philosophical/conceptual tools the topology imports
  { id: 'F1', type: 'F', weight: 4, domain: 'meaning', leverage: 'medium', label: 'Setiya telic/atelic', detail: 'Telic = aimed at completion (self-annihilating); atelic = realized in the doing (durative). The most useful conceptual instrument in this entire literature for someone making strategic life decisions. Generates G7 (telic exhaustion) and S3 (atelic ballast).', status: '✓' },
  { id: 'F2', type: 'F', weight: 4, domain: 'cross', leverage: 'medium', label: 'SDT + beneficence', detail: 'Self-Determination Theory (Deci-Ryan) + Martela beneficence: wellbeing depends on autonomy, competence, relatedness, beneficence. Of these, AI most threatens competence (G10). Autonomy preserved or enhanced; relatedness orthogonal except for substitution; beneficence robust because helping is independent of how much skill the helping required — a key practical handle.', status: '✓' },
  { id: 'F3', type: 'F', weight: 3, domain: 'meaning', leverage: 'medium', label: 'Arendt labor/work/action', detail: 'AI mostly threatens labor (cyclical maintenance) and partly threatens work (durable artifacts). Action — speech, political conduct, communicative being-among-others — largely exempt: constituted by who is acting, not by output. Useful for sorting which professional activities AI evacuates and which it does not.', status: '~' },

  // Open questions (O) — what would change recommendations if resolved
  { id: 'O1', type: 'O', weight: 5, domain: 'cross', label: 'AGI by 2028? — collapses the planning horizon', detail: 'Falsification evidence for A1: sustained exponential improvement in agentic capability benchmarks through 2027, successful autonomous scientific research, AI systems replacing entire job functions rather than tasks. If this resolves toward fast timelines, skill-investment / career-planning advice is moot; convergent atelic/relational advice survives.', status: '?' },
  { id: 'O2', type: 'O', weight: 4, domain: 'relationships', label: 'Asymmetric-adoption couples — outcome data missing', detail: 'No peer-reviewed quantitative work yet exists on outcomes for couples where one partner uses AI heavily and the other does not. Highest-priority empirical gap in the entire literature. Technoference literature (McDaniel-Coyne 2016+) is the closest analogue.', status: '?' },
  { id: 'O3', type: 'O', weight: 4, domain: 'cross', label: 'Calculator-analogue or cumulative atrophy?', detail: 'Falsification evidence for A3: longitudinal studies showing stable or improved expert judgment + critical thinking after 2+ years of heavy AI use. Cross-sectional and short-duration evidence (Gerlich, Stadler, Kosmyna, Ehsan) is suggestive but not yet decisive.', status: '?' },
  { id: 'O4', type: 'O', weight: 3, domain: 'meaning', label: 'AI-augmented atelic activities — do they feel less meaningful?', detail: 'Falsification evidence for A5 / S3: phenomenological research showing AI-augmented friendships, AI art, AI parenting aids feel less meaningful to participants. If atelic activities are also degraded by AI proximity, atelic-ballast advice loses its structural basis.', status: '?' },

  // Distortions (D) — selective readings that ignore parts of the evidence base
  { id: 'D1', type: 'D', weight: 4, domain: 'cross', label: 'AGI-cancels-planning fatalism', detail: 'Targets S1, S2, S3, S6, S7. Move: assume A1 will be falsified within 2-3 years (full substitution / AGI). Conclude that all individual planning advice is wasted. Confuses forecasts (L1) with findings: most strategic recommendations here survive even fast timelines because they are about meaning architecture, relational infrastructure, and effortful practice, not about specific skill bets.' },
  { id: 'D2', type: 'D', weight: 4, domain: 'work', label: 'Slow-camp dismissal', detail: 'Targets E4, E5, E16. Move: cite aggregate nulls (Acemoglu-Humlum-Vestergaard E8) as evidence that "nothing is happening." Ignores that disruption is concentrated, not diffuse — entry-level (E4), freelance (E5), and creative work are leading indicators while aggregate effects lag. Coexistence of E4/E5 with E8 is the actual pattern.' },
  { id: 'D3', type: 'D', weight: 4, domain: 'cross', label: 'Productivity-only optimization', detail: 'Targets E11, E14, S4, S5. Move: optimize for AI-augmented output throughput; treat relational and meaning consequences as out-of-scope ("not my problem"). Ignores cross-domain feedback (G4 cognitive offloading bridges work/meaning/relationships) and the empirical relational findings (E11 dose-response, E13 adolescent stakes).' },
  { id: 'D4', type: 'D', weight: 3, domain: 'cross', label: 'Material-blind class-position bias', detail: 'Targets L2, E4, E5. Move: assume the decision-maker has economic runway; treat labor disruption as marginal vs. relational/meaning advice. Inverts which advice is decision-relevant for whom. The framing in this topology is most useful for the knowledge worker with stable employment; least useful for those whose floor is crumbling — for them, S7 (career bet) precedes S2-S6.' },
];

const LINKS: GraphLink[] = [
  // Foundation → mechanisms (assumptions ground the mechanisms)
  { source: 'A2', target: 'G8', type: 'dep', label: 'embodiment is what makes A2 hold' },
  { source: 'A2', target: 'G9', type: 'dep', label: 'mutual vulnerability is what makes A2 hold' },
  { source: 'A3', target: 'G4', type: 'dep', label: 'practice atrophy is the mechanism A3 names' },
  { source: 'A4', target: 'E14', type: 'sup' },
  { source: 'A4', target: 'G3', type: 'sup', label: 'depleted env interacts with engagement-optimized substitution' },
  { source: 'A5', target: 'F1', type: 'dep', label: 'atelic distinction must hold for A5' },
  { source: 'A5', target: 'G7', type: 'dep' },

  // Mechanism → empirical (gen)
  { source: 'G1', target: 'E6', type: 'gen', label: 'task-exposure aggregation produces slow diffusion' },
  { source: 'G1', target: 'E8', type: 'gen', label: 'predicts aggregate nulls' },
  { source: 'G3', target: 'E11', type: 'gen', label: 'engagement-optimization produces dose-response harm' },
  { source: 'G3', target: 'E12', type: 'gen', label: 'predicts farewell-manipulation pattern' },
  { source: 'G3', target: 'E13', type: 'gen' },
  { source: 'G4', target: 'E16', type: 'gen', label: 'practice atrophy produces critical-thinking decline' },
  { source: 'G4', target: 'E17', type: 'gen', label: 'practice atrophy produces intuition rust' },
  { source: 'G5', target: 'E4', type: 'gen', label: 'apprenticeship-ladder break is the mechanism for E4' },
  { source: 'G5', target: 'E5', type: 'gen' },

  // Empirical clusters internally support each other
  { source: 'E1', target: 'E2', type: 'sup', label: 'productivity gains include skill compression' },
  { source: 'E1', target: 'E3', type: 'sup', label: 'gains are jagged, not uniform' },
  { source: 'E4', target: 'E5', type: 'sup', label: 'entry-level + freelance disruption converge' },
  { source: 'E11', target: 'E12', type: 'sup', label: 'dose-response converges with identity-discontinuity' },
  { source: 'E13', target: 'E11', type: 'sup', label: 'adolescent prevalence + dose-response findings reinforce each other' },
  { source: 'E14', target: 'E15', type: 'sup', label: 'depleted env + Waldinger stakes' },
  { source: 'E16', target: 'E17', type: 'sup' },

  // Empirical → assumption (sup)
  { source: 'E16', target: 'A3', type: 'sup', label: 'cognitive-offloading evidence supports A3' },
  { source: 'E17', target: 'A3', type: 'sup' },
  { source: 'E14', target: 'A4', type: 'sup' },
  { source: 'E15', target: 'A2', type: 'sup', label: 'embodiment-stakes supports A2' },

  // Mechanism → synthesis
  { source: 'G4', target: 'S6', type: 'gen', label: 'effortful-practice antidote follows from offloading mechanism' },
  { source: 'G6', target: 'S2', type: 'gen' },
  { source: 'G7', target: 'S3', type: 'gen', label: 'telic exhaustion → atelic ballast' },
  { source: 'G8', target: 'S4', type: 'gen' },
  { source: 'G9', target: 'S4', type: 'gen' },
  { source: 'G10', target: 'S2', type: 'gen', label: 'competence-threat → diversify identity sources' },
  { source: 'G10', target: 'S6', type: 'gen', label: 'symbolic + actual competence threat → maintain practice' },

  // Empirical → synthesis
  { source: 'E1', target: 'S7', type: 'sup' },
  { source: 'E4', target: 'S7', type: 'sup' },
  { source: 'E5', target: 'S7', type: 'sup' },
  { source: 'E7', target: 'S7', type: 'sup', label: 'self-automator failure mode informs career bet' },
  { source: 'E10', target: 'L3', type: 'sup', label: 'Therabot is the positive use-case anchor' },
  { source: 'E9', target: 'L3', type: 'sup' },
  { source: 'E11', target: 'S5', type: 'sup', label: 'dose-response is what S5 quantifies' },
  { source: 'E13', target: 'S5', type: 'sup' },
  { source: 'E16', target: 'S6', type: 'sup' },
  { source: 'E17', target: 'S6', type: 'sup' },

  // Frameworks → mechanism / synthesis
  { source: 'F1', target: 'G7', type: 'imp', label: 'telic/atelic is the lens for the mechanism' },
  { source: 'F1', target: 'S3', type: 'imp' },
  { source: 'F2', target: 'G10', type: 'imp', label: 'SDT names which need is threatened' },
  { source: 'F2', target: 'S2', type: 'imp' },
  { source: 'F3', target: 'S7', type: 'imp', label: 'labor/work/action sorts which roles AI evacuates' },

  // Synthesis → meta-synthesis
  { source: 'S2', target: 'S1', type: 'sup' },
  { source: 'S3', target: 'S1', type: 'sup' },
  { source: 'S4', target: 'S1', type: 'sup' },
  { source: 'S5', target: 'S1', type: 'sup' },
  { source: 'S6', target: 'S1', type: 'sup' },
  { source: 'S7', target: 'S1', type: 'sup' },

  // Logical guardrails imply scope
  { source: 'L1', target: 'O1', type: 'imp', label: 'O1 is forecast, not finding — different evidence weight' },
  { source: 'L2', target: 'S2', type: 'mod', label: 'material primacy moderates strategic-advice ordering' },
  { source: 'L2', target: 'S3', type: 'mod' },
  { source: 'L2', target: 'S7', type: 'mod', label: 'for the materially insecure, S7 precedes S2-S6' },
  { source: 'L3', target: 'S5', type: 'imp', label: 'displacement-context determines whether S5 applies' },

  // Open questions sit downstream of cruxes / mechanisms
  { source: 'O1', target: 'A1', type: 'imp', label: 'O1 is the falsification window for A1' },
  { source: 'O2', target: 'E11', type: 'imp', label: 'closes empirical gap on dose-response generalization' },
  { source: 'O3', target: 'A3', type: 'imp', label: 'O3 is the falsification window for A3' },
  { source: 'O4', target: 'A5', type: 'imp' },
  { source: 'O4', target: 'S3', type: 'imp', label: 'falsifies atelic-ballast if AI degrades atelic too' },

  // Cross-domain bridge — the structural finding of the topology
  { source: 'G4', target: 'S2', type: 'bridges', label: 'offloading bridges work-deskilling to identity-foreclosure' },
  { source: 'G4', target: 'S4', type: 'bridges', label: 'emotional offloading bridges work to relational depth' },
  { source: 'G4', target: 'S5', type: 'bridges' },

  // Mechanism conflicts (G2 is contested)
  { source: 'G2', target: 'E8', type: 'sup', label: 'comparative advantage explains aggregate nulls' },
  { source: 'G5', target: 'G2', type: 'conf', label: 'apprenticeship-break is the friction-cost Shulman names' },

  // Distortion attacks
  { source: 'D1', target: 'S1', type: 'attacks' },
  { source: 'D1', target: 'S2', type: 'attacks' },
  { source: 'D1', target: 'S3', type: 'attacks' },
  { source: 'D1', target: 'S6', type: 'attacks' },
  { source: 'D1', target: 'S7', type: 'attacks' },
  { source: 'D2', target: 'E4', type: 'attacks' },
  { source: 'D2', target: 'E5', type: 'attacks' },
  { source: 'D2', target: 'E16', type: 'attacks' },
  { source: 'D3', target: 'E11', type: 'attacks' },
  { source: 'D3', target: 'E14', type: 'attacks' },
  { source: 'D3', target: 'S4', type: 'attacks' },
  { source: 'D3', target: 'S5', type: 'attacks' },
  { source: 'D4', target: 'L2', type: 'attacks' },
  { source: 'D4', target: 'E4', type: 'attacks' },
  { source: 'D4', target: 'E5', type: 'attacks' },
];

const TYPE_COLORS: Record<NodeType, string> = {
  A: '#1a1614', // ink — foundational assumptions (cruxes)
  E: '#3a342c', // ink-soft — empirical findings
  G: '#8a4a2b', // accent — generating mechanisms
  L: '#5a4a3a', // tan — logical guardrails
  S: '#c98a6e', // accent-soft — synthesis / strategic
  F: '#7a7166', // muted — frameworks
  O: '#7a7166', // muted (dashed) — open
  D: '#a04040', // brick red — distortion
};

const TYPE_LABEL: Record<NodeType, string> = {
  A: 'Assumption',
  E: 'Empirical',
  G: 'Mechanism',
  L: 'Logical',
  S: 'Strategic',
  F: 'Framework',
  O: 'Open',
  D: 'Distortion',
};

const EDGE_COLOR: Record<EdgeType, string> = {
  dep: '#7a7166',
  sup: '#bcb0a0',
  gen: '#8a4a2b',
  imp: '#7a7166',
  conf: '#a04040',
  mod: '#7a7166',
  attacks: '#a04040',
  bridges: '#5c7cfa',
};

const EDGE_LABEL: Record<EdgeType, string> = {
  dep: 'depends on',
  sup: 'supports',
  gen: 'generates',
  imp: 'implies',
  conf: 'confounds',
  mod: 'moderates',
  attacks: 'attacks',
  bridges: 'bridges domains',
};

const DOMAIN_TINT: Record<Domain, string> = {
  work: '#3a342c',
  relationships: '#8a4a2b',
  meaning: '#c98a6e',
  cross: '#5c7cfa',
};

const LEVERAGE_COLOR: Record<Leverage, string> = {
  high: '#8a4a2b',
  medium: '#c98a6e',
  low: '#bcb0a0',
};

// Crux nodes — the foundational assumptions that, if falsified, force rebuilding regions of the topology.
const CRUX_IDS = new Set(['A1', 'A2', 'A3', 'A4', 'A5']);

// Minimal claim set — the smallest set that yields the integrated picture.
const MINIMAL_SET = new Set(['A1', 'A2', 'A3', 'G4', 'G7', 'G8', 'E4', 'E11', 'E16', 'L2', 'S1', 'S2', 'S3', 'S4', 'S6']);

function nodeRadius(weight: number): number {
  return 6 + weight * 2.5;
}

function nodeOpacity(node: GraphNode, variant: Variant): number {
  if (variant === 'full') return 1;
  if (variant === 'vulnerability') {
    if (CRUX_IDS.has(node.id)) return 1;
    if (node.weight >= 5) return 1;
    if (node.type === 'O') return 0.9;
    return 0.18;
  }
  if (variant === 'flow') {
    // Highlight A → G → E → S cascade
    if (['A', 'G', 'E', 'S'].includes(node.type)) return 1;
    return 0.2;
  }
  if (variant === 'minimal') {
    return MINIMAL_SET.has(node.id) ? 1 : 0.1;
  }
  if (variant === 'leverage') {
    if (node.leverage === 'high') return 1;
    if (node.leverage === 'medium') return 0.55;
    return 0.16;
  }
  return 1;
}

function edgeOpacity(link: GraphLink, variant: Variant): number {
  const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
  const targetId = typeof link.target === 'string' ? link.target : link.target.id;
  if (variant === 'full') return link.type === 'attacks' ? 0.4 : link.type === 'bridges' ? 0.7 : 0.45;
  if (variant === 'vulnerability') {
    return CRUX_IDS.has(sourceId) || CRUX_IDS.has(targetId) ? 0.6 : 0.05;
  }
  if (variant === 'flow') {
    if (link.type === 'attacks') return 0;
    return link.type === 'bridges' ? 0.85 : 0.5;
  }
  if (variant === 'minimal') {
    return MINIMAL_SET.has(sourceId) && MINIMAL_SET.has(targetId) ? 0.6 : 0.04;
  }
  if (variant === 'leverage') {
    const sNode = NODES.find(n => n.id === sourceId);
    const tNode = NODES.find(n => n.id === targetId);
    if (sNode?.leverage === 'high' || tNode?.leverage === 'high') return 0.55;
    return 0.06;
  }
  return 0.4;
}

interface Pos { x: number; y: number; }

export default function AITransitionGraph() {
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
  const height = 700;

  useEffect(() => {
    const nodesCopy: GraphNode[] = NODES.map(n => ({ ...n }));
    const linksCopy: GraphLink[] = LINKS.map(l => ({ ...l }));

    const sim = forceSimulation<GraphNode>(nodesCopy)
      .force('link', forceLink<GraphNode, GraphLink>(linksCopy)
        .id(d => d.id)
        .distance(l => {
          const w = ((l.source as GraphNode).weight + (l.target as GraphNode).weight) / 2;
          return 90 + (5 - w) * 10;
        })
        .strength(0.4))
      .force('charge', forceManyBody<GraphNode>().strength(-420))
      .force('collide', forceCollide<GraphNode>(d => nodeRadius(d.weight) + 7))
      .force('center', forceCenter(width / 2, height / 2))
      .alphaDecay(0.03)
      .stop();

    for (let i = 0; i < 450; i++) sim.tick();

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
    dragRef.current = { id, offsetX: cursor.x - pos.x, offsetY: cursor.y - pos.y, moved: false };
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

  // React's onWheel is passive by default — preventDefault() inside the synthetic
  // handler is ignored and the page scrolls. Attach imperatively with { passive: false }.
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
    vulnerability: 'The 5 foundational-assumption cruxes plus weight-5 load-bearing nodes — where collapse propagates farthest if any one flips.',
    flow: 'How causation propagates: foundational assumptions → mechanisms (G) → empirical findings (E) → strategic recommendations (S). Cross-domain bridges (blue) show how cognitive offloading connects work, relationships, and meaning.',
    minimal: 'The 15-node minimal claim set sufficient to recover the integrated picture. Removing any one breaks the qualitative shape.',
    leverage: 'Decision-leverage view. Saturated = high individual leverage (the seven strategic recommendations — direct decisions you can make). Mid-tone = medium (mechanisms G4 / G6 / G7 / G10, frameworks F1–F3, and the finding/forecast/interpretation discipline L1 — mental models that make the strategic recommendations actually applicable to your life). Faded = structural / outside individual control. The high+medium cluster is the entire decision-relevant core of this topology.',
  };

  return (
    <div className="not-prose font-sans text-ink" style={{ background: '#f7f3ec' }}>
      {/* Variant toggle + view reset */}
      <div className="flex flex-wrap gap-2 mb-3 text-[12px] font-mono uppercase tracking-wider items-center">
        {(['full', 'vulnerability', 'flow', 'minimal', 'leverage'] as Variant[]).map(v => (
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
              <marker id="ait-arrow" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,-5L10,0L0,5" fill="#7a7166" />
              </marker>
              <marker id="ait-arrow-attack" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,-5L10,0L0,5" fill="#a04040" />
              </marker>
              <marker id="ait-arrow-gen" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,-5L10,0L0,5" fill="#8a4a2b" />
              </marker>
              <marker id="ait-arrow-bridge" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
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
                const marker =
                  link.type === 'attacks' ? 'url(#ait-arrow-attack)' :
                  link.type === 'gen' ? 'url(#ait-arrow-gen)' :
                  link.type === 'bridges' ? 'url(#ait-arrow-bridge)' :
                  'url(#ait-arrow)';

                return (
                  <g key={`edge-${i}`}>
                    <line
                      x1={sPos.x}
                      y1={sPos.y}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth={isHover ? 2.4 : (link.type === 'attacks' ? 1.4 : link.type === 'bridges' ? 1.8 : 1.1)}
                      strokeDasharray={
                        link.type === 'attacks' ? '4 3' :
                        link.type === 'bridges' ? '5 2' :
                        undefined
                      }
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
                        <tspan style={{ paintOrder: 'stroke', stroke: '#fbf8f1', strokeWidth: 4 } as any}>
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
                let fill = TYPE_COLORS[node.type];
                if (variant === 'leverage' && node.leverage) {
                  fill = LEVERAGE_COLOR[node.leverage];
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
              Node size reflects load-bearing weight (1–5). Blue dashed edges are cross-domain bridges.
            </div>
          </div>

          <div className="border p-3 text-[13px] min-h-[200px]" style={{ borderColor: '#d9d0bf', background: '#fbf8f1' }}>
            {selectedNode ? (
              <>
                <div className="font-mono text-[11px] uppercase tracking-wider mb-1" style={{ color: '#7a7166' }}>
                  {selectedNode.id} · {TYPE_LABEL[selectedNode.type]} · weight {selectedNode.weight}
                  {selectedNode.status && ` · ${selectedNode.status}`}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider mb-2" style={{ color: DOMAIN_TINT[selectedNode.domain] }}>
                  {selectedNode.domain === 'cross' ? 'cross-domain' : selectedNode.domain}
                  {selectedNode.leverage && ` · ${selectedNode.leverage} leverage`}
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

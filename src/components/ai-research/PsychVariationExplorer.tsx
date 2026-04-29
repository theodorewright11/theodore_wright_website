import { useState } from 'react';

// ---------------------------------------------------------------------------
// Build-stage artifact for human-psych-variation.
//
// Translates the model formalization + data pipeline into a plain-language
// reader's tool. Three buckets per trait (Direct genes / Family setup /
// Environment + chance), then four secondary views: politics-trap map, the
// asymmetric environmental-effects finding, the three "heritability ≠
// destiny" misreadings, and a take-away summary.
//
// Numbers are frozen from the data stage (public/data/human-psych-variation/
// heritability_estimates.csv + the H2 partition output). The three plain-
// language buckets aggregate the model's seven decomposition terms:
//   bucket 1 (Direct genes) = V(A_d)
//   bucket 2 (Family setup) = V(A_LD) + V(A_i) + V(C)
//   bucket 3 (Environment + chance) = V(E_m) + V(E_s) + V(I)
// ---------------------------------------------------------------------------

type Domain = 'cognitive' | 'personality' | 'psychiatric' | 'attitudes' | 'physical';

type Trait = {
  slug: string;
  name: string;
  domain: Domain;
  oneliner: string;
  variance: { direct: number; family: number; env: number };
  familyNote: string;
  envNote: string;
  insults?: { name: string; effect: string; source: string }[];
  enrichments?: { name: string; effect: string; source: string }[];
  trapEnv: string;
  trapHer: string;
  takeaway: string;
  primarySources: { label: string; url: string }[];
};

const TRAITS: Trait[] = [
  {
    slug: 'iq_adult',
    name: 'Cognitive ability — adults',
    domain: 'cognitive',
    oneliner:
      "Why people differ in cognitive ability as adults is mostly genetic at the population level — but a sizeable chunk of what twin studies count as 'genetic' is actually the family setup parents create, not direct biological causation.",
    variance: { direct: 0.51, family: 0.41, env: 0.08 },
    familyNote:
      'Splits into ~28% structural inflation from assortative mating (people pair with partners of similar cognitive ability, which links the relevant alleles together over generations), ~8% genetic nurture (parents create environments matching their own genotypes — vocabulary, books, expectations), and ~5% residual shared family environment.',
    envNote:
      'Most of the small environment-and-chance bucket is unmeasured developmental noise. Identified large levers (severe deprivation, lead, FAS) account for almost no population variance in modern Western samples because their prevalence is now low.',
    insults: [
      { name: 'Prenatal alcohol (full FAS)', effect: '−30 IQ pts', source: 'Streissguth 2004' },
      { name: 'Severe deprivation (Romanian orphanages)', effect: '−15 IQ pts', source: 'Nelson 2007 BEIP' },
      { name: 'Lead, blood 1→10 µg/dL', effect: '−6.2 IQ pts', source: 'Lanphear 2005' },
    ],
    enrichments: [
      { name: 'Schooling, per year', effect: '+1 to +5 IQ pts', source: 'Ritchie & Tucker-Drob 2018' },
      { name: 'Within-Western-normal parenting', effect: '~0 to +1 IQ pts', source: 'Plomin & Daniels 1987' },
    ],
    trapEnv:
      "'Heritability is just an artifact of methodology' is not what the SNP-based and adoption-study evidence shows. The number is real. But citing 0.79 as if it means 'genes determine 79% of cognitive ability' confuses a population-variance ratio with an individual partition. Both moves drop information.",
    trapHer:
      "Citing 0.79 to argue 'environment doesn't matter much for cognition' ignores that ~40% of the 'genetic' bucket is structural (assortative mating) plus environmental-via-parents (genetic nurture). The direct-biological component is closer to ~50%, and the within-family GWAS for cognitive ability lands at h² ≈ 0.45–0.50 once parental environments are controlled.",
    takeaway:
      "About half of why adults differ in cognitive ability is direct genetic effect; another ~40% is the family setup that genetically-similar parents create around their kids; ~10% is everything else. The interesting policy levers are at the tails (preventing severe insults like lead, malnutrition, FAS, and severe deprivation), not at the middle (parenting style within Western normal).",
    primarySources: [
      { label: 'Bouchard 2013 — h²(t) developmental curve', url: 'https://pubmed.ncbi.nlm.nih.gov/23919982/' },
      { label: 'Howe 2022 — within-sibship GWAS for cognition', url: 'https://www.nature.com/articles/s41588-022-01062-7' },
      { label: 'Lanphear 2005 — lead and IQ pooled analysis', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1257652/' },
    ],
  },
  {
    slug: 'iq_child',
    name: 'Cognitive ability — young children',
    domain: 'cognitive',
    oneliner:
      'In early childhood, why kids differ in cognitive ability is mostly the family they were raised in. The genetic share rises along a logistic curve from ~20% at age 5 to ~80% in adulthood as kids gain agency over their own environments.',
    variance: { direct: 0.18, family: 0.55, env: 0.27 },
    familyNote:
      'The shared-environment bucket is huge in childhood (~50% of variance) and shrinks toward 0–5% by adulthood. This is the Wilson Effect: as kids become teenagers, they pick environments matching their genetic propensities (active gene-environment correlation), and the family-of-origin grip loosens.',
    envNote:
      'Larger in absolute terms in childhood than adulthood because measured environmental factors (school quality, peer effects, severe deprivation) leave bigger marks on developing children. Most of this also gets reabsorbed into the genetic bucket as kids age out of the family of origin.',
    insults: [
      { name: 'Severe deprivation (Romanian orphanages)', effect: '−15 IQ pts at age 4–6', source: 'Nelson 2007 BEIP' },
      { name: 'Severe chronic malnutrition (early)', effect: '−15 IQ pts', source: 'Grantham-McGregor 2007' },
      { name: 'Lead, blood 1→10 µg/dL', effect: '−6.2 IQ pts', source: 'Lanphear 2005' },
    ],
    enrichments: [
      { name: 'Schooling, per year', effect: '+3.4 IQ pts (persistent)', source: 'Ritchie & Tucker-Drob 2018' },
      { name: 'Adoption out of low-SES into high-SES', effect: '+12 IQ pts', source: 'Capron & Duyme 1996' },
    ],
    trapEnv:
      "Citing high childhood h² as evidence parenting doesn't matter is a category error: at age 5 the genetic share is only ~20%, and shared environment dominates. Childhood is the *most* environmentally-shaped life phase.",
    trapHer:
      "Citing the Wilson Effect ('h² rises with age') as 'genes win out' misses what's actually happening. It's not that environment stops mattering — it's that the *family-of-origin* environment loses its grip as kids select environments matching their genotypes. The environment is still doing work; it's just self-selected rather than imposed.",
    takeaway:
      'Most of why young kids differ in cognitive ability is the family they grew up in (genes + family environment together). By adulthood that ratio flips. The single biggest lever in childhood is preventing severe environmental insults (lead, malnutrition, deprivation); enrichment within normal yields little.',
    primarySources: [
      { label: 'Bouchard 2013 — Wilson Effect anchors', url: 'https://pubmed.ncbi.nlm.nih.gov/23919982/' },
      { label: 'Capron & Duyme 1996 — French adoption study', url: 'https://www.sciencedirect.com/science/article/abs/pii/S0160289696900128' },
    ],
  },
  {
    slug: 'educational_attainment',
    name: 'Educational attainment',
    domain: 'cognitive',
    oneliner:
      "Education completed is one of the most heavily 'family setup' traits the field has studied. About half of what looks genetic in twin studies is actually environmental, transmitted through parents who happen to share genes with their kids.",
    variance: { direct: 0.15, family: 0.43, env: 0.42 },
    familyNote:
      "Educational attainment has the strongest assortative mating of any non-attitudinal trait (m = 0.55 — partners are quite similar on years of schooling). About 22% of variance is AM-induced LD; another ~12% is genetic nurture (parents who completed more school create environments that boost their kids' completion); ~9% is residual shared family environment that persists into adulthood (unusual for behavioral traits).",
    envNote:
      'Larger than for cognitive ability itself because educational attainment is a social outcome, not just a cognitive one — peer effects, school quality, recession-year birth cohorts, and cultural shifts all leave signal here.',
    insults: [],
    enrichments: [
      { name: 'Mandatory schooling laws', effect: '+~1 year of education, +3.4 IQ pts/yr', source: 'Ritchie & Tucker-Drob 2018' },
    ],
    trapEnv:
      "Dismissing the genetic signal entirely ignores that within-family direct effects are non-zero (h² ≈ 0.15 is small but real). Cognitive ability matters for completing school, and cognitive ability is partly heritable.",
    trapHer:
      "Citing twin h² = 0.40 as 'education is mostly genetic' is the textbook example of getting captured by the assortative-mating + genetic-nurture inflation. Within-family h² (the cleanest direct estimate) is 0.15. Most of what looks genetic in EA is parents creating environments their kids would match anyway.",
    takeaway:
      "Educational attainment is one of the cleanest demonstrations that 'genetic effect' in twin studies routinely contains substantial structural and environmental contamination. The honest reading is: small-but-real direct genetic effect on completion, plus a much larger family-setup contribution, plus genuine effects of mandatory schooling and broader social structure.",
    primarySources: [
      { label: 'Kong 2018 — non-transmitted PGS effect', url: 'https://www.science.org/doi/10.1126/science.aan6877' },
      { label: 'Okbay 2022 EA4 — within-family attenuation', url: 'https://www.nature.com/articles/s41588-022-01016-z' },
      { label: 'Howe 2022 — within-sibship h²', url: 'https://www.nature.com/articles/s41588-022-01062-7' },
    ],
  },
  {
    slug: 'big_five',
    name: 'Personality — Big Five (composite)',
    domain: 'personality',
    oneliner:
      "Adult personality is roughly 40% genetic, ~0% the family you were raised in, and ~55% something else. That 'something else' is mostly developmental noise the field has not been able to identify, despite trying for fifty years.",
    variance: { direct: 0.42, family: 0.03, env: 0.55 },
    familyNote:
      "Almost zero. Adult personality replicates the famous 'shared environment ≈ 0' finding: identical twins raised together are not meaningfully more similar in personality than identical twins raised apart. Whatever your parents did mostly didn't transmit to your adult personality. Assortative mating on personality is also weak (m ≈ 0.13).",
    envNote:
      "About half of adult personality variance is non-shared environment, and most of *that* is unmeasured developmental noise — not bad parenting, not peer effects, not specific exposures. After fifty years of searching, the field has not identified what the 'non-shared environment' actually is. The current best guess is stochastic developmental contingency: which seat you happened to sit in, which teacher liked you, which illness you caught — events too dispersed and idiosyncratic to model.",
    insults: [],
    enrichments: [],
    trapEnv:
      "'Personality is shaped by upbringing' has dramatic poll appeal but contradicts five decades of behavior-genetic findings. Once you control for shared genes, raising kids in different families does not produce reliably different adult personalities. The actionable lever from family setup is much smaller than parents typically assume.",
    trapHer:
      "Citing h² ≈ 0.45 as 'personality is half genetic, period' misses that the *other* half is largely unmeasured chance, not 'environment' in the sense most people imagine. Personality is not 50% nature / 50% nurture; it's ~45% genetic, ~3% nurture, ~52% noise.",
    takeaway:
      "Adult personality is partly genetic and largely the result of unmeasured developmental contingency. The 'parenting shapes personality' folk model is mostly wrong (within Western normal); the 'genes are destiny' model is also wrong because half the variance has no clean genetic story either. The honest answer is that we know less than we'd like.",
    primarySources: [
      { label: 'Vukasović & Bratko 2015 — Big Five h² meta', url: 'https://pubmed.ncbi.nlm.nih.gov/25938582/' },
      { label: 'Plomin & Daniels 1987 — non-shared environment', url: 'https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/abs/why-are-children-in-the-same-family-so-different-from-one-another/B3AB30EB97A3FA8DB7B9DED0A56CFAEE' },
    ],
  },
  {
    slug: 'schizophrenia',
    name: 'Schizophrenia',
    domain: 'psychiatric',
    oneliner:
      "Schizophrenia is one of the most heritable psychiatric conditions (h² ≈ 0.79), but 'heritable' in the structural sense: about a third of the additive genetic variance is assortative-mating-induced linkage, not independent direct biological causation.",
    variance: { direct: 0.51, family: 0.34, env: 0.15 },
    familyNote:
      "The most extreme assortative-mating signal in psychiatry: people with schizophrenia partner with affected spouses at tetrachoric correlations >0.40 (Nordsletten 2016). This drives a structural ~36% V(A_LD) share — about a third of the genetic variance is the LD created by like-mating, not independent biology. Cross-disorder genetic correlations with other psychiatric conditions are also substantially inflated by cross-trait AM (Border 2022).",
    envNote:
      "Identifiable risk factors include obstetric complications, prenatal infection, urban birth, paternal age — each contributing modestly. Cannabis use in adolescence is the most-cited modifiable factor; the population-level variance contribution is moderate.",
    insults: [
      { name: 'Heavy adolescent cannabis use', effect: '~2× risk', source: 'Marconi 2016 meta' },
      { name: 'Severe obstetric complications', effect: '~2× risk', source: 'Cannon 2002 meta' },
    ],
    enrichments: [],
    trapEnv:
      "'Mental illness is environmental / cultural' does not fit the data for schizophrenia. h² ≈ 0.79 across cultures, GWAS hits replicate cross-ancestry, and there is no environmental intervention with effect sizes anywhere near the genetic load. Treating schizophrenia as a social construction underweights what affected families and clinicians know firsthand.",
    trapHer:
      "Citing h² = 0.79 as 'this is genetic, period' overlooks that ~36% of that genetic variance is structural assortative-mating-induced linkage (Nordsletten 2016 + Border 2022), and that the cross-disorder genetic correlations with bipolar, MDD, etc. are substantially inflated by cross-trait AM. The picture is genuine biology, but the share that is 'shared underlying biological cause across disorders' has shrunk substantially under correction.",
    takeaway:
      'Schizophrenia is one of the strongest heritability findings in psychiatry. But about a third of that heritability is structural AM-induced linkage, and the cross-disorder pleiotropy that some readings emphasize is partly a cross-trait AM artifact. Direct biological causation is real and dominant; the structural inflation is also real and growing in importance as a correction.',
    primarySources: [
      { label: 'Sullivan 2003 meta — schizophrenia h²', url: 'https://pubmed.ncbi.nlm.nih.gov/12642233/' },
      { label: 'Nordsletten 2016 — psychiatric assortative mating', url: 'https://pubmed.ncbi.nlm.nih.gov/26913486/' },
      { label: 'Trubetskoy 2022 — schizophrenia GWAS', url: 'https://www.nature.com/articles/s41586-022-04434-5' },
    ],
  },
  {
    slug: 'mdd',
    name: 'Depression (major depressive disorder)',
    domain: 'psychiatric',
    oneliner:
      "Depression is moderately heritable (h² ≈ 0.37, lower than most psychiatric conditions) and shows weaker assortative-mating signal. The environmental contribution is genuinely substantial — different from schizophrenia in this regard.",
    variance: { direct: 0.35, family: 0.07, env: 0.58 },
    familyNote:
      'Affective disorders show much weaker assortative mating than schizophrenia / ADHD / autism (m ≈ 0.15 vs. >0.40). The structural AM inflation is correspondingly small (~6% of h²). Genetic nurture has not been quantified at scale for depression.',
    envNote:
      "About 60% of why people differ in MDD risk is environment + chance. Identifiable contributors include adverse childhood experiences, recent stressful life events, social isolation, and chronic illness. Unlike for cognitive traits, the 'environment' bucket for MDD has identifiable named contributors that account for substantial variance.",
    insults: [
      { name: 'Adverse childhood experiences (4+)', effect: '~4× lifetime depression risk', source: 'Felitti 1998' },
      { name: 'Recent severe life stressor', effect: '~3× short-term risk', source: 'Kendler 1995' },
    ],
    enrichments: [
      { name: 'Behavioral activation therapy', effect: 'Cohen d ~0.7 vs control', source: 'Mazzucchelli 2009 meta' },
    ],
    trapEnv:
      "'Depression is purely a response to circumstances' is partly right but loses information: at h² ≈ 0.37, who responds to which circumstances has substantial genetic structure. Two people in the same adverse environment have different probabilities of becoming clinically depressed.",
    trapHer:
      "Citing depression as a 'chemical imbalance, mostly genetic' over-claims. h² is moderate, not high. Environmental events have effect sizes that rival the genetic contribution. The 'biological psychiatry' frame undersells the role of life circumstances and treatment response to behavioral interventions.",
    takeaway:
      'Depression sits in the middle of the nature-nurture spectrum more than most psychological traits. Genetic load is real and moderate; environmental events (especially early adversity and recent stressors) are also real and at comparable effect size. The clinical implication is that both medication and behavioral interventions can move the needle.',
    primarySources: [
      { label: 'Sullivan 2000 meta — depression h²', url: 'https://pubmed.ncbi.nlm.nih.gov/11015800/' },
      { label: 'Howard 2019 — MDD GWAS', url: 'https://www.nature.com/articles/s41593-018-0326-7' },
    ],
  },
  {
    slug: 'adhd',
    name: 'ADHD',
    domain: 'psychiatric',
    oneliner:
      "ADHD is highly heritable (h² ≈ 0.74) with strong assortative mating. Like schizophrenia, about a third of the genetic variance is structural AM-induced linkage rather than independent biological signal.",
    variance: { direct: 0.49, family: 0.35, env: 0.16 },
    familyNote:
      "Strong assortative mating (Nordsletten 2016 reports tetrachoric m > 0.40 for ADHD), driving ~33% V(A_LD) share. Like other 'AM-strong psychiatric' conditions, what looks like one-third of the heritable signal is actually structural like-mating, not independent direct biology.",
    envNote:
      'Identifiable contributors include preterm birth, prenatal maternal smoking, lead exposure, severe early deprivation. Each is modest at the population level.',
    insults: [
      { name: 'Lead exposure (high)', effect: '~1.5× risk', source: 'Goodlad 2013 meta' },
      { name: 'Preterm birth', effect: '~2× risk', source: 'Franz 2018 meta' },
    ],
    enrichments: [],
    trapEnv:
      "'ADHD is over-diagnosed / a cultural construct' is contradicted by the cross-cultural h² and GWAS replication. The biological signal is real. Diagnostic-rate variation is a different question from etiology.",
    trapHer:
      "Citing h² = 0.74 as 'ADHD is essentially genetic' overstates the direct-biological share once AM correction is applied. About a third of the heritable signal is structural assortative mating; the underlying direct causal architecture is not as concentrated as the headline number suggests.",
    takeaway:
      'ADHD is genuinely highly heritable, but a substantial fraction of that heritability is structural assortative mating rather than independent biological causation. Treatment responsiveness to both medication and environmental scaffolding is consistent with this mixed picture.',
    primarySources: [
      { label: 'Faraone 2019 — ADHD heritability', url: 'https://pubmed.ncbi.nlm.nih.gov/30903002/' },
      { label: 'Demontis 2023 — ADHD GWAS', url: 'https://www.nature.com/articles/s41588-022-01285-8' },
    ],
  },
  {
    slug: 'autism',
    name: 'Autism spectrum',
    domain: 'psychiatric',
    oneliner:
      "Autism is highly heritable (h² ≈ 0.80) with two distinct genetic architectures: a polygenic common-variant tail correlated positively with IQ, and a rare-variant component dominated by de novo mutations in a subset of severe cases.",
    variance: { direct: 0.51, family: 0.37, env: 0.12 },
    familyNote:
      "Strong assortative mating (m > 0.40, Nordsletten 2016) drives ~36% V(A_LD) share. Autism is also where the polygenic-additive frame breaks at the severe tail: a subset of cases (especially severe early-onset autism with intellectual disability) is driven by single rare variants like CHD8, SCN2A, SYNGAP1 — effectively Mendelian rather than polygenic.",
    envNote:
      "Identifiable contributors are modest at the population level. Vaccines do not cause autism (this is one of the most thoroughly tested negative findings in epidemiology). Advanced paternal age is a small risk factor through de novo mutation rate.",
    insults: [
      { name: 'Advanced paternal age', effect: '~1.3× per decade', source: 'Hultman 2011' },
    ],
    enrichments: [],
    trapEnv:
      "Treating autism as primarily an environmental injury (vaccines, gut, etc.) contradicts what the genetic data clearly show. h² ≈ 0.80, GWAS hits replicate, twin and family-recurrence patterns fit a strongly genetic model. The vaccine hypothesis specifically has been tested at population scale and is settled.",
    trapHer:
      "Citing h² = 0.80 as 'autism is genetic' obscures two important nuances: (a) ~36% of the heritable signal is structural AM-LD, and (b) the 'genetic' architecture is bimodal — common-variant polygenic for the majority, single-rare-variant Mendelian for a subset. These two architectures imply different things for prediction, prognosis, and intervention.",
    takeaway:
      "Autism is strongly genetic but not in a simple sense: it has a polygenic common-variant component (correlated positively with cognitive ability) and a rare-variant component (dominated by de novo mutations) that drives much of the severe tail. About a third of the heritable signal is structural AM. Environmental injury hypotheses (especially vaccines) have been thoroughly tested and don't hold up.",
    primarySources: [
      { label: 'Tick 2016 — twin meta-analysis of autism', url: 'https://pubmed.ncbi.nlm.nih.gov/26709141/' },
      { label: 'Grove 2019 — autism GWAS', url: 'https://www.nature.com/articles/s41588-019-0344-8' },
    ],
  },
  {
    slug: 'height',
    name: 'Height',
    domain: 'physical',
    oneliner:
      'Height is the cleanest demonstration that high heritability and large environmental change can coexist. h² ≈ 0.85 — and average height has risen ~10 cm in a century from nutrition improvements.',
    variance: { direct: 0.68, family: 0.17, env: 0.15 },
    familyNote:
      'Modest assortative mating for height (m ≈ 0.24), driving ~20% V(A_LD) share. Genetic nurture is essentially zero (height is not transmitted through parental environment in any meaningful way beyond shared genes).',
    envNote:
      "Mostly nutrition during developmental years. Severe early childhood malnutrition stunts adult height substantially; chronic moderate undernutrition reduces it by several centimeters. The 'secular rise' in average height across the 20th century is one of the largest environmental shifts in any psychological/biological trait.",
    insults: [
      { name: 'Severe chronic childhood malnutrition', effect: '−5 to −15 cm adult', source: 'multiple developmental cohorts' },
    ],
    enrichments: [
      { name: 'Adequate childhood protein/calories vs. historical norm', effect: '+~10 cm secular trend, 1900→2000', source: 'NCD-RisC 2016' },
    ],
    trapEnv:
      "'Height is mostly environmental' (citing the secular rise) is wrong. The h² = 0.85 is real and replicated; within a single generation in a single country, almost all the variation between individuals tracks genetic differences. The secular rise is between-cohort, not within-cohort.",
    trapHer:
      "'Height is mostly genetic' is right within a cohort and wrong across cohorts. Average height shifted ~10 cm in a century with no genetic change in the population. The same logic applies to any high-heritability trait: high within-cohort h² is fully compatible with large environmental shifts moving the cohort mean.",
    takeaway:
      "Height is the textbook case for understanding what heritability does and does not say. Within a generation, almost all the variation between people is genetic. Across generations, the population mean moves substantially with environment. These are not contradictory — they answer different questions. Apply the same logic to cognitive ability and other psychological traits.",
    primarySources: [
      { label: 'Yengo 2022 — height GWAS at N=5.4M', url: 'https://www.nature.com/articles/s41586-022-05275-y' },
      { label: 'Wainschtein 2022 — WGS h² for height', url: 'https://www.nature.com/articles/s41588-021-00997-7' },
      { label: 'NCD-RisC 2016 — secular height trends', url: 'https://elifesciences.org/articles/13410' },
    ],
  },
  {
    slug: 'political_orientation',
    name: 'Political orientation',
    domain: 'attitudes',
    oneliner:
      "Political orientation is moderately heritable (h² ≈ 0.40) and has the highest assortative mating of any measured trait (m = 0.58). Most of why people vote differently is a tangled mix of family environment, peer-group selection, and modest genetic loading.",
    variance: { direct: 0.31, family: 0.34, env: 0.35 },
    familyNote:
      "Highest assortative mating in the field (m = 0.58, slightly above religion at 0.56 — partners pick similar partners on politics more than on any other trait), driving ~23% V(A_LD) share. Shared family environment for politics is also unusually persistent into adulthood (~25%), one of the few traits where 'how your parents voted' continues to predict 'how you vote' decades later.",
    envNote:
      'Peer-group composition, education level, urban/rural geography, life events. Identifiable contributors are modest individually but collectively account for a large share.',
    insults: [],
    enrichments: [],
    trapEnv:
      "'Politics is purely socialized / framed by media' loses information. There is a real heritable component (~31% direct genetic variance) — temperamental dispositions toward openness/order/threat-sensitivity have moderate genetic loading and predict political orientation reliably across cultures.",
    trapHer:
      "'Politics has a genetic basis' is technically right but easily over-read. The direct-genetic share is moderate (~31%), the AM-induced share is substantial, and the family-environment share persists through adulthood (unusual for any trait). 'Born this way' is the wrong frame — political orientation is heritable AND substantially shaped by upbringing AND structurally inflated by like-mating.",
    takeaway:
      "Political orientation is the most assortatively-mated trait the field has measured. About 30% of why people differ is direct genetic temperament; another 30% is family setup; the last 40% is everything else. The 'born blue / born red' frame is wrong; the 'pure socialization' frame is also wrong.",
    primarySources: [
      { label: 'Hatemi 2014 — political orientation twin h²', url: 'https://pubmed.ncbi.nlm.nih.gov/24329155/' },
      { label: 'Horwitz 2023 — assortative mating across traits', url: 'https://www.nature.com/articles/s41562-023-01672-z' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Trap card content for the "Four Traps" view
// ---------------------------------------------------------------------------

type TrapCard = {
  code: string;
  name: string;
  oneliner: string;
  cites: string[];
  ignores: string[];
  integrated: string;
};

const TRAPS: TrapCard[] = [
  {
    code: 'D1',
    name: 'Blank-slate / pure-environmentalist',
    oneliner: '"Differences are socialization. Twin studies are flawed. Heritability is a methodological artifact."',
    cites: [
      'Equal environments assumption (EEA) is partially violated in classical twin studies',
      'Adoption studies have selection effects',
      'Cultural variation in trait expression is real',
      'Stereotype threat and social construction effects exist',
    ],
    ignores: [
      'SNP-based heritability bypasses EEA entirely and recovers a substantial fraction of twin h² for most traits (~50–85% depending on trait)',
      'MZ-reared-apart studies (Bouchard 1990 onward) show robust h² without shared environment',
      'Adoption studies converge on similar h² estimates as twin studies',
      'Within-family GWAS gives non-zero direct genetic effects for EA, BMI, height — biology is real',
      'Multivariate sex-difference D ≈ 1.0 (observed) to 2.7 (latent) for personality is large by any measurement standard',
    ],
    integrated:
      "The methodological critiques are partially correct (twin studies have assumptions, EEA is mildly violated, classical ACE is under-determined) but the heritability finding survives every robustness check (SNP-based, MZ-reared-apart, adoption, within-family GWAS). Heritability is not a methodological artifact. The honest version of this position is 'population-level genetic variance ratios are real but they do not license the public-discourse moves people make from them' — which is correct, and is also exactly what the science says.",
  },
  {
    code: 'D2',
    name: 'Hereditarian',
    oneliner: '"Differences are genetic. Group disparities reflect underlying biology. Environment is overrated."',
    cites: [
      'Mean trait heritability ≈ 0.49 (Polderman 2015)',
      'Twin studies replicate across cultures',
      'GWAS hits replicate',
      'Within-family designs find non-zero direct genetic effects',
    ],
    ignores: [
      'About 40–50% of "genetic" effect for socially-structured traits like EA is actually genetic nurture + assortative-mating-induced LD, not direct biological causation',
      "PGS portability collapse: scores trained on European-ancestry samples lose 30–80% of their accuracy in non-European populations (Ding 2023, Martin 2019). The same SNP 'effect sizes' do not estimate the same causal coefficients across populations",
      "L4 (Lewontin) firewall: within-population heritability provides no information about between-population mean differences",
      'High heritability is fully compatible with large environmental shifts (height +10 cm in a century at h² = 0.85)',
      'Severe environmental insults (lead, FAS, deprivation, malnutrition) cost double-digit IQ points each',
    ],
    integrated:
      "Heritability is real and substantial. But the move from 'within-population variance is genetic' to 'between-group means are genetic' is blocked twice: once by the L4 firewall (it is a logical leap, not a deduction), and again by the empirical PGS-portability collapse (the methods that would license such a comparison demonstrably do not work across populations). The hereditarian position survives 'heritability is real'; it does not survive 'within-pop h² licenses between-pop mean inference.'",
  },
  {
    code: 'D3',
    name: 'Gender similarities (single-dimension framing)',
    oneliner: '"Sex differences are tiny. Cite math performance d ≈ 0.05 — men and women are essentially the same."',
    cites: [
      'Math performance d ≈ 0.05 (essentially equal across 1.3M test-takers)',
      'Verbal ability d ≈ 0.10',
      'Many specific cognitive tasks show small or null sex differences',
      'Hyde 2005 "gender similarities hypothesis" is empirically supported for most single dimensions',
    ],
    ignores: [
      'People-things interest difference d ≈ 0.93 (one of the largest effect sizes in psychology, N = 503k)',
      'Multivariate Mahalanobis D ≈ 1.0 at observed level (15-dim 16PF panel) and D ≈ 2.7 at latent level (Del Giudice 2012) — large by any standard',
      'Aggregating weakly-correlated dimensions produces D > max(individual d) by construction',
      'Hyde 2005 was about single dimensions; the multivariate aggregate tells a different story',
    ],
    integrated:
      'Both Hyde 2005 and Del Giudice 2012 are correct about different objects. On any single dimension (math, verbal, neuroticism, etc.), the average sex difference is small. Aggregated across 15+ dimensions of personality with realistic inter-trait correlations, the multivariate distance is large. The "sexes are essentially the same" reading from single-dimension d values undersells the multivariate aggregate; the "Mars and Venus" reading from the multivariate aggregate undersells the within-group overlap. Both halves are true.',
  },
  {
    code: 'D4',
    name: 'Pop evolutionary psychology overreach',
    oneliner: '"Men are X, women are Y. Differences are categorical and evolved."',
    cites: [
      'Multivariate D ≈ 2.7 for personality',
      'People-things interest difference d ≈ 0.93',
      'Cross-cultural replication of mean differences (E14 Gender Equality Paradox)',
      'CAH girls show masculinized toy preferences; primate parallels',
    ],
    ignores: [
      'A6: psychological variation is dimensional, not taxonic — there are no two clean categories for almost any trait',
      "Distribution overlap at D = 1.0 is ~60%; at D = 2.7 is still ~18% — 'categorical' is the wrong shape",
      'Effect-size labels are scale-dependent (L7) — d = 0.5 in clinical context is not the same as d = 0.5 in interest-domain context',
      'Within-group variance is much larger than between-group variance for almost every dimension',
    ],
    integrated:
      "The aggregate sex differences are real and large by Cohen's standards. But 'categorical' (men are X, women are Y) is the wrong shape for any dimensional trait — the distributions overlap substantially even at D = 2.7. Translating a continuous-distribution effect size into 'men are' / 'women are' statements drops the within-group variance and overstates predictive power for any individual.",
  },
];

// ---------------------------------------------------------------------------
// Asymmetric environmental effects (curated from H7 in data stage)
// ---------------------------------------------------------------------------

const ASYMMETRY_EXPOSURES: { name: string; effect: number; type: 'insult' | 'enrichment' | 'mixed'; ci?: string; source: string }[] = [
  { name: 'Prenatal alcohol (full FAS)', effect: -30, ci: '−40 to −20', type: 'insult', source: 'Streissguth 2004' },
  { name: 'Severe deprivation (Romanian orphanages)', effect: -15, ci: '−20 to −10', type: 'insult', source: 'Nelson 2007 BEIP' },
  { name: 'Severe chronic malnutrition', effect: -15, ci: '−20 to −10', type: 'insult', source: 'Grantham-McGregor 2007' },
  { name: 'Adoption: high → low SES family', effect: -12, ci: '−15 to −8', type: 'insult', source: 'Capron & Duyme 1996' },
  { name: 'Severe iodine deficiency', effect: -10, ci: '−12 to −8', type: 'insult', source: 'Bougma 2013' },
  { name: 'Lead, blood 1→10 µg/dL', effect: -6.2, ci: '−8.6 to −3.8', type: 'insult', source: 'Lanphear 2005' },
  { name: 'PM₂.₅ per 1 µg/m³', effect: -0.27, ci: '−0.5 to −0.05', type: 'insult', source: 'Aghaei 2024 meta' },
  { name: 'Within-Western-normal parenting', effect: 1.0, ci: '−1 to +3', type: 'mixed', source: 'Plomin & Daniels 1987' },
  { name: 'Breastfeeding (PROBIT RCT)', effect: 3.2, ci: '+1.5 to +5.0', type: 'enrichment', source: 'Kramer 2008' },
  { name: 'Schooling, per year', effect: 3.4, ci: '+1.0 to +5.0', type: 'enrichment', source: 'Ritchie & Tucker-Drob 2018' },
];

// ---------------------------------------------------------------------------
// Heritability ≠ Destiny (three misreadings)
// ---------------------------------------------------------------------------

type Misreading = { headline: string; misread: string; correct: string; example: string };

const MISREADINGS: Misreading[] = [
  {
    headline: 'Misreading 1 — Population variance treated as individual partition',
    misread:
      "'Cognitive ability is 70% heritable' becomes 'Therefore 70% of MY cognitive ability comes from genes and 30% from environment.'",
    correct:
      "Heritability is a population statistic about the *spread* of a trait, not about any individual person's value. It says: across a population, 70% of why people differ tracks genetic differences. It says nothing about how much of any one person's intelligence is 'genetic' vs. 'environmental' — that decomposition does not exist for an individual.",
    example:
      "Imagine 100 plants of the same genotype, raised in identical pots. Their height heritability in this population is 0% (all variance is environmental — different sun angle, water, etc). But for any single plant, asking 'how much of its height is genetic' is meaningless: the genotype set the type of plant, the environment did the growing, neither percentage applies to one plant. Same for cognitive ability or anything else.",
  },
  {
    headline: 'Misreading 2 — Heritable treated as fixed',
    misread:
      "'If a trait is heritable, environment can't change it. High h² means biology is destiny.'",
    correct:
      "Heritability tells you how variance in a trait *currently* tracks genetic variance in the *current* environmental range. Hold the genes constant and shift the environment outside its current range, and the population mean can move dramatically. High heritability is fully compatible with large environmental shifts.",
    example:
      "Height is 80–85% heritable within any modern Western country. Average adult height has risen about 10 cm in the last century — entirely from environmental change (nutrition, infection control, prenatal care). The same heritability that 'shows height is genetic' coexists with one of the largest environmental shifts in any biological trait. The same logic applies to cognitive ability, where the Flynn Effect raised IQ ~30 points over the 20th century in most populations.",
  },
  {
    headline: 'Misreading 3 — Within-population h² applied to between-population means',
    misread:
      "'Trait is heritable within population A. Trait differs in mean between population A and population B. Therefore the difference between A and B is genetic.'",
    correct:
      "This inference is logically blocked. Within-population heritability — even if it's 0.99 — provides no information about whether between-population mean differences are genetic. The math literally does not connect the two quantities. Empirically, the methods that would license such a comparison (polygenic scores) lose 30–80% of their accuracy across ancestries, so even putting aside the logical block, the tools to make the claim do not work.",
    example:
      "Plant the same genetic mix of corn in fertile soil A and depleted soil B. Within each plot, height heritability is high (variation tracks genetics within each environment). Between plots, the mean difference is entirely environmental (the soil). The within-plot h² tells you nothing about why the plot means differ. Lewontin's original argument from 1970, restated empirically every time someone does the calculation.",
  },
];

// ---------------------------------------------------------------------------
// Take-aways
// ---------------------------------------------------------------------------

const TAKEAWAYS: { title: string; body: string }[] = [
  {
    title: 'Heritability is real, replicated, and substantial.',
    body: 'Across 17,804 traits and 14.5 million twin pairs (Polderman 2015), the mean trait heritability is ~0.49. SNP-based methods that bypass twin assumptions recover most of this. Adoption studies recover most of this. Within-family GWAS find non-zero direct effects. The "twin studies are bunk" position does not survive contact with the cumulative evidence.',
  },
  {
    title: "But it's a population statistic, not an individual partition.",
    body: '"70% heritable" means "70% of why people differ in this population is genetic." It does not mean "70% of any one person\'s value is genetic." Treating it as an individual partition is the most common public-discourse error and produces nonsense in both directions.',
  },
  {
    title: 'About 1/3 to 1/2 of "genetic" effect for socially-structured traits is structural, not direct biology.',
    body: "Assortative mating creates linkage among trait-relevant alleles; genetic nurture means parents create environments matching their own genotypes; classical twin studies pick both up as 'genetic.' Within-family designs separate these out. For educational attainment, twin h² ≈ 0.40 but within-family ≈ 0.15 — the gap is structural inflation, not direct biological causation.",
  },
  {
    title: 'Environmental effects are real and asymmetric.',
    body: "Severe insults — lead, fetal alcohol, severe deprivation, malnutrition — cost 10–30 IQ points each. Removing them recovers those points. Enrichment above the Western normal range — better parenting, breastfeeding, supplements — yields a few points at most. The big policy and parenting levers are at the negative tail (preventing severe insults), not at the positive tail (optimizing within normal).",
  },
  {
    title: 'High heritability is fully compatible with large environmental shifts.',
    body: 'Height: h² ≈ 0.85 within any cohort, +10 cm secular rise over the 20th century from nutrition. IQ: h² ≈ 0.80 in adulthood, +30 points from the Flynn Effect. Same population, same genes, environment shifted, the mean moved. "Heritable means fixed" is the wrong inference.',
  },
  {
    title: 'Sex differences are small per-dimension and large multivariate. Both are true.',
    body: 'On any single dimension — math performance, neuroticism, agreeableness — the average sex difference is small (Cohen d ≈ 0.05–0.50). Aggregated across 15 dimensions of personality, the multivariate Mahalanobis distance is D ≈ 1.0 (observed) to 2.7 (latent), which is large by any standard. People-things interest is the largest single-dimension difference (d ≈ 0.93). The framing trap from each side picks one of these and ignores the other.',
  },
  {
    title: 'Within-population heritability does not license between-population claims.',
    body: 'This is the Lewontin firewall and it is unfalsifiable — a logical/algebraic point, not an empirical claim. The empirical buttress is that polygenic scores lose 30–80% of their accuracy across ancestries (Ding 2023, Martin 2019), so even the methods that would attempt such a comparison do not currently work. Mean differences between groups exist on many traits; whether they have a genetic component is, in 2026, scientifically unanswered with available methods.',
  },
];

// ---------------------------------------------------------------------------
// View routing
// ---------------------------------------------------------------------------

type View = 'trait' | 'traps' | 'asymmetry' | 'destiny' | 'takeaways';

const VIEWS: { key: View; label: string; symbol: string }[] = [
  { key: 'trait',      label: 'Trait lookup',           symbol: '01' },
  { key: 'traps',      label: 'The four traps',         symbol: '02' },
  { key: 'asymmetry',  label: 'The asymmetry',          symbol: '03' },
  { key: 'destiny',    label: 'Heritability ≠ destiny', symbol: '04' },
  { key: 'takeaways',  label: 'Take away',              symbol: '05' },
];

export default function PsychVariationExplorer() {
  const [view, setView] = useState<View>('trait');
  return (
    <div className="not-prose border border-rule rounded-md bg-paper-edge/40 p-5 md:p-6 my-8">
      <div className="flex flex-wrap gap-1.5 mb-5">
        {VIEWS.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={
              'px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider border rounded transition-colors ' +
              (view === v.key
                ? 'border-accent text-accent bg-paper'
                : 'border-rule text-muted hover:text-accent hover:border-accent')
            }
          >
            <span className="text-accent-soft mr-1.5">{v.symbol}</span>
            {v.label}
          </button>
        ))}
      </div>
      {view === 'trait' && <TraitView />}
      {view === 'traps' && <TrapsView />}
      {view === 'asymmetry' && <AsymmetryView />}
      {view === 'destiny' && <DestinyView />}
      {view === 'takeaways' && <TakeawaysView />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trait view
// ---------------------------------------------------------------------------

const DOMAIN_LABEL: Record<Domain, string> = {
  cognitive: 'Cognition',
  personality: 'Personality',
  psychiatric: 'Psychiatric',
  attitudes: 'Attitudes',
  physical: 'Physical',
};

function TraitView() {
  const [traitSlug, setTraitSlug] = useState(TRAITS[0].slug);
  const trait = TRAITS.find(t => t.slug === traitSlug)!;

  const grouped: Record<Domain, Trait[]> = {
    cognitive: [], personality: [], psychiatric: [], attitudes: [], physical: [],
  };
  TRAITS.forEach(t => grouped[t.domain].push(t));

  return (
    <div>
      <h4 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3">Pick a trait</h4>

      <div className="space-y-2 mb-6">
        {(Object.keys(grouped) as Domain[]).map(d => grouped[d].length > 0 && (
          <div key={d} className="flex items-baseline gap-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted w-[80px] shrink-0 pt-1">
              {DOMAIN_LABEL[d]}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {grouped[d].map(t => (
                <button
                  key={t.slug}
                  onClick={() => setTraitSlug(t.slug)}
                  className={
                    'px-2.5 py-1 text-[11px] border rounded transition-colors ' +
                    (traitSlug === t.slug
                      ? 'border-accent text-accent bg-paper font-mono uppercase tracking-wider'
                      : 'border-rule text-ink-soft hover:text-accent hover:border-accent')
                  }
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-rule pt-5">
        <h3 className="font-display text-[22px] text-ink leading-tight mb-2">{trait.name}</h3>
        <p className="text-[14px] text-ink-soft leading-relaxed mb-5">{trait.oneliner}</p>

        <h5 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-2">
          Why people differ — three buckets
        </h5>
        <ThreeBucketBar trait={trait} />

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <BucketDetail
            color="#1a1614"
            label="Direct genes"
            pct={trait.variance.direct}
            note="The slice that's actually direct biological causation. What within-family designs (sib-FE, MZ-discordant, parent-offspring trio GWAS) recover after stripping out parental environment and assortative-mating inflation."
          />
          <BucketDetail
            color="#8a4a2b"
            label="Family setup"
            pct={trait.variance.family}
            note={trait.familyNote}
          />
          <BucketDetail
            color="#a89677"
            label="Environment + chance"
            pct={trait.variance.env}
            note={trait.envNote}
          />
        </div>

        {(trait.insults && trait.insults.length > 0) || (trait.enrichments && trait.enrichments.length > 0) ? (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {trait.insults && trait.insults.length > 0 && (
              <div>
                <h5 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-2">
                  Severe negative levers (when present)
                </h5>
                <ul className="space-y-1.5 text-[12px]">
                  {trait.insults.map(i => (
                    <li key={i.name} className="flex items-baseline justify-between gap-3 border-b border-rule-soft pb-1">
                      <span className="text-ink">{i.name}</span>
                      <span className="font-mono text-ink-soft text-right shrink-0">
                        {i.effect}
                        <span className="text-muted block text-[10px] mt-0.5">{i.source}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {trait.enrichments && trait.enrichments.length > 0 && (
              <div>
                <h5 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-2">
                  Positive levers
                </h5>
                <ul className="space-y-1.5 text-[12px]">
                  {trait.enrichments.map(e => (
                    <li key={e.name} className="flex items-baseline justify-between gap-3 border-b border-rule-soft pb-1">
                      <span className="text-ink">{e.name}</span>
                      <span className="font-mono text-ink-soft text-right shrink-0">
                        {e.effect}
                        <span className="text-muted block text-[10px] mt-0.5">{e.source}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <TrapBox label="What environmentalist readings get wrong here" body={trait.trapEnv} />
          <TrapBox label="What hereditarian readings get wrong here" body={trait.trapHer} />
        </div>

        <div className="mt-6 border-l-2 border-accent pl-4 py-1">
          <h5 className="text-[11px] font-mono uppercase tracking-wider text-accent mb-1.5">
            Take away
          </h5>
          <p className="text-[13px] text-ink leading-relaxed">{trait.takeaway}</p>
        </div>

        <div className="mt-5 pt-4 border-t border-rule-soft">
          <h5 className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">Primary sources</h5>
          <ul className="text-[11px] font-mono text-muted space-y-1">
            {trait.primarySources.map(s => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-ink-soft hover:text-accent transition-colors">
                  {s.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ThreeBucketBar({ trait }: { trait: Trait }) {
  const total = trait.variance.direct + trait.variance.family + trait.variance.env;
  const norm = (v: number) => (v / total) * 100;
  return (
    <div className="space-y-2">
      <div className="h-9 w-full flex rounded overflow-hidden border border-rule">
        <div className="h-full transition-all" style={{ width: `${norm(trait.variance.direct)}%`, backgroundColor: '#1a1614' }} />
        <div className="h-full transition-all" style={{ width: `${norm(trait.variance.family)}%`, backgroundColor: '#8a4a2b' }} />
        <div className="h-full transition-all" style={{ width: `${norm(trait.variance.env)}%`, backgroundColor: '#a89677' }} />
      </div>
      <div className="grid grid-cols-3 gap-3 text-[11px] font-mono">
        <div className="flex items-center justify-between">
          <span className="flex items-center text-muted">
            <span className="inline-block w-2 h-2 mr-2 rounded-sm" style={{ backgroundColor: '#1a1614' }} />
            Direct genes
          </span>
          <span className="text-ink">{(trait.variance.direct * 100).toFixed(0)}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center text-muted">
            <span className="inline-block w-2 h-2 mr-2 rounded-sm" style={{ backgroundColor: '#8a4a2b' }} />
            Family setup
          </span>
          <span className="text-ink">{(trait.variance.family * 100).toFixed(0)}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center text-muted">
            <span className="inline-block w-2 h-2 mr-2 rounded-sm" style={{ backgroundColor: '#a89677' }} />
            Env + chance
          </span>
          <span className="text-ink">{(trait.variance.env * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

function BucketDetail({ color, label, pct, note }: { color: string; label: string; pct: number; note: string }) {
  return (
    <div className="border-t border-rule-soft pt-3">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
        <span className="text-[11px] font-mono uppercase tracking-wider text-muted">{label}</span>
        <span className="font-mono text-[13px] text-ink ml-auto">{(pct * 100).toFixed(0)}%</span>
      </div>
      <p className="text-[12px] text-ink-soft leading-relaxed">{note}</p>
    </div>
  );
}

function TrapBox({ label, body }: { label: string; body: string }) {
  return (
    <div className="border border-rule-soft rounded p-3 bg-paper">
      <h5 className="text-[10px] font-mono uppercase tracking-wider text-accent-soft mb-1.5">{label}</h5>
      <p className="text-[12px] text-ink-soft leading-relaxed">{body}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Traps view
// ---------------------------------------------------------------------------

function TrapsView() {
  return (
    <div>
      <h3 className="font-display text-[22px] text-ink leading-tight mb-2">The four traps</h3>
      <p className="text-[13px] text-ink-soft mb-6 leading-relaxed">
        Each of these is a common public-discourse position about psychological variation. None is fully wrong — each cites real evidence. Each is also incomplete, and the incompleteness is in a specific, identifiable direction. The integrated reading at the bottom of each card is what the data actually supports when the omitted evidence is added back in.
      </p>
      <div className="space-y-5">
        {TRAPS.map(t => (
          <div key={t.code} className="border border-rule rounded p-4 bg-paper">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-accent-soft">{t.code}</span>
              <h4 className="font-display text-[17px] text-ink leading-tight">{t.name}</h4>
            </div>
            <p className="text-[13px] italic text-ink-soft mb-4">{t.oneliner}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <h5 className="text-[10px] font-mono uppercase tracking-wider text-muted mb-1.5">What it cites correctly</h5>
                <ul className="text-[12px] text-ink-soft space-y-1 leading-snug">
                  {t.cites.map(c => <li key={c} className="pl-3 -indent-3">— {c}</li>)}
                </ul>
              </div>
              <div>
                <h5 className="text-[10px] font-mono uppercase tracking-wider text-muted mb-1.5">What it ignores</h5>
                <ul className="text-[12px] text-ink-soft space-y-1 leading-snug">
                  {t.ignores.map(c => <li key={c} className="pl-3 -indent-3">— {c}</li>)}
                </ul>
              </div>
            </div>

            <div className="border-l-2 border-accent pl-3 py-1 mt-3">
              <h5 className="text-[10px] font-mono uppercase tracking-wider text-accent mb-1">Integrated reading</h5>
              <p className="text-[12px] text-ink leading-relaxed">{t.integrated}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted mt-5 leading-relaxed">
        All four traps work by selective citation: they each cite real findings and ignore other real findings. The integrated picture requires holding all of it at once — large heritability *and* large structural inflation; small per-dimension sex differences *and* large multivariate ones; high within-population h² *and* a logical block on between-population inference. Any single-direction narrative is structurally incomplete.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Asymmetry view
// ---------------------------------------------------------------------------

function AsymmetryView() {
  const sorted = [...ASYMMETRY_EXPOSURES].sort((a, b) => a.effect - b.effect);
  const minE = -32;
  const maxE = 6;
  const span = maxE - minE;
  const zeroPct = ((0 - minE) / span) * 100;

  return (
    <div>
      <h3 className="font-display text-[22px] text-ink leading-tight mb-2">The asymmetry</h3>
      <p className="text-[13px] text-ink-soft mb-2 leading-relaxed">
        The single most useful empirical pattern in this field. Severe environmental insults — lead, fetal alcohol, severe deprivation, malnutrition, iodine deficiency — cost 10 to 30 IQ points each. Removing them recovers those points. Enrichment above the Western normal range — better parenting, breastfeeding, supplements — yields a few points at most.
      </p>
      <p className="text-[13px] text-ink-soft mb-6 leading-relaxed">
        This asymmetry is why high-heritability findings and large environmental effects coexist without contradiction. Heritability is a population-variance statistic; it depends on which environmental variation is currently present. In any modern country that has already removed the worst environmental tails, most remaining variance is genetic — not because environment doesn't matter, but because you already removed the environmental factors that mattered most.
      </p>

      <div className="space-y-1.5 text-[12px]">
        <div className="grid grid-cols-[210px_1fr_140px] gap-3 text-[10px] font-mono uppercase tracking-wider text-muted pb-1 border-b border-rule-soft">
          <span>exposure</span>
          <span>effect on cognitive ability (IQ pts)</span>
          <span className="text-right">source</span>
        </div>
        {sorted.map(r => {
          const isNeg = r.effect < 0;
          const effectPct = ((r.effect - minE) / span) * 100;
          return (
            <div key={r.name} className="grid grid-cols-[210px_1fr_140px] gap-3 items-center">
              <span className="text-ink leading-tight">{r.name}</span>
              <div className="relative h-5 bg-paper border border-rule-soft rounded-sm">
                <div className="absolute top-0 bottom-0 w-px bg-rule" style={{ left: `${zeroPct}%` }} />
                <div
                  className="absolute top-0 bottom-0 w-1 rounded"
                  style={{ left: `${effectPct}%`, backgroundColor: isNeg ? '#8a4a2b' : '#1a1614' }}
                />
                <span
                  className="absolute top-0.5 text-[10px] font-mono text-ink-soft"
                  style={{ left: isNeg ? `${Math.min(effectPct + 1.5, 80)}%` : `${Math.max(effectPct - 4, 1)}%` }}
                >
                  {r.effect > 0 ? '+' : ''}{r.effect.toFixed(1)}
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted text-right leading-tight">{r.source}</span>
            </div>
          );
        })}
        <div className="grid grid-cols-[210px_1fr_140px] gap-3 pt-1">
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

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-rule-soft rounded p-3 bg-paper">
          <h5 className="text-[10px] font-mono uppercase tracking-wider text-accent mb-1.5">For parents</h5>
          <p className="text-[12px] text-ink-soft leading-relaxed">
            The big levers are at the negative tail: prevent severe insults (lead exposure, prenatal alcohol, severe deprivation, severe early malnutrition, untreated iodine deficiency). Within the Western normal range, additional optimization of parenting style, enrichment activities, and educational supplements yields a few IQ points at most. Anxiety about "optimizing" within normal is mostly misallocated.
          </p>
        </div>
        <div className="border border-rule-soft rounded p-3 bg-paper">
          <h5 className="text-[10px] font-mono uppercase tracking-wider text-accent mb-1.5">For policy</h5>
          <p className="text-[12px] text-ink-soft leading-relaxed">
            Lead remediation, iodine fortification, fetal-alcohol prevention, basic nutrition, schooling access are the highest-effect-per-dollar cognitive interventions ever measured. Universal pre-K and similar middle-of-the-distribution interventions show genuine but smaller effects. Programs targeted at "enrichment above normal" generally do not move long-term outcomes.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heritability ≠ Destiny view
// ---------------------------------------------------------------------------

function DestinyView() {
  return (
    <div>
      <h3 className="font-display text-[22px] text-ink leading-tight mb-2">Heritability ≠ destiny</h3>
      <p className="text-[13px] text-ink-soft mb-6 leading-relaxed">
        The three most common public-discourse misreadings of "X is heritable." Each is a real logical/statistical error, and each has a clean correction. Internalizing these three is most of what it takes to read pop-science coverage of genetics without being captured by motivated reasoning from any direction.
      </p>
      <div className="space-y-5">
        {MISREADINGS.map((m, i) => (
          <div key={i} className="border border-rule rounded p-4 bg-paper">
            <h4 className="font-display text-[17px] text-ink leading-tight mb-3">{m.headline}</h4>
            <div className="space-y-3">
              <div>
                <h5 className="text-[10px] font-mono uppercase tracking-wider text-accent-soft mb-1">The misreading</h5>
                <p className="text-[12px] italic text-ink-soft leading-relaxed">{m.misread}</p>
              </div>
              <div>
                <h5 className="text-[10px] font-mono uppercase tracking-wider text-accent mb-1">What's actually true</h5>
                <p className="text-[12px] text-ink leading-relaxed">{m.correct}</p>
              </div>
              <div className="border-l-2 border-rule pl-3">
                <h5 className="text-[10px] font-mono uppercase tracking-wider text-muted mb-1">Worked example</h5>
                <p className="text-[12px] text-ink-soft leading-relaxed">{m.example}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Take-aways view
// ---------------------------------------------------------------------------

function TakeawaysView() {
  return (
    <div>
      <h3 className="font-display text-[22px] text-ink leading-tight mb-2">Seven things to actually believe</h3>
      <p className="text-[13px] text-ink-soft mb-6 leading-relaxed">
        The integrated reading the formalization (Stage 3) and data pipeline (Stage 4) support. None of these is contested within mainstream behavior genetics in 2026. The contested questions sit at finer-grained resolutions — magnitudes per trait, mechanism per finding, what polygenic scores actually measure — but the seven bullets below are field-level consensus.
      </p>
      <ol className="space-y-4">
        {TAKEAWAYS.map((t, i) => (
          <li key={i} className="grid grid-cols-[28px_1fr] gap-3 border-l-2 border-accent pl-4 py-1">
            <span className="font-display text-[20px] text-accent leading-none pt-0.5">{i + 1}</span>
            <div>
              <h4 className="font-display text-[15px] text-ink leading-tight mb-1">{t.title}</h4>
              <p className="text-[12px] text-ink-soft leading-relaxed">{t.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-7 pt-5 border-t border-rule-soft">
        <h5 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-2">Where this came from</h5>
        <p className="text-[11px] text-muted leading-relaxed">
          Numbers are frozen from the data pipeline (Stage 4). Curated CSVs are downloadable at{' '}
          <a href="/data/human-psych-variation/" className="text-ink-soft hover:text-accent transition-colors">/data/human-psych-variation/</a>.
          {' '}For the formalization that generates the variance decomposition, see{' '}
          <a href="/ai-research/human-psych-variation/model" className="text-ink-soft hover:text-accent transition-colors">the model stage</a>.
          {' '}For the per-prediction empirical tests, see{' '}
          <a href="/ai-research/human-psych-variation/data" className="text-ink-soft hover:text-accent transition-colors">the data stage</a>.
        </p>
      </div>
    </div>
  );
}

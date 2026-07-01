// The rating rubric: axis definitions + per-level descriptions, verbatim from
// the study's rubric doc. Rendered in the Rate view's rubric panel and as
// hover hints on the score buttons.

import type { AxisKey } from './types';

export type AxisDef = {
  key: AxisKey;
  label: string;
  short: string;
  kind: 'evaluative' | 'descriptive';
  wip?: boolean;
  question: string;
  // levels[0] = score 5 … levels[4] = score 1
  levels: [string, string, string, string, string];
};

export const AXES: AxisDef[] = [
  {
    key: 'grounding',
    label: 'Grounding',
    short: 'G',
    kind: 'evaluative',
    question:
      'Does this theme accurately reflect patterns present in the data? For surface/semantic themes, the supporting text demonstrates the theme. For interpretive themes, the argument connecting the supporting text to the theme is specific, traceable, and convincing.',
    levels: [
      'The theme accurately reflects patterns in the data. Extracts clearly demonstrate the claimed pattern. Interpretive arguments, where present, are specific and traceable to particular extracts.',
      'The theme mostly reflects patterns in the data. Extracts largely demonstrate the claimed pattern with minor mismatches. Interpretive arguments, where present, are mostly traceable with minor gaps.',
      'The theme partially reflects patterns in the data. Some extracts demonstrate the claimed pattern while others fit loosely. Interpretive arguments, where present, are vague or only partially traceable.',
      'The theme loosely reflects patterns in the data. Few extracts clearly demonstrate the claimed pattern. Interpretive arguments, where present, are weak or difficult to trace to specific extracts.',
      'The theme does not reflect patterns present in the data. Extracts do not demonstrate the claimed pattern. Interpretive arguments, where present, are absent or unconvincing.',
    ],
  },
  {
    key: 'researchQuestionFit',
    label: 'Research question fit',
    short: 'RQF',
    kind: 'evaluative',
    question:
      'Does this theme contribute to advancing the analysis, and is it relevant to the research question at the specificity and depth it demands?',
    levels: [
      'The theme directly addresses the research question at the specificity and depth it demands. It contributes a clear, well matched understanding that meaningfully advances the analysis.',
      'The theme mostly addresses the research question with minor mismatches in specificity or depth. It contributes understanding that largely advances the analysis.',
      'The theme partially addresses the research question with noticeable mismatches in specificity or depth. It contributes understanding that only partially advances the analysis.',
      'The theme tangentially addresses the research question with significant mismatches in specificity or depth. It contributes little understanding that advances the analysis.',
      'The theme does not address the research question. It contributes no understanding that advances the analysis.',
    ],
  },
  {
    key: 'interpretationLevel',
    label: 'Interpretation level',
    short: 'IL',
    kind: 'descriptive',
    question:
      'How far beyond the surface text does this theme go? Documents interpretive/analytical depth — a surface-level theme is not worse than a deeply interpretive one; the appropriate level depends on the research question.',
    levels: [
      'The theme goes substantially beyond the surface text in connecting patterns to underlying dynamics or frameworks. It requires significant inference that draws on knowledge beyond what the text directly states.',
      'The theme goes clearly beyond the surface text, framing patterns using broader context. It requires considerable inference beyond what the text directly states.',
      'The theme goes moderately beyond the surface text, identifying patterns not explicit in any text extracts. It requires moderate inference beyond what the text directly states.',
      'The theme goes slightly beyond the surface text, grouping similar content under a broader label. It requires minimal inference beyond what the text directly states.',
      'The theme does not go beyond the surface of the text, restating or summarizing what text extracts say. It requires no inference beyond what the text directly states.',
    ],
  },
  {
    key: 'aiPriorNovelty',
    label: 'AI prior novelty',
    short: 'PN',
    kind: 'descriptive',
    question:
      "Does this theme's subject matter appear in the AI no-data baseline output?",
    levels: [
      'The theme has no counterpart in the AI no-data baseline. The baseline does not capture this pattern or the territory it occupies.',
      'The theme has no clear counterpart in the AI no-data baseline. The baseline does not capture this pattern, though it may touch adjacent territory.',
      'The theme has a partial counterpart in the AI no-data baseline. The baseline approaches this pattern but does not fully capture it.',
      'The theme has a close counterpart in the AI no-data baseline. The baseline captures the core of this pattern with only minor differences.',
      'The theme has a direct counterpart in the AI no-data baseline. The baseline captures this pattern with no meaningful difference.',
    ],
  },
  {
    key: 'analyticalNovelty',
    label: 'Analytical novelty',
    short: 'AN',
    kind: 'descriptive',
    question:
      'Would someone familiar with the domain already know or infer this without reading the data?',
    levels: [
      'The theme provides an insight that could not be anticipated without reading the data. The understanding goes well beyond what domain familiarity alone would provide.',
      'The theme provides an insight that would probably not be anticipated without reading the data. The understanding goes substantially beyond what domain familiarity alone would provide.',
      'The theme provides an insight that might not be anticipated without reading the data. The understanding goes meaningfully beyond what domain familiarity alone would provide.',
      'The theme provides an insight that could largely be anticipated without reading the data. The understanding goes only slightly beyond what domain familiarity alone would provide.',
      'The theme provides an insight that could readily be anticipated without reading the data. The understanding does not go beyond what domain familiarity alone would provide.',
    ],
  },
  {
    key: 'positionalityInfluence',
    label: 'Positionality influence',
    short: 'PI',
    kind: 'descriptive',
    wip: true,
    question:
      'WIP — How much the theme differs from the neutral positionality, or how much the theme seems influenced by the instantiated positionality. Use N/A on runs with no positionality.',
    levels: [
      'The theme is strongly shaped by the instantiated positionality — its framing, salience, and content clearly differ from what a neutral run produces.',
      'The theme is clearly shaped by the positionality, with visible differences in framing or emphasis from the neutral run.',
      'The theme is moderately shaped by the positionality — some framing or emphasis reflects it, but the core would likely appear in a neutral run.',
      'The theme is slightly shaped by the positionality — minor wording or emphasis differences only.',
      'The theme shows no discernible influence of the positionality — it matches what a neutral run produces.',
    ],
  },
];

export const AXIS_BY_KEY = new Map(AXES.map((a) => [a.key, a]));

// Pairwise similarity axis (rated on theme pairs in compare mode, not on a
// single theme).
export const SIMILARITY_RUBRIC = {
  label: 'Theme similarity',
  question: 'How much overlap do these two themes share?',
  levels: [
    'The two themes have near-total overlap in what they capture. Merging them would lose no meaningful analytical content.',
    'The two themes have strong overlap in what they capture. Merging them would lose only a small amount of analytical content.',
    'The two themes have moderate overlap in what they capture. Merging them would lose a noticeable amount of analytical content.',
    'The two themes have slight overlap in what they capture. Merging them would lose a substantial amount of analytical content.',
    'The two themes have minimal overlap in what they capture. Merging them would lose nearly all distinct analytical content.',
  ] as const,
};

// levels[] is ordered 5→1; score → description.
export function levelText(levels: readonly string[], score: 1 | 2 | 3 | 4 | 5): string {
  return levels[5 - score];
}

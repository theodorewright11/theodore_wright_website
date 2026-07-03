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
      'Does this theme accurately reflect patterns present in the data? For surface/semantic themes, the supporting text from the data demonstrates the theme. For interpretive themes, the argument connecting the supporting text from the data to the theme is specific, traceable, and convincing.',
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
      'Does this theme contribute to advancing the analysis and is it relevant to the research question at the specificity and depth it demands?',
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
    key: 'novelty',
    label: 'Novelty',
    short: 'N',
    kind: 'descriptive',
    question:
      'Would someone familiar with the domain already know or infer this without reading the data?',
    levels: [
      'The theme provides an insight that could not be readily anticipated. The understanding goes well beyond obvious or expected patterns.',
      'The theme provides an insight that would probably not be readily anticipated. The understanding goes substantially beyond obvious or expected patterns.',
      'The theme provides an insight that might not be readily anticipated. The understanding goes meaningfully beyond obvious or expected patterns.',
      'The theme provides an insight that could largely be anticipated. The understanding goes only slightly beyond obvious or expected patterns.',
      'The theme provides an insight that could readily be anticipated. The understanding does not go beyond obvious or expected patterns.',
    ],
  },
  {
    key: 'dataContribution',
    label: 'Data contribution',
    short: 'DC',
    kind: 'descriptive',
    question: "How much does this theme's content appear in the no-data baseline?",
    levels: [
      'The theme has no counterpart in the AI no-data baseline. The baseline does not capture this pattern or the territory it occupies.',
      'The theme has no clear counterpart in the AI no-data baseline. The baseline does not capture this pattern, though it may touch adjacent territory.',
      'The theme has a partial counterpart in the AI no-data baseline. The baseline approaches this pattern but does not fully capture it.',
      'The theme has a close counterpart in the AI no-data baseline. The baseline captures the core of this pattern with only minor differences.',
      'The theme has a direct counterpart in the AI no-data baseline. The baseline captures this pattern with no meaningful difference.',
    ],
  },
  {
    key: 'positionalityContribution',
    label: 'Positionality contribution',
    short: 'PC',
    kind: 'descriptive',
    question: "How much does this theme's content appear in the no-positionality baseline?",
    levels: [
      'The theme has no counterpart in the AI no-positionality baseline. The baseline does not capture this pattern or the territory it occupies.',
      'The theme has no clear counterpart in the AI no-positionality baseline. The baseline does not capture this pattern, though it may touch adjacent territory.',
      'The theme has a partial counterpart in the AI no-positionality baseline. The baseline approaches this pattern but does not fully capture it.',
      'The theme has a close counterpart in the AI no-positionality baseline. The baseline captures the core of this pattern with only minor differences.',
      'The theme has a direct counterpart in the AI no-positionality baseline. The baseline captures this pattern with no meaningful difference.',
    ],
  },
];

export const AXIS_BY_KEY = new Map(AXES.map((a) => [a.key, a]));

// Pairwise similarity axis (rated on theme pairs, not on a single theme).
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

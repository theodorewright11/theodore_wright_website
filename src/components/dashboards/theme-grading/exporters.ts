// Per-run export mirroring the qual-coding dashboard's themes-ratings JSON:
// downloads as `<run name>.themes-ratings.json` and keeps the same per-theme
// shape (name / definition / reasoning / ratings / similarities / quotes) so
// the downstream comparison pipeline can treat both tools' outputs alike.

import { buildRunName } from './runName';
import type { AppState, AxisScore, Run } from './types';

function scoreOut(v: AxisScore | undefined): number | 'NA' | null {
  if (v === undefined) return null;
  return v === 'na' ? 'NA' : v;
}

export function runThemesRatingsJSON(run: Run, state: AppState): unknown {
  const themeIndex = new Map<string, { run: Run; themeName: string }>();
  for (const r of state.runs) {
    for (const t of r.themes) themeIndex.set(t.id, { run: r, themeName: t.name });
  }
  const corpus = run.corpusId ? state.corpora.find((c) => c.id === run.corpusId) : undefined;

  return {
    run: {
      name: buildRunName(run),
      model: run.model || null,
      promptVariant: run.promptVariant || null,
      version: run.version || null,
      dataSource: run.dataSource || null,
      rq: run.rq || null,
      positionality: run.positionality || null,
      runN: run.runN ?? null,
      corpus: corpus?.name ?? null,
      notes: run.notes ?? null,
      created_at: run.created_at,
    },
    themes: run.themes.map((t) => ({
      name: t.name,
      definition: t.definition ?? null,
      reasoning: t.reasoning ?? null,
      ratings: {
        grounding: scoreOut(t.rating.grounding),
        researchQuestionFit: scoreOut(t.rating.researchQuestionFit),
        interpretationLevel: scoreOut(t.rating.interpretationLevel),
        novelty: scoreOut(t.rating.novelty),
        dataContribution: scoreOut(t.rating.dataContribution),
        positionalityContribution: scoreOut(t.rating.positionalityContribution),
        notes: t.rating.notes ?? null,
      },
      similarities: state.similarities
        .filter((s) => s.themeA === t.id || s.themeB === t.id)
        .map((s) => {
          const otherId = s.themeA === t.id ? s.themeB : s.themeA;
          const other = themeIndex.get(otherId);
          if (!other) return null;
          return {
            other: other.themeName,
            otherRun: other.run.id === run.id ? null : buildRunName(other.run),
            similarity: scoreOut(s.similarity),
            notes: s.notes ?? null,
          };
        })
        .filter(Boolean),
      quotes: t.quotes.map((q) => ({
        text: q.text,
        source: q.source ?? null,
        role: q.role ?? null,
        anchored: !!q.anchor,
        possibleSources: q.possibleSources ?? undefined,
      })),
      all_supporting_data: t.supportingData ?? null,
    })),
    additional_text: run.additionalText ?? null,
  };
}

export function runExportFilename(run: Run): string {
  return `${buildRunName(run)}.themes-ratings.json`;
}

import { buildRunName } from './runName';
import type {
  AppState,
  AxisScore,
  Corpus,
  CorpusDoc,
  RatedTheme,
  Run,
  SimilarityPair,
  ThemeQuote,
} from './types';
import { AXIS_KEYS } from './types';

const KEY = 'tw-theme-grading-v1';

const empty: AppState = {
  version: 1,
  corpora: [],
  runs: [],
  similarities: [],
  activeRunId: null,
  view: 'runs',
  showDefinition: true,
  showReasoning: true,
  showQuotes: true,
  showQuoteSources: true,
  showSupportingData: true,
  showRubricHints: false,
  deletedRunIds: [],
  deletedCorpusIds: [],
};

export function loadState(): AppState {
  if (typeof window === 'undefined') return empty;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1) return coerceState(parsed);
  } catch {
    // fall through
  }
  return empty;
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function coerceState(p: any): AppState {
  return {
    version: 1,
    corpora: Array.isArray(p.corpora) ? p.corpora.map(coerceCorpus) : [],
    runs: Array.isArray(p.runs) ? p.runs.map(coerceRun) : [],
    similarities: Array.isArray(p.similarities)
      ? p.similarities
          .filter(
            (s: any) => s && typeof s.themeA === 'string' && typeof s.themeB === 'string',
          )
          .map(
            (s: any): SimilarityPair => ({
              id: typeof s.id === 'string' ? s.id : cryptoRandomId(),
              themeA: s.themeA,
              themeB: s.themeB,
              similarity: coerceScore(s.similarity),
              notes: typeof s.notes === 'string' ? s.notes : undefined,
              created_at:
                typeof s.created_at === 'string' ? s.created_at : new Date().toISOString(),
            }),
          )
      : [],
    activeRunId: typeof p.activeRunId === 'string' ? p.activeRunId : null,
    rateRunIds: Array.isArray(p.rateRunIds)
      ? p.rateRunIds.filter((s: any) => typeof s === 'string').slice(0, 4)
      : undefined,
    view: p.view === 'rate' || p.view === 'explore' ? p.view : 'runs',
    showDefinition: p.showDefinition !== false,
    showReasoning: p.showReasoning !== false,
    showQuotes: p.showQuotes !== false,
    showQuoteSources: p.showQuoteSources !== false,
    showSupportingData: p.showSupportingData !== false,
    showRubricHints: !!p.showRubricHints,
    deletedRunIds: Array.isArray(p.deletedRunIds)
      ? p.deletedRunIds.filter((s: any) => typeof s === 'string')
      : [],
    deletedCorpusIds: Array.isArray(p.deletedCorpusIds)
      ? p.deletedCorpusIds.filter((s: any) => typeof s === 'string')
      : [],
    drive:
      p.drive && typeof p.drive === 'object' && p.drive.folderId && p.drive.stateFileId
        ? {
            folderId: String(p.drive.folderId),
            stateFileId: String(p.drive.stateFileId),
            modifiedTime:
              typeof p.drive.modifiedTime === 'string' ? p.drive.modifiedTime : undefined,
          }
        : undefined,
    updated_at: typeof p.updated_at === 'string' ? p.updated_at : undefined,
  };
}

function coerceCorpus(c: any): Corpus {
  return {
    id: typeof c?.id === 'string' ? c.id : cryptoRandomId(),
    name: typeof c?.name === 'string' ? c.name : 'Untitled corpus',
    docs: Array.isArray(c?.docs)
      ? c.docs
          .filter((d: any) => d && typeof d.text === 'string')
          .map((d: any): CorpusDoc => ({
            extId: typeof d.extId === 'string' ? d.extId : '',
            text: d.text,
            dnum: typeof d.dnum === 'number' && d.dnum >= 1 ? d.dnum : undefined,
          }))
      : [],
    created_at: typeof c?.created_at === 'string' ? c.created_at : new Date().toISOString(),
  };
}

export function coerceRun(r: any): Run {
  const str = (v: any): string => (typeof v === 'string' ? v : '');
  return {
    id: typeof r?.id === 'string' ? r.id : cryptoRandomId(),
    corpusId: typeof r?.corpusId === 'string' ? r.corpusId : null,
    model: str(r?.model),
    // Legacy field names from the first cut: condition → promptVariant,
    // researchQuestion → rq, repeat → runN.
    promptVariant: str(r?.promptVariant) || str(r?.condition),
    version: str(r?.version),
    dataSource: str(r?.dataSource),
    rq: str(r?.rq) || str(r?.researchQuestion),
    positionality: str(r?.positionality),
    runN:
      (typeof r?.runN === 'string' && r.runN.trim() ? r.runN : undefined) ??
      (typeof r?.repeat === 'string' && r.repeat.trim() ? r.repeat : undefined),
    notes: typeof r?.notes === 'string' && r.notes.trim() ? r.notes : undefined,
    themes: Array.isArray(r?.themes) ? r.themes.map(coerceTheme) : [],
    additionalText:
      typeof r?.additionalText === 'string' && r.additionalText.trim()
        ? r.additionalText
        : undefined,
    created_at: typeof r?.created_at === 'string' ? r.created_at : new Date().toISOString(),
    updated_at: typeof r?.updated_at === 'string' ? r.updated_at : new Date().toISOString(),
  };
}

// Rubric-rename migration (2026-07): old axis keys → current ones. Old
// aiPriorNovelty became Data contribution, analyticalNovelty became Novelty,
// positionalityInfluence became Positionality contribution.
const LEGACY_AXIS_KEYS: Record<string, (typeof AXIS_KEYS)[number]> = {
  aiPriorNovelty: 'dataContribution',
  analyticalNovelty: 'novelty',
  positionalityInfluence: 'positionalityContribution',
};

function coerceTheme(t: any): RatedTheme {
  const rating: RatedTheme['rating'] = {};
  if (t?.rating && typeof t.rating === 'object') {
    for (const [legacy, current] of Object.entries(LEGACY_AXIS_KEYS)) {
      const v = coerceScore(t.rating[legacy]);
      if (v !== undefined) rating[current] = v;
    }
    for (const k of AXIS_KEYS) {
      const v = coerceScore(t.rating[k]);
      if (v !== undefined) rating[k] = v;
    }
    if (typeof t.rating.notes === 'string' && t.rating.notes.trim()) {
      rating.notes = t.rating.notes;
    }
  }
  return {
    id: typeof t?.id === 'string' ? t.id : cryptoRandomId(),
    name: typeof t?.name === 'string' ? t.name : 'Untitled theme',
    definition: typeof t?.definition === 'string' && t.definition.trim() ? t.definition : undefined,
    reasoning: typeof t?.reasoning === 'string' && t.reasoning.trim() ? t.reasoning : undefined,
    supportingData: Array.isArray(t?.supportingData)
      ? t.supportingData.filter((s: any) => typeof s === 'string' && s.trim())
      : undefined,
    quotes: Array.isArray(t?.quotes)
      ? t.quotes
          .filter((q: any) => q && typeof q.text === 'string')
          .map(
            (q: any): ThemeQuote => ({
              text: q.text,
              source: typeof q.source === 'string' ? q.source : undefined,
              role: q.role === 'core' || q.role === 'supporting' ? q.role : undefined,
              anchor:
                q.anchor &&
                typeof q.anchor.docIdx === 'number' &&
                typeof q.anchor.start === 'number' &&
                typeof q.anchor.end === 'number'
                  ? { docIdx: q.anchor.docIdx, start: q.anchor.start, end: q.anchor.end }
                  : undefined,
              possibleSources: Array.isArray(q.possibleSources)
                ? q.possibleSources
                    .filter(
                      (p: any) => p && typeof p.source === 'string' && typeof p.score === 'number',
                    )
                    .map((p: any) => ({ source: p.source, score: p.score }))
                : undefined,
            }),
          )
      : [],
    rating,
  };
}

export function coerceScore(v: any): AxisScore | undefined {
  if (v === 1 || v === 2 || v === 3 || v === 4 || v === 5 || v === 'na') return v;
  return undefined;
}

export function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// --- Corpus CSV parsing ----------------------------------------------------

// RFC-4180-ish CSV parser: quoted fields, "" escapes, embedded commas/newlines.
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const src = text.replace(/^﻿/, ''); // strip BOM
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      if (ch === '\r' && src[i + 1] === '\n') i++;
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  row.push(field);
  rows.push(row);
  // Drop fully-empty trailing rows.
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

const ID_ALIASES = ['id', 'ext_id', 'extid', 'comment_id', '#'];
const TEXT_ALIASES = ['text', 'data', 'comment', 'body', 'content', 'document'];

export type CorpusParseResult = {
  docs: CorpusDoc[];
  warnings: string[];
};

// Standard corpus CSV format: a header row with an `id` column and a `text`
// column (aliases accepted). If no header matches, falls back to: 1 column =
// text only; 2+ columns = first is id, second is text.
export function parseCorpusCSV(text: string): CorpusParseResult {
  const warnings: string[] = [];
  const rows = parseCSV(text);
  if (rows.length === 0) return { docs: [], warnings: ['CSV is empty.'] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  let idCol = header.findIndex((h) => ID_ALIASES.includes(h));
  let textCol = header.findIndex((h) => TEXT_ALIASES.includes(h));
  let dataRows: string[][];

  if (textCol >= 0) {
    dataRows = rows.slice(1);
  } else {
    warnings.push(
      'No recognized header row (expected columns like "id,text") — treating every row as data.',
    );
    dataRows = rows;
    if (rows[0].length === 1) {
      idCol = -1;
      textCol = 0;
    } else {
      idCol = 0;
      textCol = 1;
    }
  }

  const docs: CorpusDoc[] = [];
  dataRows.forEach((r, i) => {
    const t = (r[textCol] ?? '').trim();
    if (!t) {
      warnings.push(`Row ${i + 2}: empty text — skipped.`);
      return;
    }
    const extId = idCol >= 0 ? (r[idCol] ?? '').trim() : String(docs.length + 1);
    // An id like "D35" (or "[D35]") is an explicit D-number: that row IS D35
    // for quote anchoring, regardless of its position in the file.
    const dm = extId.match(/^\[?[Dd](\d+)\]?$/);
    docs.push({
      extId,
      text: t,
      dnum: dm ? parseInt(dm[1], 10) : undefined,
    });
  });

  const withDnum = docs.filter((d) => d.dnum !== undefined).length;
  if (withDnum > 0) {
    warnings.push(
      `Using explicit D-numbers from the id column (${withDnum}/${docs.length} rows).`,
    );
    const seen = new Set<number>();
    const dups = new Set<number>();
    for (const d of docs) {
      if (d.dnum === undefined) continue;
      if (seen.has(d.dnum)) dups.add(d.dnum);
      seen.add(d.dnum);
    }
    if (dups.size > 0) {
      warnings.push(
        `Duplicate D-numbers (first occurrence wins): ${[...dups].map((n) => `D${n}`).join(', ')}.`,
      );
    }
  }
  return { docs, warnings };
}

// The D-number a corpus doc goes by: its explicit dnum when the CSV carried
// one, else its 1-based position.
export function docNumber(corpus: Corpus, idx: number): number {
  return corpus.docs[idx]?.dnum ?? idx + 1;
}

// Inverse: which doc a [D{n}] tag points at. First doc whose effective number
// matches wins; null when the number doesn't exist in this corpus.
export function docIndexForNumber(corpus: Corpus, n: number): number | null {
  for (let i = 0; i < corpus.docs.length; i++) {
    if ((corpus.docs[i].dnum ?? i + 1) === n) return i;
  }
  return null;
}

// --- Ratings CSV export ------------------------------------------------------

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function scoreCell(v: AxisScore | undefined): string {
  if (v === undefined) return '';
  return v === 'na' ? 'NA' : String(v);
}

// One row per theme, with full run metadata — the analysis-ready artifact.
export function ratingsCSV(state: AppState): string {
  const corpusById = new Map(state.corpora.map((c) => [c.id, c]));
  const header = [
    'run_id',
    'run_name',
    'corpus',
    'model',
    'prompt_variant',
    'version',
    'data_source',
    'rq',
    'positionality',
    'run_n',
    'theme_name',
    'grounding',
    'research_question_fit',
    'interpretation_level',
    'novelty',
    'data_contribution',
    'positionality_contribution',
    'rating_notes',
    'quote_count',
    'anchored_quote_count',
    'definition',
    'reasoning',
  ];
  const lines = [header.join(',')];
  for (const run of state.runs) {
    for (const t of run.themes) {
      lines.push(
        [
          csvCell(run.id),
          csvCell(buildRunName(run)),
          csvCell(run.corpusId ? corpusById.get(run.corpusId)?.name ?? run.corpusId : ''),
          csvCell(run.model),
          csvCell(run.promptVariant),
          csvCell(run.version),
          csvCell(run.dataSource),
          csvCell(run.rq),
          csvCell(run.positionality),
          csvCell(run.runN),
          csvCell(t.name),
          csvCell(scoreCell(t.rating.grounding)),
          csvCell(scoreCell(t.rating.researchQuestionFit)),
          csvCell(scoreCell(t.rating.interpretationLevel)),
          csvCell(scoreCell(t.rating.novelty)),
          csvCell(scoreCell(t.rating.dataContribution)),
          csvCell(scoreCell(t.rating.positionalityContribution)),
          csvCell(t.rating.notes),
          csvCell(t.quotes.length),
          csvCell(t.quotes.filter((q) => q.anchor).length),
          csvCell(t.definition),
          csvCell(t.reasoning),
        ].join(','),
      );
    }
  }
  return lines.join('\n');
}

// One row per rated similarity pair.
export function similaritiesCSV(state: AppState): string {
  const themeIndex = new Map<string, { run: Run; theme: RatedTheme }>();
  for (const run of state.runs) {
    for (const t of run.themes) themeIndex.set(t.id, { run, theme: t });
  }
  const header = ['theme_a', 'run_a', 'theme_b', 'run_b', 'similarity', 'notes'];
  const lines = [header.join(',')];
  for (const s of state.similarities) {
    const a = themeIndex.get(s.themeA);
    const b = themeIndex.get(s.themeB);
    if (!a || !b) continue;
    lines.push(
      [
        csvCell(a.theme.name),
        csvCell(buildRunName(a.run)),
        csvCell(b.theme.name),
        csvCell(buildRunName(b.run)),
        csvCell(scoreCell(s.similarity)),
        csvCell(s.notes),
      ].join(','),
    );
  }
  return lines.join('\n');
}

// --- Downloads / file reads --------------------------------------------------

export function downloadJSON(filename: string, data: unknown): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(filename, blob);
}

export function downloadText(filename: string, text: string, mime = 'text/csv'): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  triggerDownload(filename, blob);
}

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

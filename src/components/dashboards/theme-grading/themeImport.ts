// Parse an AI thematic-analysis JSON output and anchor its quotes against a
// corpus. Same file format as the qual-coding dashboard's "import AI ↓":
//
//   { themes: [{ name, definition, reasoning, quotes: [{ text, source, role }] }],
//     additional_text? }
//
// where `source` is a [D{n}] tag resolving to corpus doc n (1-based, in CSV
// row order). Unlike qual-coding, non-anchored quotes are always kept (with
// possible-source suggestions) — this tool's job is rating themes, so evidence
// text must never be dropped.

// Tolerant JSON parsing (stray quotes, fences, jsonrepair) is shared with the
// qual-coding dashboard.
import { parseAIThemesJson } from '../qualitative-coding/aiThemeImport';
import { cryptoRandomId } from './storage';
import type { Corpus, RatedTheme, ThemeQuote } from './types';

export { parseAIThemesJson };

export type ThemeImportResult = {
  themes: RatedTheme[];
  additionalText?: string;
  totalQuotes: number;
  anchoredQuotes: number;
  warnings: string[];
};

// Pull the document index out of a source tag. Accepts "D4", "[D4]", "d4",
// "Item 4", or a bare "4". Returns a 0-based index.
function resolveDocIndex(source: unknown): number | null {
  if (typeof source !== 'string') return null;
  const m = source.match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n - 1;
}

function cleanField(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// For a quote that couldn't be anchored verbatim: score every corpus doc by
// normalized-substring (1) or content-word overlap, return the top few ≥ 0.6.
function findPossibleSources(
  text: string,
  corpus: Corpus,
): { source: string; score: number }[] {
  const nq = normalizeForMatch(text);
  if (!nq) return [];
  const qWords = [...new Set(nq.split(' ').filter((w) => w.length > 3))];
  const out: { source: string; score: number }[] = [];
  corpus.docs.forEach((d, i) => {
    const nd = normalizeForMatch(d.text);
    let score = 0;
    if (nd.includes(nq)) score = 1;
    else if (qWords.length > 0) {
      const present = qWords.filter((w) => nd.includes(w)).length;
      score = present / qWords.length;
    }
    if (score >= 0.6) out.push({ source: `D${i + 1}`, score: Math.round(score * 100) / 100 });
  });
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 3);
}

export function buildThemesFromImport(
  raw: unknown,
  corpus: Corpus | null,
): ThemeImportResult {
  const warnings: string[] = [];
  let totalQuotes = 0;
  let anchoredQuotes = 0;

  const additionalText = cleanField((raw as any)?.additional_text);
  const rawThemes: any[] = Array.isArray((raw as any)?.themes)
    ? (raw as any).themes
    : Array.isArray(raw)
      ? (raw as any)
      : [];

  if (rawThemes.length === 0) {
    warnings.push('No "themes" array found in the file.');
    return { themes: [], additionalText, totalQuotes: 0, anchoredQuotes: 0, warnings };
  }
  if (!corpus) {
    warnings.push('No corpus selected — quotes kept but none anchored.');
  }

  const themes: RatedTheme[] = rawThemes.map((rt, ti) => {
    const name = cleanField(rt?.name) ?? `Imported theme ${ti + 1}`;
    const rawQuotes: any[] = Array.isArray(rt?.quotes) ? rt.quotes : [];
    const quotes: ThemeQuote[] = [];
    for (const q of rawQuotes) {
      const text = cleanField(q?.text);
      if (!text) continue;
      totalQuotes++;
      const quote: ThemeQuote = {
        text,
        source: typeof q?.source === 'string' ? q.source : undefined,
        role: q?.role === 'core' || q?.role === 'supporting' ? q.role : undefined,
      };
      if (corpus) {
        const idx = resolveDocIndex(q?.source);
        const doc = idx !== null ? corpus.docs[idx] : undefined;
        const start = doc ? doc.text.indexOf(text) : -1;
        if (doc && start >= 0) {
          anchoredQuotes++;
          quote.anchor = { docIdx: idx!, start, end: start + text.length };
        } else {
          const possible = findPossibleSources(text, corpus);
          if (possible.length > 0) quote.possibleSources = possible;
        }
      }
      quotes.push(quote);
    }
    return {
      id: cryptoRandomId(),
      name,
      definition: cleanField(rt?.definition),
      reasoning: cleanField(rt?.reasoning),
      quotes,
      rating: {},
    };
  });

  return { themes, additionalText, totalQuotes, anchoredQuotes, warnings };
}

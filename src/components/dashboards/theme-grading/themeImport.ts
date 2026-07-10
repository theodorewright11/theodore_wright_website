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
import { cryptoRandomId, docIndexForNumber, docNumber } from './storage';
import type { Corpus, RatedTheme, ThemeQuote } from './types';

export { parseAIThemesJson };

export type ThemeImportResult = {
  themes: RatedTheme[];
  additionalText?: string;
  totalQuotes: number;
  anchoredQuotes: number;
  warnings: string[];
};

// Pull the D-number out of a source tag. Accepts "D4", "[D4]", "d4",
// "Item 4", or a bare "4". Resolution to a doc index goes through
// docIndexForNumber so explicit CSV D-ids are honoured.
function resolveDocNumber(source: unknown): number | null {
  if (typeof source !== 'string') return null;
  const m = source.match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
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

// --- Tolerant verbatim locating ----------------------------------------------
//
// Strict indexOf misses quotes that differ only in curly vs straight quotes,
// en/em dashes, or whitespace/line-break shape — which is most "should have
// matched" failures. So each doc gets a canonical form with an index map back
// to original offsets: smart quotes → straight, dashes → '-', runs of
// whitespace → one space, lowercased. A quote canonicalized the same way is
// located in that space and the hit is mapped back to exact original offsets.

type NormIndex = { norm: string; map: number[] };

function canonChar(ch: string): string {
  if (ch === '‘' || ch === '’' || ch === 'ʼ') return "'";
  if (ch === '“' || ch === '”') return '"';
  if (ch === '–' || ch === '—' || ch === '−') return '-';
  if (ch === '…') return '...';
  if (ch === ' ') return ' ';
  return ch;
}

function buildNormIndex(text: string): NormIndex {
  let norm = '';
  const map: number[] = [];
  let lastWasSpace = true;
  for (let i = 0; i < text.length; i++) {
    const c = canonChar(text[i]);
    if (/\s/.test(c)) {
      if (lastWasSpace) continue;
      norm += ' ';
      map.push(i);
      lastWasSpace = true;
      continue;
    }
    lastWasSpace = false;
    for (const cc of c.toLowerCase()) {
      norm += cc;
      map.push(i);
    }
  }
  return { norm, map };
}

function canonQuote(q: string): string {
  let out = '';
  let lastWasSpace = true;
  for (let i = 0; i < q.length; i++) {
    const c = canonChar(q[i]);
    if (/\s/.test(c)) {
      if (lastWasSpace) continue;
      out += ' ';
      lastWasSpace = true;
      continue;
    }
    lastWasSpace = false;
    out += c.toLowerCase();
  }
  return out.trim();
}

// Exact match first; canonical-space match as fallback. Returns original-text
// offsets either way.
function locateQuote(
  docText: string,
  normIdx: NormIndex,
  quote: string,
): { start: number; end: number } | null {
  const exact = docText.indexOf(quote);
  if (exact >= 0) return { start: exact, end: exact + quote.length };
  const nq = canonQuote(quote);
  if (!nq) return null;
  const pos = normIdx.norm.indexOf(nq);
  if (pos < 0) return null;
  const start = normIdx.map[pos];
  const end = normIdx.map[pos + nq.length - 1] + 1;
  return { start, end };
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
    if (score >= 0.6)
      out.push({ source: `D${docNumber(corpus, i)}`, score: Math.round(score * 100) / 100 });
  });
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 3);
}

// Lazily-built canonical index per corpus doc (anchoring a run touches each
// referenced doc once).
type NormCache = Map<number, NormIndex>;

function anchorQuote(quote: ThemeQuote, corpus: Corpus, cache: NormCache): ThemeQuote {
  const out: ThemeQuote = { text: quote.text, source: quote.source, role: quote.role };
  const n = resolveDocNumber(quote.source);
  const idx = n !== null ? docIndexForNumber(corpus, n) : null;
  const doc = idx !== null ? corpus.docs[idx] : undefined;
  if (doc && idx !== null) {
    let normIdx = cache.get(idx);
    if (!normIdx) {
      normIdx = buildNormIndex(doc.text);
      cache.set(idx, normIdx);
    }
    const hit = locateQuote(doc.text, normIdx, quote.text);
    if (hit) {
      out.anchor = { docIdx: idx, start: hit.start, end: hit.end };
      return out;
    }
  }
  const possible = findPossibleSources(quote.text, corpus);
  if (possible.length > 0) out.possibleSources = possible;
  return out;
}

export function buildThemesFromImport(
  raw: unknown,
  corpus: Corpus | null,
): ThemeImportResult {
  const warnings: string[] = [];
  let totalQuotes = 0;
  let anchoredQuotes = 0;
  const cache: NormCache = new Map();

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
    warnings.push('No data selected — quotes kept but none located in data.');
  }

  const themes: RatedTheme[] = rawThemes.map((rt, ti) => {
    const name = cleanField(rt?.name) ?? `Imported theme ${ti + 1}`;
    const rawQuotes: any[] = Array.isArray(rt?.quotes) ? rt.quotes : [];
    const quotes: ThemeQuote[] = [];
    for (const q of rawQuotes) {
      const text = cleanField(q?.text);
      if (!text) continue;
      totalQuotes++;
      let quote: ThemeQuote = {
        text,
        source: typeof q?.source === 'string' ? q.source : undefined,
        role: q?.role === 'core' || q?.role === 'supporting' ? q.role : undefined,
      };
      if (corpus) {
        quote = anchorQuote(quote, corpus, cache);
        if (quote.anchor) anchoredQuotes++;
      }
      quotes.push(quote);
    }
    const supportingData: string[] = Array.isArray(rt?.all_supporting_data)
      ? rt.all_supporting_data.filter((s: any) => typeof s === 'string' && s.trim())
      : Array.isArray(rt?.supporting_data)
        ? rt.supporting_data.filter((s: any) => typeof s === 'string' && s.trim())
        : [];
    return {
      id: cryptoRandomId(),
      name,
      definition: cleanField(rt?.definition),
      reasoning: cleanField(rt?.reasoning),
      quotes,
      supportingData: supportingData.length > 0 ? supportingData : undefined,
      rating: {},
    };
  });

  return { themes, additionalText, totalQuotes, anchoredQuotes, warnings };
}

// Re-run anchoring for an existing run's themes against a corpus (e.g. after
// uploading the data the run should have pointed at, or after the tolerant
// matcher improves). Ratings and theme ids are preserved.
export function reanchorThemes(
  themes: RatedTheme[],
  corpus: Corpus,
): { themes: RatedTheme[]; totalQuotes: number; anchoredQuotes: number } {
  const cache: NormCache = new Map();
  let totalQuotes = 0;
  let anchoredQuotes = 0;
  const next = themes.map((t) => ({
    ...t,
    quotes: t.quotes.map((q) => {
      totalQuotes++;
      const nq = anchorQuote(q, corpus, cache);
      if (nq.anchor) anchoredQuotes++;
      return nq;
    }),
  }));
  return { themes: next, totalQuotes, anchoredQuotes };
}

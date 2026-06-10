// Merge an AI thematic-analysis output into an existing project as themes.
//
// The AI is prompted (see the qual-coding prompt) to emit a single JSON object
// shaped as:
//   { themes: [{ reasoning, name, definition, justification,
//                quotes: [{ text, source, role }] }] }
// where `source` is the `[D{n}]` identifier from the corpus.md export and
// `text` is a verbatim span of that document.
//
// This is NOT the dashboard's own Project schema — it carries quote TEXT, not
// annotation ids + offsets. So we resolve each quote here: `source` → document
// (via the [D{n}] index, which matches project.documents order, the same order
// corpus.md is written in), then locate the verbatim `text` in that document's
// body to compute character offsets. Matched quotes become ThemeUncodedHighlights
// (theme evidence with no code attached); unmatched quotes are reported back so
// the user can see what didn't land rather than having it silently dropped.

import { jsonrepair } from 'jsonrepair';
import { cryptoRandomId } from './storage';
import { PALETTE, type Project, type Theme, type ThemeUncodedHighlight } from './types';

// LLMs reliably break JSON when a verbatim quote contains a literal `"` (e.g.
// `...the "experts"`), because they forget to escape it. Strict JSON.parse then
// fails and the rest of the document derails. This tolerant parser tries, in
// order: the raw text, our stray-quote escaper, jsonrepair (trailing commas,
// fences, unquoted keys), and both combined. The first that parses wins.
export function parseAIThemesJson(text: string): unknown {
  const clean = stripCodeFences(text);
  const attempts: (() => string)[] = [
    () => clean,
    () => escapeStrayQuotes(clean),
    () => jsonrepair(clean),
    () => jsonrepair(escapeStrayQuotes(clean)),
  ];
  let lastErr: unknown = new Error('empty input');
  for (const make of attempts) {
    try {
      return JSON.parse(make());
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Could not parse JSON');
}

// Strip a leading/trailing ```json … ``` markdown fence if the model wrapped its
// output in one.
function stripCodeFences(s: string): string {
  const t = s.trim();
  const m = t.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  return m ? m[1] : t;
}

// Escape double-quotes that appear *inside* a JSON string value but were left
// unescaped. A `"` only genuinely closes a string if the next non-whitespace
// character is a JSON structural token (`,` `:` `}` `]`) or end-of-input;
// otherwise it's a stray inner quote and gets escaped. Existing `\"` / `\\`
// escapes pass through untouched.
function escapeStrayQuotes(src: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inString && ch === '\\') {
      out += ch + (src[i + 1] ?? '');
      i++;
      continue;
    }
    if (ch === '"') {
      if (!inString) {
        inString = true;
        out += ch;
      } else {
        let j = i + 1;
        while (j < src.length && /\s/.test(src[j])) j++;
        const next = src[j];
        if (next === undefined || next === ',' || next === ':' || next === '}' || next === ']') {
          inString = false;
          out += ch;
        } else {
          out += '\\"';
        }
      }
    } else {
      out += ch;
    }
  }
  return out;
}

export type AIImportUnmatched = {
  themeName: string;
  source: string;
  text: string;
  reason: string;
};

export type AIImportResult = {
  themes: Theme[];
  matchedQuotes: number;
  totalQuotes: number;
  unmatched: AIImportUnmatched[];
  warnings: string[];
};

// Pull the document index out of a source tag. Accepts "D4", "[D4]", "d4",
// "Item 4", or a bare "4" — anything with a number. Returns a 0-based index.
function resolveDocIndex(source: unknown): number | null {
  if (typeof source !== 'string') return null;
  const m = source.match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n - 1;
}

function composeDescription(t: any): string | undefined {
  const parts: string[] = [];
  const add = (label: string, v: unknown) => {
    if (typeof v === 'string' && v.trim()) parts.push(`**${label}.** ${v.trim()}`);
  };
  add('Definition', t?.definition);
  add('Justification', t?.justification);
  add('Reasoning', t?.reasoning);
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

export function buildThemesFromAI(
  project: Project,
  raw: unknown,
  now: string,
): AIImportResult {
  const warnings: string[] = [];
  const unmatched: AIImportUnmatched[] = [];
  let matchedQuotes = 0;
  let totalQuotes = 0;

  const rawThemes: any[] = Array.isArray((raw as any)?.themes)
    ? (raw as any).themes
    : Array.isArray(raw)
      ? (raw as any)
      : [];

  if (rawThemes.length === 0) {
    warnings.push('No "themes" array found in the file.');
    return { themes: [], matchedQuotes: 0, totalQuotes: 0, unmatched, warnings };
  }

  const existingCount = (project.themes ?? []).length;
  const themes: Theme[] = [];

  rawThemes.forEach((rt, ti) => {
    const themeName =
      typeof rt?.name === 'string' && rt.name.trim() ? rt.name.trim() : `Imported theme ${ti + 1}`;
    const quotes: any[] = Array.isArray(rt?.quotes) ? rt.quotes : [];
    const highlights: ThemeUncodedHighlight[] = [];

    for (const q of quotes) {
      totalQuotes++;
      const text = q?.text;
      if (typeof text !== 'string' || text.length === 0) {
        unmatched.push({
          themeName,
          source: String(q?.source ?? '?'),
          text: String(text ?? ''),
          reason: 'quote has no text',
        });
        continue;
      }
      const idx = resolveDocIndex(q?.source);
      if (idx === null) {
        unmatched.push({ themeName, source: String(q?.source ?? '?'), text, reason: 'unreadable source tag' });
        continue;
      }
      const doc = project.documents[idx];
      if (!doc) {
        unmatched.push({
          themeName,
          source: String(q?.source ?? '?'),
          text,
          reason: `no document at index ${idx + 1}`,
        });
        continue;
      }
      const start = doc.text.indexOf(text);
      if (start < 0) {
        unmatched.push({
          themeName,
          source: String(q?.source ?? '?'),
          text,
          reason: `text not found verbatim in ${String(q?.source)}`,
        });
        continue;
      }
      matchedQuotes++;
      highlights.push({
        id: cryptoRandomId(),
        docId: doc.id,
        ranges: [{ start, end: start + text.length }],
        weight: q?.role === 'core' ? 'core' : 'supporting',
        created_at: now,
      });
    }

    themes.push({
      id: cryptoRandomId(),
      name: themeName,
      description: composeDescription(rt),
      parentIds: [],
      color: PALETTE[(existingCount + ti) % PALETTE.length],
      order: existingCount + ti,
      annotationLinks: [],
      includeCodeIds: [],
      uncodedHighlights: highlights,
      created_at: now,
    });
  });

  return { themes, matchedQuotes, totalQuotes, unmatched, warnings };
}

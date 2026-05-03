import type { DataState, Need, Source } from './types';
import { DOMAINS, SOURCES, EMPTY_SOURCES } from './types';
import { SEED_NEEDS } from './seed';

const KEY = 'tw-emotional-wellbeing-v1';

export function initialState(): DataState {
  return { version: 1, needs: structuredClone(SEED_NEEDS) };
}

export function loadState(): DataState {
  if (typeof window === 'undefined') return initialState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed.needs)) return initialState();
    return { version: 1, needs: parsed.needs.map(coerceNeed).filter(Boolean) as Need[] };
  } catch {
    return initialState();
  }
}

export function saveState(state: DataState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearState(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}

function coerceNeed(raw: unknown): Need | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string') return null;
  const domain = (DOMAINS as readonly string[]).includes(r.domain as string)
    ? (r.domain as Need['domain']) : 'Emotional';
  const sources = structuredClone(EMPTY_SOURCES);
  if (r.sources && typeof r.sources === 'object') {
    for (const s of SOURCES) {
      const v = (r.sources as Record<string, unknown>)[s];
      if (v && typeof v === 'object') {
        const a = Number((v as Record<string, unknown>).actual);
        const i = Number((v as Record<string, unknown>).ideal);
        sources[s] = {
          actual: Number.isFinite(a) ? clamp(a, 0, 100) : 0,
          ideal: Number.isFinite(i) ? clamp(i, 0, 100) : 0,
        };
      }
    }
  }
  return {
    id: r.id,
    name: r.name,
    domain,
    priority: clampInt(Number(r.priority), 0, 5),
    currentlyMet: clampInt(Number(r.currentlyMet), 0, 7),
    sources,
  };
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function clampInt(v: number, lo: number, hi: number) { return Number.isFinite(v) ? clamp(Math.round(v), lo, hi) : 0; }

// --- CSV ------------------------------------------------------------------
// One CSV with one row per need. Columns: id, name, domain, priority, currently_met,
// then for each source: <s>_actual, <s>_ideal.

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { cur.push(field); field = ''; }
      else if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else if (ch === '\r') { /* handled by \n */ }
      else field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.some(c => c !== '')).map(r => {
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim(); });
    return o;
  });
}

export function needsToCsv(needs: Need[]): string {
  const headers = ['id', 'name', 'domain', 'priority', 'currently_met'];
  for (const s of SOURCES) headers.push(`${s}_actual`, `${s}_ideal`);
  const head = headers.join(',');
  const body = needs.map(n => {
    const base: Record<string, unknown> = {
      id: n.id,
      name: n.name,
      domain: n.domain,
      priority: n.priority,
      currently_met: n.currentlyMet,
    };
    for (const s of SOURCES) {
      base[`${s}_actual`] = n.sources[s].actual;
      base[`${s}_ideal`] = n.sources[s].ideal;
    }
    return headers.map(h => csvEscape(base[h])).join(',');
  }).join('\n');
  return body ? head + '\n' + body + '\n' : head + '\n';
}

export function csvToNeeds(text: string): Need[] {
  const rows = parseCsv(text);
  const out: Need[] = [];
  for (const r of rows) {
    if (!r.id || !r.name) continue;
    const domain = (DOMAINS as readonly string[]).includes(r.domain) ? (r.domain as Need['domain']) : 'Emotional';
    const sources = structuredClone(EMPTY_SOURCES);
    for (const s of SOURCES) {
      const a = parseFloat(r[`${s}_actual`]);
      const i = parseFloat(r[`${s}_ideal`]);
      sources[s as Source] = {
        actual: Number.isFinite(a) ? clamp(a, 0, 100) : 0,
        ideal: Number.isFinite(i) ? clamp(i, 0, 100) : 0,
      };
    }
    out.push({
      id: r.id,
      name: r.name,
      domain,
      priority: clampInt(parseFloat(r.priority), 0, 5),
      currentlyMet: clampInt(parseFloat(r.currently_met), 0, 7),
      sources,
    });
  }
  return out;
}

export function downloadFile(name: string, contents: string, mime = 'text/csv') {
  if (typeof window === 'undefined') return;
  const blob = new Blob([contents], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

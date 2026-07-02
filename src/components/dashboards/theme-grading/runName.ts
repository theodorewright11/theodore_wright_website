// The study's run-naming convention:
//
//   {model}_{promptVariant}_v{version}_{dataSource}_{rq}_{positionality}_run{n}
//
// e.g. claude_engineered_data_v2_160_als_comments_policy_neutral_run1
//
// buildRunName composes it from a run's metadata (skipping blank parts);
// parseRunName does the reverse so pasting a full name into the New-run form
// autofills the fields. Parsing anchors on the unambiguous tokens — the known
// promptVariant values, the v{n} token, and the trailing run{n} — because
// model and dataSource can themselves contain underscores.

import { PROMPT_VARIANTS, type Run } from './types';

type RunMeta = Pick<
  Run,
  'model' | 'promptVariant' | 'version' | 'dataSource' | 'rq' | 'positionality' | 'runN'
>;

export function buildRunName(run: RunMeta): string {
  const parts: string[] = [];
  if (run.model) parts.push(run.model);
  if (run.promptVariant) parts.push(run.promptVariant);
  if (run.version) parts.push(`v${run.version.replace(/^v/i, '')}`);
  if (run.dataSource) parts.push(run.dataSource);
  if (run.rq) parts.push(run.rq);
  if (run.positionality) parts.push(run.positionality);
  if (run.runN) parts.push(`run${run.runN.replace(/^run/i, '')}`);
  return parts.join('_') || 'untitled run';
}

export function parseRunName(name: string): Partial<RunMeta> {
  const out: Partial<RunMeta> = {};
  let s = name.trim().replace(/\.json$/i, '');
  if (!s) return out;

  // Trailing run{n}
  const runM = s.match(/_run(\d+)$/i);
  if (runM) {
    out.runN = runM[1];
    s = s.slice(0, runM.index);
  }

  // Prompt variant — the longest known value found in the string. Everything
  // before it is the model.
  let pvStart = -1;
  let pv = '';
  for (const cand of [...PROMPT_VARIANTS].sort((a, b) => b.length - a.length)) {
    const idx = s.indexOf(`_${cand}`);
    if (idx >= 0) {
      pvStart = idx;
      pv = cand;
      break;
    }
  }
  if (pvStart >= 0) {
    out.model = s.slice(0, pvStart);
    out.promptVariant = pv;
    s = s.slice(pvStart + 1 + pv.length).replace(/^_/, '');
  }

  // v{version}
  const vM = s.match(/^v(\d+)_?/i);
  if (vM) {
    out.version = vM[1];
    s = s.slice(vM[0].length);
  }

  // Remainder: {dataSource}_{rq}_{positionality}. dataSource can contain
  // underscores; rq and positionality are assumed single tokens (shorthands).
  const tokens = s.split('_').filter(Boolean);
  if (tokens.length >= 3) {
    out.positionality = tokens[tokens.length - 1];
    out.rq = tokens[tokens.length - 2];
    out.dataSource = tokens.slice(0, tokens.length - 2).join('_');
  } else if (tokens.length === 2) {
    out.dataSource = tokens[0];
    out.rq = tokens[1];
  } else if (tokens.length === 1) {
    out.dataSource = tokens[0];
  }
  return out;
}

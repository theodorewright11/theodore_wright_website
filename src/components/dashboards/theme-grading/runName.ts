// The study's run-naming convention:
//
//   {model}_{promptvariant}-v{version}_{datasource}_{rq}_{positionality}_run{n}
//
// e.g. claude_engineered-data-v2_160-als-comments_rq1_p2_run1
//
// Slots are underscore-separated; WITHIN a slot hyphens are used (so parsing
// is a plain split on '_'). Values:
//   model          chatgpt5.5, claude, gemini; human-teddy for the human set
//   promptvariant  engineered-data, engineered-no-data, not-engineered-data,
//                  na (human set) — version attached with a hyphen (-v2)
//   datasource     20-als-comments, 160-als-comments, na for no-data runs
//   rq             rq1, rq2, …
//   positionality  p1, p2, …
//   run            run1, run2, …
//
// buildRunName composes it from a run's metadata (skipping blank parts);
// parseRunName does the reverse so pasting a full name (or .json filename)
// into the New-run form autofills the fields.

import type { Run } from './types';

type RunMeta = Pick<
  Run,
  'model' | 'promptVariant' | 'version' | 'dataSource' | 'rq' | 'positionality' | 'runN'
>;

export function buildRunName(run: RunMeta): string {
  const parts: string[] = [];
  if (run.model) parts.push(run.model);
  if (run.promptVariant || run.version) {
    const v = run.version ? `-v${run.version.replace(/^v/i, '')}` : '';
    parts.push(`${run.promptVariant || 'na'}${v}`);
  }
  if (run.dataSource) parts.push(run.dataSource);
  if (run.rq) parts.push(run.rq);
  if (run.positionality) parts.push(run.positionality);
  if (run.runN) parts.push(`run${run.runN.replace(/^run/i, '')}`);
  return parts.join('_') || 'untitled run';
}

export function parseRunName(name: string): Partial<RunMeta> {
  const out: Partial<RunMeta> = {};
  const s = name.trim().replace(/\.themes-ratings\.json$/i, '').replace(/\.json$/i, '');
  if (!s) return out;

  const parts = s.split('_').filter(Boolean);
  if (parts.length === 0) return out;

  // Trailing run{n} slot (dotted repeats like run1.1 allowed).
  const last = parts[parts.length - 1];
  const runM = last.match(/^run(\d+(?:\.\d+)*)$/i);
  if (runM) {
    out.runN = runM[1];
    parts.pop();
  }

  // The promptvariant slot is the one ending in -v{n} (dotted versions like
  // v3.1 allowed). Everything before it is the model; after it come
  // datasource, rq, positionality in order.
  let pvIdx = parts.findIndex((p) => /-v\d+(?:\.\d+)*$/i.test(p));
  if (pvIdx >= 0) {
    const slot = parts[pvIdx];
    const m = slot.match(/^(.*)-v(\d+(?:\.\d+)*)$/i)!;
    out.promptVariant = m[1];
    out.version = m[2];
    if (pvIdx > 0) out.model = parts.slice(0, pvIdx).join('_');
  } else {
    // No versioned slot — assume the first part is the model.
    pvIdx = 0;
    out.model = parts[0];
  }

  const rest = parts.slice(pvIdx + 1);
  if (rest.length >= 1) out.dataSource = rest[0];
  if (rest.length >= 2) out.rq = rest[1];
  if (rest.length >= 3) out.positionality = rest[2];
  return out;
}

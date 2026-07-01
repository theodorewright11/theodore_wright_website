// Drive sync orchestration for the theme-grading dashboard. One folder holding
// one canonical state.json (app-tagged) plus derived CSV exports. Pulls merge
// at the run level (latest-wins by updated_at, local wins ties) so two devices
// rating different runs don't clobber each other.

import {
  createFile,
  fileExists,
  findOrCreateFolder,
  getFileContent,
  listChildren,
  listStateFiles,
  MIME,
  updateFile,
  type DriveItem,
} from './drive';
import { coerceState, ratingsCSV, similaritiesCSV } from './storage';
import type { AppState, DriveLink } from './types';

const FOLDER_NAME = 'Theme Grading';
const STATE_FILE = 'state.json';
const RATINGS_FILE = 'ratings.csv';
const SIMILARITIES_FILE = 'similarities.csv';

// What gets written to state.json: everything except the device-local Drive
// link (re-stamped on pull) and UI toggles are harmless to share.
function serializable(state: AppState): Omit<AppState, 'drive'> {
  const { drive: _drive, ...rest } = state;
  return rest;
}

export async function syncStateToDrive(
  token: string,
  state: AppState,
  rootFolderId: string | undefined,
): Promise<DriveLink> {
  let folderId = state.drive?.folderId;
  let stateFileId = state.drive?.stateFileId;

  // Validate the remembered folder/file — they may have been deleted in Drive.
  if (folderId && !(await fileExists(token, folderId))) {
    folderId = undefined;
    stateFileId = undefined;
  }
  if (!folderId) {
    // Re-find an existing state.json anywhere before creating a new folder
    // (e.g. first sync on a second device).
    const tagged = await listStateFiles(token);
    if (tagged.length > 0) {
      const f = pickNewest(tagged);
      stateFileId = f.id;
      folderId = f.parents?.[0];
    }
  }
  if (!folderId) {
    folderId = await findOrCreateFolder(token, FOLDER_NAME, rootFolderId);
  }
  if (stateFileId && !(await fileExists(token, stateFileId))) {
    stateFileId = undefined;
  }

  let item: DriveItem;
  if (stateFileId) {
    item = await updateFile(token, stateFileId, serializable(state), MIME.json);
  } else {
    item = await createFile(token, {
      name: STATE_FILE,
      parentId: folderId,
      mimeType: MIME.json,
      content: serializable(state),
      appTagged: true,
    });
  }

  // Derived CSVs — best-effort; a failure here shouldn't fail the sync.
  try {
    const children = await listChildren(token, folderId);
    await upsertByName(token, folderId, children, RATINGS_FILE, ratingsCSV(state));
    await upsertByName(token, folderId, children, SIMILARITIES_FILE, similaritiesCSV(state));
  } catch {
    /* csv export is a convenience */
  }

  return { folderId, stateFileId: item.id, modifiedTime: item.modifiedTime };
}

async function upsertByName(
  token: string,
  folderId: string,
  children: DriveItem[],
  name: string,
  content: string,
): Promise<void> {
  const existing = children.find((c) => c.name === name);
  if (existing) await updateFile(token, existing.id, content, MIME.csv);
  else
    await createFile(token, {
      name,
      parentId: folderId,
      mimeType: MIME.csv,
      content,
    });
}

function pickNewest(items: DriveItem[]): DriveItem {
  return [...items].sort(
    (a, b) => (Date.parse(b.modifiedTime ?? '') || 0) - (Date.parse(a.modifiedTime ?? '') || 0),
  )[0];
}

export type PulledState = {
  state: AppState;
  drive: DriveLink;
};

export async function pullStateFromDrive(token: string): Promise<PulledState | null> {
  const tagged = await listStateFiles(token);
  if (tagged.length === 0) return null;
  const f = pickNewest(tagged);
  const content = await getFileContent(token, f.id);
  const state = coerceState(content);
  return {
    state,
    drive: {
      folderId: f.parents?.[0] ?? '',
      stateFileId: f.id,
      modifiedTime: f.modifiedTime,
    },
  };
}

export type MergeResult = {
  merged: AppState;
  // True when local content wasn't fully represented on the server — the
  // caller should queue a push so Drive catches up.
  pushNeeded: boolean;
};

// Merge a pulled state into the local one. Entity-level, tombstone-aware:
//  - runs: by id, latest updated_at wins (local wins ties)
//  - corpora: union by id (corpora are immutable after upload)
//  - similarities: union by unordered theme pair, local wins conflicts
//  - tombstones: union of both sides, applied to everything
//  - UI state (view, toggles, activeRunId): always local
export function mergeStates(local: AppState, pulled: AppState, drive: DriveLink): MergeResult {
  let pushNeeded = false;

  const deletedRunIds = new Set([...(local.deletedRunIds ?? []), ...(pulled.deletedRunIds ?? [])]);
  const deletedCorpusIds = new Set([
    ...(local.deletedCorpusIds ?? []),
    ...(pulled.deletedCorpusIds ?? []),
  ]);

  // Runs
  const pulledRunById = new Map(pulled.runs.map((r) => [r.id, r]));
  const runs = [];
  for (const lr of local.runs) {
    if (deletedRunIds.has(lr.id)) continue;
    const pr = pulledRunById.get(lr.id);
    if (!pr) {
      runs.push(lr);
      pushNeeded = true;
      continue;
    }
    const lt = Date.parse(lr.updated_at) || 0;
    const pt = Date.parse(pr.updated_at) || 0;
    if (lt >= pt) {
      runs.push(lr);
      if (lt > pt) pushNeeded = true;
    } else {
      runs.push(pr);
    }
    pulledRunById.delete(lr.id);
  }
  for (const pr of pulledRunById.values()) {
    if (deletedRunIds.has(pr.id)) {
      pushNeeded = true; // deletion needs to reach the server
      continue;
    }
    runs.push(pr);
  }

  // Corpora
  const corpusIds = new Set(local.corpora.map((c) => c.id));
  const corpora = local.corpora.filter((c) => !deletedCorpusIds.has(c.id));
  for (const pc of pulled.corpora) {
    if (deletedCorpusIds.has(pc.id)) {
      pushNeeded = true;
      continue;
    }
    if (!corpusIds.has(pc.id)) corpora.push(pc);
  }
  if (local.corpora.some((c) => !pulled.corpora.some((p) => p.id === c.id))) {
    pushNeeded = true;
  }

  // Similarities — keyed by unordered theme pair.
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const simByKey = new Map(local.similarities.map((s) => [pairKey(s.themeA, s.themeB), s]));
  const similarities = [...local.similarities];
  for (const ps of pulled.similarities) {
    const k = pairKey(ps.themeA, ps.themeB);
    if (!simByKey.has(k)) {
      similarities.push(ps);
      simByKey.set(k, ps);
    }
  }
  if (local.similarities.length > pulled.similarities.length) pushNeeded = true;

  const merged: AppState = {
    ...local,
    corpora,
    runs,
    similarities,
    deletedRunIds: [...deletedRunIds],
    deletedCorpusIds: [...deletedCorpusIds],
    drive,
    activeRunId:
      local.activeRunId && runs.some((r) => r.id === local.activeRunId)
        ? local.activeRunId
        : runs[0]?.id ?? null,
  };
  return { merged, pushNeeded };
}

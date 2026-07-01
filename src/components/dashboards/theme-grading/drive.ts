// Google Drive REST layer for the theme-grading dashboard. Auth comes from the
// shared OAuth code-flow client (src/lib/googleAuth.ts); this module is just
// Drive v3 calls.
//
// File layout in Drive:
//
//   <PUBLIC_THEME_GRADING_DRIVE_FOLDER_ID or root>/
//     Theme Grading/
//       state.json     <- canonical app state (corpora + runs + ratings)
//       ratings.csv    <- derived per-theme ratings export (read-only)
//       similarities.csv
//
// state.json carries the appProperty tag tw_theme_grading=v1 so pulls can find
// it wherever it lives. Scope: drive.file (only files this app created).

export const APP_PROPERTY_KEY = 'tw_theme_grading';
export const APP_PROPERTY_VALUE = 'v1';

export const MIME = {
  json: 'application/json',
  csv: 'text/csv',
  folder: 'application/vnd.google-apps.folder',
} as const;

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
};

export class DriveAuthError extends Error {
  constructor(
    public status: number,
    msg: string,
  ) {
    super(msg);
    this.name = 'DriveAuthError';
  }
}

const FIELDS = 'id,name,mimeType,modifiedTime,parents,appProperties';

async function apiJSON<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (r.status === 401 || r.status === 403) {
    throw new DriveAuthError(r.status, `Drive auth failed (${r.status}). Sign in again.`);
  }
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Drive API ${r.status}: ${body || r.statusText}`);
  }
  return r.json() as Promise<T>;
}

// Find every app-tagged state.json (normally exactly one).
export async function listStateFiles(token: string): Promise<DriveItem[]> {
  const q = encodeURIComponent(
    `appProperties has { key='${APP_PROPERTY_KEY}' and value='${APP_PROPERTY_VALUE}' } and trashed=false`,
  );
  const fields = encodeURIComponent(`files(${FIELDS})`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=100`;
  const r = await apiJSON<{ files?: DriveItem[] }>(token, url);
  return r.files ?? [];
}

export async function listChildren(token: string, parentId: string): Promise<DriveItem[]> {
  const q = encodeURIComponent(`'${parentId}' in parents and trashed=false`);
  const fields = encodeURIComponent(`files(${FIELDS})`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000`;
  const r = await apiJSON<{ files?: DriveItem[] }>(token, url);
  return r.files ?? [];
}

export async function getFileContent<T = unknown>(token: string, fileId: string): Promise<T> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401 || r.status === 403) {
    throw new DriveAuthError(r.status, `Drive auth failed (${r.status}).`);
  }
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Drive API ${r.status}: ${body || r.statusText}`);
  }
  return r.json() as Promise<T>;
}

export async function fileExists(token: string, fileId: string): Promise<boolean> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,trashed`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 404) return false;
  if (r.status === 401 || r.status === 403) {
    throw new DriveAuthError(r.status, `Drive auth failed (${r.status}).`);
  }
  if (!r.ok) return false;
  const data = (await r.json().catch(() => null)) as { trashed?: boolean } | null;
  return !!data && !data.trashed;
}

export async function createFolder(
  token: string,
  name: string,
  parentId?: string,
): Promise<DriveItem> {
  const metadata = {
    name,
    mimeType: MIME.folder,
    parents: parentId ? [parentId] : undefined,
  };
  const url = `https://www.googleapis.com/drive/v3/files?fields=${encodeURIComponent(FIELDS)}`;
  return apiJSON<DriveItem>(token, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
}

export async function findOrCreateFolder(
  token: string,
  name: string,
  parentId: string | undefined,
): Promise<string> {
  if (parentId) {
    const children = await listChildren(token, parentId);
    const existing = children.find((c) => c.mimeType === MIME.folder && c.name === name);
    if (existing) return existing.id;
  }
  const made = await createFolder(token, name, parentId);
  return made.id;
}

export type CreateOpts = {
  name: string;
  parentId?: string;
  mimeType: string;
  content: unknown | string;
  appTagged?: boolean;
};

export async function createFile(token: string, opts: CreateOpts): Promise<DriveItem> {
  const metadata: any = {
    name: opts.name,
    mimeType: opts.mimeType,
    parents: opts.parentId ? [opts.parentId] : undefined,
  };
  if (opts.appTagged) {
    metadata.appProperties = { [APP_PROPERTY_KEY]: APP_PROPERTY_VALUE };
  }
  const bodyContent =
    typeof opts.content === 'string' ? opts.content : JSON.stringify(opts.content);
  const body = multipartBody(metadata, bodyContent, opts.mimeType);
  const url = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=${encodeURIComponent(FIELDS)}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${MULTIPART_BOUNDARY}`,
    },
    body,
  });
  if (r.status === 401 || r.status === 403) {
    throw new DriveAuthError(r.status, `Drive auth failed (${r.status}).`);
  }
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Drive create ${r.status}: ${t || r.statusText}`);
  }
  return (await r.json()) as DriveItem;
}

export async function updateFile(
  token: string,
  fileId: string,
  content: unknown | string,
  mimeType: string,
): Promise<DriveItem> {
  const bodyContent = typeof content === 'string' ? content : JSON.stringify(content);
  const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=${encodeURIComponent(FIELDS)}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': mimeType,
    },
    body: bodyContent,
  });
  if (r.status === 401 || r.status === 403) {
    throw new DriveAuthError(r.status, `Drive auth failed (${r.status}).`);
  }
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Drive update ${r.status}: ${t || r.statusText}`);
  }
  return (await r.json()) as DriveItem;
}

// --- multipart helper ----------------------------------------------------

const MULTIPART_BOUNDARY = 'tw_tg_boundary_' + Math.random().toString(36).slice(2);

function multipartBody(metadata: unknown, content: string, contentMime: string): string {
  const meta = JSON.stringify(metadata);
  return [
    `--${MULTIPART_BOUNDARY}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    meta,
    `--${MULTIPART_BOUNDARY}`,
    `Content-Type: ${contentMime}; charset=UTF-8`,
    '',
    content,
    `--${MULTIPART_BOUNDARY}--`,
  ].join('\r\n');
}

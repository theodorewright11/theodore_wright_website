// Google Drive sync layer for the qualitative-coding dashboard. Browser-side
// OAuth via Google Identity Services (GIS), direct REST calls to the Drive v3
// API.
//
// File layout in Drive (one folder per project):
//
//   <DRIVE_FOLDER_ID or root>/
//     <project name>/
//       project.json           <- canonical state (machine-readable)
//       project.md             <- full export, all docs + annotations
//       codebook.md            <- codes + definitions
//       documents/
//         <doc folder path>/   <- mirrors Document.folder
//           <doc title>.md     <- per-document export with annotation table
//
// project.json carries the appProperty tag tw_qual_coding=v1 so the app's
// listing query can find legacy flat files (created by v2) and offer a
// migration path. Derived files (.md) are pure exports — the dashboard never
// reads them back.
//
// Scope: drive.file — only files the app creates or the user explicitly opens
// with it. *Not* full Drive.

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/drive.file email profile';
const TOKEN_KEY = 'tw-qual-coding-google-token';

export const APP_PROPERTY_KEY = 'tw_qual_coding';
export const APP_PROPERTY_VALUE = 'v1';

export const MIME = {
  json: 'application/json',
  md: 'text/markdown',
  folder: 'application/vnd.google-apps.folder',
} as const;

export type StoredToken = {
  access_token: string;
  expires_at: number;
  email?: string;
};

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
};

// --- Token persistence ---------------------------------------------------

export function loadStoredToken(): StoredToken | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    if (!t.access_token || !t.expires_at || t.expires_at <= Date.now()) {
      window.sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return t;
  } catch {
    return null;
  }
}

function saveToken(t: StoredToken): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
}

export function clearStoredToken(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(TOKEN_KEY);
}

// --- GIS bootstrap -------------------------------------------------------

declare global {
  interface Window {
    google?: any;
  }
}

let gisLoadPromise: Promise<void> | null = null;

export function loadGIS(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('GIS only loads in the browser'));
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoadPromise = null;
      reject(new Error('Failed to load Google Identity Services'));
    };
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

export type SignInOptions = {
  clientId: string;
  prompt?: 'consent' | '' | 'none';
};

export async function signIn(opts: SignInOptions): Promise<StoredToken> {
  await loadGIS();
  const google = window.google!;
  return new Promise<StoredToken>((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: opts.clientId,
      scope: SCOPE,
      callback: async (resp: any) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        const expires_at = Date.now() + (resp.expires_in - 60) * 1000;
        const t: StoredToken = { access_token: resp.access_token, expires_at };
        try {
          t.email = await fetchEmail(t.access_token);
        } catch {
          /* userinfo failure is non-fatal */
        }
        saveToken(t);
        resolve(t);
      },
      // Without error_callback, silent-refresh (prompt: 'none') failures like
      // "popup closed" / "interaction required" can leave the promise hanging.
      error_callback: (err: any) => {
        reject(new Error(err?.message || err?.type || 'sign-in failed'));
      },
    });
    tokenClient.requestAccessToken({ prompt: opts.prompt ?? 'consent' });
  });
}

export function signOut(token?: string): void {
  if (typeof window === 'undefined') return;
  if (token && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(token, () => {});
    } catch {
      /* best-effort */
    }
  }
  clearStoredToken();
}

async function fetchEmail(accessToken: string): Promise<string | undefined> {
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return undefined;
  const j = await r.json();
  return j.email;
}

// --- Drive REST helpers --------------------------------------------------

export class DriveAuthError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
    this.name = 'DriveAuthError';
  }
}

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

const FIELDS = 'id,name,mimeType,modifiedTime,parents,appProperties';

// --- Listing -------------------------------------------------------------

export async function listAppFiles(
  token: string,
  rootFolderId?: string,
): Promise<DriveItem[]> {
  const qParts = [
    `appProperties has { key='${APP_PROPERTY_KEY}' and value='${APP_PROPERTY_VALUE}' }`,
    'trashed=false',
  ];
  if (rootFolderId) qParts.push(`'${rootFolderId}' in parents`);
  const q = encodeURIComponent(qParts.join(' and '));
  const fields = encodeURIComponent(`files(${FIELDS})`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000`;
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

// --- File ops ------------------------------------------------------------

export async function getFileContent<T = unknown>(
  token: string,
  fileId: string,
): Promise<T> {
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
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });
  if (r.status === 401 || r.status === 403) {
    throw new DriveAuthError(r.status, `Drive auth failed (${r.status}).`);
  }
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Drive create folder ${r.status}: ${body || r.statusText}`);
  }
  return (await r.json()) as DriveItem;
}

export async function findOrCreateFolder(
  token: string,
  name: string,
  parentId: string | undefined,
  cache?: Map<string, string>,
): Promise<string> {
  const cacheKey = `${parentId ?? 'root'}|${name}`;
  if (cache?.has(cacheKey)) return cache.get(cacheKey)!;
  const children = parentId ? await listChildren(token, parentId) : [];
  const existing = children.find(
    (c) => c.mimeType === MIME.folder && c.name === name,
  );
  if (existing) {
    cache?.set(cacheKey, existing.id);
    return existing.id;
  }
  const made = await createFolder(token, name, parentId);
  cache?.set(cacheKey, made.id);
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

export type UpdateOpts = {
  fileId: string;
  content: unknown | string;
  mimeType: string;
  name?: string;
};

export async function updateFile(token: string, opts: UpdateOpts): Promise<DriveItem> {
  if (opts.name) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(opts.fileId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: opts.name }),
    });
  }
  const bodyContent =
    typeof opts.content === 'string' ? opts.content : JSON.stringify(opts.content);
  const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(opts.fileId)}?uploadType=media&fields=${encodeURIComponent(FIELDS)}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': opts.mimeType,
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

export async function renameFile(
  token: string,
  fileId: string,
  newName: string,
): Promise<void> {
  await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
  });
}

export async function moveFile(
  token: string,
  fileId: string,
  newParentId: string,
  removeParents?: string[],
): Promise<void> {
  const removeStr = removeParents?.length ? `&removeParents=${removeParents.join(',')}` : '';
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?addParents=${encodeURIComponent(newParentId)}${removeStr}`;
  await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
}

export async function deleteFile(token: string, fileId: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
  const r = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 401 || r.status === 403) {
    throw new DriveAuthError(r.status, `Drive auth failed (${r.status}).`);
  }
  if (!r.ok && r.status !== 404) {
    const t = await r.text().catch(() => '');
    throw new Error(`Drive delete ${r.status}: ${t || r.statusText}`);
  }
}

// --- multipart helper ----------------------------------------------------

const MULTIPART_BOUNDARY = 'tw_qc_boundary_' + Math.random().toString(36).slice(2);

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

// --- Naming --------------------------------------------------------------

export function slugFile(name: string): string {
  return (
    name
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 80) || 'untitled'
  );
}

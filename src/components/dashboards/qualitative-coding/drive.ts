// Google Drive sync layer for the qualitative-coding dashboard. Browser-side
// OAuth via Google Identity Services (GIS), direct REST calls to the Drive v3
// API. One file per Project, JSON content. No server, no service account.
//
// Scope: drive.file — only access files the app created or the user opened
// with it. The app cannot see the user's other Drive files.

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/drive.file email profile';
const TOKEN_KEY = 'tw-qual-coding-google-token';

export const APP_PROPERTY_KEY = 'tw_qual_coding';
export const APP_PROPERTY_VALUE = 'v1';
export const FILE_MIME = 'application/json';

export type StoredToken = {
  access_token: string;
  expires_at: number;
  email?: string;
};

export type DriveFile = {
  id: string;
  name: string;
  modifiedTime: string;
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

async function api<T>(token: string, url: string, init?: RequestInit): Promise<T> {
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

// List all files this app created (filtered by appProperties).
export async function listAppFiles(token: string, folderId?: string): Promise<DriveFile[]> {
  const qParts = [
    `appProperties has { key='${APP_PROPERTY_KEY}' and value='${APP_PROPERTY_VALUE}' }`,
    'trashed=false',
  ];
  if (folderId) qParts.push(`'${folderId}' in parents`);
  const q = encodeURIComponent(qParts.join(' and '));
  const fields = encodeURIComponent('files(id,name,modifiedTime,appProperties)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000`;
  const r = await api<{ files?: DriveFile[] }>(token, url);
  return r.files ?? [];
}

export async function getFileContent<T = unknown>(token: string, fileId: string): Promise<T> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
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

export async function createFile(
  token: string,
  name: string,
  content: unknown,
  folderId?: string,
): Promise<DriveFile> {
  const metadata = {
    name,
    mimeType: FILE_MIME,
    appProperties: { [APP_PROPERTY_KEY]: APP_PROPERTY_VALUE },
    parents: folderId ? [folderId] : undefined,
  };
  const body = multipartBody(metadata, content);
  const url =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,appProperties';
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
  return (await r.json()) as DriveFile;
}

export async function updateFile(
  token: string,
  fileId: string,
  content: unknown,
  newName?: string,
): Promise<DriveFile> {
  if (newName) {
    // Rename via PATCH metadata
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      },
    );
  }
  const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,modifiedTime,appProperties`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': FILE_MIME,
    },
    body: JSON.stringify(content),
  });
  if (r.status === 401 || r.status === 403) {
    throw new DriveAuthError(r.status, `Drive auth failed (${r.status}).`);
  }
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Drive update ${r.status}: ${t || r.statusText}`);
  }
  return (await r.json()) as DriveFile;
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

function multipartBody(metadata: unknown, content: unknown): string {
  const meta = JSON.stringify(metadata);
  const body = JSON.stringify(content);
  return [
    `--${MULTIPART_BOUNDARY}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    meta,
    `--${MULTIPART_BOUNDARY}`,
    `Content-Type: ${FILE_MIME}; charset=UTF-8`,
    '',
    body,
    `--${MULTIPART_BOUNDARY}--`,
  ].join('\r\n');
}

export function projectFileName(projectName: string, projectId: string): string {
  const slug = projectName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'project';
  return `${slug}.${projectId.slice(0, 8)}.qcoding.json`;
}

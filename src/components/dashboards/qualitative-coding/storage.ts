import type { AppState, Project } from './types';

const KEY = 'tw-qual-coding-v1';

const empty: AppState = {
  version: 1,
  projects: [],
  activeProjectId: null,
  exploreProjectIds: [],
  view: 'documents',
  showCodeDefinitions: false,
};

export function loadState(): AppState {
  if (typeof window === 'undefined') return empty;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && Array.isArray(parsed.projects)) {
      return {
        version: 1,
        projects: parsed.projects.map(coerceProject),
        activeProjectId: parsed.activeProjectId ?? null,
        exploreProjectIds: Array.isArray(parsed.exploreProjectIds) ? parsed.exploreProjectIds : [],
        view: parsed.view === 'explore' ? 'explore' : 'documents',
        showCodeDefinitions: !!parsed.showCodeDefinitions,
      };
    }
  } catch {
    // fall through
  }
  return empty;
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function coerceProject(p: any): Project {
  const docs = Array.isArray(p.documents) ? p.documents : [];
  return {
    version: 1,
    id: String(p.id ?? cryptoRandomId()),
    name: String(p.name ?? 'Untitled project'),
    description: p.description ?? undefined,
    about: typeof p.about === 'string' ? p.about : undefined,
    metadataSchema: Array.isArray(p.metadataSchema) ? p.metadataSchema : [],
    documents: docs.map((d: any) => ({
      ...d,
      folder: typeof d.folder === 'string' && d.folder.trim() ? d.folder : undefined,
      notes: typeof d.notes === 'string' ? d.notes : undefined,
      metadata: d.metadata && typeof d.metadata === 'object' ? d.metadata : {},
    })),
    codes: Array.isArray(p.codes) ? p.codes : [],
    annotations: Array.isArray(p.annotations) ? p.annotations : [],
    folders: Array.isArray(p.folders) ? p.folders.filter((f: any) => typeof f === 'string') : [],
    created_at: p.created_at ?? new Date().toISOString(),
    updated_at: p.updated_at ?? new Date().toISOString(),
    drive:
      p.drive && typeof p.drive === 'object' && (p.drive.folderId || p.drive.fileId)
        ? p.drive
        : undefined,
  };
}

export function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function newProject(name: string): Project {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: cryptoRandomId(),
    name,
    metadataSchema: [],
    documents: [],
    codes: [],
    annotations: [],
    created_at: now,
    updated_at: now,
  };
}

export function downloadJSON(filename: string, data: unknown): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(filename, blob);
}

export function downloadText(filename: string, text: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(filename, blob);
}

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

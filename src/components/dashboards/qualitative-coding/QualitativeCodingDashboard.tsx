import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AuthBar, { type SyncStatus } from './AuthBar';
import CodeTree from './CodeTree';
import CodebookView from './CodebookView';
import DocumentViewer from './DocumentViewer';
import ExploreView, {
  defaultExploreFilterState,
  type ExploreFilterState,
} from './ExploreView';
import MetadataSchemaEditor from './MetadataSchemaEditor';
import ProjectAboutView from './ProjectAboutView';
import { ResizeHandle } from './Resizable';
import {
  buildFolderTree,
  codePathString,
  deepCodeCounts,
  descendantIds,
  findDoc,
  folderDocCount,
  nextPaletteColor,
  type FolderNode,
} from './compute';
import {
  DriveAuthError,
  listAppFiles,
  loadStoredToken,
  signIn,
  signOut,
  type DriveItem,
  type StoredToken,
} from './drive';
import {
  deleteProjectFromDrive,
  pullProjectFromDrive,
  syncProjectToDrive,
} from './driveSync';
import { exportDocumentMarkdown, exportProjectJSON, exportProjectMarkdown } from './exporters';
import {
  coerceProject,
  cryptoRandomId,
  downloadJSON,
  downloadText,
  loadState,
  newProject,
  readFileAsText,
  saveState,
} from './storage';
import type {
  Annotation,
  AppState,
  Code,
  Document,
  MetadataField,
  Project,
  View,
} from './types';

type DriveState = {
  token: StoredToken | null;
  syncStatus: SyncStatus;
  lastError: string | null;
};

const GOOGLE_CLIENT_ID = (import.meta as any).env?.PUBLIC_GOOGLE_CLIENT_ID as string | undefined;
const DRIVE_FOLDER_ID = (import.meta as any).env?.PUBLIC_QUAL_CODING_DRIVE_FOLDER_ID as
  | string
  | undefined;

export default function QualitativeCodingDashboard() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [hydrated, setHydrated] = useState(false);
  const [openDocIds, setOpenDocIds] = useState<string[]>([]);
  const [dragPaneId, setDragPaneId] = useState<string | null>(null);
  const [dragOverPaneId, setDragOverPaneId] = useState<string | null>(null);
  const activeDocId = openDocIds[0] ?? null;
  const setActiveDocId = (id: string | null) => {
    setOpenDocIds(id ? [id] : []);
  };
  const addCompareDoc = (id: string) => {
    setOpenDocIds((prev) => {
      if (prev.includes(id)) return prev;
      // Soft cap: 20. Doc area scrolls horizontally past ~4.
      return [...prev, id].slice(0, 20);
    });
  };
  const closeDocPane = (id: string) => {
    setOpenDocIds((prev) => prev.filter((x) => x !== id));
  };
  const movePaneTo = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setOpenDocIds((prev) => {
      const fromIdx = prev.indexOf(fromId);
      const toIdx = prev.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };
  const [focusedAnnotationId, setFocusedAnnotationId] = useState<string | null>(null);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [codebookPanelOpen, setCodebookPanelOpen] = useState(false);
  // Explore filters are session-state (not persisted), but lifted here so
  // they survive navigating away from the Explore tab and back.
  const [exploreFilterState, setExploreFilterState] = useState<ExploreFilterState>(
    () => defaultExploreFilterState(),
  );
  const updateExploreFilter = (patch: Partial<ExploreFilterState>) =>
    setExploreFilterState((s) => ({ ...s, ...patch }));
  const [drive, setDrive] = useState<DriveState>({
    token: null,
    syncStatus: 'offline',
    lastError: null,
  });
  const importInputRef = useRef<HTMLInputElement>(null);

  const view: View = state.view ?? 'documents';
  const showCodeDefinitions = !!state.showCodeDefinitions;
  const sidebarCollapsed = !!state.sidebarCollapsed;
  const sidebarWidth = state.sidebarWidth ?? 320;
  const notesWidth = state.notesWidth ?? 380;
  const codebookWidth = state.codebookWidth ?? 360;
  const annotationsPanelHeight = state.annotationsPanelHeight ?? 280;
  const annotationsPanelCollapsed = !!state.annotationsPanelCollapsed;
  const metadataCollapsed = !!state.metadataCollapsed;
  const exploreProjectIds = state.exploreProjectIds ?? [];

  const setSidebarWidth = (n: number) =>
    setState((s) => ({ ...s, sidebarWidth: n }));
  const setNotesWidth = (n: number) =>
    setState((s) => ({ ...s, notesWidth: n }));
  const setCodebookWidth = (n: number) =>
    setState((s) => ({ ...s, codebookWidth: n }));
  const setAnnotationsPanelHeight = (n: number) =>
    setState((s) => ({ ...s, annotationsPanelHeight: n }));
  const toggleAnnotationsPanel = () =>
    setState((s) => ({ ...s, annotationsPanelCollapsed: !s.annotationsPanelCollapsed }));
  const toggleMetadata = () =>
    setState((s) => ({ ...s, metadataCollapsed: !s.metadataCollapsed }));

  useEffect(() => {
    setHydrated(true);
    const t = loadStoredToken();
    if (t) setDrive((d) => ({ ...d, token: t, syncStatus: 'idle' }));
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  const activeProject = useMemo<Project | null>(() => {
    if (!state.activeProjectId) return null;
    return state.projects.find((p) => p.id === state.activeProjectId) ?? null;
  }, [state]);

  useEffect(() => {
    if (!activeProject) {
      setOpenDocIds([]);
      setSelectedCodeId(null);
      return;
    }
    const validIds = new Set(activeProject.documents.map((d) => d.id));
    const filtered = openDocIds.filter((id) => validIds.has(id));
    if (filtered.length !== openDocIds.length) {
      setOpenDocIds(filtered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject]);

  // ----- Mutation primitives -----
  const updateActiveProject = useCallback(
    (mutate: (p: Project) => Project) => {
      setState((s) => {
        if (!s.activeProjectId) return s;
        return {
          ...s,
          projects: s.projects.map((p) =>
            p.id === s.activeProjectId
              ? { ...mutate(p), updated_at: new Date().toISOString() }
              : p,
          ),
        };
      });
    },
    [],
  );

  const updateProjectById = useCallback(
    (projectId: string, mutate: (p: Project) => Project) => {
      setState((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === projectId
            ? { ...mutate(p), updated_at: new Date().toISOString() }
            : p,
        ),
      }));
    },
    [],
  );

  // ----- Drive sync queue -----
  const pendingWrites = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const inflightWrites = useRef<Set<string>>(new Set());

  const queueWrite = useCallback(
    (projectId: string) => {
      if (!drive.token) return;
      const existing = pendingWrites.current.get(projectId);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        pendingWrites.current.delete(projectId);
        runWrite(projectId);
      }, 800);
      pendingWrites.current.set(projectId, t);
    },
    [drive.token],
  );

  const runWrite = useCallback(
    async (projectId: string) => {
      if (!drive.token) return;
      if (inflightWrites.current.has(projectId)) {
        queueWrite(projectId);
        return;
      }
      inflightWrites.current.add(projectId);
      setDrive((d) => ({ ...d, syncStatus: 'syncing', lastError: null }));
      try {
        const snapshot = JSON.parse(window.localStorage.getItem('tw-qual-coding-v1') ?? '{}');
        const project: Project | undefined = (snapshot.projects ?? []).find(
          (p: Project) => p.id === projectId,
        );
        if (!project) {
          inflightWrites.current.delete(projectId);
          setDrive((d) => ({ ...d, syncStatus: 'idle' }));
          return;
        }
        const newDrive = await syncProjectToDrive(
          drive.token.access_token,
          project,
          DRIVE_FOLDER_ID,
        );
        updateProjectById(projectId, (p) => ({ ...p, drive: newDrive }));
        inflightWrites.current.delete(projectId);
        setDrive((d) => ({ ...d, syncStatus: 'idle' }));
      } catch (err) {
        inflightWrites.current.delete(projectId);
        if (err instanceof DriveAuthError) {
          setDrive({ token: null, syncStatus: 'error', lastError: err.message });
        } else {
          setDrive((d) => ({
            ...d,
            syncStatus: 'error',
            lastError: err instanceof Error ? err.message : String(err),
          }));
        }
      }
    },
    [drive.token, updateProjectById, queueWrite],
  );

  const pullAllFromDrive = useCallback(async () => {
    if (!drive.token) return;
    setDrive((d) => ({ ...d, syncStatus: 'syncing', lastError: null }));
    try {
      // Pulls have two paths:
      //  - app-tagged project.json files (new layout: inside a project folder)
      //  - legacy app-tagged flat files (v2: in DRIVE_FOLDER_ID or root)
      // Both surface via listAppFiles. We then peek at the parent folder; if
      // it's the DRIVE_FOLDER_ID (or root), it's legacy and needs migration —
      // syncProjectToDrive will handle the move-into-folder on next write.
      const tagged: DriveItem[] = await listAppFiles(drive.token.access_token);
      // Also list children of DRIVE_FOLDER_ID for folder-per-project structures.
      // (project.json sits inside a child folder, so listAppFiles already finds it.)
      const pulledProjects: Project[] = [];
      const tombstones = new Set(state.deletedProjectIds ?? []);
      for (const f of tagged) {
        try {
          const parentId = f.parents?.[0];
          const isLegacyFlat = !parentId || parentId === DRIVE_FOLDER_ID;
          const content = await pullProjectFromDrive(drive.token.access_token, {
            projectJsonId: f.id,
          });
          const projAttrs: any = { ...(content as object) };
          if (isLegacyFlat) {
            // Legacy file lived flat. Stamp drive.fileId so syncProjectToDrive
            // will migrate it into a folder on the next write.
            projAttrs.drive = { fileId: f.id, modifiedTime: f.modifiedTime };
          } else {
            projAttrs.drive = {
              folderId: parentId!,
              projectJsonId: f.id,
              modifiedTime: f.modifiedTime,
            };
          }
          const proj = coerceProject(projAttrs);
          // Honour tombstones: don't resurrect projects the user deleted locally
          // (Drive trash may still hold the file briefly).
          if (tombstones.has(proj.id)) continue;
          pulledProjects.push(proj);
        } catch {
          // Skip files we can't parse
        }
      }
      const pulledIds = new Set(pulledProjects.map((p) => p.id));
      const localSnapshot = JSON.parse(
        window.localStorage.getItem('tw-qual-coding-v1') ?? '{}',
      );
      const localProjects: Project[] = (localSnapshot.projects ?? []) as Project[];
      const localById = new Map(localProjects.map((p) => [p.id, p]));
      const localPreferredIds: string[] = [];

      const merged: Project[] = [];
      for (const pulled of pulledProjects) {
        const local = localById.get(pulled.id);
        if (!local) {
          merged.push(pulled);
          continue;
        }
        const localTime = Date.parse(local.updated_at) || 0;
        const serverTime = Date.parse(pulled.updated_at) || 0;
        // Local wins ties so newer-typed edits aren't clobbered on a focus pull.
        if (localTime >= serverTime) {
          // Adopt server's Drive link (folderId / projectJsonId) so the next
          // write updates the correct files rather than creating duplicates.
          merged.push({ ...local, drive: pulled.drive });
          localPreferredIds.push(pulled.id);
        } else {
          merged.push(pulled);
        }
      }
      for (const local of localProjects) {
        if (pulledIds.has(local.id)) continue;
        merged.push(local);
      }

      setState((s) => {
        const seenIds = new Set(merged.map((p) => p.id));
        return {
          ...s,
          projects: merged,
          activeProjectId:
            s.activeProjectId && seenIds.has(s.activeProjectId)
              ? s.activeProjectId
              : merged[0]?.id ?? null,
        };
      });

      // Queue writes for: (a) local-newer projects so server catches up,
      // (b) projects that need migration (no folderId yet).
      for (const id of localPreferredIds) queueWrite(id);
      for (const p of localProjects) {
        if (!p.drive || !p.drive.folderId) {
          queueWrite(p.id);
        }
      }
      setDrive((d) => ({ ...d, syncStatus: 'idle' }));
    } catch (err) {
      if (err instanceof DriveAuthError) {
        setDrive({ token: null, syncStatus: 'error', lastError: err.message });
      } else {
        setDrive((d) => ({
          ...d,
          syncStatus: 'error',
          lastError: err instanceof Error ? err.message : String(err),
        }));
      }
    }
  }, [drive.token, queueWrite]);

  // Pull on sign-in
  useEffect(() => {
    if (drive.token) pullAllFromDrive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drive.token?.access_token]);

  // Wake handler: covers tab-switch (visibilitychange) and window focus.
  // setTimeout is throttled in background tabs so the silent-refresh timer
  // below may fire well after expiry; on wake, if the token is within 5
  // minutes of expiry, silent-refresh first so the subsequent pull uses a
  // fresh token (otherwise pull → 401 → token cleared → "signed out").
  useEffect(() => {
    if (!drive.token || !GOOGLE_CLIENT_ID) return;
    const wake = () => {
      if (!drive.token) return;
      if (drive.token.expires_at - Date.now() < 5 * 60_000) {
        signIn({ clientId: GOOGLE_CLIENT_ID, prompt: 'none' })
          .then((t) => setDrive({ token: t, syncStatus: 'idle', lastError: null }))
          .catch(() => pullAllFromDrive()); // silent refresh failed — try pull anyway
      } else {
        pullAllFromDrive();
      }
    };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [drive.token, pullAllFromDrive]);

  // Silent token refresh ~1 minute before expiry. GIS reissues a new access
  // token with no popup as long as the user is still signed into Google in
  // any browser tab and previously consented to this app. If silent refresh
  // fails (signed out of Google, consent revoked), the current token is left
  // alone and dies at natural expiry, prompting normal manual sign-in.
  useEffect(() => {
    if (!drive.token || !GOOGLE_CLIENT_ID) return;
    const delay = drive.token.expires_at - 60_000 - Date.now();
    if (delay <= 0) return;
    const tid = window.setTimeout(async () => {
      try {
        const fresh = await signIn({ clientId: GOOGLE_CLIENT_ID, prompt: 'none' });
        setDrive({ token: fresh, syncStatus: 'idle', lastError: null });
      } catch {
        /* let the token die naturally */
      }
    }, delay);
    return () => clearTimeout(tid);
  }, [drive.token]);

  const handleSignIn = async () => {
    if (!GOOGLE_CLIENT_ID) return;
    try {
      const t = await signIn({ clientId: GOOGLE_CLIENT_ID, prompt: 'consent' });
      setDrive({ token: t, syncStatus: 'idle', lastError: null });
    } catch (err) {
      setDrive((d) => ({
        ...d,
        syncStatus: 'error',
        lastError: err instanceof Error ? err.message : String(err),
      }));
    }
  };

  const handleSignOut = () => {
    signOut(drive.token?.access_token);
    setDrive({ token: null, syncStatus: 'offline', lastError: null });
  };

  // ----- Project CRUD -----
  const createProject = (name: string) => {
    const p = newProject(name);
    setState((s) => ({
      ...s,
      projects: [...s.projects, p],
      activeProjectId: p.id,
      view: 'documents',
    }));
    setActiveDocId(null);
    setSelectedCodeId(null);
    queueWrite(p.id);
  };

  const switchProject = (id: string) => {
    setState((s) => ({ ...s, activeProjectId: id }));
    setActiveDocId(null);
    setSelectedCodeId(null);
  };

  const deleteProject = (id: string) => {
    const proj = state.projects.find((p) => p.id === id);
    setState((s) => {
      const next = s.projects.filter((p) => p.id !== id);
      const tombstones = [...(s.deletedProjectIds ?? []), id];
      return {
        ...s,
        projects: next,
        activeProjectId: s.activeProjectId === id ? next[0]?.id ?? null : s.activeProjectId,
        exploreProjectIds: (s.exploreProjectIds ?? []).filter((x) => x !== id),
        // Keep tombstones bounded so the list doesn't grow forever.
        deletedProjectIds: tombstones.slice(-200),
      };
    });
    if (proj?.drive && drive.token) {
      deleteProjectFromDrive(drive.token.access_token, proj.drive).catch(() => {});
    }
  };

  const updateProjectMeta = (patch: Partial<Project>) => {
    if (!activeProject) return;
    updateActiveProject((p) => ({ ...p, ...patch }));
    queueWrite(activeProject.id);
  };

  const toggleExploreProject = (id: string) => {
    setState((s) => {
      const cur = s.exploreProjectIds ?? [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...s, exploreProjectIds: next };
    });
  };

  // ----- Document CRUD -----
  const addDocument = (folder?: string, kind: 'document' | 'note' = 'document') => {
    if (!activeProject) return;
    const now = new Date().toISOString();
    const d: Document = {
      id: cryptoRandomId(),
      title: kind === 'note' ? 'Untitled note' : 'Untitled document',
      text: '',
      kind,
      folder: folder || undefined,
      metadata: {},
      created_at: now,
      updated_at: now,
    };
    const projectId = activeProject.id;
    updateActiveProject((p) => ({ ...p, documents: [...p.documents, d] }));
    setActiveDocId(d.id);
    queueWrite(projectId);
  };

  const deleteDocument = (id: string) => {
    if (!activeProject) return;
    const projectId = activeProject.id;
    updateActiveProject((p) => ({
      ...p,
      documents: p.documents.filter((d) => d.id !== id),
      annotations: p.annotations.filter((a) => a.docId !== id),
    }));
    closeDocPane(id);
    queueWrite(projectId);
  };

  const updateDocument = (id: string, patch: Partial<Document>) => {
    if (!activeProject) return;
    const projectId = activeProject.id;
    updateActiveProject((p) => ({
      ...p,
      documents: p.documents.map((d) =>
        d.id === id ? { ...d, ...patch, updated_at: new Date().toISOString() } : d,
      ),
    }));
    queueWrite(projectId);
  };

  const addFolder = (path: string) => {
    if (!activeProject) return;
    const trimmed = path.trim();
    if (!trimmed) return;
    const projectId = activeProject.id;
    updateActiveProject((p) => {
      const existing = p.folders ?? [];
      if (existing.includes(trimmed)) return p;
      return { ...p, folders: [...existing, trimmed] };
    });
    queueWrite(projectId);
  };

  const deleteFolder = (path: string) => {
    if (!activeProject) return;
    const projectId = activeProject.id;
    updateActiveProject((p) => ({
      ...p,
      folders: (p.folders ?? []).filter((f) => f !== path && !f.startsWith(path + '/')),
      documents: p.documents.map((d) =>
        d.folder === path || d.folder?.startsWith(path + '/')
          ? { ...d, folder: undefined, updated_at: new Date().toISOString() }
          : d,
      ),
    }));
    queueWrite(projectId);
  };

  const moveDocumentToFolder = (docId: string, folder: string | undefined) => {
    updateDocument(docId, { folder });
  };

  // ----- Code CRUD -----
  const addCode = (
    parentId: string | null,
    name: string,
    explicitColor?: string | null,
  ): string => {
    if (!activeProject) return '';
    const projectId = activeProject.id;
    const id = cryptoRandomId();
    updateActiveProject((p) => {
      const color =
        explicitColor !== undefined
          ? explicitColor
          : parentId === null
            ? nextPaletteColor(p.codes)
            : null;
      const code: Code = {
        id,
        name,
        parentId,
        color,
        created_at: new Date().toISOString(),
      };
      return { ...p, codes: [...p.codes, code] };
    });
    queueWrite(projectId);
    return id;
  };

  const updateCode = (codeId: string, patch: Partial<Code>) => {
    if (!activeProject) return;
    const projectId = activeProject.id;
    updateActiveProject((p) => ({
      ...p,
      codes: p.codes.map((c) => (c.id === codeId ? { ...c, ...patch } : c)),
    }));
    queueWrite(projectId);
  };

  const deleteCode = (codeId: string) => {
    if (!activeProject) return;
    const projectId = activeProject.id;
    updateActiveProject((p) => {
      const toRemove = descendantIds(p.codes, codeId);
      return {
        ...p,
        codes: p.codes.filter((c) => !toRemove.has(c.id)),
        annotations: p.annotations.filter((a) => !toRemove.has(a.codeId)),
      };
    });
    if (selectedCodeId && descendantIds(activeProject.codes, codeId).has(selectedCodeId)) {
      setSelectedCodeId(null);
    }
    queueWrite(projectId);
  };

  // Move a code in the tree: relative to targetCodeId (before/after as sibling,
  // or inside as last child). Prevents cycles. Renumbers the new sibling group.
  const moveCode = (
    codeId: string,
    targetCodeId: string | null,
    position: 'before' | 'after' | 'inside',
  ) => {
    if (!activeProject) return;
    const projectId = activeProject.id;
    if (codeId === targetCodeId) return;
    // Cycle check: refuse to drop a code into its own descendant.
    if (targetCodeId && descendantIds(activeProject.codes, codeId).has(targetCodeId)) {
      return;
    }
    updateActiveProject((p) => {
      const target = targetCodeId ? p.codes.find((c) => c.id === targetCodeId) : null;
      // Determine the new parent id.
      let newParentId: string | null;
      if (position === 'inside') {
        newParentId = targetCodeId; // null means root (drop on root zone)
      } else if (target) {
        newParentId = target.parentId;
      } else {
        newParentId = null;
      }
      // Update parentId on the moved code
      const moved = p.codes.find((c) => c.id === codeId);
      if (!moved) return p;
      const updatedCode: Code = { ...moved, parentId: newParentId };
      // Sibling group of the new parent (excluding the moved code)
      const siblings = p.codes
        .filter((c) => c.parentId === newParentId && c.id !== codeId)
        .sort((a, b) => {
          const ao = a.order ?? Number.MAX_SAFE_INTEGER;
          const bo = b.order ?? Number.MAX_SAFE_INTEGER;
          if (ao !== bo) return ao - bo;
          return a.created_at.localeCompare(b.created_at);
        });
      let insertIdx: number;
      if (position === 'inside' || !target) {
        insertIdx = siblings.length; // last child
      } else {
        const ti = siblings.findIndex((c) => c.id === targetCodeId);
        insertIdx = ti < 0 ? siblings.length : position === 'before' ? ti : ti + 1;
      }
      const reordered = [...siblings];
      reordered.splice(insertIdx, 0, updatedCode);
      // Reassign sequential orders to the new sibling group
      const reorderedById = new Map(reordered.map((c, i) => [c.id, { ...c, order: i }]));
      // Apply: every code stays if it's not in the affected sibling group;
      // otherwise pull the reordered version.
      const nextCodes = p.codes.map((c) => {
        if (c.id === codeId) return reorderedById.get(c.id) ?? updatedCode;
        return reorderedById.get(c.id) ?? c;
      });
      return { ...p, codes: nextCodes };
    });
    queueWrite(projectId);
  };

  // ----- Annotation CRUD -----
  const addAnnotation = (
    docId: string,
    start: number,
    end: number,
    codeId: string,
    note?: string,
    explicitId?: string,
  ) => {
    if (!activeProject) return;
    const projectId = activeProject.id;
    const a: Annotation = {
      id: explicitId ?? cryptoRandomId(),
      docId,
      start,
      end,
      codeId,
      note,
      created_at: new Date().toISOString(),
    };
    updateActiveProject((p) => ({ ...p, annotations: [...p.annotations, a] }));
    queueWrite(projectId);
  };

  const updateAnnotation = (id: string, patch: Partial<Annotation>) => {
    if (!activeProject) return;
    const projectId = activeProject.id;
    updateActiveProject((p) => ({
      ...p,
      annotations: p.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
    queueWrite(projectId);
  };

  const deleteAnnotation = (id: string) => {
    if (!activeProject) return;
    const projectId = activeProject.id;
    updateActiveProject((p) => ({
      ...p,
      annotations: p.annotations.filter((a) => a.id !== id),
    }));
    queueWrite(projectId);
  };

  const handleSchemaChange = (next: MetadataField[]) => {
    if (!activeProject) return;
    const projectId = activeProject.id;
    updateActiveProject((p) => ({ ...p, metadataSchema: next }));
    queueWrite(projectId);
  };

  // ----- Export / import -----
  const onExportJSON = () => {
    if (!activeProject) return;
    downloadJSON(`${slugFile(activeProject.name)}.json`, exportProjectJSON(activeProject));
    setExportMenuOpen(false);
  };
  const onExportProjectMD = () => {
    if (!activeProject) return;
    downloadText(`${slugFile(activeProject.name)}.md`, exportProjectMarkdown(activeProject));
    setExportMenuOpen(false);
  };
  const onExportDocMD = () => {
    if (!activeProject) return;
    const doc = findDoc(activeProject, activeDocId);
    if (!doc) return;
    downloadText(`${slugFile(doc.title)}.coded.md`, exportDocumentMarkdown(activeProject, doc));
    setExportMenuOpen(false);
  };

  const onImportJSON = async (file: File) => {
    try {
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text);
      const project = coerceProject({ ...parsed, id: cryptoRandomId(), drive: undefined });
      setState((s) => ({
        ...s,
        projects: [...s.projects, project],
        activeProjectId: project.id,
      }));
      setActiveDocId(null);
      queueWrite(project.id);
    } catch (err) {
      window.alert(`Could not import: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  // ----- View helpers -----
  const setView = (v: View) => setState((s) => ({ ...s, view: v }));

  const toggleDefinitions = () =>
    setState((s) => ({ ...s, showCodeDefinitions: !s.showCodeDefinitions }));

  const toggleSidebar = () =>
    setState((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }));

  // Build a markdown link to an annotation and append it to the first open
  // note pane. Takes the annotation data directly so it works for annotations
  // that were just-created (state hasn't flushed yet) as well as existing ones.
  const sendAnnotationToNote = (
    fromDoc: Document,
    annotationData: { id: string; start: number; end: number; codeId: string },
  ) => {
    if (!activeProject) return;
    const openNotes = openDocIds
      .map((id) => activeProject.documents.find((d) => d.id === id))
      .filter((d): d is Document => !!d && d.kind === 'note');
    if (openNotes.length === 0) {
      window.alert(
        'Open a note pane first (click "+ note" in the sidebar, then open it as a compare pane).',
      );
      return;
    }
    const note = openNotes[0];
    const span = fromDoc.text
      .slice(annotationData.start, annotationData.end)
      .slice(0, 80)
      .replace(/\s+/g, ' ');
    const truncated = annotationData.end - annotationData.start > 80 ? '…' : '';
    const path = codePathString(activeProject.codes, annotationData.codeId);
    const label = `${fromDoc.title} · ${path} · "${span}${truncated}"`;
    const href = `qcanno://${activeProject.id}/${fromDoc.id}/${annotationData.id}`;
    const linkMd = `- [${label.replace(/[\[\]]/g, '')}](${href})`;
    const newText = note.text && note.text.trim() ? `${note.text}\n${linkMd}` : linkMd;
    updateDocument(note.id, { text: newText });
  };

  const handleQcLinkClick = (href: string) => {
    // qcanno://<projectId>/<docId>/<annotationId>
    const annoMatch = /^qcanno:\/\/([^/]+)\/([^/]+)\/(.+)$/i.exec(href);
    if (annoMatch) {
      const [, projectId, docId, annotationId] = annoMatch;
      jumpToAnnotation(projectId, docId, annotationId);
      return;
    }
    // qcdoc://<projectId>/<docId>
    const docMatch = /^qcdoc:\/\/([^/]+)\/([^/]+)$/i.exec(href);
    if (docMatch) {
      const [, projectId, docId] = docMatch;
      if (projectId !== state.activeProjectId) {
        setState((s) => ({ ...s, activeProjectId: projectId, view: 'documents' }));
      } else {
        setView('documents');
      }
      setSelectedCodeId(null);
      // Open as a compare pane if alongside the note; else replace.
      // Heuristic: if there are open notes, open the linked doc as a compare pane
      // so the note stays visible. Otherwise replace.
      const hasOpenNote = openDocIds.some((id) => {
        const d = activeProject?.documents.find((x) => x.id === id);
        return d?.kind === 'note';
      });
      if (hasOpenNote && !openDocIds.includes(docId)) {
        addCompareDoc(docId);
      } else {
        setActiveDocId(docId);
      }
      setFocusedAnnotationId(null);
    }
  };

  const jumpToAnnotation = (projectId: string, docId: string, annotationId: string) => {
    if (projectId !== state.activeProjectId) {
      setState((s) => ({ ...s, activeProjectId: projectId, view: 'documents' }));
    } else {
      setView('documents');
    }
    // Clear any sidebar code filter so the target annotation isn't filtered out
    // of the doc viewer.
    setSelectedCodeId(null);
    setActiveDocId(docId);
    setFocusedAnnotationId(annotationId);
  };

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-screen bg-white text-slate-400 text-[13px]">
        Loading…
      </div>
    );
  }

  if (!activeProject) {
    return (
      <NoProjects
        projects={state.projects}
        onCreate={createProject}
        onSwitch={switchProject}
        onImport={(f) => onImportJSON(f)}
      />
    );
  }

  const counts = deepCodeCounts(activeProject);
  const openDocs = openDocIds
    .map((id) => findDoc(activeProject, id))
    .filter((d): d is NonNullable<typeof d> => d !== null);
  const docAnnotations = selectedCodeId
    ? activeProject.annotations.filter((a) =>
        descendantIds(activeProject.codes, selectedCodeId).has(a.codeId),
      )
    : activeProject.annotations;

  const exploreProjects = (() => {
    const ids = new Set(exploreProjectIds);
    ids.add(activeProject.id);
    return state.projects.filter((p) => ids.has(p.id));
  })();

  return (
    <div className="h-screen flex flex-col bg-white text-slate-900">
      <TopBar
        project={activeProject}
        projects={state.projects}
        view={view}
        onSetView={setView}
        exploreProjectIds={exploreProjectIds}
        onToggleExplore={toggleExploreProject}
        onSwitch={switchProject}
        onCreate={createProject}
        onDelete={deleteProject}
        onRename={(name) => updateProjectMeta({ name })}
        onOpenSchema={() => setSchemaOpen(true)}
        exportMenuOpen={exportMenuOpen}
        setExportMenuOpen={setExportMenuOpen}
        onExportJSON={onExportJSON}
        onExportProjectMD={onExportProjectMD}
        onExportDocMD={onExportDocMD}
        canExportDocMD={openDocs.length > 0}
        onImport={() => importInputRef.current?.click()}
        driveConfigured={!!GOOGLE_CLIENT_ID}
        driveEmail={drive.token?.email}
        driveStatus={drive.syncStatus}
        driveError={drive.lastError}
        driveFileCount={state.projects.filter((p) => p.drive?.fileId).length}
        onDriveSignIn={handleSignIn}
        onDriveSignOut={handleSignOut}
        onDrivePullAll={pullAllFromDrive}
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportJSON(f);
          e.target.value = '';
        }}
      />
      <div className="flex-1 min-h-0 flex">
        {view !== 'about' && view !== 'codebook' && (
          <Sidebar
            project={activeProject}
            openDocIds={openDocIds}
            collapsed={sidebarCollapsed}
            width={sidebarWidth}
            onResize={setSidebarWidth}
            onToggleCollapsed={toggleSidebar}
            onOpenCodebookView={() => setView('codebook')}
            onSelectDoc={(id) => {
              setActiveDocId(id);
              setFocusedAnnotationId(null);
              if (view !== 'documents') setView('documents');
            }}
            onCompareDoc={(id) => {
              addCompareDoc(id);
              setFocusedAnnotationId(null);
              if (view !== 'documents') setView('documents');
            }}
            onAddDoc={(folder, kind) => addDocument(folder, kind)}
            onDeleteDoc={deleteDocument}
            onMoveDocToFolder={moveDocumentToFolder}
            onAddFolder={addFolder}
            onDeleteFolder={deleteFolder}
          />
        )}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-white">
          {view === 'about' ? (
            <ProjectAboutView project={activeProject} onUpdate={updateProjectMeta} />
          ) : view === 'codebook' ? (
            <CodebookView
              project={activeProject}
              variant="page"
              showDefinitions={showCodeDefinitions}
              onToggleDefinitions={toggleDefinitions}
              onAddCode={addCode}
              onUpdateCode={updateCode}
              onDeleteCode={deleteCode}
              onMoveCode={moveCode}
            />
          ) : view === 'explore' ? (
            <ExploreView
              projects={exploreProjects}
              filtersCollapsed={!!state.exploreFiltersCollapsed}
              coOccurrenceCollapsed={!!state.exploreCoOccurrenceCollapsed}
              filterState={exploreFilterState}
              onChangeFilter={updateExploreFilter}
              onToggleFilters={() =>
                setState((s) => ({
                  ...s,
                  exploreFiltersCollapsed: !s.exploreFiltersCollapsed,
                }))
              }
              onToggleCoOccurrence={() =>
                setState((s) => ({
                  ...s,
                  exploreCoOccurrenceCollapsed: !s.exploreCoOccurrenceCollapsed,
                }))
              }
              onJumpToAnnotation={jumpToAnnotation}
            />
          ) : openDocs.length > 0 ? (
            <div className="flex-1 min-w-0 min-h-0 flex">
              <div className="flex-1 min-w-0 min-h-0 flex overflow-x-auto">
                {openDocs.map((d, idx) => {
                  const isDragOver =
                    dragPaneId !== null && dragPaneId !== d.id && dragOverPaneId === d.id;
                  const isBeingDragged = dragPaneId === d.id;
                  return (
                    <div
                      key={d.id}
                      onDragOver={(e) => {
                        if (dragPaneId && dragPaneId !== d.id) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setDragOverPaneId(d.id);
                        }
                      }}
                      onDragLeave={(e) => {
                        const rt = e.relatedTarget as Node | null;
                        if (rt && (e.currentTarget as HTMLElement).contains(rt)) return;
                        if (dragOverPaneId === d.id) setDragOverPaneId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragPaneId && dragPaneId !== d.id) {
                          movePaneTo(dragPaneId, d.id);
                        }
                        setDragPaneId(null);
                        setDragOverPaneId(null);
                      }}
                      className={`flex-1 min-h-0 flex transition-colors ${
                        idx < openDocs.length - 1 ? 'border-r border-slate-200' : ''
                      } ${isBeingDragged ? 'opacity-40' : ''} ${
                        isDragOver ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : ''
                      }`}
                      style={{
                        // Line view: 3 panes fit at once on a typical wide
                        // monitor; more open → horizontal scroll. Non-line:
                        // 4 panes fit. Falls back to fixed minimum on narrow
                        // screens so panes never get crushed.
                        minWidth: state.lineView
                          ? 'max(540px, 32vw)'
                          : 'max(420px, 24vw)',
                      }}
                    >
                      <DocumentViewer
                        key={d.id + (idx === 0 && focusedAnnotationId ? ':' + focusedAnnotationId : '')}
                        doc={d}
                        codes={activeProject.codes}
                        annotations={docAnnotations}
                        metadataSchema={activeProject.metadataSchema}
                        selectedCodeId={selectedCodeId}
                        showCodeDefinitions={showCodeDefinitions}
                        codebookOpen={codebookPanelOpen}
                        notesWidth={notesWidth}
                        annotationsPanelHeight={annotationsPanelHeight}
                        annotationsPanelCollapsed={annotationsPanelCollapsed}
                        metadataCollapsed={metadataCollapsed}
                        onResizeNotes={setNotesWidth}
                        onResizeAnnotationsPanel={setAnnotationsPanelHeight}
                        onToggleAnnotationsPanel={toggleAnnotationsPanel}
                        onToggleMetadata={toggleMetadata}
                        onToggleCodebook={() => setCodebookPanelOpen((v) => !v)}
                        onUpdateDoc={(patch) => updateDocument(d.id, patch)}
                        onAddAnnotation={(start, end, codeId, note, id) =>
                          addAnnotation(d.id, start, end, codeId, note, id)
                        }
                        onDeleteAnnotation={deleteAnnotation}
                        onUpdateAnnotation={updateAnnotation}
                        onSendAnnotationToNote={(annData) => sendAnnotationToNote(d, annData)}
                        canSendToNote={openDocs.some((o) => o.kind === 'note')}
                        onCreateCode={(name, parentId, color) =>
                          addCode(parentId ?? null, name, color)
                        }
                        lineView={!!state.lineView}
                        onToggleLineView={() =>
                          setState((s) => ({ ...s, lineView: !s.lineView }))
                        }
                        linesMode={state.linesMode ?? 'sentence'}
                        linesCharsN={state.linesCharsN ?? 100}
                        onSetLinesMode={(m) =>
                          setState((s) => ({ ...s, linesMode: m }))
                        }
                        onSetLinesCharsN={(n) =>
                          setState((s) => ({ ...s, linesCharsN: n }))
                        }
                        qcLinkOptions={{
                          projectId: activeProject.id,
                          docs: activeProject.documents,
                          annotations: activeProject.annotations,
                          codes: activeProject.codes,
                        }}
                        onJumpToQcLink={handleQcLinkClick}
                        onClose={() => closeDocPane(d.id)}
                        showPaneControls={openDocs.length > 1}
                        onPaneDragStart={() => setDragPaneId(d.id)}
                        onPaneDragEnd={() => {
                          setDragPaneId(null);
                          setDragOverPaneId(null);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              {codebookPanelOpen && (
                <aside
                  className="flex-shrink-0 border-l border-slate-200 bg-white flex flex-col min-h-0 relative"
                  style={{ width: `${codebookWidth}px` }}
                >
                  <ResizeHandle
                    side="left"
                    width={codebookWidth}
                    min={280}
                    max={640}
                    onChange={setCodebookWidth}
                  />
                  <CodebookView
                    project={activeProject}
                    variant="panel"
                    showDefinitions={showCodeDefinitions}
                    onToggleDefinitions={toggleDefinitions}
                    onAddCode={addCode}
                    onUpdateCode={updateCode}
                    onDeleteCode={deleteCode}
                    onMoveCode={moveCode}
                    onClose={() => setCodebookPanelOpen(false)}
                  />
                </aside>
              )}
            </div>
          ) : (
            <EmptyDocPane
              onAdd={() => addDocument()}
              hasDocs={activeProject.documents.length > 0}
            />
          )}
        </main>
      </div>
      {schemaOpen && (
        <MetadataSchemaEditor
          schema={activeProject.metadataSchema}
          onChange={handleSchemaChange}
          onClose={() => setSchemaOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// TopBar
// ============================================================================

function TopBar({
  project,
  projects,
  view,
  onSetView,
  exploreProjectIds,
  onToggleExplore,
  onSwitch,
  onCreate,
  onDelete,
  onRename,
  onOpenSchema,
  exportMenuOpen,
  setExportMenuOpen,
  onExportJSON,
  onExportProjectMD,
  onExportDocMD,
  canExportDocMD,
  onImport,
  driveConfigured,
  driveEmail,
  driveStatus,
  driveError,
  driveFileCount,
  onDriveSignIn,
  onDriveSignOut,
  onDrivePullAll,
}: {
  project: Project;
  projects: Project[];
  view: View;
  onSetView: (v: View) => void;
  exploreProjectIds: string[];
  onToggleExplore: (id: string) => void;
  onSwitch: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
  onRename: (name: string) => void;
  onOpenSchema: () => void;
  exportMenuOpen: boolean;
  setExportMenuOpen: (v: boolean) => void;
  onExportJSON: () => void;
  onExportProjectMD: () => void;
  onExportDocMD: () => void;
  canExportDocMD: boolean;
  onImport: () => void;
  driveConfigured: boolean;
  driveEmail: string | undefined;
  driveStatus: SyncStatus;
  driveError: string | null;
  driveFileCount: number;
  onDriveSignIn: () => void;
  onDriveSignOut: () => void;
  onDrivePullAll: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(project.name);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  useEffect(() => setName(project.name), [project.id]);

  useEffect(() => {
    const close = () => {
      setExportMenuOpen(false);
      setProjectMenuOpen(false);
    };
    if (exportMenuOpen || projectMenuOpen) {
      window.addEventListener('click', close);
      return () => window.removeEventListener('click', close);
    }
  }, [exportMenuOpen, projectMenuOpen, setExportMenuOpen]);

  const exploreCount = new Set([...exploreProjectIds, project.id]).size;

  return (
    <header className="flex items-center gap-2 px-5 py-3 bg-white border-b border-slate-200">
      <a
        href="/dashboards"
        className="text-[12px] font-medium text-slate-400 hover:text-slate-700 transition-colors px-2 py-1 rounded hover:bg-slate-100"
      >
        ← Dashboards
      </a>
      <div className="w-px h-5 bg-slate-200" />

      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setProjectMenuOpen((v) => !v);
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
        >
          <span className="text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-400">
            Project
          </span>
          <span className="text-[15px] font-bold text-slate-900 truncate max-w-[220px]">
            {project.name}
          </span>
          <span className="text-slate-400 text-[10px]">▾</span>
        </button>
        {projectMenuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-full mt-1 w-[340px] bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-[10px] text-slate-500">
              Click name to switch · checkbox includes in Explore
            </div>
            <div className="max-h-[340px] overflow-y-auto">
              {projects.map((p) => {
                const inExplore = exploreProjectIds.includes(p.id) || p.id === project.id;
                const isActive = p.id === project.id;
                return (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-2 px-3 py-2 transition-colors ${
                      isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={inExplore}
                      disabled={isActive}
                      onChange={() => onToggleExplore(p.id)}
                      className="accent-blue-600"
                      title={isActive ? 'active project is always included' : 'include in Explore'}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onSwitch(p.id);
                        setProjectMenuOpen(false);
                      }}
                      className="flex-1 min-w-0 text-left flex items-center gap-2"
                    >
                      <span
                        className={`flex-1 truncate text-[13px] ${
                          isActive ? 'font-semibold text-slate-900' : 'text-slate-700'
                        }`}
                      >
                        {p.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                        {p.documents.length}d · {p.codes.length}c
                      </span>
                      {(p.drive?.folderId || (p.drive as any)?.fileId) && (
                        <span title="synced to Drive" className="text-emerald-500 text-[11px]">
                          ☁
                        </span>
                      )}
                    </button>
                    {projects.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              `Delete project "${p.name}"? This cannot be undone${
                                p.drive?.fileId ? ' (will also delete its Drive file)' : ''
                              }.`,
                            )
                          ) {
                            onDelete(p.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 text-[14px] transition-opacity"
                        title="delete project"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="border-t border-slate-100 p-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const n = window.prompt('Project name?');
                  if (n && n.trim()) {
                    onCreate(n.trim());
                    setProjectMenuOpen(false);
                  }
                }}
                className="flex-1 px-2 py-1.5 text-[12px] text-blue-600 hover:bg-blue-50 rounded font-medium"
              >
                + New project
              </button>
              <button
                type="button"
                onClick={() => {
                  setProjectMenuOpen(false);
                  onImport();
                }}
                className="flex-1 px-2 py-1.5 text-[12px] text-slate-600 hover:bg-slate-100 rounded font-medium"
              >
                Import JSON
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="ml-3 flex items-center bg-slate-100 rounded-lg p-1">
        <ViewBtn active={view === 'documents'} onClick={() => onSetView('documents')}>
          Documents
        </ViewBtn>
        <ViewBtn active={view === 'codebook'} onClick={() => onSetView('codebook')}>
          Codebook
        </ViewBtn>
        <ViewBtn active={view === 'explore'} onClick={() => onSetView('explore')}>
          Explore{exploreCount > 1 ? ` · ${exploreCount}` : ''}
        </ViewBtn>
        <ViewBtn active={view === 'about'} onClick={() => onSetView('about')}>
          Info
        </ViewBtn>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSchema}
          className="px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
        >
          Metadata schema
        </button>
        <AuthBar
          configured={driveConfigured}
          email={driveEmail}
          syncStatus={driveStatus}
          lastError={driveError}
          fileCount={driveFileCount}
          onSignIn={onDriveSignIn}
          onSignOut={onDriveSignOut}
          onPullAll={onDrivePullAll}
        />
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExportMenuOpen(!exportMenuOpen);
            }}
            className="px-3.5 py-1.5 text-[13px] font-semibold bg-slate-900 text-white rounded-md hover:bg-black transition-colors flex items-center gap-1.5"
          >
            Export
            <span className="text-[10px]">▾</span>
          </button>
          {exportMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 w-[260px] bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden"
            >
              <button
                type="button"
                onClick={onExportJSON}
                className="w-full flex flex-col items-start gap-0.5 px-3 py-2 hover:bg-blue-50 transition-colors"
              >
                <span className="text-[13px] font-semibold text-slate-900">Project JSON</span>
                <span className="text-[11px] text-slate-500">Canonical, round-trips through Import</span>
              </button>
              <button
                type="button"
                onClick={onExportProjectMD}
                className="w-full flex flex-col items-start gap-0.5 px-3 py-2 border-t border-slate-100 hover:bg-blue-50 transition-colors"
              >
                <span className="text-[13px] font-semibold text-slate-900">Project Markdown</span>
                <span className="text-[11px] text-slate-500">All documents + annotation tables</span>
              </button>
              <button
                type="button"
                onClick={onExportDocMD}
                disabled={!canExportDocMD}
                className="w-full flex flex-col items-start gap-0.5 px-3 py-2 border-t border-slate-100 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:hover:bg-white"
              >
                <span className="text-[13px] font-semibold text-slate-900">Current doc Markdown</span>
                <span className="text-[11px] text-slate-500">Just the open document</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {renaming && (
        <RenameModal
          initial={project.name}
          onCancel={() => setRenaming(false)}
          onSave={(v) => {
            onRename(v);
            setRenaming(false);
          }}
        />
      )}
    </header>
  );
}

function RailBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="w-9 h-9 rounded-md text-[11px] font-semibold text-slate-500 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 flex items-center justify-center transition-colors"
    >
      {children}
    </button>
  );
}

function ViewBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-[13px] font-semibold rounded-md transition-colors ${
        active
          ? 'bg-white shadow-sm text-slate-900'
          : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function RenameModal({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-32" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl p-5 w-[420px]" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && v.trim()) onSave(v.trim());
            if (e.key === 'Escape') onCancel();
          }}
          className="w-full px-3 py-2 text-[18px] border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Sidebar
// ============================================================================

function Sidebar({
  project,
  openDocIds,
  collapsed,
  width,
  onResize,
  onToggleCollapsed,
  onOpenCodebookView,
  onSelectDoc,
  onCompareDoc,
  onAddDoc,
  onDeleteDoc,
  onMoveDocToFolder,
  onAddFolder,
  onDeleteFolder,
}: {
  project: Project;
  openDocIds: string[];
  collapsed: boolean;
  width: number;
  onResize: (n: number) => void;
  onToggleCollapsed: () => void;
  onOpenCodebookView: () => void;
  onSelectDoc: (id: string) => void;
  onCompareDoc: (id: string) => void;
  onAddDoc: (folder?: string, kind?: 'document' | 'note') => void;
  onDeleteDoc: (id: string) => void;
  onMoveDocToFolder: (docId: string, folder: string | undefined) => void;
  onAddFolder: (path: string) => void;
  onDeleteFolder: (path: string) => void;
}) {
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const filteredDocs = useMemo(() => {
    const q = docSearchQuery.trim().toLowerCase();
    if (!q) return project.documents;
    return project.documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.text ?? '').toLowerCase().includes(q),
    );
  }, [project.documents, docSearchQuery]);
  const { rootDocs, folders } = useMemo(
    () =>
      buildFolderTree(
        filteredDocs,
        docSearchQuery.trim() ? [] : project.folders ?? [],
      ),
    [filteredDocs, project.folders, docSearchQuery],
  );
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [rootDragOver, setRootDragOver] = useState(false);

  const handleAddFolder = () => {
    const path = window.prompt(
      'New folder name (use / for nested, e.g. "Interviews/Round 1"):',
    );
    if (path && path.trim()) onAddFolder(path.trim());
  };

  const handleDrop = (folder: string | undefined) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const docId = e.dataTransfer.getData('application/x-qc-doc');
    if (!docId) return;
    onMoveDocToFolder(docId, folder);
    setDragOverFolder(null);
    setRootDragOver(false);
  };

  if (collapsed) {
    return (
      <aside className="w-[52px] flex-shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col items-center py-3 gap-2">
        <RailBtn onClick={onToggleCollapsed} title="expand sidebar">
          »
        </RailBtn>
        <div className="w-6 h-px bg-slate-200 my-1" />
        <RailBtn
          onClick={() => {
            onToggleCollapsed();
            onAddDoc();
          }}
          title="new document"
        >
          +D
        </RailBtn>
        <RailBtn onClick={onOpenCodebookView} title="open codebook">
          Cb
        </RailBtn>
      </aside>
    );
  }

  return (
    <aside
      className="flex-shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col relative"
      style={{ width: `${width}px` }}
    >
      <ResizeHandle side="right" width={width} min={240} max={520} onChange={onResize} />
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="text-[12px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded px-2 py-1 transition-colors"
          title="collapse sidebar"
        >
          « Collapse
        </button>
        <button
          type="button"
          onClick={onOpenCodebookView}
          className="text-[12px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded px-2 py-1 transition-colors"
          title="open codebook view"
        >
          Codebook →
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Documents
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleAddFolder}
                className="text-[12px] font-medium text-slate-500 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-white"
                title="new folder"
              >
                + folder
              </button>
              <button
                type="button"
                onClick={() => onAddDoc(undefined, 'note')}
                className="text-[12px] font-medium text-amber-700 hover:text-amber-900 transition-colors px-2 py-1 rounded hover:bg-amber-50"
                title="new notes doc (markdown, for commentary + links to annotations)"
              >
                + note
              </button>
              <button
                type="button"
                onClick={() => onAddDoc(undefined, 'document')}
                className="text-[12px] font-semibold text-blue-600 hover:text-blue-800 transition-colors px-2 py-1 rounded hover:bg-blue-50"
              >
                + doc
              </button>
            </div>
          </div>
          {project.documents.length > 0 && (
            <div className="mb-2 relative">
              <input
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                placeholder="Search doc text + titles…"
                className="w-full pl-2.5 pr-7 py-1.5 text-[12px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
              {docSearchQuery && (
                <button
                  type="button"
                  onClick={() => setDocSearchQuery('')}
                  className="absolute top-1/2 -translate-y-1/2 right-1 w-5 h-5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center text-[12px]"
                  title="clear search"
                >
                  ×
                </button>
              )}
              {docSearchQuery && (
                <div className="mt-1 text-[10px] text-slate-500 font-mono px-1">
                  {filteredDocs.length} / {project.documents.length} match
                  {filteredDocs.length === 1 ? '' : 'es'}
                </div>
              )}
            </div>
          )}
          {project.documents.length === 0 && folders.length === 0 ? (
            <div className="text-[12px] text-slate-400 italic py-2">
              No documents yet. Drop one in or click + doc.
            </div>
          ) : docSearchQuery && filteredDocs.length === 0 ? (
            <div className="text-[12px] text-slate-400 italic py-2">
              No docs match “{docSearchQuery}”.
            </div>
          ) : (
            <div className="space-y-px">
              <div
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('application/x-qc-doc')) {
                    e.preventDefault();
                    setRootDragOver(true);
                  }
                }}
                onDragLeave={() => setRootDragOver(false)}
                onDrop={handleDrop(undefined)}
                className={`rounded transition-colors ${
                  rootDragOver ? 'ring-2 ring-blue-400 ring-inset bg-blue-50' : ''
                }`}
              >
                {rootDocs.length === 0 && rootDragOver ? (
                  <div className="text-[11px] text-blue-700 italic py-3 text-center">
                    Drop here to move out of folder
                  </div>
                ) : (
                  <DocList
                    docs={rootDocs}
                    openDocIds={openDocIds}
                    onSelectDoc={onSelectDoc}
                    onCompareDoc={onCompareDoc}
                    onDeleteDoc={onDeleteDoc}
                  />
                )}
              </div>
              {folders.map((f) => (
                <FolderGroup
                  key={f.path}
                  node={f}
                  openDocIds={openDocIds}
                  dragOverFolder={dragOverFolder}
                  setDragOverFolder={setDragOverFolder}
                  onSelectDoc={onSelectDoc}
                  onCompareDoc={onCompareDoc}
                  onDeleteDoc={onDeleteDoc}
                  onAddDoc={onAddDoc}
                  onMoveDocToFolder={onMoveDocToFolder}
                  onDeleteFolder={onDeleteFolder}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-5 pt-3">
          <button
            type="button"
            onClick={onOpenCodebookView}
            className="w-full px-3 py-2.5 text-left text-[13px] font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 rounded-md transition-colors flex items-center justify-between"
            title="open the codebook to manage codes"
          >
            <span>Codes &amp; definitions</span>
            <span className="text-slate-400 text-[12px]">→</span>
          </button>
          <div className="mt-1.5 text-[11px] text-slate-400 leading-snug px-1">
            {project.codes.length} code{project.codes.length === 1 ? '' : 's'} ·
            manage in Codebook
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 px-5 py-3 bg-white">
        <div className="text-[11px] font-mono text-slate-400 leading-tight">
          {project.documents.length} doc{project.documents.length === 1 ? '' : 's'} ·{' '}
          {project.codes.length} code{project.codes.length === 1 ? '' : 's'} ·{' '}
          {project.annotations.length} annotation
          {project.annotations.length === 1 ? '' : 's'}
        </div>
      </div>
    </aside>
  );
}

function DocList({
  docs,
  openDocIds,
  onSelectDoc,
  onCompareDoc,
  onDeleteDoc,
  depth = 0,
}: {
  docs: Document[];
  openDocIds: string[];
  onSelectDoc: (id: string) => void;
  onCompareDoc: (id: string) => void;
  onDeleteDoc: (id: string) => void;
  depth?: number;
}) {
  const openSet = new Set(openDocIds);
  const primary = openDocIds[0];
  return (
    <ul className="space-y-px">
      {docs.map((d) => {
        const isOpen = openSet.has(d.id);
        const isPrimary = primary === d.id;
        const isNote = d.kind === 'note';
        return (
          <li
            key={d.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-qc-doc', d.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            className={`group flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer text-[14px] transition-colors ${
              isPrimary
                ? isNote
                  ? 'bg-amber-100 text-slate-900 font-medium'
                  : 'bg-blue-100 text-slate-900 font-medium'
                : isOpen
                  ? isNote
                    ? 'bg-amber-50 text-slate-800'
                    : 'bg-blue-50 text-slate-800'
                  : isNote
                    ? 'text-amber-800 hover:bg-white'
                    : 'text-slate-700 hover:bg-white'
            }`}
            style={{ paddingLeft: `${10 + depth * 14}px` }}
            onClick={() => onSelectDoc(d.id)}
          >
            <span className="text-slate-300 text-[11px] cursor-grab" title="drag to move">⋮⋮</span>
            {isNote && (
              <span
                className="text-[9px] font-semibold uppercase tracking-wider text-amber-700 px-1 py-0.5 rounded bg-amber-100 flex-shrink-0"
                title="note (markdown)"
              >
                note
              </span>
            )}
            <span className={`flex-1 truncate ${isNote ? 'italic' : ''}`}>
              {d.title || 'Untitled'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCompareDoc(d.id);
              }}
              disabled={isOpen && openDocIds.length >= 4}
              className={`opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded hover:bg-blue-50 transition-opacity disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 ${
                isOpen ? 'opacity-100 text-blue-600' : ''
              }`}
              title={
                isOpen
                  ? openDocIds.length >= 4
                    ? 'already open · max 4'
                    : 'already open'
                  : 'open alongside (compare)'
              }
            >
              +
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete "${d.title}" and its annotations?`)) {
                  onDeleteDoc(d.id);
                }
              }}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 text-[16px] w-6 h-6 flex items-center justify-center transition-opacity"
              title="delete"
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FolderGroup({
  node,
  openDocIds,
  dragOverFolder,
  setDragOverFolder,
  onSelectDoc,
  onCompareDoc,
  onDeleteDoc,
  onAddDoc,
  onMoveDocToFolder,
  onDeleteFolder,
}: {
  node: FolderNode;
  openDocIds: string[];
  dragOverFolder: string | null;
  setDragOverFolder: (path: string | null) => void;
  onSelectDoc: (id: string) => void;
  onCompareDoc: (id: string) => void;
  onDeleteDoc: (id: string) => void;
  onAddDoc: (folder: string) => void;
  onMoveDocToFolder: (docId: string, folder: string | undefined) => void;
  onDeleteFolder: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const total = folderDocCount(node);
  const isDragOver = dragOverFolder === node.path;

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-qc-doc')) {
          e.preventDefault();
          setDragOverFolder(node.path);
        }
      }}
      onDragLeave={(e) => {
        const rt = e.relatedTarget as Node | null;
        if (rt && (e.currentTarget as HTMLElement).contains(rt)) return;
        if (dragOverFolder === node.path) setDragOverFolder(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const docId = e.dataTransfer.getData('application/x-qc-doc');
        if (docId) onMoveDocToFolder(docId, node.path);
        setDragOverFolder(null);
      }}
      className={`rounded transition-colors ${
        isDragOver ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : ''
      }`}
    >
      <div
        className="group flex items-center gap-1.5 px-1.5 py-1.5 cursor-pointer hover:bg-white rounded"
        style={{ paddingLeft: `${6 + node.depth * 12}px` }}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[10px] text-slate-400 w-3">{open ? '▾' : '▸'}</span>
        <span className="text-[12px]">📁</span>
        <span className="flex-1 text-[12px] font-semibold text-slate-700 truncate">
          {node.name}
        </span>
        <span className="text-[10px] font-mono text-slate-400 tabular-nums">{total}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddDoc(node.path);
          }}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 text-[14px] w-5 h-5 flex items-center justify-center transition-opacity"
          title={`add document in ${node.path}`}
        >
          +
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (
              window.confirm(
                `Delete folder "${node.path}"? Documents inside will be moved to no folder.`,
              )
            ) {
              onDeleteFolder(node.path);
            }
          }}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 text-[14px] w-5 h-5 flex items-center justify-center transition-opacity"
          title="delete folder"
        >
          ×
        </button>
      </div>
      {open && (
        <div>
          {node.docs.length > 0 && (
            <DocList
              docs={node.docs}
              openDocIds={openDocIds}
              onSelectDoc={onSelectDoc}
              onCompareDoc={onCompareDoc}
              onDeleteDoc={onDeleteDoc}
              depth={node.depth + 1}
            />
          )}
          {node.docs.length === 0 && node.children.length === 0 && (
            <div
              className="text-[11px] text-slate-400 italic py-1 px-2"
              style={{ paddingLeft: `${20 + node.depth * 12}px` }}
            >
              {isDragOver ? 'Drop here' : 'empty'}
            </div>
          )}
          {node.children.map((child) => (
            <FolderGroup
              key={child.path}
              node={child}
              openDocIds={openDocIds}
              dragOverFolder={dragOverFolder}
              setDragOverFolder={setDragOverFolder}
              onSelectDoc={onSelectDoc}
              onCompareDoc={onCompareDoc}
              onDeleteDoc={onDeleteDoc}
              onAddDoc={onAddDoc}
              onMoveDocToFolder={onMoveDocToFolder}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Empty states
// ============================================================================

function NoProjects({
  projects,
  onCreate,
  onSwitch,
  onImport,
}: {
  projects: Project[];
  onCreate: (name: string) => void;
  onSwitch: (id: string) => void;
  onImport: (file: File) => void;
}) {
  const [name, setName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-white to-blue-50/40 flex items-center justify-center px-4">
      <div className="w-full max-w-[520px]">
        <a
          href="/dashboards"
          className="inline-block mb-8 text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors"
        >
          ← Dashboards
        </a>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600">
          Qualitative Coding
        </div>
        <h1
          className="text-[40px] font-bold text-slate-900 leading-[1.05] mb-3"
          style={{ letterSpacing: '-0.025em' }}
        >
          Code text, build a tree, compare to AI.
        </h1>
        <p className="text-[15px] text-slate-600 leading-[1.6] mb-8">
          Start a project, paste in documents, build a nested code tree, and tag spans. Export
          everything as JSON or Markdown to feed into Claude in VS Code.
        </p>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {projects.length > 0 && (
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
                Recent projects
              </div>
              <ul className="space-y-1">
                {projects.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onSwitch(p.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-slate-50"
                    >
                      <span className="flex-1 text-[14px] text-slate-800 font-medium truncate">
                        {p.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {p.documents.length}d · {p.codes.length}c
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
              Create project
            </div>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) {
                    onCreate(name.trim());
                    setName('');
                  }
                }}
                placeholder="Project name, e.g. Interview Study 1"
                className="flex-1 px-3 py-2 text-[14px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (name.trim()) {
                    onCreate(name.trim());
                    setName('');
                  }
                }}
                disabled={!name.trim()}
                className="px-4 py-2 text-[13px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
              >
                Create
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[12px] text-slate-400">
              <span>or</span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-blue-600 font-medium hover:text-blue-800"
              >
                import a project JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </div>
        <div className="mt-6 text-[12px] text-slate-400 text-center">
          Data lives in your browser (localStorage). Sign in to sync to Google Drive.
        </div>
      </div>
    </div>
  );
}

function EmptyDocPane({ onAdd, hasDocs }: { onAdd: () => void; hasDocs: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-8">
      <div className="max-w-[400px]">
        <div className="text-[14px] font-semibold text-slate-700 mb-2">
          {hasDocs ? 'Select a document' : 'No documents yet'}
        </div>
        <p className="text-[13px] text-slate-500 leading-[1.6] mb-4">
          {hasDocs
            ? 'Pick a document from the sidebar to start coding.'
            : 'Add a document to begin. Paste in interview text, an essay, field notes — anything plain text.'}
        </p>
        {!hasDocs && (
          <button
            type="button"
            onClick={onAdd}
            className="px-4 py-2 text-[13px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New document
          </button>
        )}
      </div>
    </div>
  );
}

function slugFile(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'project'
  );
}

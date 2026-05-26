import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AuthBar, { type SyncStatus } from './AuthBar';
import CodeTree from './CodeTree';
import DocumentViewer from './DocumentViewer';
import ExploreView from './ExploreView';
import MetadataSchemaEditor from './MetadataSchemaEditor';
import ProjectAboutView from './ProjectAboutView';
import {
  buildFolderTree,
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
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [focusedAnnotationId, setFocusedAnnotationId] = useState<string | null>(null);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [drive, setDrive] = useState<DriveState>({
    token: null,
    syncStatus: 'offline',
    lastError: null,
  });
  const importInputRef = useRef<HTMLInputElement>(null);

  const view: View = state.view ?? 'documents';
  const showCodeDefinitions = !!state.showCodeDefinitions;
  const exploreProjectIds = state.exploreProjectIds ?? [];

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
      setActiveDocId(null);
      setSelectedCodeId(null);
      return;
    }
    if (activeDocId && !activeProject.documents.some((d) => d.id === activeDocId)) {
      setActiveDocId(activeProject.documents[0]?.id ?? null);
    }
  }, [activeProject, activeDocId]);

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
          pulledProjects.push(proj);
        } catch {
          // Skip files we can't parse
        }
      }
      const pulledIds = new Set(pulledProjects.map((p) => p.id));
      setState((s) => {
        const merged: Project[] = [...pulledProjects];
        for (const p of s.projects) {
          if (pulledIds.has(p.id)) continue;
          merged.push(p);
        }
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
      // Push any local-only projects or projects that need migration.
      const localSnapshot = JSON.parse(
        window.localStorage.getItem('tw-qual-coding-v1') ?? '{}',
      );
      const localProjects: Project[] = localSnapshot.projects ?? [];
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

  // Refresh on focus
  useEffect(() => {
    if (!drive.token) return;
    const onFocus = () => pullAllFromDrive();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [drive.token, pullAllFromDrive]);

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
      return {
        ...s,
        projects: next,
        activeProjectId: s.activeProjectId === id ? next[0]?.id ?? null : s.activeProjectId,
        exploreProjectIds: (s.exploreProjectIds ?? []).filter((x) => x !== id),
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
  const addDocument = (folder?: string) => {
    if (!activeProject) return;
    const now = new Date().toISOString();
    const d: Document = {
      id: cryptoRandomId(),
      title: 'Untitled document',
      text: '',
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
    if (activeDocId === id) setActiveDocId(null);
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
  const addCode = (parentId: string | null, name: string) => {
    if (!activeProject) return;
    const projectId = activeProject.id;
    updateActiveProject((p) => {
      const code: Code = {
        id: cryptoRandomId(),
        name,
        parentId,
        color: parentId === null ? nextPaletteColor(p.codes) : null,
        created_at: new Date().toISOString(),
      };
      return { ...p, codes: [...p.codes, code] };
    });
    queueWrite(projectId);
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

  // ----- Annotation CRUD -----
  const addAnnotation = (
    docId: string,
    start: number,
    end: number,
    codeId: string,
    note?: string,
  ) => {
    if (!activeProject) return;
    const projectId = activeProject.id;
    const a: Annotation = {
      id: cryptoRandomId(),
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

  const jumpToAnnotation = (projectId: string, docId: string, annotationId: string) => {
    if (projectId !== state.activeProjectId) {
      setState((s) => ({ ...s, activeProjectId: projectId, view: 'documents' }));
    } else {
      setView('documents');
    }
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
  const activeDoc = findDoc(activeProject, activeDocId);
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
        canExportDocMD={!!activeDoc}
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
        {view !== 'about' && (
          <Sidebar
            project={activeProject}
            activeDocId={activeDocId}
            onSelectDoc={(id) => {
              setActiveDocId(id);
              setFocusedAnnotationId(null);
              if (view !== 'documents') setView('documents');
            }}
            onAddDoc={(folder) => addDocument(folder)}
            onDeleteDoc={deleteDocument}
            onMoveDocToFolder={moveDocumentToFolder}
            onAddFolder={addFolder}
            onDeleteFolder={deleteFolder}
            deepCounts={counts}
            showCodeDefinitions={showCodeDefinitions}
            onToggleDefinitions={toggleDefinitions}
            selectedCodeId={selectedCodeId}
            onSelectCode={setSelectedCodeId}
            onAddCode={addCode}
            onUpdateCode={updateCode}
            onDeleteCode={deleteCode}
          />
        )}
        <main className="flex-1 min-w-0 flex flex-col bg-white">
          {view === 'about' ? (
            <ProjectAboutView project={activeProject} onUpdate={updateProjectMeta} />
          ) : view === 'explore' ? (
            <ExploreView projects={exploreProjects} onJumpToAnnotation={jumpToAnnotation} />
          ) : activeDoc ? (
            <DocumentViewer
              key={activeDoc.id + ':' + focusedAnnotationId}
              doc={activeDoc}
              codes={activeProject.codes}
              annotations={docAnnotations}
              metadataSchema={activeProject.metadataSchema}
              selectedCodeId={selectedCodeId}
              showCodeDefinitions={showCodeDefinitions}
              onToggleDefinitions={toggleDefinitions}
              onUpdateDoc={(patch) => updateDocument(activeDoc.id, patch)}
              onAddAnnotation={(start, end, codeId, note) =>
                addAnnotation(activeDoc.id, start, end, codeId, note)
              }
              onDeleteAnnotation={deleteAnnotation}
              onUpdateAnnotation={updateAnnotation}
            />
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
  activeDocId,
  onSelectDoc,
  onAddDoc,
  onDeleteDoc,
  onMoveDocToFolder,
  onAddFolder,
  onDeleteFolder,
  deepCounts,
  showCodeDefinitions,
  onToggleDefinitions,
  selectedCodeId,
  onSelectCode,
  onAddCode,
  onUpdateCode,
  onDeleteCode,
}: {
  project: Project;
  activeDocId: string | null;
  onSelectDoc: (id: string) => void;
  onAddDoc: (folder?: string) => void;
  onDeleteDoc: (id: string) => void;
  onMoveDocToFolder: (docId: string, folder: string | undefined) => void;
  onAddFolder: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  deepCounts: Map<string, number>;
  showCodeDefinitions: boolean;
  onToggleDefinitions: () => void;
  selectedCodeId: string | null;
  onSelectCode: (id: string | null) => void;
  onAddCode: (parentId: string | null, name: string) => void;
  onUpdateCode: (id: string, patch: Partial<Code>) => void;
  onDeleteCode: (id: string) => void;
}) {
  const { rootDocs, folders } = useMemo(
    () => buildFolderTree(project.documents, project.folders ?? []),
    [project.documents, project.folders],
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

  return (
    <aside className="w-[280px] flex-shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Documents
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddFolder}
                className="text-[12px] font-medium text-slate-500 hover:text-blue-600 transition-colors px-1.5 py-0.5 rounded hover:bg-white"
                title="new folder"
              >
                + folder
              </button>
              <button
                type="button"
                onClick={() => onAddDoc()}
                className="text-[12px] font-semibold text-blue-600 hover:text-blue-800 transition-colors px-2 py-0.5 rounded hover:bg-blue-50"
              >
                + doc
              </button>
            </div>
          </div>
          {project.documents.length === 0 && folders.length === 0 ? (
            <div className="text-[12px] text-slate-400 italic py-2">
              No documents yet. Drop one in or click + doc.
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
                    activeDocId={activeDocId}
                    onSelectDoc={onSelectDoc}
                    onDeleteDoc={onDeleteDoc}
                  />
                )}
              </div>
              {folders.map((f) => (
                <FolderGroup
                  key={f.path}
                  node={f}
                  activeDocId={activeDocId}
                  dragOverFolder={dragOverFolder}
                  setDragOverFolder={setDragOverFolder}
                  onSelectDoc={onSelectDoc}
                  onDeleteDoc={onDeleteDoc}
                  onAddDoc={onAddDoc}
                  onMoveDocToFolder={onMoveDocToFolder}
                  onDeleteFolder={onDeleteFolder}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-4">
          <CodeTree
            codes={project.codes}
            deepCounts={deepCounts}
            selectedCodeId={selectedCodeId}
            showDefinitions={showCodeDefinitions}
            onToggleDefinitions={onToggleDefinitions}
            onSelectCode={onSelectCode}
            onAddCode={onAddCode}
            onUpdateCode={onUpdateCode}
            onDeleteCode={onDeleteCode}
          />
          {selectedCodeId && (
            <button
              type="button"
              onClick={() => onSelectCode(null)}
              className="mt-3 w-full text-[12px] text-slate-500 hover:text-slate-800 py-1.5 border border-dashed border-slate-300 rounded hover:bg-white transition-colors"
            >
              clear code filter
            </button>
          )}
        </div>
      </div>
      <div className="border-t border-slate-200 px-4 py-2.5 bg-white">
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
  activeDocId,
  onSelectDoc,
  onDeleteDoc,
  depth = 0,
}: {
  docs: Document[];
  activeDocId: string | null;
  onSelectDoc: (id: string) => void;
  onDeleteDoc: (id: string) => void;
  depth?: number;
}) {
  return (
    <ul className="space-y-px">
      {docs.map((d) => (
        <li
          key={d.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/x-qc-doc', d.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          className={`group flex items-center gap-2 rounded px-2 py-2 cursor-pointer text-[13px] transition-colors ${
            d.id === activeDocId
              ? 'bg-blue-100 text-slate-900 font-medium'
              : 'text-slate-700 hover:bg-white'
          }`}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onClick={() => onSelectDoc(d.id)}
        >
          <span className="text-slate-300 text-[10px] cursor-grab" title="drag to move">⋮⋮</span>
          <span className="flex-1 truncate">{d.title || 'Untitled'}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Delete "${d.title}" and its annotations?`)) {
                onDeleteDoc(d.id);
              }
            }}
            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 text-[14px] transition-opacity"
            title="delete"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

function FolderGroup({
  node,
  activeDocId,
  dragOverFolder,
  setDragOverFolder,
  onSelectDoc,
  onDeleteDoc,
  onAddDoc,
  onMoveDocToFolder,
  onDeleteFolder,
}: {
  node: FolderNode;
  activeDocId: string | null;
  dragOverFolder: string | null;
  setDragOverFolder: (path: string | null) => void;
  onSelectDoc: (id: string) => void;
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
              activeDocId={activeDocId}
              onSelectDoc={onSelectDoc}
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
              activeDocId={activeDocId}
              dragOverFolder={dragOverFolder}
              setDragOverFolder={setDragOverFolder}
              onSelectDoc={onSelectDoc}
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

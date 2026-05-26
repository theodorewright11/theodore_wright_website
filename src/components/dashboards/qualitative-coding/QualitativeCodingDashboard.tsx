import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeTree from './CodeTree';
import DocumentViewer from './DocumentViewer';
import MetadataSchemaEditor from './MetadataSchemaEditor';
import {
  buildCodeTree,
  deepCodeCounts,
  descendantIds,
  findDoc,
} from './compute';
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
import { nextPaletteColor } from './compute';
import type { Annotation, AppState, Code, Document, MetadataField, Project } from './types';

export default function QualitativeCodingDashboard() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [hydrated, setHydrated] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHydrated(true);
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

  const createProject = (name: string) => {
    const p = newProject(name);
    setState((s) => ({
      ...s,
      projects: [...s.projects, p],
      activeProjectId: p.id,
    }));
    setActiveDocId(null);
    setSelectedCodeId(null);
  };

  const switchProject = (id: string) => {
    setState((s) => ({ ...s, activeProjectId: id }));
    setActiveDocId(null);
    setSelectedCodeId(null);
  };

  const deleteProject = (id: string) => {
    setState((s) => {
      const next = s.projects.filter((p) => p.id !== id);
      return {
        ...s,
        projects: next,
        activeProjectId: s.activeProjectId === id ? next[0]?.id ?? null : s.activeProjectId,
      };
    });
  };

  const addDocument = () => {
    if (!activeProject) return;
    const now = new Date().toISOString();
    const d: Document = {
      id: cryptoRandomId(),
      title: 'Untitled document',
      text: '',
      metadata: {},
      created_at: now,
      updated_at: now,
    };
    updateActiveProject((p) => ({ ...p, documents: [...p.documents, d] }));
    setActiveDocId(d.id);
  };

  const deleteDocument = (id: string) => {
    updateActiveProject((p) => ({
      ...p,
      documents: p.documents.filter((d) => d.id !== id),
      annotations: p.annotations.filter((a) => a.docId !== id),
    }));
    if (activeDocId === id) setActiveDocId(null);
  };

  const updateDocument = (id: string, patch: Partial<Document>) => {
    updateActiveProject((p) => ({
      ...p,
      documents: p.documents.map((d) =>
        d.id === id ? { ...d, ...patch, updated_at: new Date().toISOString() } : d,
      ),
    }));
  };

  const addCode = (parentId: string | null, name: string) => {
    if (!activeProject) return;
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
  };

  const updateCode = (codeId: string, patch: Partial<Code>) => {
    updateActiveProject((p) => ({
      ...p,
      codes: p.codes.map((c) => (c.id === codeId ? { ...c, ...patch } : c)),
    }));
  };

  const deleteCode = (codeId: string) => {
    updateActiveProject((p) => {
      const toRemove = descendantIds(p.codes, codeId);
      return {
        ...p,
        codes: p.codes.filter((c) => !toRemove.has(c.id)),
        annotations: p.annotations.filter((a) => !toRemove.has(a.codeId)),
      };
    });
    if (selectedCodeId && descendantIds(activeProject?.codes ?? [], codeId).has(selectedCodeId)) {
      setSelectedCodeId(null);
    }
  };

  const addAnnotation = (
    docId: string,
    start: number,
    end: number,
    codeId: string,
    note?: string,
  ) => {
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
  };

  const updateAnnotation = (id: string, patch: Partial<Annotation>) => {
    updateActiveProject((p) => ({
      ...p,
      annotations: p.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };

  const deleteAnnotation = (id: string) => {
    updateActiveProject((p) => ({
      ...p,
      annotations: p.annotations.filter((a) => a.id !== id),
    }));
  };

  const handleSchemaChange = (next: MetadataField[]) => {
    updateActiveProject((p) => ({ ...p, metadataSchema: next }));
  };

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
      const project = coerceProject({ ...parsed, id: cryptoRandomId() });
      setState((s) => ({
        ...s,
        projects: [...s.projects, project],
        activeProjectId: project.id,
      }));
      setActiveDocId(null);
    } catch (err) {
      window.alert(`Could not import: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
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

  const tree = buildCodeTree(activeProject.codes);
  const counts = deepCodeCounts(activeProject);
  const activeDoc = findDoc(activeProject, activeDocId);
  const docAnnotations = selectedCodeId
    ? activeProject.annotations.filter((a) =>
        descendantIds(activeProject.codes, selectedCodeId).has(a.codeId),
      )
    : activeProject.annotations;

  return (
    <div className="h-screen flex flex-col bg-white text-slate-900">
      <TopBar
        project={activeProject}
        projects={state.projects}
        onSwitch={switchProject}
        onCreate={createProject}
        onDelete={deleteProject}
        onRename={(name) => updateActiveProject((p) => ({ ...p, name }))}
        onOpenSchema={() => setSchemaOpen(true)}
        exportMenuOpen={exportMenuOpen}
        setExportMenuOpen={setExportMenuOpen}
        onExportJSON={onExportJSON}
        onExportProjectMD={onExportProjectMD}
        onExportDocMD={onExportDocMD}
        canExportDocMD={!!activeDoc}
        onImport={() => importInputRef.current?.click()}
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
        <Sidebar
          project={activeProject}
          activeDocId={activeDocId}
          onSelectDoc={setActiveDocId}
          onAddDoc={addDocument}
          onDeleteDoc={deleteDocument}
          deepCounts={counts}
          selectedCodeId={selectedCodeId}
          onSelectCode={setSelectedCodeId}
          onAddCode={addCode}
          onUpdateCode={updateCode}
          onDeleteCode={deleteCode}
        />
        <main className="flex-1 min-w-0 flex flex-col bg-white">
          {activeDoc ? (
            <DocumentViewer
              key={activeDoc.id}
              doc={activeDoc}
              codes={activeProject.codes}
              annotations={docAnnotations}
              metadataSchema={activeProject.metadataSchema}
              selectedCodeId={selectedCodeId}
              onUpdateDoc={(patch) => updateDocument(activeDoc.id, patch)}
              onAddAnnotation={(start, end, codeId, note) =>
                addAnnotation(activeDoc.id, start, end, codeId, note)
              }
              onDeleteAnnotation={deleteAnnotation}
              onUpdateAnnotation={updateAnnotation}
            />
          ) : (
            <EmptyDocPane onAdd={addDocument} hasDocs={activeProject.documents.length > 0} />
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

function TopBar({
  project,
  projects,
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
}: {
  project: Project;
  projects: Project[];
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

  return (
    <header className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-slate-200">
      <a
        href="/dashboards"
        className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors"
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
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
        >
          <span className="text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-400">
            Project
          </span>
          <span className="text-[14px] font-bold text-slate-900">{project.name}</span>
          <span className="text-slate-400 text-[10px]">▾</span>
        </button>
        {projectMenuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-full mt-1 w-[280px] bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden"
          >
            <div className="max-h-[300px] overflow-y-auto">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                    p.id === project.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    onSwitch(p.id);
                    setProjectMenuOpen(false);
                  }}
                >
                  <span
                    className={`flex-1 truncate text-[13px] ${
                      p.id === project.id ? 'font-semibold text-slate-900' : 'text-slate-700'
                    }`}
                  >
                    {p.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                    {p.documents.length}d · {p.codes.length}c
                  </span>
                  {projects.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          window.confirm(
                            `Delete project "${p.name}"? This cannot be undone (export first if you want a backup).`,
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
              ))}
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

      {renaming ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const v = name.trim();
            if (v && v !== project.name) onRename(v);
            setRenaming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = name.trim();
              if (v && v !== project.name) onRename(v);
              setRenaming(false);
            }
            if (e.key === 'Escape') {
              setName(project.name);
              setRenaming(false);
            }
          }}
          className="px-2 py-1 text-[14px] font-medium border border-blue-500 rounded focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setRenaming(true)}
          className="text-[11px] text-slate-400 hover:text-slate-700 transition-colors"
          title="rename project"
        >
          ✎ rename
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSchema}
          className="px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
        >
          Metadata schema
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExportMenuOpen(!exportMenuOpen);
            }}
            className="px-3 py-1 text-[12px] font-semibold bg-slate-900 text-white rounded hover:bg-black transition-colors flex items-center gap-1.5"
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
                <span className="text-[13px] font-semibold text-slate-900">
                  Project JSON
                </span>
                <span className="text-[11px] text-slate-500">
                  Canonical, round-trips through Import
                </span>
              </button>
              <button
                type="button"
                onClick={onExportProjectMD}
                className="w-full flex flex-col items-start gap-0.5 px-3 py-2 border-t border-slate-100 hover:bg-blue-50 transition-colors"
              >
                <span className="text-[13px] font-semibold text-slate-900">
                  Project Markdown
                </span>
                <span className="text-[11px] text-slate-500">
                  All documents + annotation tables
                </span>
              </button>
              <button
                type="button"
                onClick={onExportDocMD}
                disabled={!canExportDocMD}
                className="w-full flex flex-col items-start gap-0.5 px-3 py-2 border-t border-slate-100 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:hover:bg-white"
              >
                <span className="text-[13px] font-semibold text-slate-900">
                  Current doc Markdown
                </span>
                <span className="text-[11px] text-slate-500">
                  Just the open document
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Sidebar({
  project,
  activeDocId,
  onSelectDoc,
  onAddDoc,
  onDeleteDoc,
  deepCounts,
  selectedCodeId,
  onSelectCode,
  onAddCode,
  onUpdateCode,
  onDeleteCode,
}: {
  project: Project;
  activeDocId: string | null;
  onSelectDoc: (id: string) => void;
  onAddDoc: () => void;
  onDeleteDoc: (id: string) => void;
  deepCounts: Map<string, number>;
  selectedCodeId: string | null;
  onSelectCode: (id: string | null) => void;
  onAddCode: (parentId: string | null, name: string) => void;
  onUpdateCode: (id: string, patch: Partial<Code>) => void;
  onDeleteCode: (id: string) => void;
}) {
  return (
    <aside className="w-[280px] flex-shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Documents
            </div>
            <button
              type="button"
              onClick={onAddDoc}
              className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
            >
              + new
            </button>
          </div>
          {project.documents.length === 0 ? (
            <div className="text-[12px] text-slate-400 italic py-1">No documents yet.</div>
          ) : (
            <ul className="space-y-px">
              {project.documents.map((d) => (
                <li
                  key={d.id}
                  className={`group flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer text-[13px] transition-colors ${
                    d.id === activeDocId
                      ? 'bg-blue-100 text-slate-900 font-medium'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                  onClick={() => onSelectDoc(d.id)}
                >
                  <span className="flex-1 truncate">{d.title || 'Untitled'}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        window.confirm(`Delete "${d.title}" and its annotations?`)
                      ) {
                        onDeleteDoc(d.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 text-[12px] transition-opacity"
                    title="delete"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4">
          <CodeTree
            codes={project.codes}
            deepCounts={deepCounts}
            selectedCodeId={selectedCodeId}
            onSelectCode={onSelectCode}
            onAddCode={onAddCode}
            onUpdateCode={onUpdateCode}
            onDeleteCode={onDeleteCode}
          />
          {selectedCodeId && (
            <button
              type="button"
              onClick={() => onSelectCode(null)}
              className="mt-3 w-full text-[11px] text-slate-500 hover:text-slate-800 py-1 border border-dashed border-slate-300 rounded"
            >
              clear code filter
            </button>
          )}
        </div>
      </div>
      <div className="border-t border-slate-200 px-4 py-2.5 bg-white">
        <div className="text-[10px] font-mono text-slate-400 leading-tight">
          {project.documents.length} doc{project.documents.length === 1 ? '' : 's'} ·{' '}
          {project.codes.length} code{project.codes.length === 1 ? '' : 's'} ·{' '}
          {project.annotations.length} annotation
          {project.annotations.length === 1 ? '' : 's'}
        </div>
      </div>
    </aside>
  );
}

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
          Data lives in your browser (localStorage). Use Export often to save.
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
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'project';
}

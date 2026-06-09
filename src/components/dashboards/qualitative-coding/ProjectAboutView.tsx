import { useEffect, useMemo, useState } from 'react';
import { countWords } from './compute';
import { MarkdownEditor, MarkdownRendered } from './Markdown';
import { emDash } from './storage';
import type { Project } from './types';

type Props = {
  project: Project;
  onUpdate: (patch: Partial<Project>) => void;
};

export default function ProjectAboutView({ project, onUpdate }: Props) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [aboutDraft, setAboutDraft] = useState(project.about ?? '');
  const [aboutMode, setAboutMode] = useState<'view' | 'edit'>(project.about ? 'view' : 'edit');

  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? '');
    setAboutDraft(project.about ?? '');
    setAboutMode(project.about ? 'view' : 'edit');
  }, [project.id]);

  const isDirty =
    name.trim() !== project.name ||
    description !== (project.description ?? '') ||
    aboutDraft !== (project.about ?? '');

  const save = () => {
    const patch: Partial<Project> = {};
    const v = name.trim();
    if (v && v !== project.name) patch.name = v;
    if (description !== (project.description ?? '')) {
      patch.description = description.trim() || undefined;
    }
    if (aboutDraft !== (project.about ?? '')) {
      patch.about = aboutDraft || undefined;
    }
    if (Object.keys(patch).length > 0) onUpdate(patch);
  };

  const discard = () => {
    setName(project.name);
    setDescription(project.description ?? '');
    setAboutDraft(project.about ?? '');
  };

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-white">
      <div className="max-w-[820px] mx-auto px-8 py-10">
        <div className="flex items-start justify-between mb-2 gap-3">
          <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-blue-600">
            Project info
          </div>
          {isDirty && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={discard}
                className="px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={save}
                className="px-4 py-1.5 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Save changes
              </button>
            </div>
          )}
        </div>

        <input
          value={name}
          onChange={(e) => setName(emDash(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-full font-bold text-[22px] leading-tight text-slate-900 placeholder-slate-300 border-none focus:outline-none bg-transparent mb-2"
          style={{ letterSpacing: '-0.015em' }}
          placeholder="Project name"
        />

        <div className="mb-5">
          <input
            value={description}
            onChange={(e) => setDescription(emDash(e.target.value))}
            placeholder="One-line summary of what this project is about"
            className="w-full px-3 py-1.5 text-[13px] text-slate-700 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-500">
              About this project
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAboutMode('view')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
                  aboutMode === 'view'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Read
              </button>
              <button
                type="button"
                onClick={() => setAboutMode('edit')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
                  aboutMode === 'edit'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Edit
              </button>
            </div>
          </div>
          {aboutMode === 'edit' ? (
            <MarkdownEditor
              value={aboutDraft}
              onChange={setAboutDraft}
              placeholder="Background, goals, code-tree decisions, research questions, what to look for. Markdown supported (B, I, headings, lists)."
              minHeight={360}
            />
          ) : (
            <div className="p-4 border border-slate-200 rounded-lg bg-white min-h-[200px]">
              <MarkdownRendered text={aboutDraft} className="text-[15px] text-slate-800" />
            </div>
          )}
        </div>

        {isDirty && (
          <div className="mb-8 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              className="px-5 py-2 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={discard}
              className="px-3 py-2 text-[13px] font-medium text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors"
            >
              Discard
            </button>
            <span className="text-[12px] text-slate-400 italic">
              Unsaved changes
            </span>
          </div>
        )}

        <ProjectStats project={project} />
      </div>
    </div>
  );
}

function ProjectStats({ project }: { project: Project }) {
  const aggregate = useMemo(() => {
    let totalChars = 0;
    let totalWords = 0;
    let docCount = 0;
    let noteCount = 0;
    for (const d of project.documents) {
      if (d.kind === 'note') {
        noteCount++;
      } else {
        docCount++;
        totalChars += d.text.length;
        totalWords += countWords(d.text);
      }
    }
    return { totalChars, totalWords, docCount, noteCount };
  }, [project.documents]);

  return (
    <div className="mt-12 pt-6 border-t border-slate-200">
      <div className="text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-500 mb-3">
        Project at a glance
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Documents" value={aggregate.docCount} />
        <Stat label="Notes" value={aggregate.noteCount} />
        <Stat label="Codes" value={project.codes.length} />
        <Stat label="Annotations" value={project.annotations.length} />
        <Stat
          label="Leaf codes"
          value={
            project.codes.filter(
              (c) => !project.codes.some((other) => other.parentIds.includes(c.id)),
            ).length
          }
        />
        <Stat
          label="Top-level codes"
          value={project.codes.filter((c) => c.parentIds.length === 0).length}
        />
        <Stat label="Themes" value={(project.themes ?? []).length} />
        <Stat
          label="Top-level themes"
          value={(project.themes ?? []).filter((t) => t.parentIds.length === 0).length}
        />
      </div>
      <div className="mt-3 text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-500 mb-2">
        Corpus size (documents only)
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total words" value={aggregate.totalWords} />
        <Stat label="Total chars" value={aggregate.totalChars} />
        <Stat
          label="Avg words / doc"
          value={
            aggregate.docCount > 0
              ? Math.round(aggregate.totalWords / aggregate.docCount)
              : 0
          }
        />
        <Stat
          label="Avg chars / doc"
          value={
            aggregate.docCount > 0
              ? Math.round(aggregate.totalChars / aggregate.docCount)
              : 0
          }
        />
      </div>
      <div className="mt-3 text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-500 mb-2">
        Schema
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Metadata fields" value={project.metadataSchema.length} />
        <Stat
          label="Folders"
          value={(() => {
            const all = new Set<string>(project.folders ?? []);
            for (const d of project.documents) {
              if (d.folder) all.add(d.folder);
            }
            return all.size;
          })()}
        />
      </div>
      <div className="mt-4 text-[11px] text-slate-400 font-mono">
        Created {new Date(project.created_at).toLocaleDateString()} · Updated{' '}
        {new Date(project.updated_at).toLocaleDateString()}
        {project.drive?.folderId && <> · synced to Drive</>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
      <div className="text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div className="text-[24px] font-bold text-slate-900 leading-tight tabular-nums mt-1">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

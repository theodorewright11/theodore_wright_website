import { useEffect, useState } from 'react';
import { MarkdownEditor, MarkdownRendered } from './Markdown';
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

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-white">
      <div className="max-w-[820px] mx-auto px-8 py-10">
        <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-blue-600 mb-2">
          Project info
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const v = name.trim();
            if (v && v !== project.name) onUpdate({ name: v });
            else setName(project.name);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-full font-bold text-[36px] leading-tight text-slate-900 placeholder-slate-300 border-none focus:outline-none bg-transparent mb-3"
          style={{ letterSpacing: '-0.025em' }}
          placeholder="Project name"
        />

        <div className="mb-8">
          <label className="block text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-500 mb-1">
            Short description
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              const v = description.trim();
              if (v !== (project.description ?? '')) {
                onUpdate({ description: v || undefined });
              }
            }}
            placeholder="One-line summary of what this project is about"
            className="w-full px-3 py-2 text-[15px] text-slate-700 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
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
              onChange={(v) => {
                setAboutDraft(v);
                onUpdate({ about: v || undefined });
              }}
              placeholder="Background, goals, code-tree decisions, research questions, what to look for. Markdown supported (B, I, headings, lists)."
              minHeight={360}
            />
          ) : (
            <div className="p-4 border border-slate-200 rounded-lg bg-white min-h-[200px]">
              <MarkdownRendered text={aboutDraft} className="text-[15px] text-slate-800" />
            </div>
          )}
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200">
          <div className="text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-500 mb-3">
            Project at a glance
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Documents" value={project.documents.length} />
            <Stat label="Codes" value={project.codes.length} />
            <Stat label="Annotations" value={project.annotations.length} />
            <Stat label="Metadata fields" value={project.metadataSchema.length} />
          </div>
          <div className="mt-4 text-[11px] text-slate-400 font-mono">
            Created {new Date(project.created_at).toLocaleDateString()} · Updated{' '}
            {new Date(project.updated_at).toLocaleDateString()}
            {project.drive?.fileId && <> · synced to Drive</>}
          </div>
        </div>
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

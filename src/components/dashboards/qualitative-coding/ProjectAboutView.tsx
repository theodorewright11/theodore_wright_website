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

      <RubricSection />
    </div>
  );
}

function RubricSection() {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-10 pt-6 border-t border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-500 hover:text-slate-800 mb-2"
      >
        <span className="text-[10px] text-slate-400 w-3">{open ? '▾' : '▸'}</span>
        Grading rubrics — reference
      </button>
      {open && (
        <div className="space-y-6 max-w-[860px]">
          <RubricBlock
            title="Code rubric"
            intro={
              <>
                Codes are rated on two criteria. <strong>Specificity</strong> is set once per code (intrinsic to how it’s defined). <strong>Accuracy</strong> is set per annotation — how well that code fits a particular text segment. A code’s aggregate accuracy is the mean of all its annotation-level ratings.
              </>
            }
            rows={[
              {
                criterion: 'Specificity',
                question: 'Is the code at an appropriate level of detail?',
                anchors: [
                  '5 · precise level of detail; meaningfully compresses while preserving what matters',
                  '4 · mostly appropriate; slight over- or under-compression',
                  '3 · somewhat mismatched; noticeably over- or under-compresses',
                  '2 · poorly matched; too broad to distinguish or too narrow to add value',
                  '1 · unhelpful; applies to nearly anything OR just repeats the segment',
                ],
              },
              {
                criterion: 'Accuracy (per annotation)',
                question: 'Does the code correctly and clearly label the text segment it’s applied to?',
                anchors: [
                  '5 · precisely captures the segment; clear, informative shorthand',
                  '4 · mostly captures with minor ambiguity',
                  '3 · partially captures with some ambiguity',
                  '2 · loosely captures with notable ambiguity',
                  '1 · does not capture the segment; unclear or unrelated label',
                ],
              },
            ]}
          />

          <RubricBlock
            title="Theme rubric — evaluative"
            intro={
              <>
                Themes are rated on three evaluative criteria. Subthemes use the same scale — independence is scoped to siblings under the same parent.
              </>
            }
            rows={[
              {
                criterion: 'Grounding',
                question: 'Does this theme accurately reflect patterns present in the data?',
                anchors: [
                  '5 · clearly reflects patterns; extracts demonstrate it; interpretation specific and traceable',
                  '4 · mostly reflects with minor mismatches; mostly traceable',
                  '3 · partially reflects; some extracts loose; interpretation vague',
                  '2 · loosely connects; few extracts demonstrate the pattern',
                  '1 · does not reflect; extracts don’t demonstrate; interpretation unconvincing',
                ],
              },
              {
                criterion: 'Usefulness',
                question: 'Does this theme contribute to answering the research question?',
                anchors: [
                  '5 · directly addresses at appropriate depth; meaningfully advances the analysis',
                  '4 · mostly addresses with minor depth/specificity issues',
                  '3 · partially addresses at somewhat mismatched depth',
                  '2 · tangentially addresses at mismatched depth',
                  '1 · does not address the research question',
                ],
              },
              {
                criterion: 'Independence',
                question: 'Is this theme distinct from other themes in the set?',
                anchors: [
                  '5 · clearly distinct; captures a unique pattern',
                  '4 · mostly distinct with minor overlap with one other theme',
                  '3 · partially distinct; moderate overlap with another theme',
                  '2 · substantial overlap with another theme',
                  '1 · redundant; captures no unique pattern',
                ],
              },
            ]}
          />

          <RubricBlock
            title="Theme rubric — descriptive"
            intro={
              <>
                These two criteria describe the theme without judging it. Lower or higher isn’t worse — appropriateness depends on the research question.
              </>
            }
            rows={[
              {
                criterion: 'Interpretation level',
                question: 'How far beyond the surface text does this theme go?',
                anchors: [
                  '5 · substantial; ties pattern to underlying dynamics or frameworks',
                  '4 · considerable inference; broader-context framing',
                  '3 · moderate inference; pattern not explicit in any extract',
                  '2 · slightly beyond surface; minimal inference',
                  '1 · surface; restates / summarises the text',
                ],
              },
              {
                criterion: 'Prevalence',
                question: 'How often does this theme appear in the data?',
                anchors: [
                  '5 · nearly all data items; pervasive',
                  '4 · majority of data items; common',
                  '3 · notable portion; moderate',
                  '2 · small minority; uncommon',
                  '1 · very few items; rare',
                ],
              },
            ]}
          />

          <div className="text-[12px] text-slate-500 leading-relaxed border-l-2 border-slate-300 pl-3">
            <strong className="text-slate-700">Why theme independence matters:</strong> no information redundancy (each theme captures unique variance — the PCA argument), stable data-to-theme mapping (comments can be unambiguously assigned), and interpretive clarity (when themes are orthogonal, the relationship between them becomes meaningful).
          </div>
        </div>
      )}
    </div>
  );
}

function RubricBlock({
  title,
  intro,
  rows,
}: {
  title: string;
  intro: React.ReactNode;
  rows: { criterion: string; question: string; anchors: string[] }[];
}) {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="text-[13px] font-bold text-slate-800">{title}</div>
        <p className="text-[12px] text-slate-600 mt-1 leading-snug">{intro}</p>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((r) => (
          <div key={r.criterion} className="px-4 py-3">
            <div className="text-[12px] font-semibold text-slate-700">
              {r.criterion}
            </div>
            <div className="text-[11px] text-slate-500 italic mt-0.5">
              {r.question}
            </div>
            <ul className="mt-2 space-y-1">
              {r.anchors.map((a, i) => (
                <li
                  key={i}
                  className="text-[12px] text-slate-700 leading-snug pl-3 border-l border-slate-200"
                >
                  {a}
                </li>
              ))}
            </ul>
          </div>
        ))}
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

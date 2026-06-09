import { useMemo, useState } from 'react';
import {
  annRanges,
  annText,
  codePathString,
  descendantIds,
  resolveColor,
} from './compute';
import HierarchicalCodePicker from './HierarchicalCodePicker';
import { MarkdownEditor } from './Markdown';
import { emDash } from './storage';
import type { Annotation, Code, Project, Theme, ThemeRating } from './types';

// Rubric anchors shown as tooltips on rating buttons.
const RUBRIC: Record<keyof Omit<ThemeRating, 'notes'>, string[]> = {
  grounding: [
    '1 · does not reflect data; extracts don’t demonstrate the pattern',
    '2 · loosely connects; few extracts demonstrate the pattern',
    '3 · partially reflects; some extracts fit, others loosely',
    '4 · mostly reflects with minor mismatches',
    '5 · clearly reflects patterns; extracts demonstrate it; interpretation traceable',
  ],
  usefulness: [
    '1 · does not address the research question',
    '2 · tangentially addresses at mismatched depth',
    '3 · partially addresses at somewhat mismatched depth',
    '4 · mostly addresses with minor depth/specificity issues',
    '5 · directly addresses at appropriate depth; meaningfully advances the analysis',
  ],
  independence: [
    '1 · redundant with another theme',
    '2 · substantial overlap with another theme',
    '3 · partially distinct; moderate overlap',
    '4 · mostly distinct; minor overlap',
    '5 · clearly distinct; unique pattern not represented elsewhere',
  ],
  interpretationLevel: [
    '1 · surface; restates / summarises the text',
    '2 · slightly beyond surface; minimal inference',
    '3 · moderate inference; pattern not explicit in extracts',
    '4 · considerable inference; broader-context framing',
    '5 · substantial; ties pattern to underlying dynamics or frameworks',
  ],
  prevalence: [
    '1 · very few data items; rare pattern',
    '2 · small minority of data items',
    '3 · notable portion of data items',
    '4 · majority of data items; common',
    '5 · nearly all data items; pervasive',
  ],
};

type AxisKey = keyof typeof RUBRIC;
const AXES: { key: AxisKey; label: string; group: 'evaluative' | 'descriptive' }[] = [
  { key: 'grounding', label: 'Grounding', group: 'evaluative' },
  { key: 'usefulness', label: 'Usefulness', group: 'evaluative' },
  { key: 'independence', label: 'Independence', group: 'evaluative' },
  { key: 'interpretationLevel', label: 'Interpretation level', group: 'descriptive' },
  { key: 'prevalence', label: 'Prevalence', group: 'descriptive' },
];

type Props = {
  project: Project;
  activeThemeId: string | null;
  onSetActiveThemeId: (id: string | null) => void;
  onAddTheme: (name: string, parentId?: string | null) => string;
  onUpdateTheme: (id: string, patch: Partial<Theme>) => void;
  onDeleteTheme: (id: string) => void;
  onLinkAnnotation: (themeId: string, annotationId: string, weight: 'core' | 'supporting') => void;
  onUnlinkAnnotation: (themeId: string, annotationId: string) => void;
  onToggleIncludeCode: (themeId: string, codeId: string) => void;
  onJumpToAnnotation: (
    projectId: string,
    docId: string,
    annotationId: string,
  ) => void;
};

export default function ThemesView({
  project,
  activeThemeId,
  onSetActiveThemeId,
  onAddTheme,
  onUpdateTheme,
  onDeleteTheme,
  onLinkAnnotation,
  onUnlinkAnnotation,
  onToggleIncludeCode,
  onJumpToAnnotation,
}: Props) {
  const themes = project.themes ?? [];
  const active = themes.find((t) => t.id === activeThemeId) ?? null;
  const [addingRoot, setAddingRoot] = useState(false);
  const [draftName, setDraftName] = useState('');

  // Group themes by parent for sidebar render.
  const tree = useMemo(() => buildThemeTree(themes), [themes]);

  return (
    <div className="flex-1 min-w-0 min-h-0 flex bg-white">
      <aside className="w-[280px] flex-shrink-0 border-r border-slate-200 flex flex-col bg-white">
        <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
          <div className="text-[12px] uppercase tracking-wider font-semibold text-slate-600">
            Themes · {themes.length}
          </div>
          <button
            type="button"
            onClick={() => {
              setAddingRoot(true);
              setDraftName('');
            }}
            className="text-[11px] font-semibold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
          >
            + new
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {addingRoot && (
            <div className="px-3 py-1.5">
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(emDash(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = draftName.trim();
                    if (v) {
                      const id = onAddTheme(v, null);
                      onSetActiveThemeId(id);
                    }
                    setAddingRoot(false);
                    setDraftName('');
                  }
                  if (e.key === 'Escape') {
                    setAddingRoot(false);
                    setDraftName('');
                  }
                }}
                onBlur={() => {
                  const v = draftName.trim();
                  if (v) {
                    const id = onAddTheme(v, null);
                    onSetActiveThemeId(id);
                  }
                  setAddingRoot(false);
                  setDraftName('');
                }}
                placeholder="New top-level theme"
                className="w-full px-2 py-1 text-[12px] border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>
          )}
          {themes.length === 0 && !addingRoot && (
            <div className="px-3 py-4 text-[12px] text-slate-400 italic">
              No themes yet. Click <span className="font-semibold">+ new</span> to start.
            </div>
          )}
          {tree.map((node) => (
            <ThemeRow
              key={node.theme.id}
              node={node}
              depth={0}
              activeId={activeThemeId}
              project={project}
              onSelect={onSetActiveThemeId}
              onAddChild={(parentId) => {
                const id = onAddTheme('Untitled theme', parentId);
                onSetActiveThemeId(id);
              }}
            />
          ))}
        </div>
      </aside>

      <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">
        {!active ? (
          <div className="h-full flex items-center justify-center text-[14px] text-slate-400 italic">
            Select a theme on the left, or create one.
          </div>
        ) : (
          <ThemeDetail
            project={project}
            theme={active}
            onUpdateTheme={onUpdateTheme}
            onDeleteTheme={onDeleteTheme}
            onLinkAnnotation={onLinkAnnotation}
            onUnlinkAnnotation={onUnlinkAnnotation}
            onToggleIncludeCode={onToggleIncludeCode}
            onJumpToAnnotation={onJumpToAnnotation}
          />
        )}
      </main>
    </div>
  );
}

// --- Sidebar tree ---

type ThemeNode = { theme: Theme; children: ThemeNode[] };

function buildThemeTree(themes: Theme[]): ThemeNode[] {
  const byParent = new Map<string | null, Theme[]>();
  for (const t of themes) {
    const parent = t.parentIds[0] ?? null;
    const list = byParent.get(parent) ?? [];
    list.push(t);
    byParent.set(parent, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return a.created_at.localeCompare(b.created_at);
    });
  }
  const build = (parent: string | null): ThemeNode[] =>
    (byParent.get(parent) ?? []).map((theme) => ({
      theme,
      children: build(theme.id),
    }));
  return build(null);
}

function ThemeRow({
  node,
  depth,
  activeId,
  project,
  onSelect,
  onAddChild,
}: {
  node: ThemeNode;
  depth: number;
  activeId: string | null;
  project: Project;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const evidenceCount = countEvidence(node.theme, project);
  const isActive = node.theme.id === activeId;
  return (
    <div>
      <div
        onClick={() => onSelect(node.theme.id)}
        className={`group flex items-center gap-1 px-2 py-1 cursor-pointer ${
          isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="w-3 text-[10px] text-slate-400 hover:text-slate-700"
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span className="flex-1 min-w-0 text-[13px] text-slate-800 leading-snug break-words">
          {node.theme.name}
        </span>
        {evidenceCount > 0 && (
          <span className="text-[10px] font-mono text-slate-400">{evidenceCount}</span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild(node.theme.id);
          }}
          className="opacity-0 group-hover:opacity-100 text-[12px] text-slate-400 hover:text-blue-600 px-1"
          title="add subtheme"
        >
          +
        </button>
      </div>
      {open &&
        node.children.map((child) => (
          <ThemeRow
            key={child.theme.id}
            node={child}
            depth={depth + 1}
            activeId={activeId}
            project={project}
            onSelect={onSelect}
            onAddChild={onAddChild}
          />
        ))}
    </div>
  );
}

function countEvidence(theme: Theme, project: Project): number {
  const direct = new Set(theme.annotationLinks.map((l) => l.annotationId));
  let extra = 0;
  if (theme.includeCodeIds.length > 0) {
    const codeIdSet = new Set<string>();
    for (const cid of theme.includeCodeIds) {
      for (const d of descendantIds(project.codes, cid)) codeIdSet.add(d);
    }
    for (const a of project.annotations) {
      if (direct.has(a.id)) continue;
      if (codeIdSet.has(a.codeId)) extra += 1;
    }
  }
  return direct.size + extra;
}

// --- Detail pane ---

function ThemeDetail({
  project,
  theme,
  onUpdateTheme,
  onDeleteTheme,
  onLinkAnnotation,
  onUnlinkAnnotation,
  onToggleIncludeCode,
  onJumpToAnnotation,
}: {
  project: Project;
  theme: Theme;
  onUpdateTheme: (id: string, patch: Partial<Theme>) => void;
  onDeleteTheme: (id: string) => void;
  onLinkAnnotation: (themeId: string, annotationId: string, weight: 'core' | 'supporting') => void;
  onUnlinkAnnotation: (themeId: string, annotationId: string) => void;
  onToggleIncludeCode: (themeId: string, codeId: string) => void;
  onJumpToAnnotation: (projectId: string, docId: string, annotationId: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(theme.name);
  const [pickerQuery, setPickerQuery] = useState('');
  const [codePickerOpen, setCodePickerOpen] = useState(false);
  const [annPickerOpen, setAnnPickerOpen] = useState(false);

  // Build the evidence list: direct links (with their weight) + auto-include
  // annotations from includeCodeIds (as 'supporting' unless they're also in
  // direct, in which case the direct weight wins).
  const evidence = useMemo(() => {
    type Item = {
      annotation: Annotation;
      weight: 'core' | 'supporting';
      source: 'direct' | 'auto';
    };
    const out: Item[] = [];
    const seen = new Set<string>();
    const annById = new Map(project.annotations.map((a) => [a.id, a]));
    for (const link of theme.annotationLinks) {
      const a = annById.get(link.annotationId);
      if (!a) continue;
      out.push({ annotation: a, weight: link.weight, source: 'direct' });
      seen.add(a.id);
    }
    if (theme.includeCodeIds.length > 0) {
      const codeIdSet = new Set<string>();
      for (const cid of theme.includeCodeIds) {
        for (const d of descendantIds(project.codes, cid)) codeIdSet.add(d);
      }
      for (const a of project.annotations) {
        if (seen.has(a.id)) continue;
        if (!codeIdSet.has(a.codeId)) continue;
        out.push({ annotation: a, weight: 'supporting', source: 'auto' });
      }
    }
    // Sort: core first, then by code path.
    out.sort((x, y) => {
      if (x.weight !== y.weight) return x.weight === 'core' ? -1 : 1;
      return codePathString(project.codes, x.annotation.codeId).localeCompare(
        codePathString(project.codes, y.annotation.codeId),
      );
    });
    return out;
  }, [theme, project.annotations, project.codes]);

  // Group evidence by code for cleaner display.
  const evidenceByCode = useMemo(() => {
    const m = new Map<string, typeof evidence>();
    for (const e of evidence) {
      const arr = m.get(e.annotation.codeId) ?? [];
      arr.push(e);
      m.set(e.annotation.codeId, arr);
    }
    return [...m.entries()].sort((a, b) =>
      codePathString(project.codes, a[0]).localeCompare(codePathString(project.codes, b[0])),
    );
  }, [evidence, project.codes]);

  const coreCount = evidence.filter((e) => e.weight === 'core').length;

  return (
    <div className="px-6 py-4 max-w-[900px] mx-auto">
      <header className="flex items-baseline gap-2 mb-2 flex-wrap">
        {editingName ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(emDash(e.target.value))}
            onBlur={() => {
              const v = draftName.trim();
              if (v && v !== theme.name) onUpdateTheme(theme.id, { name: v });
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                setDraftName(theme.name);
                setEditingName(false);
              }
            }}
            className="flex-1 min-w-[200px] font-bold text-[22px] leading-tight text-slate-900 border-none focus:outline-none bg-transparent"
            style={{ letterSpacing: '-0.015em' }}
          />
        ) : (
          <h1
            onClick={() => {
              setDraftName(theme.name);
              setEditingName(true);
            }}
            className="flex-1 min-w-[200px] font-bold text-[22px] leading-tight text-slate-900 cursor-text"
            style={{ letterSpacing: '-0.015em' }}
          >
            {theme.name}
          </h1>
        )}
        <span className="text-[11px] font-mono text-slate-500">
          {evidence.length} quote{evidence.length === 1 ? '' : 's'}
          {coreCount > 0 && ` · ${coreCount} core`}
        </span>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete theme "${theme.name}"? Subthemes are preserved (re-parent first if needed).`)) {
              onDeleteTheme(theme.id);
            }
          }}
          className="text-[11px] text-slate-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
        >
          Delete
        </button>
      </header>

      <section className="mb-5">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
          Interpretation
        </div>
        <MarkdownEditor
          value={theme.description ?? ''}
          onChange={(v) => onUpdateTheme(theme.id, { description: v })}
          placeholder="Write your interpretation of this theme. What pattern are you naming? How does it answer the research question?"
          minHeight={180}
        />
      </section>

      <section className="mb-5">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
          Ratings
        </div>
        <RatingsCard
          rating={theme.rating}
          onChange={(patch) =>
            onUpdateTheme(theme.id, { rating: { ...(theme.rating ?? {}), ...patch } })
          }
        />
      </section>

      <section className="mb-5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
            Auto-include codes
          </div>
          <button
            type="button"
            onClick={() => setCodePickerOpen((v) => !v)}
            className="text-[11px] font-semibold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
          >
            {codePickerOpen ? 'Done' : '+ add'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {theme.includeCodeIds.length === 0 && (
            <span className="text-[12px] italic text-slate-400">
              No codes auto-included. Add a code to pull all its annotations as supporting evidence.
            </span>
          )}
          {theme.includeCodeIds.map((cid) => (
            <span
              key={cid}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 text-[12px] text-slate-700"
            >
              <span
                className="w-2.5 h-2.5 rounded-sm ring-1 ring-black/5"
                style={{ background: resolveColor(project.codes, cid) }}
              />
              {codePathString(project.codes, cid)}
              <button
                type="button"
                onClick={() => onToggleIncludeCode(theme.id, cid)}
                className="text-slate-400 hover:text-red-600 text-[14px] leading-none"
                title="stop auto-including this code"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {codePickerOpen && (
          <div className="mt-2 border border-slate-200 rounded bg-white overflow-hidden">
            <HierarchicalCodePicker
              codes={project.codes}
              selectedIds={new Set(theme.includeCodeIds)}
              onToggle={(codeId) => onToggleIncludeCode(theme.id, codeId)}
              maxHeight="280px"
            />
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
            Evidence · {evidence.length}
          </div>
          <button
            type="button"
            onClick={() => setAnnPickerOpen((v) => !v)}
            className="text-[11px] font-semibold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
          >
            {annPickerOpen ? 'Done' : '+ add annotation'}
          </button>
        </div>
        {annPickerOpen && (
          <AnnotationPicker
            project={project}
            currentLinks={new Set(theme.annotationLinks.map((l) => l.annotationId))}
            onAdd={(annotationId, weight) =>
              onLinkAnnotation(theme.id, annotationId, weight)
            }
            onRemove={(annotationId) => onUnlinkAnnotation(theme.id, annotationId)}
          />
        )}
        {evidence.length === 0 ? (
          <div className="text-[13px] text-slate-400 italic border border-dashed border-slate-200 rounded-lg p-8 text-center">
            No evidence yet. From the doc viewer or Explore, send annotations into this theme — or auto-include a code above.
          </div>
        ) : (
          <div className="space-y-6">
            {evidenceByCode.map(([codeId, items]) => {
              const color = resolveColor(project.codes, codeId);
              const path = codePathString(project.codes, codeId);
              return (
                <div key={codeId} className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                  <header
                    className="px-3 py-2 flex items-center gap-2 border-b border-slate-100 sticky top-0 bg-white"
                    style={{ boxShadow: `inset 3px 0 0 0 ${color}` }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm ring-1 ring-black/5 flex-shrink-0"
                      style={{ background: color }}
                    />
                    <span className="text-[13px] font-semibold text-slate-800 flex-1">
                      {path}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {items.length}
                    </span>
                  </header>
                  <ol className="divide-y divide-slate-100">
                    {items.map(({ annotation: a, weight, source }) => {
                      const doc = project.documents.find((d) => d.id === a.docId);
                      const text = annText(a, doc?.text ?? '');
                      const ranges = annRanges(a);
                      const isCore = weight === 'core';
                      return (
                        <li
                          key={a.id}
                          className="px-3 py-2 hover:bg-slate-50/60 group/ev"
                        >
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                onLinkAnnotation(
                                  theme.id,
                                  a.id,
                                  isCore ? 'supporting' : 'core',
                                );
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold tracking-wider transition-colors ${
                                isCore
                                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              }`}
                              title="toggle core / supporting"
                            >
                              {isCore ? 'Core' : 'Supporting'}
                            </button>
                            {source === 'auto' && (
                              <span
                                className="text-[10px] uppercase font-semibold tracking-wider text-slate-400"
                                title="auto-included via the code above"
                              >
                                auto
                              </span>
                            )}
                            <span className="text-[11px] text-slate-500 ml-auto">
                              {doc?.folder ? `${doc.folder} / ` : ''}
                              {doc?.title}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onJumpToAnnotation(project.id, a.docId, a.id)
                              }
                              className="text-[10px] text-slate-400 hover:text-blue-600 px-1"
                              title="jump to the doc"
                            >
                              ↗
                            </button>
                            {source === 'direct' && (
                              <button
                                type="button"
                                onClick={() => onUnlinkAnnotation(theme.id, a.id)}
                                className="text-[12px] text-slate-400 hover:text-red-600 leading-none px-1 opacity-0 group-hover/ev:opacity-100"
                                title="remove from theme"
                              >
                                ×
                              </button>
                            )}
                          </div>
                          <blockquote
                            className="text-[14px] text-slate-800 leading-relaxed border-l-2 border-slate-300 pl-3 whitespace-pre-wrap break-words"
                            style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
                          >
                            {text}
                          </blockquote>
                          {ranges.length > 1 && (
                            <span className="block mt-1 text-[10px] font-mono text-slate-400">
                              {ranges.length} ranges
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// 5-axis rating card. Same rubric tooltips for both evaluative and descriptive axes.
function RatingsCard({
  rating,
  onChange,
}: {
  rating: ThemeRating | undefined;
  onChange: (patch: Partial<ThemeRating>) => void;
}) {
  return (
    <div className="border border-slate-200 rounded-lg bg-white">
      <div className="px-3 py-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {AXES.map((ax) => (
          <div key={ax.key}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-[11px] font-semibold text-slate-700">
                {ax.label}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400">
                {ax.group}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => {
                const isPicked = rating?.[ax.key] === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      onChange({ [ax.key]: isPicked ? undefined : n } as Partial<ThemeRating>)
                    }
                    title={RUBRIC[ax.key][n - 1]}
                    className={`w-7 h-7 rounded border text-[12px] font-semibold transition-colors ${
                      isPicked
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3">
        <textarea
          value={rating?.notes ?? ''}
          onChange={(e) => onChange({ notes: emDash(e.target.value) || undefined })}
          placeholder="Optional rating notes — anything to remember about how you scored this theme"
          rows={2}
          className="w-full px-2 py-1 text-[12px] border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
}

// Inline annotation search-and-add for the theme detail view. Lists every
// annotation in the project (newest first), filtered by free-text on the
// code path / quote / doc title. Each row shows the existing weight (if
// linked) and Core / Supporting toggle buttons that add or change the weight.
function AnnotationPicker({
  project,
  currentLinks,
  onAdd,
  onRemove,
}: {
  project: Project;
  currentLinks: Set<string>;
  onAdd: (annotationId: string, weight: 'core' | 'supporting') => void;
  onRemove: (annotationId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [showLinkedOnly, setShowLinkedOnly] = useState(false);

  const items = useMemo(() => {
    const docById = new Map(project.documents.map((d) => [d.id, d]));
    return project.annotations
      .map((a) => {
        const doc = docById.get(a.docId);
        const text = doc ? annText(a, doc.text) : '';
        const codePath = codePathString(project.codes, a.codeId);
        const docLabel = doc ? `${doc.folder ? doc.folder + ' / ' : ''}${doc.title}` : '';
        return { a, doc, text, codePath, docLabel };
      })
      .sort((x, y) => y.a.created_at.localeCompare(x.a.created_at));
  }, [project.annotations, project.documents, project.codes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((it) => (showLinkedOnly ? currentLinks.has(it.a.id) : true))
      .filter((it) => {
        if (!q) return true;
        return (
          it.codePath.toLowerCase().includes(q) ||
          it.text.toLowerCase().includes(q) ||
          it.docLabel.toLowerCase().includes(q)
        );
      })
      .slice(0, 100);
  }, [items, query, showLinkedOnly, currentLinks]);

  return (
    <div className="mb-3 border border-slate-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search annotations by code, quote, or doc…"
          className="flex-1 min-w-0 px-2 py-1 text-[12px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
        />
        <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={showLinkedOnly}
            onChange={(e) => setShowLinkedOnly(e.target.checked)}
          />
          Already in theme
        </label>
      </div>
      <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-[12px] text-slate-400 italic text-center">
            No annotations match.
          </div>
        ) : (
          filtered.map(({ a, doc, text, codePath, docLabel }) => {
            const linked = currentLinks.has(a.id);
            const color = resolveColor(project.codes, a.codeId);
            const preview = text.slice(0, 160).replace(/\s+/g, ' ');
            return (
              <div key={a.id} className="px-3 py-2">
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span
                    className="w-2.5 h-2.5 rounded-sm ring-1 ring-black/5 flex-shrink-0"
                    style={{ background: color }}
                  />
                  <span className="font-semibold text-slate-700">{codePath}</span>
                  {doc && (
                    <span className="text-slate-500 truncate ml-auto max-w-[200px]">
                      {docLabel}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[12px] text-slate-700 italic break-words">
                  “{preview}{text.length > 160 ? '…' : ''}”
                </div>
                <div className="mt-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onAdd(a.id, 'core')}
                    className={`px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wider rounded ${
                      linked
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    }`}
                  >
                    {linked ? '↻' : '+'} Core
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdd(a.id, 'supporting')}
                    className={`px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wider rounded ${
                      linked
                        ? 'bg-slate-400 text-white hover:bg-slate-500'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {linked ? '↻' : '+'} Supporting
                  </button>
                  {linked && (
                    <button
                      type="button"
                      onClick={() => onRemove(a.id)}
                      className="ml-auto text-[10px] text-slate-400 hover:text-red-600 px-1.5 py-0.5"
                    >
                      remove
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

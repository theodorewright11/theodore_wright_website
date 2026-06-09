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
  // Display toggles for the Evidence section.
  const [evViewMode, setEvViewMode] = useState<'flat' | 'by-code' | 'doc'>('by-code');
  const [evShowFullDoc, setEvShowFullDoc] = useState(false);
  const [evShowNotes, setEvShowNotes] = useState(true);
  const [evShowMeta, setEvShowMeta] = useState(false);
  // Doc-view extras
  const [docCodeMargin, setDocCodeMargin] = useState<'off' | 'on'>('on');
  const [docCodeLevel, setDocCodeLevel] = useState<'all' | 'top' | 'mid' | 'leaf'>('all');

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

  // Group evidence by code. Groups with any core annotation come first; within
  // each group, core items also appear before supporting (since `evidence` was
  // already core-first-sorted upstream).
  const evidenceByCode = useMemo(() => {
    const m = new Map<string, typeof evidence>();
    for (const e of evidence) {
      const arr = m.get(e.annotation.codeId) ?? [];
      arr.push(e);
      m.set(e.annotation.codeId, arr);
    }
    return [...m.entries()].sort((a, b) => {
      const aHasCore = a[1].some((x) => x.weight === 'core');
      const bHasCore = b[1].some((x) => x.weight === 'core');
      if (aHasCore !== bHasCore) return aHasCore ? -1 : 1;
      return codePathString(project.codes, a[0]).localeCompare(
        codePathString(project.codes, b[0]),
      );
    });
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
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
            Evidence · {evidence.length}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-[11px]">
              {(['flat', 'by-code', 'doc'] as const).map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setEvViewMode(m)}
                  className={`px-2 py-1 font-semibold capitalize ${
                    evViewMode === m
                      ? 'bg-slate-900 text-white'
                      : `text-slate-600 hover:bg-slate-100 ${i > 0 ? 'border-l border-slate-300' : ''}`
                  }`}
                >
                  {m === 'by-code' ? 'By code' : m === 'doc' ? 'Doc' : 'Flat'}
                </button>
              ))}
            </div>
            {evViewMode === 'doc' && (
              <>
                <button
                  type="button"
                  onClick={() => setDocCodeMargin((v) => (v === 'on' ? 'off' : 'on'))}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-md border ${
                    docCodeMargin === 'on'
                      ? 'border-violet-300 bg-violet-50 text-violet-800'
                      : 'border-slate-300 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Code margin {docCodeMargin}
                </button>
                <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-[11px]">
                  {(['all', 'top', 'mid', 'leaf'] as const).map((lvl, i) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDocCodeLevel(lvl)}
                      className={`px-2 py-1 font-semibold capitalize ${
                        docCodeLevel === lvl
                          ? 'bg-slate-900 text-white'
                          : `text-slate-600 hover:bg-slate-100 ${i > 0 ? 'border-l border-slate-300' : ''}`
                      }`}
                      title={`show only ${lvl}-level codes in the margin`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => setEvShowFullDoc((v) => !v)}
              className={`px-2 py-1 text-[11px] font-semibold rounded-md border ${
                evShowFullDoc
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-slate-300 text-slate-500 hover:bg-slate-100'
              }`}
              title={evShowFullDoc ? 'show only the quoted span' : 'show full doc with annotation highlighted'}
            >
              Full doc {evShowFullDoc ? 'on' : 'off'}
            </button>
            <button
              type="button"
              onClick={() => setEvShowNotes((v) => !v)}
              className={`px-2 py-1 text-[11px] font-semibold rounded-md border ${
                evShowNotes
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-300 text-slate-500 hover:bg-slate-100'
              }`}
            >
              Notes {evShowNotes ? 'on' : 'off'}
            </button>
            <button
              type="button"
              onClick={() => setEvShowMeta((v) => !v)}
              className={`px-2 py-1 text-[11px] font-semibold rounded-md border ${
                evShowMeta
                  ? 'border-blue-300 bg-blue-50 text-blue-800'
                  : 'border-slate-300 text-slate-500 hover:bg-slate-100'
              }`}
            >
              Metadata {evShowMeta ? 'on' : 'off'}
            </button>
            <button
              type="button"
              onClick={() => setAnnPickerOpen((v) => !v)}
              className="text-[11px] font-semibold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
            >
              {annPickerOpen ? 'Done' : '+ add annotation'}
            </button>
          </div>
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
        ) : evViewMode === 'doc' ? (
          <DocsView
            evidence={evidence}
            project={project}
            codeMargin={docCodeMargin}
            codeLevel={docCodeLevel}
          />
        ) : evViewMode === 'flat' ? (
          <ul className="space-y-3">
            {evidence.map(({ annotation: a, weight, source }) => (
              <li
                key={a.id}
                className="border border-slate-200 rounded-lg p-3 bg-white"
              >
                <EvidenceRow
                  annotation={a}
                  weight={weight}
                  source={source}
                  project={project}
                  themeId={theme.id}
                  onToggleWeight={() =>
                    onLinkAnnotation(theme.id, a.id, weight === 'core' ? 'supporting' : 'core')
                  }
                  onUnlink={
                    source === 'direct' ? () => onUnlinkAnnotation(theme.id, a.id) : undefined
                  }
                  onJump={() => onJumpToAnnotation(project.id, a.docId, a.id)}
                  showFullDoc={evShowFullDoc}
                  showNotes={evShowNotes}
                  showMeta={evShowMeta}
                  showCodePath
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-6">
            {evidenceByCode.map(([codeId, items]) => {
              const color = resolveColor(project.codes, codeId);
              const path = codePathString(project.codes, codeId);
              const coreFirst = [...items].sort((x, y) => {
                if (x.weight !== y.weight) return x.weight === 'core' ? -1 : 1;
                return 0;
              });
              return (
                <div key={codeId} className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                  <header
                    className="px-3 py-2 flex items-center gap-2 border-b border-slate-100 sticky top-0 bg-white z-10"
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
                      {items.filter((x) => x.weight === 'core').length} core ·{' '}
                      {items.length} total
                    </span>
                  </header>
                  <ol className="divide-y divide-slate-100">
                    {coreFirst.map(({ annotation: a, weight, source }) => (
                      <li key={a.id} className="px-3 py-2">
                        <EvidenceRow
                          annotation={a}
                          weight={weight}
                          source={source}
                          project={project}
                          themeId={theme.id}
                          onToggleWeight={() =>
                            onLinkAnnotation(theme.id, a.id, weight === 'core' ? 'supporting' : 'core')
                          }
                          onUnlink={
                            source === 'direct' ? () => onUnlinkAnnotation(theme.id, a.id) : undefined
                          }
                          onJump={() => onJumpToAnnotation(project.id, a.docId, a.id)}
                          showFullDoc={evShowFullDoc}
                          showNotes={evShowNotes}
                          showMeta={evShowMeta}
                        />
                      </li>
                    ))}
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

// Renders a single evidence row used by both flat and by-code modes.
function EvidenceRow({
  annotation: a,
  weight,
  source,
  project,
  themeId,
  onToggleWeight,
  onUnlink,
  onJump,
  showFullDoc,
  showNotes,
  showMeta,
  showCodePath = false,
}: {
  annotation: Annotation;
  weight: 'core' | 'supporting';
  source: 'direct' | 'auto';
  project: Project;
  themeId: string;
  onToggleWeight: () => void;
  onUnlink?: () => void;
  onJump: () => void;
  showFullDoc: boolean;
  showNotes: boolean;
  showMeta: boolean;
  showCodePath?: boolean;
}) {
  const doc = project.documents.find((d) => d.id === a.docId);
  const text = annText(a, doc?.text ?? '');
  const ranges = annRanges(a);
  const isCore = weight === 'core';
  const codeColor = resolveColor(project.codes, a.codeId);
  const codePath = codePathString(project.codes, a.codeId);
  return (
    <div className="group/ev">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <button
          type="button"
          onClick={onToggleWeight}
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
            title="auto-included via the code"
          >
            auto
          </span>
        )}
        {showCodePath && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 min-w-0">
            <span
              className="w-2 h-2 rounded-sm ring-1 ring-black/5 flex-shrink-0"
              style={{ background: codeColor }}
            />
            <span className="truncate">{codePath}</span>
          </span>
        )}
        <span className="text-[11px] text-slate-500 ml-auto truncate max-w-[300px]">
          {doc?.folder ? `${doc.folder} / ` : ''}
          {doc?.title}
        </span>
        <button
          type="button"
          onClick={onJump}
          className="text-[10px] text-slate-400 hover:text-blue-600 px-1"
          title="jump to the doc"
        >
          ↗
        </button>
        {onUnlink && (
          <button
            type="button"
            onClick={onUnlink}
            className="text-[12px] text-slate-400 hover:text-red-600 leading-none px-1 opacity-0 group-hover/ev:opacity-100"
            title="remove from theme"
          >
            ×
          </button>
        )}
      </div>
      {!showFullDoc ? (
        <blockquote
          className="text-[14px] text-slate-800 leading-relaxed border-l-2 border-slate-300 pl-3 whitespace-pre-wrap break-words"
          style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
        >
          {text}
        </blockquote>
      ) : (
        <HighlightedDocBlock
          docText={doc?.text ?? ''}
          ranges={ranges}
          color={codeColor}
        />
      )}
      {showNotes && a.note && (
        <div className="mt-1.5 text-[12px] text-amber-900 bg-amber-50 border-l-2 border-amber-300 pl-3 py-1 leading-snug whitespace-pre-wrap">
          {a.note}
        </div>
      )}
      {showMeta && doc && Object.keys(doc.metadata).length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500 font-mono">
          {Object.entries(doc.metadata)
            .filter(([_, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => (
              <span key={k}>
                <span className="text-slate-400">{k}:</span> {String(v)}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

// Full doc text with the annotation's range(s) highlighted in the code color.
function HighlightedDocBlock({
  docText,
  ranges,
  color,
}: {
  docText: string;
  ranges: { start: number; end: number }[];
  color: string;
}) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  const rgba = hexToRgba(color, 0.35);
  for (const r of sorted) {
    const s = Math.max(0, Math.min(docText.length, r.start));
    const e = Math.max(s, Math.min(docText.length, r.end));
    if (s > cursor) {
      pieces.push(<span key={key++}>{docText.slice(cursor, s)}</span>);
    }
    pieces.push(
      <mark
        key={key++}
        className="rounded-sm px-0.5"
        style={{
          backgroundColor: rgba,
          boxShadow: `inset 0 -2px 0 ${color}`,
          color: '#0f172a',
        }}
      >
        {docText.slice(s, e)}
      </mark>,
    );
    cursor = e;
  }
  if (cursor < docText.length) {
    pieces.push(<span key={key++}>{docText.slice(cursor)}</span>);
  }
  return (
    <blockquote
      className="text-[13px] text-slate-700 leading-relaxed border-l-2 border-slate-300 pl-3 whitespace-pre-wrap break-words max-h-[360px] overflow-y-auto"
      style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
    >
      {pieces}
    </blockquote>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type EvidenceItem = {
  annotation: Annotation;
  weight: 'core' | 'supporting';
  source: 'direct' | 'auto';
};

// Doc-grouped view of theme evidence. For each document with theme-linked
// annotations, render the full doc text with theme spans highlighted in
// place (adjacent ranges flow as one continuous block). An optional side
// margin lists every code that covers each highlighted block — including
// codes from OTHER annotations on the same doc that share the highlighted
// text. The level filter restricts margin codes to top-level / mid / leaves.
function DocsView({
  evidence,
  project,
  codeMargin,
  codeLevel,
}: {
  evidence: EvidenceItem[];
  project: Project;
  codeMargin: 'on' | 'off';
  codeLevel: 'all' | 'top' | 'mid' | 'leaf';
}) {
  // Group evidence by docId; only docs that actually exist.
  const docs = useMemo(() => {
    const byDoc = new Map<string, EvidenceItem[]>();
    for (const e of evidence) {
      const arr = byDoc.get(e.annotation.docId) ?? [];
      arr.push(e);
      byDoc.set(e.annotation.docId, arr);
    }
    return project.documents
      .filter((d) => byDoc.has(d.id))
      .map((d) => ({ doc: d, items: byDoc.get(d.id)! }))
      .sort((a, b) =>
        (a.doc.folder ?? '').localeCompare(b.doc.folder ?? '') ||
        a.doc.title.localeCompare(b.doc.title),
      );
  }, [evidence, project.documents]);

  // Cache for which codes are leaves (no child in project.codes references this id as parent).
  const codeLevelOf = useMemo(() => {
    const isParent = new Set<string>();
    for (const c of project.codes) {
      for (const pid of c.parentIds) isParent.add(pid);
    }
    return (codeId: string): 'top' | 'mid' | 'leaf' => {
      const c = project.codes.find((x) => x.id === codeId);
      if (!c) return 'leaf';
      const isTop = c.parentIds.length === 0;
      const isLeaf = !isParent.has(codeId);
      if (isTop && isLeaf) return 'top'; // singleton — treat as top
      if (isTop) return 'top';
      if (isLeaf) return 'leaf';
      return 'mid';
    };
  }, [project.codes]);

  const passLevel = (codeId: string) =>
    codeLevel === 'all' ? true : codeLevelOf(codeId) === codeLevel;

  return (
    <div className="space-y-6">
      {docs.map(({ doc, items }) => (
        <DocBlock
          key={doc.id}
          doc={doc}
          items={items}
          project={project}
          codeMargin={codeMargin}
          passLevel={passLevel}
        />
      ))}
    </div>
  );
}

// Render one doc: the full text with merged theme ranges highlighted, plus
// (optionally) a side margin with the codes that cover each highlighted band.
function DocBlock({
  doc,
  items,
  project,
  codeMargin,
  passLevel,
}: {
  doc: Project['documents'][number];
  items: EvidenceItem[];
  project: Project;
  codeMargin: 'on' | 'off';
  passLevel: (codeId: string) => boolean;
}) {
  // Step 1: merge all theme ranges into non-overlapping bands (adjacent ranges
  // become continuous so two annotations one after the other read as one).
  type Band = { start: number; end: number; items: EvidenceItem[] };
  const bands: Band[] = useMemo(() => {
    type R = { start: number; end: number; item: EvidenceItem };
    const flat: R[] = [];
    for (const it of items) {
      for (const r of it.annotation.ranges ?? []) {
        flat.push({ start: r.start, end: r.end, item: it });
      }
    }
    flat.sort((a, b) => a.start - b.start || a.end - b.end);
    const out: Band[] = [];
    for (const r of flat) {
      const last = out[out.length - 1];
      // Merge if overlapping OR touching (adjacent reads as one continuous span).
      if (last && r.start <= last.end) {
        last.end = Math.max(last.end, r.end);
        if (!last.items.includes(r.item)) last.items.push(r.item);
      } else {
        out.push({ start: r.start, end: r.end, items: [r.item] });
      }
    }
    return out;
  }, [items]);

  // Step 2: for each band, find every annotation (in the whole doc) whose
  // ranges overlap the band — that's the source for the side margin.
  // Theme-linked annotations are highlighted differently in the margin too.
  const themeAnnIds = useMemo(
    () => new Set(items.map((i) => i.annotation.id)),
    [items],
  );
  const allDocAnns = useMemo(
    () => project.annotations.filter((a) => a.docId === doc.id),
    [project.annotations, doc.id],
  );
  // For each band, collect every code that applies to it — including ancestor
  // codes of any directly-applied code. You typically annotate with leaves,
  // and a leaf implies its parent chain; filtering by 'top' / 'mid' should
  // surface those even though no annotation is literally on the parent.
  const codeById = useMemo(
    () => new Map(project.codes.map((c) => [c.id, c])),
    [project.codes],
  );
  const ancestorsOf = (codeId: string): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    const walk = (id: string) => {
      const c = codeById.get(id);
      if (!c) return;
      for (const pid of c.parentIds) {
        if (seen.has(pid)) continue;
        seen.add(pid);
        out.push(pid);
        walk(pid);
      }
    };
    walk(codeId);
    return out;
  };
  const bandMeta = bands.map((band) => {
    const codeSet = new Set<string>();
    const inThemeCodes = new Set<string>();
    for (const a of allDocAnns) {
      const overlaps = (a.ranges ?? []).some(
        (r) => r.start < band.end && r.end > band.start,
      );
      if (!overlaps) continue;
      const isThemeAnn = themeAnnIds.has(a.id);
      // Build the chain: the annotated code + every ancestor (multi-parent
      // safe). Then filter that chain by the level toggle.
      const chain = [a.codeId, ...ancestorsOf(a.codeId)];
      for (const cid of chain) {
        if (!passLevel(cid)) continue;
        codeSet.add(cid);
        if (isThemeAnn) inThemeCodes.add(cid);
      }
    }
    return { codes: [...codeSet], inTheme: inThemeCodes };
  });

  // Pick a representative color for each band (first theme item's code).
  const bandColors = bands.map(
    (b) => resolveColor(project.codes, b.items[0].annotation.codeId),
  );

  // Render the doc text split by band boundaries, with highlighted bands.
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  bands.forEach((band, i) => {
    if (band.start > cursor) {
      pieces.push(<span key={key++}>{doc.text.slice(cursor, band.start)}</span>);
    }
    const color = bandColors[i];
    pieces.push(
      <mark
        key={key++}
        className="rounded-sm px-0.5"
        style={{
          backgroundColor: hexToRgba(color, 0.32),
          boxShadow: `inset 0 -2px 0 ${color}`,
          color: '#0f172a',
        }}
        title={
          band.items.length > 1
            ? `${band.items.length} annotations merged`
            : undefined
        }
      >
        {doc.text.slice(band.start, band.end)}
      </mark>,
    );
    cursor = band.end;
  });
  if (cursor < doc.text.length) {
    pieces.push(<span key={key++}>{doc.text.slice(cursor)}</span>);
  }

  return (
    <article className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <header className="px-4 py-2 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
        <div className="text-[13px] font-bold text-slate-800">{doc.title}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          {doc.folder ? `${doc.folder} · ` : ''}
          {items.length} annotation{items.length === 1 ? '' : 's'} · {bands.length} highlight
          {bands.length === 1 ? '' : 's'}
        </div>
      </header>
      <div className="flex gap-4 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div
            className="text-[14px] text-slate-800 leading-relaxed whitespace-pre-wrap break-words"
            style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
          >
            {pieces}
          </div>
        </div>
        {codeMargin === 'on' && (
          <aside className="w-[200px] flex-shrink-0 border-l border-slate-100 pl-3 space-y-3">
            {bands.map((b, i) => {
              const meta = bandMeta[i];
              return (
                <div key={i} className="text-[10px]">
                  <div className="text-slate-400 font-mono mb-1">
                    {b.start}–{b.end}
                  </div>
                  {meta.codes.length === 0 ? (
                    <div className="italic text-slate-300">
                      (no codes at this level)
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {meta.codes.map((cid) => (
                        <span
                          key={cid}
                          className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] leading-snug ${
                            meta.inTheme.has(cid)
                              ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                          title={
                            meta.inTheme.has(cid)
                              ? 'linked to this theme via an annotation here'
                              : 'present on this text but not in the theme'
                          }
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
                            style={{
                              background: resolveColor(project.codes, cid),
                            }}
                          />
                          <span className="break-words">
                            {project.codes.find((c) => c.id === cid)?.name ?? cid}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </aside>
        )}
      </div>
    </article>
  );
}

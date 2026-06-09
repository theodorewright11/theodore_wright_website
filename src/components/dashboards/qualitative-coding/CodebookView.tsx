import { useEffect, useMemo, useRef, useState } from 'react';
import ColorPicker from './ColorPicker';
import {
  buildCodeTree,
  codePathString,
  descendantIds,
  flattenTree,
  meanAccuracyForCode,
  resolveColor,
  type CodeNode,
} from './compute';
import { emDash } from './storage';
import type { Annotation, Code, Project } from './types';

type DropPosition = 'before' | 'after' | 'inside';

type Props = {
  project: Project;
  variant?: 'page' | 'panel';
  showDefinitions: boolean;
  onToggleDefinitions: () => void;
  onAddCode: (parentId: string | null, name: string) => void;
  onUpdateCode: (codeId: string, patch: Partial<Code>) => void;
  onDeleteCode: (codeId: string) => void;
  onMoveCode: (
    codeId: string,
    sourceParentId: string | null,
    targetCodeId: string | null,
    position: DropPosition,
    additive?: boolean,
  ) => void;
  onAddParentLink?: (codeId: string, parentId: string) => void;
  onRemoveParentLink?: (codeId: string, parentId: string) => void;
  onSortAlphabetically?: () => void;
  collapsedCodeIds?: Set<string>;
  onToggleCodeCollapsed?: (codeId: string) => void;
  onToggleAllCollapsed?: () => void;
  onClose?: () => void; // for panel variant
};

export default function CodebookView({
  project,
  variant = 'page',
  showDefinitions,
  onToggleDefinitions,
  onAddCode,
  onUpdateCode,
  onDeleteCode,
  onMoveCode,
  onAddParentLink,
  onRemoveParentLink,
  onSortAlphabetically,
  collapsedCodeIds,
  onToggleCodeCollapsed,
  onToggleAllCollapsed,
  onClose,
}: Props) {
  // Custom pointer-based drag (not native HTML5), so the wheel keeps working
  // while the user is mid-drag. Chrome suppresses wheel events during native
  // HTML5 drag, which is the only way to keep mouse-wheel scrolling alive.
  type ActiveDrag = {
    codeId: string;
    sourceParentId: string | null; // which parent context the drag started from
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    active: boolean;
    altKey: boolean; // hold Alt/Ctrl while dragging to ADD a parent (keep old)
    overCodeId: string | null;
    overPathKey: string | null;
    overZone: DropPosition | null;
    overRoot: boolean;
  };
  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  const dragCodeId = drag?.active ? drag.codeId : null;
  const dropTarget =
    drag?.active && drag.overCodeId && drag.overPathKey && drag.overZone
      ? { codeId: drag.overCodeId, pathKey: drag.overPathKey, zone: drag.overZone }
      : null;
  const rootDragOver = !!drag?.active && drag.overRoot;
  const [addingRoot, setAddingRoot] = useState(false);
  const [draft, setDraft] = useState('');
  const [sortMode, setSortMode] = useState<'manual' | 'spec-desc' | 'acc-desc'>(
    'manual',
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  // When the user picks a sort mode, override each code's `order` so
  // siblings under any parent group come out in score order. Unrated codes
  // sink. buildCodeTree already sorts siblings by order ascending, then
  // by created_at as a tie-breaker.
  const orderedCodes = useMemo(() => {
    if (sortMode === 'manual') return project.codes;
    return project.codes.map((c) => {
      let key: number;
      if (sortMode === 'spec-desc') {
        key = c.specificity ? -c.specificity : 1000;
      } else {
        const a = meanAccuracyForCode(project.annotations, c.id);
        key = a ? -a.mean : 1000;
      }
      return { ...c, order: key };
    });
  }, [project.codes, project.annotations, sortMode]);
  const tree = buildCodeTree(orderedCodes);

  const startDrag = (
    codeId: string,
    sourceParentId: string | null,
    e: React.PointerEvent,
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDrag({
      codeId,
      sourceParentId,
      startX: e.clientX,
      startY: e.clientY,
      curX: e.clientX,
      curY: e.clientY,
      active: false,
      altKey: e.altKey || e.ctrlKey || e.metaKey,
      overCodeId: null,
      overPathKey: null,
      overZone: null,
      overRoot: false,
    });
  };

  // Drives the active drag: tracks cursor → finds the row under it → updates
  // drop target + auto-scrolls when near the edges of the scroll container.
  // pointerup commits the move.
  useEffect(() => {
    if (!drag) return;
    const scroller = scrollRef.current;
    const descendants = descendantIds(project.codes, drag.codeId);
    let dy = 0;
    let raf = 0;
    const step = () => {
      if (!scroller || dy === 0) {
        raf = 0;
        return;
      }
      scroller.scrollTop += dy;
      raf = requestAnimationFrame(step);
    };
    const updateAutoScroll = (clientY: number) => {
      if (!scroller) return;
      const rect = scroller.getBoundingClientRect();
      const edge = 70;
      const maxSpeed = 18;
      if (clientY < rect.top + edge && clientY > rect.top - 40) {
        const t = Math.min(1, Math.max(0, (rect.top + edge - clientY) / edge));
        dy = -Math.ceil(maxSpeed * t);
      } else if (clientY > rect.bottom - edge && clientY < rect.bottom + 40) {
        const t = Math.min(1, Math.max(0, (clientY - (rect.bottom - edge)) / edge));
        dy = Math.ceil(maxSpeed * t);
      } else {
        dy = 0;
      }
      if (dy !== 0 && raf === 0) raf = requestAnimationFrame(step);
    };
    const computeOver = (x: number, y: number) => {
      const empty = {
        overCodeId: null,
        overPathKey: null,
        overZone: null,
        overRoot: false,
      };
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      if (!el) return empty;
      if (el.closest('[data-codebook-root-zone]')) {
        return { ...empty, overRoot: true };
      }
      const li = el.closest('[data-codebook-code-id]') as HTMLElement | null;
      if (!li) return empty;
      const id = li.getAttribute('data-codebook-code-id');
      const pathKey = li.getAttribute('data-codebook-path');
      if (!id || !pathKey || id === drag.codeId || descendants.has(id)) {
        return empty;
      }
      const header = li.querySelector('[data-codebook-header]') as HTMLElement | null;
      const rect = (header ?? li).getBoundingClientRect();
      const h = rect.height || 1;
      const ry = Math.max(0, Math.min(h, y - rect.top));
      const zone: DropPosition = ry < h * 0.3 ? 'before' : ry > h * 0.7 ? 'after' : 'inside';
      return { overCodeId: id, overPathKey: pathKey, overZone: zone, overRoot: false };
    };
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.startX;
      const ddy = e.clientY - drag.startY;
      const active = drag.active || dx * dx + ddy * ddy > 16; // ~4px threshold
      const over = active
        ? computeOver(e.clientX, e.clientY)
        : { overCodeId: null, overZone: null, overRoot: false };
      if (active) updateAutoScroll(e.clientY);
      setDrag((d) =>
        d
          ? {
              ...d,
              curX: e.clientX,
              curY: e.clientY,
              active,
              altKey: e.altKey || e.ctrlKey || e.metaKey,
              ...over,
            }
          : null,
      );
    };
    const finish = () => {
      if (dy !== 0 || raf) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        dy = 0;
      }
      setDrag((d) => {
        if (!d) return null;
        if (d.active) {
          if (d.overCodeId && d.overZone) {
            onMoveCode(d.codeId, d.sourceParentId, d.overCodeId, d.overZone, d.altKey);
          } else if (d.overRoot) {
            onMoveCode(d.codeId, d.sourceParentId, null, 'inside', d.altKey);
          }
        }
        return null;
      });
    };
    const cancel = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      dy = 0;
      setDrag(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', onKey);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [drag?.codeId, drag?.startX, drag?.startY, onMoveCode, project.codes]);

  const draggedCode = drag ? project.codes.find((c) => c.id === drag.codeId) : null;

  const counts = new Map<string, number>();
  for (const a of project.annotations) {
    for (const id of descendantIds(project.codes, a.codeId)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const isPanel = variant === 'panel';

  return (
    <div
      ref={isPanel ? null : scrollRef}
      className={`${isPanel ? 'h-full flex flex-col bg-white' : 'flex-1 min-w-0 min-h-0 overflow-y-auto bg-white'}`}
    >
      <div
        className={
          isPanel
            ? 'px-4 py-2 border-b border-slate-200 flex items-center justify-between bg-white gap-2'
            : 'px-8 pt-3 pb-2 max-w-[820px] mx-auto border-b border-slate-200'
        }
      >
        <div className="flex-1 min-w-0">
          {!isPanel && (
            <h1
              className="font-bold text-[20px] text-slate-900 leading-tight"
              style={{ letterSpacing: '-0.015em' }}
            >
              Codebook · {project.name}
            </h1>
          )}
          {isPanel && (
            <div className="text-[12px] uppercase tracking-wider font-semibold text-slate-600">
              Codebook
            </div>
          )}
          {!isPanel && (
            <p className="text-[12px] text-slate-500">
              {project.codes.length} code{project.codes.length === 1 ? '' : 's'} ·{' '}
              {project.annotations.length} annotation
              {project.annotations.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onToggleAllCollapsed && project.codes.length > 1 && (() => {
            const anyCollapsed = !!collapsedCodeIds && collapsedCodeIds.size > 0;
            return (
              <button
                type="button"
                onClick={onToggleAllCollapsed}
                title={anyCollapsed ? 'expand every code' : 'collapse every parent code'}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {anyCollapsed ? 'Expand all' : 'Collapse all'}
              </button>
            );
          })()}
          {project.codes.length > 1 && (
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
              title="sort codes within each parent group"
              className="px-2 py-1.5 text-[12px] font-semibold rounded-md border border-slate-300 text-slate-600 bg-white hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
            >
              <option value="manual">Manual order</option>
              <option value="spec-desc">Sort by Specificity</option>
              <option value="acc-desc">Sort by mean Accuracy</option>
            </select>
          )}
          {onSortAlphabetically && project.codes.length > 1 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Sort all codes alphabetically? This rewrites the order at every level.')) {
                  onSortAlphabetically();
                }
              }}
              title="sort every level alphabetically"
              className="px-3 py-1.5 text-[12px] font-semibold rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Sort A→Z
            </button>
          )}
          <button
            type="button"
            onClick={onToggleDefinitions}
            title={showDefinitions ? 'Hide definitions while annotating' : 'Show definitions while annotating'}
            className={`px-3 py-1.5 text-[12px] font-semibold rounded-md transition-colors ${
              showDefinitions
                ? 'bg-blue-600 text-white shadow-sm'
                : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Definitions {showDefinitions ? 'on' : 'off'}
          </button>
          {isPanel && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-800 text-[18px] w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100"
              aria-label="close codebook"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div
        ref={isPanel ? scrollRef : null}
        className={
          isPanel
            ? 'flex-1 overflow-y-auto px-4 py-3'
            : 'px-8 pb-16 max-w-[820px] mx-auto'
        }
      >
        {(addingRoot || tree.length > 0) && (
          <div className={`mb-${isPanel ? '4' : '6'} pb-3 border-b border-slate-200`}>
            {addingRoot ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(emDash(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = draft.trim();
                      if (v) onAddCode(null, v);
                      setDraft('');
                      setAddingRoot(false);
                    }
                    if (e.key === 'Escape') {
                      setDraft('');
                      setAddingRoot(false);
                    }
                  }}
                  placeholder="New top-level code name"
                  className="flex-1 px-3 py-2 text-[14px] border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = draft.trim();
                    if (v) onAddCode(null, v);
                    setDraft('');
                    setAddingRoot(false);
                  }}
                  className="px-4 py-2 text-[13px] font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft('');
                    setAddingRoot(false);
                  }}
                  className="px-3 py-2 text-[13px] text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAddingRoot(true);
                  setDraft('');
                }}
                className="px-4 py-2 text-[13px] font-semibold text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                + New top-level code
              </button>
            )}
          </div>
        )}
        {tree.length === 0 ? (
          <EmptyState onAdd={() => setAddingRoot(true)} addingRoot={addingRoot} />
        ) : (
          <>
            <ul className="space-y-3">
              {tree.map((node) => (
                <CodebookRow
                  key={node.pathKey}
                  node={node}
                  codes={project.codes}
                  annotations={project.annotations}
                  counts={counts}
                  isPanel={isPanel}
                  dragCodeId={dragCodeId}
                  dropTarget={dropTarget}
                  startDrag={startDrag}
                  onAddCode={onAddCode}
                  onUpdateCode={onUpdateCode}
                  onAddParentLink={onAddParentLink}
                  onRemoveParentLink={onRemoveParentLink}
                  collapsedCodeIds={collapsedCodeIds}
                  onToggleCodeCollapsed={onToggleCodeCollapsed}
                  onDeleteCode={onDeleteCode}
                />
              ))}
            </ul>
            <div
              data-codebook-root-zone
              className={`mt-3 py-3 text-center text-[11px] italic rounded-md border-2 border-dashed transition-colors ${
                rootDragOver
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : dragCodeId
                    ? 'border-slate-300 text-slate-500'
                    : 'border-transparent text-transparent'
              }`}
            >
              Drop here to make a top-level code
            </div>
          </>
        )}
      </div>
      {drag?.active && draggedCode && (
        <div
          style={{
            position: 'fixed',
            left: drag.curX + 12,
            top: drag.curY + 12,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="bg-white border border-slate-300 rounded shadow-lg px-2 py-1 text-[12px] font-semibold text-slate-800 max-w-[280px] truncate"
        >
          <span
            className="inline-block w-2 h-2 rounded-sm mr-1.5 align-middle ring-1 ring-black/10"
            style={{ background: resolveColor(project.codes, draggedCode.id) }}
          />
          {draggedCode.name}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  onAdd,
  addingRoot,
}: {
  onAdd: () => void;
  addingRoot: boolean;
}) {
  if (addingRoot) return null;
  return (
    <div className="text-center py-12">
      <div className="text-[14px] font-semibold text-slate-700 mb-1">
        No codes yet
      </div>
      <p className="text-[13px] text-slate-500 mb-4">
        A codebook is your evolving list of codes — what each one means and when to apply it.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="px-4 py-2 text-[13px] font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        + Add first code
      </button>
    </div>
  );
}

function CodebookRow({
  node,
  codes,
  annotations,
  counts,
  isPanel,
  dragCodeId,
  dropTarget,
  startDrag,
  onAddCode,
  onUpdateCode,
  onAddParentLink,
  onRemoveParentLink,
  collapsedCodeIds,
  onToggleCodeCollapsed,
  onDeleteCode,
}: {
  node: CodeNode;
  codes: Code[];
  annotations: Annotation[];
  counts: Map<string, number>;
  isPanel: boolean;
  dragCodeId: string | null;
  dropTarget: { codeId: string; pathKey: string; zone: DropPosition } | null;
  startDrag: (codeId: string, sourceParentId: string | null, e: React.PointerEvent) => void;
  onAddCode: (parentId: string | null, name: string) => void;
  onUpdateCode: (codeId: string, patch: Partial<Code>) => void;
  onAddParentLink?: (codeId: string, parentId: string) => void;
  onRemoveParentLink?: (codeId: string, parentId: string) => void;
  collapsedCodeIds?: Set<string>;
  onToggleCodeCollapsed?: (codeId: string) => void;
  onDeleteCode: (codeId: string) => void;
}) {
  const { code, depth, children, parentId: instanceParentId, pathKey } = node;
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(code.name);
  const [draftDesc, setDraftDesc] = useState(code.description ?? '');
  const [adding, setAdding] = useState(false);
  const [draftChild, setDraftChild] = useState('');

  const color = resolveColor(codes, code.id);
  const count = counts.get(code.id) ?? 0;
  const isBeingDragged = dragCodeId === code.id;
  const dropZone = dropTarget?.pathKey === pathKey ? dropTarget.zone : null;

  const startEdit = () => {
    setDraftName(code.name);
    setDraftDesc(code.description ?? '');
    setEditing(true);
  };
  const saveEdit = () => {
    const patch: Partial<Code> = {};
    const newName = draftName.trim();
    if (newName && newName !== code.name) patch.name = newName;
    const newDesc = draftDesc.trim();
    if (newDesc !== (code.description ?? '')) {
      patch.description = newDesc || undefined;
    }
    if (Object.keys(patch).length > 0) onUpdateCode(code.id, patch);
    setEditing(false);
  };

  const HeadingTag = (depth === 0
    ? 'h2'
    : depth === 1
      ? 'h3'
      : 'h4') as keyof JSX.IntrinsicElements;
  const headingSize =
    depth === 0 ? (isPanel ? 'text-[18px]' : 'text-[22px]') : depth === 1 ? (isPanel ? 'text-[15px]' : 'text-[17px]') : isPanel ? 'text-[14px]' : 'text-[15px]';
  const indent = depth > 0 ? `pl-${Math.min(depth * 4, 12)}` : '';

  const dropClass =
    dropZone === 'before'
      ? 'border-t-2 border-t-blue-500'
      : dropZone === 'after'
        ? 'border-b-2 border-b-blue-500'
        : dropZone === 'inside'
          ? 'ring-2 ring-blue-400 bg-blue-50/40'
          : '';

  const parentCount = code.parentIds.length;
  const isShared = parentCount > 1;
  const hasChildren = children.length > 0;
  const isCollapsed = !!collapsedCodeIds?.has(code.id);

  return (
    <li
      data-codebook-code-id={code.id}
      data-codebook-instance-parent={instanceParentId ?? ''}
      data-codebook-path={pathKey}
      className={`group rounded-lg p-3 transition-colors ${
        depth === 0 ? 'border border-slate-200 bg-white' : ''
      } ${isBeingDragged ? 'opacity-40' : ''} ${dropClass}`}
      style={depth > 0 ? { marginLeft: `${depth * 16}px` } : undefined}
    >
      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(emDash(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            placeholder="Code name"
            rows={2}
            className="w-full px-3 py-2 text-[15px] font-semibold leading-snug border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
          />
          <textarea
            value={draftDesc}
            onChange={(e) => setDraftDesc(emDash(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            placeholder="Definition — when to apply this code…"
            rows={3}
            className="w-full px-3 py-2 text-[13px] border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
          />
          {(onAddParentLink || onRemoveParentLink) && (() => {
            const banned = descendantIds(codes, code.id);
            const flat = flattenTree(buildCodeTree(codes));
            // Dedupe by code id, then sort alphabetically — the parent picker
            // is name-search-friendly regardless of codebook drag order.
            const seen = new Set<string>();
            const addable = flat
              .filter((n) => {
                if (seen.has(n.code.id)) return false;
                seen.add(n.code.id);
                return !banned.has(n.code.id) && !code.parentIds.includes(n.code.id);
              })
              .sort((a, b) =>
                a.code.name.localeCompare(b.code.name, undefined, { sensitivity: 'base' }),
              );
            return (
              <div className="flex items-start gap-3 flex-wrap">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mt-1.5">
                  Parents
                </span>
                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
                  {code.parentIds.length === 0 && (
                    <span className="text-[11px] italic text-slate-400 py-1">
                      Top-level · no parents
                    </span>
                  )}
                  {code.parentIds.map((pid) => {
                    const parent = codes.find((c) => c.id === pid);
                    if (!parent) return null;
                    return (
                      <span
                        key={pid}
                        className="inline-flex items-center gap-1 max-w-full px-2 py-1 rounded-full bg-slate-100 text-[12px] text-slate-700"
                      >
                        <span className="min-w-0 break-words">{codePathString(codes, pid)}</span>
                        {onRemoveParentLink && (
                          <button
                            type="button"
                            onClick={() => onRemoveParentLink(code.id, pid)}
                            className="flex-shrink-0 text-slate-400 hover:text-red-600 text-[14px] leading-none"
                            title="remove this parent"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {onAddParentLink && addable.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        const pid = e.target.value;
                        if (pid) onAddParentLink(code.id, pid);
                      }}
                      className="max-w-full w-[150px] px-2 py-1 text-[12px] border border-slate-300 rounded bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    >
                      <option value="">+ add parent</option>
                      {addable.map((n) => (
                        <option key={n.code.id} value={n.code.id}>
                          {codePathString(codes, n.code.id)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            );
          })()}
          <div className="flex items-start gap-3 flex-wrap">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mt-0.5">
              Color
            </span>
            <div className="flex-1 min-w-0">
              <ColorPicker
                value={code.color}
                onChange={(c) => onUpdateCode(code.id, { color: c })}
                allowInherit={code.parentIds.length > 0}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-[13px] text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-md"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div data-codebook-header className="flex items-start gap-3">
            <span
              onPointerDown={(e) => startDrag(code.id, instanceParentId, e)}
              title="drag to move (Alt/Ctrl to add a parent)"
              className="flex-shrink-0 mt-1 cursor-grab text-slate-300 hover:text-slate-600 select-none text-[11px] leading-none px-0.5 opacity-0 group-hover:opacity-100 transition-opacity touch-none"
            >
              ⋮⋮
            </span>
            {hasChildren && onToggleCodeCollapsed ? (
              <button
                type="button"
                onClick={() => onToggleCodeCollapsed(code.id)}
                title={isCollapsed ? `show ${children.length} child code${children.length === 1 ? '' : 's'}` : 'hide child codes'}
                className="flex-shrink-0 mt-1 w-4 h-4 flex items-center justify-center text-[11px] text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                aria-label={isCollapsed ? 'expand children' : 'collapse children'}
              >
                {isCollapsed ? '▸' : '▾'}
              </button>
            ) : (
              <span className="flex-shrink-0 w-4" aria-hidden />
            )}
            <span
              className={`flex-shrink-0 rounded ring-1 ring-black/5 ${
                depth === 0 ? 'w-3.5 h-3.5 mt-1.5' : 'w-2.5 h-2.5 mt-1.5'
              }`}
              style={{ background: color }}
            />
            <div className="flex-1 min-w-0">
              <HeadingTag
                className={`${headingSize} font-bold text-slate-900 leading-tight m-0`}
                style={{ letterSpacing: depth === 0 ? '-0.015em' : '-0.01em' }}
              >
                {code.name}
              </HeadingTag>
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                {isShared && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-purple-700 bg-purple-100 rounded px-1.5 py-0.5"
                    title={`Same code, shown under ${parentCount} parents. Edit it once and all instances update.`}
                  >
                    <span>⤴</span>
                    shared · {parentCount}
                  </span>
                )}
                {code.specificity && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-100 rounded px-1.5 py-0.5"
                    title={`Specificity ${code.specificity}/5${code.specificityNotes ? ' — ' + code.specificityNotes : ''}`}
                  >
                    Spec {code.specificity}/5
                  </span>
                )}
                {(() => {
                  const acc = meanAccuracyForCode(annotations, code.id);
                  if (!acc) return null;
                  return (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-sky-800 bg-sky-100 rounded px-1.5 py-0.5"
                      title={`Mean accuracy across ${acc.count} rated annotation${acc.count === 1 ? '' : 's'}`}
                    >
                      Acc {acc.mean.toFixed(1)}/5 · {acc.count}
                    </span>
                  );
                })()}
              </div>
              {code.description && (
                <p className="text-[13px] text-slate-600 leading-snug mt-1.5 m-0">
                  {code.description}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {count > 0 && (
                <span className="text-[11px] font-mono text-slate-400 tabular-nums mr-1">
                  {count}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setAdding(true);
                  setDraftChild('');
                }}
                title="add child code"
                className="w-7 h-7 rounded text-[14px] text-slate-400 hover:text-blue-600 hover:bg-slate-100 flex items-center justify-center"
              >
                +
              </button>
              <button
                type="button"
                onClick={startEdit}
                title="edit"
                className="w-7 h-7 rounded text-[13px] text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete "${code.name}"${
                        children.length ? ' and all children' : ''
                      }? Annotations using it will be removed.`,
                    )
                  ) {
                    onDeleteCode(code.id);
                  }
                }}
                title="delete"
                className="w-7 h-7 rounded text-[14px] text-slate-400 hover:text-red-600 hover:bg-slate-100 flex items-center justify-center"
              >
                ×
              </button>
            </div>
          </div>
          {adding && (
            <div className="mt-3 pl-6 flex items-center gap-2">
              <input
                autoFocus
                value={draftChild}
                onChange={(e) => setDraftChild(emDash(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = draftChild.trim();
                    if (v) onAddCode(code.id, v);
                    setDraftChild('');
                    setAdding(false);
                  }
                  if (e.key === 'Escape') {
                    setDraftChild('');
                    setAdding(false);
                  }
                }}
                placeholder="Child code name"
                className="flex-1 px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>
          )}
        </>
      )}
      {hasChildren && isCollapsed && (
        <div className="mt-2 ml-9 text-[11px] italic text-slate-400">
          {children.length} child code{children.length === 1 ? '' : 's'} hidden
        </div>
      )}
      {hasChildren && !isCollapsed && (
        <ul className={`mt-3 space-y-3`}>
          {children.map((child) => (
            <CodebookRow
              key={child.pathKey}
              node={child}
              codes={codes}
              annotations={annotations}
              counts={counts}
              isPanel={isPanel}
              dragCodeId={dragCodeId}
              dropTarget={dropTarget}
              startDrag={startDrag}
              onAddCode={onAddCode}
              onUpdateCode={onUpdateCode}
              onAddParentLink={onAddParentLink}
              onRemoveParentLink={onRemoveParentLink}
              collapsedCodeIds={collapsedCodeIds}
              onToggleCodeCollapsed={onToggleCodeCollapsed}
              onDeleteCode={onDeleteCode}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

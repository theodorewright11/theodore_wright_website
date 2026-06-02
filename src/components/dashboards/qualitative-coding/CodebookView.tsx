import { useEffect, useRef, useState } from 'react';
import ColorPicker from './ColorPicker';
import { buildCodeTree, descendantIds, resolveColor, type CodeNode } from './compute';
import { emDash } from './storage';
import type { Code, Project } from './types';

type DropPosition = 'before' | 'after' | 'inside';

type Props = {
  project: Project;
  variant?: 'page' | 'panel';
  showDefinitions: boolean;
  onToggleDefinitions: () => void;
  onAddCode: (parentId: string | null, name: string) => void;
  onUpdateCode: (codeId: string, patch: Partial<Code>) => void;
  onDeleteCode: (codeId: string) => void;
  onMoveCode: (codeId: string, targetCodeId: string | null, position: DropPosition) => void;
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
  onClose,
}: Props) {
  // Custom pointer-based drag (not native HTML5), so the wheel keeps working
  // while the user is mid-drag. Chrome suppresses wheel events during native
  // HTML5 drag, which is the only way to keep mouse-wheel scrolling alive.
  type ActiveDrag = {
    codeId: string;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    active: boolean;
    overCodeId: string | null;
    overZone: DropPosition | null;
    overRoot: boolean;
  };
  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  const dragCodeId = drag?.active ? drag.codeId : null;
  const dropTarget =
    drag?.active && drag.overCodeId && drag.overZone
      ? { codeId: drag.overCodeId, zone: drag.overZone }
      : null;
  const rootDragOver = !!drag?.active && drag.overRoot;
  const tree = buildCodeTree(project.codes);
  const [addingRoot, setAddingRoot] = useState(false);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const startDrag = (codeId: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDrag({
      codeId,
      startX: e.clientX,
      startY: e.clientY,
      curX: e.clientX,
      curY: e.clientY,
      active: false,
      overCodeId: null,
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
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      if (!el) return { overCodeId: null, overZone: null, overRoot: false };
      if (el.closest('[data-codebook-root-zone]')) {
        return { overCodeId: null, overZone: null, overRoot: true };
      }
      const li = el.closest('[data-codebook-code-id]') as HTMLElement | null;
      if (!li) return { overCodeId: null, overZone: null, overRoot: false };
      const id = li.getAttribute('data-codebook-code-id');
      if (!id || id === drag.codeId || descendants.has(id)) {
        return { overCodeId: null, overZone: null, overRoot: false };
      }
      const header = li.querySelector('[data-codebook-header]') as HTMLElement | null;
      const rect = (header ?? li).getBoundingClientRect();
      const h = rect.height || 1;
      const ry = Math.max(0, Math.min(h, y - rect.top));
      const zone: DropPosition = ry < h * 0.3 ? 'before' : ry > h * 0.7 ? 'after' : 'inside';
      return { overCodeId: id, overZone: zone, overRoot: false };
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
            onMoveCode(d.codeId, d.overCodeId, d.overZone);
          } else if (d.overRoot) {
            onMoveCode(d.codeId, null, 'inside');
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
            ? 'px-4 py-3 border-b border-slate-200 flex items-start justify-between bg-white gap-2'
            : 'px-8 pt-8 pb-4 max-w-[820px] mx-auto'
        }
      >
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-blue-600 mb-1">
            Codebook
          </div>
          {!isPanel && (
            <h1
              className="font-bold text-[34px] text-slate-900 leading-tight mb-2"
              style={{ letterSpacing: '-0.025em' }}
            >
              {project.name}
            </h1>
          )}
          {!isPanel && (
            <p className="text-[14px] text-slate-500">
              {project.codes.length} code{project.codes.length === 1 ? '' : 's'} ·{' '}
              {project.annotations.length} annotation
              {project.annotations.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
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
        {tree.length === 0 ? (
          <EmptyState onAdd={() => setAddingRoot(true)} addingRoot={addingRoot} />
        ) : (
          <>
            <ul className="space-y-3">
              {tree.map((node) => (
                <CodebookRow
                  key={node.code.id}
                  node={node}
                  codes={project.codes}
                  counts={counts}
                  isPanel={isPanel}
                  dragCodeId={dragCodeId}
                  dropTarget={dropTarget}
                  startDrag={startDrag}
                  onAddCode={onAddCode}
                  onUpdateCode={onUpdateCode}
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

        {(addingRoot || tree.length > 0) && (
          <div className={`mt-${isPanel ? '4' : '8'} pt-4 border-t border-slate-200`}>
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
  counts,
  isPanel,
  dragCodeId,
  dropTarget,
  startDrag,
  onAddCode,
  onUpdateCode,
  onDeleteCode,
}: {
  node: CodeNode;
  codes: Code[];
  counts: Map<string, number>;
  isPanel: boolean;
  dragCodeId: string | null;
  dropTarget: { codeId: string; zone: DropPosition } | null;
  startDrag: (codeId: string, e: React.PointerEvent) => void;
  onAddCode: (parentId: string | null, name: string) => void;
  onUpdateCode: (codeId: string, patch: Partial<Code>) => void;
  onDeleteCode: (codeId: string) => void;
}) {
  const { code, depth, children } = node;
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(code.name);
  const [draftDesc, setDraftDesc] = useState(code.description ?? '');
  const [adding, setAdding] = useState(false);
  const [draftChild, setDraftChild] = useState('');

  const color = resolveColor(codes, code.id);
  const count = counts.get(code.id) ?? 0;
  const isBeingDragged = dragCodeId === code.id;
  const dropZone = dropTarget?.codeId === code.id ? dropTarget.zone : null;

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

  return (
    <li
      data-codebook-code-id={code.id}
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
          <div className="flex items-start gap-3 flex-wrap">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mt-0.5">
              Color
            </span>
            <div className="flex-1 min-w-0">
              <ColorPicker
                value={code.color}
                onChange={(c) => onUpdateCode(code.id, { color: c })}
                allowInherit={code.parentId !== null}
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
              onPointerDown={(e) => startDrag(code.id, e)}
              title="drag to reorder / reparent"
              className="flex-shrink-0 mt-1 cursor-grab text-slate-300 hover:text-slate-600 select-none text-[11px] leading-none px-0.5 opacity-0 group-hover:opacity-100 transition-opacity touch-none"
            >
              ⋮⋮
            </span>
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
      {children.length > 0 && (
        <ul className={`mt-3 space-y-3`}>
          {children.map((child) => (
            <CodebookRow
              key={child.code.id}
              node={child}
              codes={codes}
              counts={counts}
              isPanel={isPanel}
              dragCodeId={dragCodeId}
              dropTarget={dropTarget}
              startDrag={startDrag}
              onAddCode={onAddCode}
              onUpdateCode={onUpdateCode}
              onDeleteCode={onDeleteCode}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

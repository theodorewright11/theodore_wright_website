import { useState } from 'react';
import { buildCodeTree, descendantIds, resolveColor, type CodeNode } from './compute';
import { emDash } from './storage';
import { PALETTE, type Code, type Project } from './types';

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
  const [dragCodeId, setDragCodeId] = useState<string | null>(null);
  const [rootDragOver, setRootDragOver] = useState(false);
  const tree = buildCodeTree(project.codes);
  const [addingRoot, setAddingRoot] = useState(false);
  const [draft, setDraft] = useState('');

  const counts = new Map<string, number>();
  for (const a of project.annotations) {
    for (const id of descendantIds(project.codes, a.codeId)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const isPanel = variant === 'panel';

  return (
    <div className={`${isPanel ? 'h-full flex flex-col bg-white' : 'flex-1 min-w-0 min-h-0 overflow-y-auto bg-white'}`}>
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
                  setDragCodeId={setDragCodeId}
                  onAddCode={onAddCode}
                  onUpdateCode={onUpdateCode}
                  onDeleteCode={onDeleteCode}
                  onMoveCode={onMoveCode}
                />
              ))}
            </ul>
            <div
              onDragOver={(e) => {
                if (dragCodeId && e.dataTransfer.types.includes('application/x-qc-code')) {
                  e.preventDefault();
                  setRootDragOver(true);
                }
              }}
              onDragLeave={() => setRootDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                if (dragCodeId) onMoveCode(dragCodeId, null, 'inside');
                setDragCodeId(null);
                setRootDragOver(false);
              }}
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
  setDragCodeId,
  onAddCode,
  onUpdateCode,
  onDeleteCode,
  onMoveCode,
}: {
  node: CodeNode;
  codes: Code[];
  counts: Map<string, number>;
  isPanel: boolean;
  dragCodeId: string | null;
  setDragCodeId: (id: string | null) => void;
  onAddCode: (parentId: string | null, name: string) => void;
  onUpdateCode: (codeId: string, patch: Partial<Code>) => void;
  onDeleteCode: (codeId: string) => void;
  onMoveCode: (codeId: string, targetCodeId: string | null, position: DropPosition) => void;
}) {
  const { code, depth, children } = node;
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(code.name);
  const [draftDesc, setDraftDesc] = useState(code.description ?? '');
  const [adding, setAdding] = useState(false);
  const [draftChild, setDraftChild] = useState('');
  const [dropZone, setDropZone] = useState<DropPosition | null>(null);

  const color = resolveColor(codes, code.id);
  const count = counts.get(code.id) ?? 0;
  const isBeingDragged = dragCodeId === code.id;

  const handleDragOver = (e: React.DragEvent) => {
    if (!dragCodeId || dragCodeId === code.id) return;
    if (!e.dataTransfer.types.includes('application/x-qc-code')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    if (y < h * 0.25) setDropZone('before');
    else if (y > h * 0.75) setDropZone('after');
    else setDropZone('inside');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragCodeId && dropZone) {
      onMoveCode(dragCodeId, code.id, dropZone);
    }
    setDropZone(null);
    setDragCodeId(null);
  };

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
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-qc-code', code.id);
        e.dataTransfer.effectAllowed = 'move';
        setDragCodeId(code.id);
      }}
      onDragEnd={() => {
        setDragCodeId(null);
        setDropZone(null);
      }}
      onDragOver={handleDragOver}
      onDragLeave={(e) => {
        const rt = e.relatedTarget as Node | null;
        if (rt && (e.currentTarget as HTMLElement).contains(rt)) return;
        setDropZone(null);
      }}
      onDrop={handleDrop}
      className={`group rounded-lg p-3 transition-colors ${
        depth === 0 ? 'border border-slate-200 bg-white' : ''
      } ${isBeingDragged ? 'opacity-40' : ''} ${dropClass}`}
      style={depth > 0 ? { marginLeft: `${depth * 16}px` } : undefined}
    >
      {editing ? (
        <div className="space-y-2">
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(emDash(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) saveEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            placeholder="Code name"
            className="w-full px-3 py-2 text-[15px] font-semibold border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
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
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mr-1">
              Color
            </span>
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onUpdateCode(code.id, { color: c })}
                className={`w-5 h-5 rounded ring-1 transition-transform ${
                  code.color === c
                    ? 'ring-slate-700 scale-110'
                    : 'ring-black/10 hover:scale-110'
                }`}
                style={{ background: c }}
              />
            ))}
            {code.parentId !== null && (
              <button
                type="button"
                onClick={() => onUpdateCode(code.id, { color: null })}
                className={`text-[11px] px-1 hover:text-slate-800 ${
                  code.color === null
                    ? 'text-slate-800 font-semibold'
                    : 'text-slate-500'
                }`}
              >
                inherit
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
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
          <div className="flex items-start gap-3">
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
              setDragCodeId={setDragCodeId}
              onAddCode={onAddCode}
              onUpdateCode={onUpdateCode}
              onDeleteCode={onDeleteCode}
              onMoveCode={onMoveCode}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

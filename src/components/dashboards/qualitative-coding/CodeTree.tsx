import { useState } from 'react';
import { buildCodeTree, resolveColor, type CodeNode } from './compute';
import { PALETTE, type Code } from './types';

type Props = {
  codes: Code[];
  deepCounts: Map<string, number>;
  selectedCodeId: string | null;
  onSelectCode: (codeId: string | null) => void;
  onAddCode: (parentId: string | null, name: string) => void;
  onUpdateCode: (codeId: string, patch: Partial<Code>) => void;
  onDeleteCode: (codeId: string) => void;
};

export default function CodeTree({
  codes,
  deepCounts,
  selectedCodeId,
  onSelectCode,
  onAddCode,
  onUpdateCode,
  onDeleteCode,
}: Props) {
  const tree = buildCodeTree(codes);
  const [addingUnder, setAddingUnder] = useState<string | null | 'root'>(null);
  const [draft, setDraft] = useState('');

  const commitAdd = (parentId: string | null) => {
    const name = draft.trim();
    if (name) onAddCode(parentId, name);
    setDraft('');
    setAddingUnder(null);
  };

  return (
    <div className="text-[13px]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Codes
        </div>
        <button
          type="button"
          onClick={() => {
            setAddingUnder('root');
            setDraft('');
          }}
          className="text-[11px] font-medium text-slate-500 hover:text-blue-600 transition-colors"
        >
          + new
        </button>
      </div>
      {tree.length === 0 && addingUnder !== 'root' && (
        <div className="text-[12px] text-slate-400 italic py-2">No codes yet.</div>
      )}
      <ul className="space-y-px">
        {tree.map((node) => (
          <TreeRow
            key={node.code.id}
            node={node}
            codes={codes}
            deepCounts={deepCounts}
            selectedCodeId={selectedCodeId}
            onSelectCode={onSelectCode}
            onAddCode={onAddCode}
            onUpdateCode={onUpdateCode}
            onDeleteCode={onDeleteCode}
          />
        ))}
      </ul>
      {addingUnder === 'root' && (
        <div className="mt-2 flex items-center gap-2 pl-1">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAdd(null);
              if (e.key === 'Escape') {
                setDraft('');
                setAddingUnder(null);
              }
            }}
            placeholder="New code name"
            className="flex-1 px-2 py-1 text-[13px] border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => commitAdd(null)}
            className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
          >
            add
          </button>
        </div>
      )}
    </div>
  );
}

function TreeRow({
  node,
  codes,
  deepCounts,
  selectedCodeId,
  onSelectCode,
  onAddCode,
  onUpdateCode,
  onDeleteCode,
}: {
  node: CodeNode;
  codes: Code[];
  deepCounts: Map<string, number>;
  selectedCodeId: string | null;
  onSelectCode: (codeId: string | null) => void;
  onAddCode: (parentId: string | null, name: string) => void;
  onUpdateCode: (codeId: string, patch: Partial<Code>) => void;
  onDeleteCode: (codeId: string) => void;
}) {
  const { code, children, depth } = node;
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(code.name);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draftChild, setDraftChild] = useState('');

  const color = resolveColor(codes, code.id);
  const count = deepCounts.get(code.id) ?? 0;
  const selected = selectedCodeId === code.id;
  const hasChildren = children.length > 0;

  return (
    <li>
      <div
        className={`group flex items-center gap-1.5 rounded px-1.5 py-1 cursor-pointer transition-colors ${
          selected ? 'bg-blue-50' : 'hover:bg-slate-50'
        }`}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        onClick={() => onSelectCode(selected ? null : code.id)}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded((v) => !v);
          }}
          className={`w-3 flex-shrink-0 text-[10px] text-slate-400 hover:text-slate-700 ${
            hasChildren ? '' : 'invisible'
          }`}
          aria-label={expanded ? 'collapse' : 'expand'}
        >
          {expanded ? '▾' : '▸'}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen((v) => !v);
          }}
          className="w-3 h-3 rounded-[3px] flex-shrink-0 ring-1 ring-black/5"
          style={{ background: color }}
          aria-label="change color"
        />
        {editing ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => {
              const v = draftName.trim();
              if (v && v !== code.name) onUpdateCode(code.id, { name: v });
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = draftName.trim();
                if (v && v !== code.name) onUpdateCode(code.id, { name: v });
                setEditing(false);
              }
              if (e.key === 'Escape') {
                setDraftName(code.name);
                setEditing(false);
              }
            }}
            className="flex-1 min-w-0 px-1 py-0 text-[13px] border border-blue-500 rounded focus:outline-none"
          />
        ) : (
          <span
            className={`flex-1 min-w-0 truncate ${selected ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
              setDraftName(code.name);
            }}
          >
            {code.name}
          </span>
        )}
        {count > 0 && (
          <span className="text-[10px] font-mono text-slate-400 tabular-nums flex-shrink-0">
            {count}
          </span>
        )}
        <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
          <RowBtn
            onClick={(e) => {
              e.stopPropagation();
              setAdding(true);
              setDraftChild('');
              setExpanded(true);
            }}
            title="add child"
          >
            +
          </RowBtn>
          <RowBtn
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
              setDraftName(code.name);
            }}
            title="rename"
          >
            ✎
          </RowBtn>
          <RowBtn
            onClick={(e) => {
              e.stopPropagation();
              if (
                window.confirm(
                  `Delete "${code.name}"${hasChildren ? ' and all children' : ''}? Annotations using it will be removed.`,
                )
              ) {
                onDeleteCode(code.id);
              }
            }}
            title="delete"
          >
            ×
          </RowBtn>
        </div>
      </div>
      {pickerOpen && (
        <div
          className="ml-6 my-1 p-2 bg-white border border-slate-200 rounded shadow-sm inline-flex flex-wrap gap-1"
          style={{ marginLeft: `${depth * 14 + 28}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onUpdateCode(code.id, { color: c });
                setPickerOpen(false);
              }}
              className="w-5 h-5 rounded ring-1 ring-black/10 hover:scale-110 transition-transform"
              style={{ background: c }}
              aria-label={`color ${c}`}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              onUpdateCode(code.id, { color: null });
              setPickerOpen(false);
            }}
            className="text-[10px] text-slate-500 px-1 hover:text-slate-800"
          >
            inherit
          </button>
        </div>
      )}
      {adding && (
        <div
          className="flex items-center gap-2 my-1"
          style={{ paddingLeft: `${(depth + 1) * 14 + 24}px` }}
        >
          <input
            autoFocus
            value={draftChild}
            onChange={(e) => setDraftChild(e.target.value)}
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
            onBlur={() => {
              const v = draftChild.trim();
              if (v) onAddCode(code.id, v);
              setDraftChild('');
              setAdding(false);
            }}
            placeholder="Child code name"
            className="flex-1 px-2 py-1 text-[12px] border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
        </div>
      )}
      {expanded && hasChildren && (
        <ul className="space-y-px">
          {children.map((child) => (
            <TreeRow
              key={child.code.id}
              node={child}
              codes={codes}
              deepCounts={deepCounts}
              selectedCodeId={selectedCodeId}
              onSelectCode={onSelectCode}
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

function RowBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-5 h-5 rounded text-[11px] text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center"
    >
      {children}
    </button>
  );
}

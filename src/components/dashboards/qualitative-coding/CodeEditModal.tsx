import { useEffect, useState } from 'react';
import ColorPicker from './ColorPicker';
import { buildCodeTree, codePathString, descendantIds, flattenTree } from './compute';
import { emDash } from './storage';
import type { Code } from './types';

type Props = {
  code: Code;
  allCodes: Code[];
  onSave: (patch: Partial<Code>) => void;
  onAddParent?: (codeId: string, parentId: string) => void;
  onRemoveParent?: (codeId: string, parentId: string) => void;
  onClose: () => void;
};

// Compact modal for quickly editing a code (name, description, color) from
// anywhere that surfaces codes — e.g. the line-view margin chips and the
// annotations panel rows. For parent / reorder, use the full Codebook view.
export default function CodeEditModal({
  code,
  allCodes,
  onSave,
  onAddParent,
  onRemoveParent,
  onClose,
}: Props) {
  const [name, setName] = useState(code.name);
  const [description, setDescription] = useState(code.description ?? '');
  const [color, setColor] = useState<string | null>(code.color);

  useEffect(() => {
    setName(code.name);
    setDescription(code.description ?? '');
    setColor(code.color);
  }, [code.id]);

  const isDirty =
    name.trim() !== code.name ||
    description !== (code.description ?? '') ||
    color !== code.color;

  const save = () => {
    const patch: Partial<Code> = {};
    const v = name.trim();
    if (v && v !== code.name) patch.name = v;
    if (description !== (code.description ?? '')) {
      patch.description = description.trim() || undefined;
    }
    if (color !== code.color) patch.color = color;
    if (Object.keys(patch).length > 0) onSave(patch);
    onClose();
  };

  const tryClose = () => {
    if (isDirty && !window.confirm('Discard unsaved changes to this code?')) return;
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-24 px-4"
      onClick={tryClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-[520px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-500">
              Edit code
            </div>
            <div className="text-[13px] text-slate-500 font-mono">{code.id.slice(0, 8)}</div>
          </div>
          <button
            type="button"
            onClick={tryClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            aria-label="close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
              Name
            </label>
            <textarea
              autoFocus
              value={name}
              onChange={(e) => setName(emDash(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
                if (e.key === 'Escape') tryClose();
              }}
              placeholder="Code name"
              rows={2}
              className="w-full px-3 py-2 text-[15px] font-semibold leading-snug border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
              Definition
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(emDash(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
                if (e.key === 'Escape') tryClose();
              }}
              placeholder="When to apply this code…"
              rows={4}
              className="w-full px-3 py-2 text-[13px] border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
            />
          </div>
          {(onAddParent || onRemoveParent) && (() => {
            const banned = descendantIds(allCodes, code.id);
            const tree = buildCodeTree(allCodes);
            const flat = flattenTree(tree);
            // Dedupe by code id (a multi-parent code appears multiple times in
            // flat), then sort alphabetically by name for an intuitive parent
            // picker that doesn't depend on the codebook's manual order.
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
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
                  Parents
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {code.parentIds.length === 0 && (
                    <span className="text-[11px] italic text-slate-400 py-1">
                      Top-level code · no parents
                    </span>
                  )}
                  {code.parentIds.map((pid) => {
                    const parent = allCodes.find((c) => c.id === pid);
                    if (!parent) return null;
                    return (
                      <span
                        key={pid}
                        className="inline-flex items-center gap-1 max-w-full px-2 py-1 rounded-full bg-slate-100 text-[12px] text-slate-700"
                      >
                        <span className="min-w-0 break-words">{codePathString(allCodes, pid)}</span>
                        {onRemoveParent && (
                          <button
                            type="button"
                            onClick={() => onRemoveParent(code.id, pid)}
                            className="flex-shrink-0 text-slate-400 hover:text-red-600 text-[14px] leading-none"
                            title="remove this parent"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
                {onAddParent && addable.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 max-w-full">
                    <span className="flex-shrink-0 text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                      Add
                    </span>
                    <select
                      value=""
                      onChange={(e) => {
                        const pid = e.target.value;
                        if (pid) onAddParent(code.id, pid);
                      }}
                      className="flex-1 min-w-0 max-w-full px-2 py-1 text-[12px] border border-slate-300 rounded bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    >
                      <option value="">— pick a parent —</option>
                      {addable.map((n) => (
                        <option key={n.code.id} value={n.code.id}>
                          {codePathString(allCodes, n.code.id)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })()}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
              Color
            </label>
            <ColorPicker
              value={color}
              onChange={setColor}
              allowInherit={code.parentIds.length > 0}
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={tryClose}
            className="px-3 py-2 text-[13px] font-medium text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="px-5 py-2 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            {isDirty ? 'Save' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

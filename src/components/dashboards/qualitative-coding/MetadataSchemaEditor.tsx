import { useEffect, useState } from 'react';
import { emDash } from './storage';
import type { MetadataField, MetadataFieldType } from './types';

type Props = {
  schema: MetadataField[];
  onChange: (next: MetadataField[]) => void;
  onClose: () => void;
};

const TYPES: { value: MetadataFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'enum', label: 'Options' },
];

export default function MetadataSchemaEditor({ schema, onChange, onClose }: Props) {
  const [draft, setDraft] = useState<MetadataField[]>(() => deepClone(schema));
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<MetadataFieldType>('text');
  const [dragFieldKey, setDragFieldKey] = useState<string | null>(null);
  const [dragOption, setDragOption] = useState<{ fieldKey: string; idx: number } | null>(null);

  useEffect(() => {
    setDraft(deepClone(schema));
  }, [schema]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(schema);

  const save = () => {
    onChange(draft);
    onClose();
  };

  const handleClose = () => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
    }
    onClose();
  };

  const addField = () => {
    const label = newLabel.trim();
    if (!label) return;
    const key = slug(label);
    if (draft.some((f) => f.key === key)) return;
    setDraft([
      ...draft,
      { key, label, type: newType, options: newType === 'enum' ? [] : undefined },
    ]);
    setNewLabel('');
  };

  const updateField = (key: string, patch: Partial<MetadataField>) => {
    setDraft(draft.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  };

  const deleteField = (key: string) => {
    setDraft(draft.filter((f) => f.key !== key));
  };

  const reorderFields = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    const fromIdx = draft.findIndex((f) => f.key === fromKey);
    const toIdx = draft.findIndex((f) => f.key === toKey);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...draft];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setDraft(next);
  };

  const updateOption = (fieldKey: string, idx: number, value: string) => {
    const f = draft.find((x) => x.key === fieldKey);
    if (!f) return;
    const opts = [...(f.options ?? [])];
    opts[idx] = value;
    updateField(fieldKey, { options: opts });
  };

  const addOption = (fieldKey: string) => {
    const f = draft.find((x) => x.key === fieldKey);
    if (!f) return;
    updateField(fieldKey, { options: [...(f.options ?? []), ''] });
  };

  const removeOption = (fieldKey: string, idx: number) => {
    const f = draft.find((x) => x.key === fieldKey);
    if (!f) return;
    const opts = (f.options ?? []).filter((_, i) => i !== idx);
    updateField(fieldKey, { options: opts });
  };

  const reorderOption = (fieldKey: string, from: number, to: number) => {
    if (from === to) return;
    const f = draft.find((x) => x.key === fieldKey);
    if (!f) return;
    const opts = [...(f.options ?? [])];
    const [moved] = opts.splice(from, 1);
    opts.splice(to, 0, moved);
    updateField(fieldKey, { options: opts });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-16 px-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-[620px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-500">
              Project schema
            </div>
            <div className="text-[18px] font-bold text-slate-900">
              Document metadata fields
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            aria-label="close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          {draft.length === 0 ? (
            <div className="text-[13px] text-slate-400 italic py-2">
              No fields yet. Add one below (e.g. <em>Date</em>, <em>Gender</em>, <em>Source</em>).
            </div>
          ) : (
            <ul className="space-y-2.5">
              {draft.map((f) => (
                <li
                  key={f.key}
                  draggable
                  onDragStart={(e) => {
                    setDragFieldKey(f.key);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    if (dragFieldKey && dragFieldKey !== f.key) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragFieldKey) reorderFields(dragFieldKey, f.key);
                    setDragFieldKey(null);
                  }}
                  onDragEnd={() => setDragFieldKey(null)}
                  className={`p-3 rounded-lg border bg-slate-50 transition-colors ${
                    dragFieldKey === f.key
                      ? 'opacity-50 border-blue-400'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="cursor-grab text-slate-400 text-[14px] select-none"
                      title="drag to reorder"
                    >
                      ⋮⋮
                    </span>
                    <input
                      value={f.label}
                      onChange={(e) => updateField(f.key, { label: emDash(e.target.value) })}
                      className="flex-1 px-2.5 py-1.5 text-[14px] font-medium text-slate-800 border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    />
                    <select
                      value={f.type}
                      onChange={(e) =>
                        updateField(f.key, {
                          type: e.target.value as MetadataFieldType,
                          options:
                            e.target.value === 'enum' ? f.options ?? [] : undefined,
                        })
                      }
                      className="px-2.5 py-1.5 text-[13px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    >
                      {TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete field "${f.label}"? Existing values on documents will remain in their JSON until cleared.`,
                          )
                        ) {
                          deleteField(f.key);
                        }
                      }}
                      className="text-slate-400 hover:text-red-600 text-[18px] w-8 h-8 flex items-center justify-center rounded hover:bg-white"
                      title="delete"
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-1 ml-7 text-[10px] font-mono text-slate-400">
                    key: {f.key}
                  </div>
                  {f.type === 'enum' && (
                    <div className="mt-2.5 ml-7">
                      <div className="text-[11px] font-medium text-slate-500 mb-1.5">
                        Options{' '}
                        <span className="text-slate-400 font-normal">(drag to reorder)</span>
                      </div>
                      <ul className="space-y-1.5">
                        {(f.options ?? []).map((opt, oi) => (
                          <li
                            key={oi}
                            draggable
                            onDragStart={(e) => {
                              setDragOption({ fieldKey: f.key, idx: oi });
                              e.dataTransfer.effectAllowed = 'move';
                              e.stopPropagation();
                            }}
                            onDragOver={(e) => {
                              if (
                                dragOption &&
                                dragOption.fieldKey === f.key &&
                                dragOption.idx !== oi
                              ) {
                                e.preventDefault();
                                e.stopPropagation();
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (dragOption && dragOption.fieldKey === f.key) {
                                reorderOption(f.key, dragOption.idx, oi);
                              }
                              setDragOption(null);
                            }}
                            onDragEnd={() => setDragOption(null)}
                            className={`flex items-center gap-2 ${
                              dragOption &&
                              dragOption.fieldKey === f.key &&
                              dragOption.idx === oi
                                ? 'opacity-50'
                                : ''
                            }`}
                          >
                            <span
                              className="cursor-grab text-slate-400 text-[12px] select-none"
                              title="drag to reorder"
                            >
                              ⋮⋮
                            </span>
                            <input
                              value={opt}
                              onChange={(e) => updateOption(f.key, oi, emDash(e.target.value))}
                              placeholder={`Option ${oi + 1}`}
                              className="flex-1 px-2.5 py-1.5 text-[13px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => removeOption(f.key, oi)}
                              className="text-slate-400 hover:text-red-600 text-[16px] w-7 h-7 flex items-center justify-center rounded hover:bg-white"
                              title="remove"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => addOption(f.key)}
                        className="mt-1.5 text-[12px] font-medium text-blue-600 hover:text-blue-800 px-1 py-1"
                      >
                        + Add option
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
          <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-500 mb-2">
            Add field
          </div>
          <div className="flex items-center gap-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(emDash(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addField();
              }}
              placeholder="Field label, e.g. Gender"
              className="flex-1 px-3 py-2 text-[14px] border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as MetadataFieldType)}
              className="px-3 py-2 text-[13px] border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addField}
              disabled={!newLabel.trim()}
              className="px-4 py-2 text-[13px] font-semibold bg-slate-700 text-white rounded-md hover:bg-slate-900 disabled:bg-slate-300 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-2 text-[13px] font-medium text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!isDirty}
            className="px-5 py-2 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 rounded-md transition-colors"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

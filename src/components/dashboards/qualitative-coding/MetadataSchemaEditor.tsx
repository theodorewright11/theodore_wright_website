import { useState } from 'react';
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
  const [draftLabel, setDraftLabel] = useState('');
  const [draftType, setDraftType] = useState<MetadataFieldType>('text');

  const addField = () => {
    const label = draftLabel.trim();
    if (!label) return;
    const key = slug(label);
    if (schema.some((f) => f.key === key)) return;
    onChange([
      ...schema,
      { key, label, type: draftType, options: draftType === 'enum' ? [] : undefined },
    ]);
    setDraftLabel('');
  };

  const updateField = (key: string, patch: Partial<MetadataField>) => {
    onChange(schema.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  };

  const deleteField = (key: string) => {
    onChange(schema.filter((f) => f.key !== key));
  };

  const moveField = (key: string, direction: -1 | 1) => {
    const idx = schema.findIndex((f) => f.key === key);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= schema.length) return;
    const next = [...schema];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const updateOption = (key: string, idx: number, value: string) => {
    const f = schema.find((x) => x.key === key);
    if (!f) return;
    const opts = [...(f.options ?? [])];
    opts[idx] = value;
    updateField(key, { options: opts });
  };

  const addOption = (key: string) => {
    const f = schema.find((x) => x.key === key);
    if (!f) return;
    updateField(key, { options: [...(f.options ?? []), ''] });
  };

  const removeOption = (key: string, idx: number) => {
    const f = schema.find((x) => x.key === key);
    if (!f) return;
    const opts = (f.options ?? []).filter((_, i) => i !== idx);
    updateField(key, { options: opts });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-16 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-[600px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-500">
              Project schema
            </div>
            <div className="text-[18px] font-bold text-slate-900">Document metadata fields</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            aria-label="close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          {schema.length === 0 ? (
            <div className="text-[13px] text-slate-400 italic py-2">
              No fields yet. Add one below (e.g. <em>Date</em>, <em>Gender</em>, <em>Source</em>).
            </div>
          ) : (
            <ul className="space-y-2.5">
              {schema.map((f, idx) => (
                <li
                  key={f.key}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col -ml-1">
                      <button
                        type="button"
                        onClick={() => moveField(f.key, -1)}
                        disabled={idx === 0}
                        className="w-5 h-4 text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400 flex items-center justify-center"
                        title="move up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(f.key, 1)}
                        disabled={idx === schema.length - 1}
                        className="w-5 h-4 text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400 flex items-center justify-center"
                        title="move down"
                      >
                        ▼
                      </button>
                    </div>
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
                        Options
                      </div>
                      <ul className="space-y-1.5">
                        {(f.options ?? []).map((opt, oi) => (
                          <li key={oi} className="flex items-center gap-2">
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

        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50">
          <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-500 mb-2">
            Add field
          </div>
          <div className="flex items-center gap-2">
            <input
              value={draftLabel}
              onChange={(e) => setDraftLabel(emDash(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addField();
              }}
              placeholder="Field label, e.g. Gender"
              className="flex-1 px-3 py-2 text-[14px] border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as MetadataFieldType)}
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
              disabled={!draftLabel.trim()}
              className="px-4 py-2 text-[13px] font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

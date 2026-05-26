import { useState } from 'react';
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-[560px] max-h-[80vh] flex flex-col overflow-hidden"
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
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
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
            <ul className="space-y-2">
              {schema.map((f) => (
                <li
                  key={f.key}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={f.label}
                      onChange={(e) =>
                        updateField(f.key, { label: e.target.value })
                      }
                      className="flex-1 px-2 py-1 text-[14px] font-medium text-slate-800 border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
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
                      className="px-2 py-1 text-[13px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
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
                      className="text-slate-400 hover:text-red-600 text-[16px] w-7 h-7 flex items-center justify-center rounded hover:bg-white"
                      title="delete"
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-slate-400">
                    key: {f.key}
                  </div>
                  {f.type === 'enum' && (
                    <div className="mt-2">
                      <div className="text-[11px] text-slate-500 mb-1">
                        Options (comma-separated)
                      </div>
                      <input
                        value={(f.options ?? []).join(', ')}
                        onChange={(e) =>
                          updateField(f.key, {
                            options: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="e.g. Male, Female, Nonbinary, Prefer not to say"
                        className="w-full px-2 py-1 text-[13px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      />
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
              onChange={(e) => setDraftLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addField();
              }}
              placeholder="Field label, e.g. Gender"
              className="flex-1 px-3 py-2 text-[14px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as MetadataFieldType)}
              className="px-2 py-2 text-[13px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
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
              className="px-3 py-2 text-[13px] font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
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

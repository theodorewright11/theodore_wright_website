import { useMemo, useRef, useState } from 'react';
import { Chip, isFullyRated, meanScore } from './shared';
import { readFileAsText } from './storage';
import type { AppState, Corpus, Run } from './types';
import { CONDITION_SUGGESTIONS } from './types';

type Props = {
  state: AppState;
  onAddCorpus: (name: string, csvText: string) => { docCount: number; warnings: string[] };
  onDeleteCorpus: (id: string) => void;
  onRenameCorpus: (id: string, name: string) => void;
  onCreateRun: (
    meta: Omit<Run, 'id' | 'themes' | 'created_at' | 'updated_at' | 'additionalText'>,
    themesJson: string,
  ) => { themeCount: number; anchoredQuotes: number; totalQuotes: number; warnings: string[] };
  onDeleteRun: (id: string) => void;
  onUpdateRunMeta: (id: string, patch: Partial<Run>) => void;
  onOpenRun: (id: string) => void;
};

export default function RunsView({
  state,
  onAddCorpus,
  onDeleteCorpus,
  onRenameCorpus,
  onCreateRun,
  onDeleteRun,
  onUpdateRunMeta,
  onOpenRun,
}: Props) {
  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-white">
      <div className="max-w-[1000px] mx-auto px-6 py-5 space-y-8">
        <CorpusSection
          corpora={state.corpora}
          runs={state.runs}
          onAdd={onAddCorpus}
          onDelete={onDeleteCorpus}
          onRename={onRenameCorpus}
        />
        <NewRunSection state={state} onCreateRun={onCreateRun} />
        <RunListSection
          state={state}
          onDeleteRun={onDeleteRun}
          onUpdateRunMeta={onUpdateRunMeta}
          onOpenRun={onOpenRun}
        />
      </div>
    </div>
  );
}

// --- Corpus ------------------------------------------------------------------

function CorpusSection({
  corpora,
  runs,
  onAdd,
  onDelete,
  onRename,
}: {
  corpora: Corpus[];
  runs: Run[];
  onAdd: Props['onAddCorpus'];
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    const text = await readFileAsText(file);
    const name = file.name.replace(/\.csv$/i, '');
    const { docCount, warnings } = onAdd(name, text);
    setReport(
      `${name}: ${docCount} document${docCount === 1 ? '' : 's'} loaded.` +
        (warnings.length > 0 ? ` ${warnings.join(' ')}` : ''),
    );
  };

  return (
    <section>
      <div className="flex items-center gap-3 mb-2">
        <h2 className="font-bold text-[16px] text-slate-900">Data</h2>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="px-3 py-1 text-[12px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
        >
          Upload CSV
        </button>
        <span className="text-[11px] text-slate-400">
          columns: <code className="bg-slate-100 px-1 rounded">id</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">text</code> — row order sets the D-numbers
        </span>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
      </div>
      {report && (
        <div className="mb-2 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5">
          {report}
        </div>
      )}
      {corpora.length === 0 ? (
        <div className="text-[13px] text-slate-400 italic border border-dashed border-slate-200 rounded-lg p-6 text-center">
          No data uploaded yet. Upload a CSV with an <code>id</code> column and a <code>text</code>{' '}
          column — each row becomes a document (D1, D2, …) that theme quotes anchor against.
        </div>
      ) : (
        <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
          {corpora.map((c) => {
            const usedBy = runs.filter((r) => r.corpusId === c.id).length;
            return (
              <li key={c.id} className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <input
                    value={c.name}
                    onChange={(e) => onRename(c.id, e.target.value)}
                    className="text-[13px] font-semibold text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-300 rounded px-1.5 py-0.5 outline-none min-w-0 flex-1"
                  />
                  <span className="text-[11px] text-slate-500 font-mono flex-shrink-0">
                    {c.docs.length} docs · used by {usedBy} run{usedBy === 1 ? '' : 's'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewId(previewId === c.id ? null : c.id)}
                    className="text-[11px] text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-100 flex-shrink-0"
                  >
                    {previewId === c.id ? 'hide' : 'preview'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (usedBy > 0) {
                        if (
                          !window.confirm(
                            `${usedBy} run(s) reference this data. Delete anyway? (Runs keep their quotes but lose anchoring.)`,
                          )
                        )
                          return;
                      } else if (!window.confirm(`Delete "${c.name}"?`)) return;
                      onDeleteCorpus_(c.id);
                    }}
                    className="text-[11px] text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 flex-shrink-0"
                  >
                    delete
                  </button>
                </div>
                {previewId === c.id && (
                  <ul className="mt-2 max-h-[240px] overflow-y-auto border border-slate-100 rounded bg-slate-50/60 divide-y divide-slate-100">
                    {c.docs.slice(0, 200).map((d, i) => (
                      <li key={i} className="px-2.5 py-1.5 text-[12px] text-slate-600 flex gap-2">
                        <span className="font-mono text-[10px] text-slate-400 flex-shrink-0 pt-0.5">
                          D{i + 1}
                          {d.extId ? ` (${d.extId})` : ''}
                        </span>
                        <span className="break-words leading-snug">
                          {d.text.length > 220 ? d.text.slice(0, 220) + '…' : d.text}
                        </span>
                      </li>
                    ))}
                    {c.docs.length > 200 && (
                      <li className="px-2.5 py-1.5 text-[11px] text-slate-400 italic">
                        … {c.docs.length - 200} more
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  function onDeleteCorpus_(id: string) {
    onDelete(id);
    if (previewId === id) setPreviewId(null);
  }
}

// --- New run -------------------------------------------------------------------

function distinct(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v && v.trim().length > 0))];
}

function NewRunSection({
  state,
  onCreateRun,
}: {
  state: AppState;
  onCreateRun: Props['onCreateRun'];
}) {
  const [open, setOpen] = useState(false);
  const [corpusId, setCorpusId] = useState<string>('');
  const [model, setModel] = useState('');
  const [positionality, setPositionality] = useState('');
  const [researchQuestion, setResearchQuestion] = useState('');
  const [condition, setCondition] = useState('');
  const [repeat, setRepeat] = useState('');
  const [notes, setNotes] = useState('');
  const [json, setJson] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);

  const models = distinct(state.runs.map((r) => r.model));
  const positionalities = distinct(state.runs.map((r) => r.positionality));
  const rqs = distinct(state.runs.map((r) => r.researchQuestion));
  const conditions = distinct([
    ...state.runs.map((r) => r.condition),
    ...CONDITION_SUGGESTIONS,
  ]);

  const effectiveCorpusId = corpusId || state.corpora[0]?.id || '';

  const create = () => {
    setError(null);
    setResult(null);
    if (!json.trim()) {
      setError('Paste or upload the AI themes JSON first.');
      return;
    }
    try {
      const r = onCreateRun(
        {
          corpusId: effectiveCorpusId || null,
          model: model.trim(),
          positionality: positionality.trim(),
          researchQuestion: researchQuestion.trim(),
          condition: condition.trim(),
          repeat: repeat.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        json,
      );
      setResult(
        `Run created: ${r.themeCount} themes, ${r.anchoredQuotes}/${r.totalQuotes} quotes anchored.` +
          (r.warnings.length > 0 ? ` ${r.warnings.join(' ')}` : ''),
      );
      setJson('');
      setRepeat('');
      setNotes('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section>
      <div className="flex items-center gap-3 mb-2">
        <h2 className="font-bold text-[16px] text-slate-900">New run</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-1 text-[12px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
        >
          {open ? 'close' : '+ add run'}
        </button>
      </div>
      {open && (
        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Model">
              <input
                list="tg-models"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Claude, GPT"
                className={inputCls}
              />
              <datalist id="tg-models">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="Positionality">
              <input
                list="tg-positionalities"
                value={positionality}
                onChange={(e) => setPositionality(e.target.value)}
                placeholder="e.g. Neutral, Patient, FDA worker, Researcher"
                className={inputCls}
              />
              <datalist id="tg-positionalities">
                {positionalities.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="Research question">
              <input
                list="tg-rqs"
                value={researchQuestion}
                onChange={(e) => setResearchQuestion(e.target.value)}
                placeholder="the RQ this run was prompted with"
                className={inputCls}
              />
              <datalist id="tg-rqs">
                {rqs.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="Condition">
              <input
                list="tg-conditions"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="e.g. with-data engineered"
                className={inputCls}
              />
              <datalist id="tg-conditions">
                {conditions.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="Data">
              <select
                value={effectiveCorpusId}
                onChange={(e) => setCorpusId(e.target.value)}
                className={inputCls}
              >
                {state.corpora.length === 0 && <option value="">— none uploaded —</option>}
                {state.corpora.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.docs.length} docs)
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Repeat #">
                <input
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  placeholder="optional"
                  className={inputCls}
                />
              </Field>
              <Field label="Notes">
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="optional"
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
          <Field label="Themes JSON">
            <div className="flex items-start gap-2">
              <textarea
                value={json}
                onChange={(e) => setJson(e.target.value)}
                placeholder='{"themes": [{"name": "...", "definition": "...", "reasoning": "...", "quotes": [{"text": "...", "source": "[D4]", "role": "core"}]}]}'
                rows={5}
                className={`${inputCls} font-mono text-[11px] leading-snug flex-1`}
              />
              <button
                type="button"
                onClick={() => jsonFileRef.current?.click()}
                className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 border border-slate-300 rounded-md hover:bg-slate-100 flex-shrink-0"
              >
                upload .json
              </button>
              <input
                ref={jsonFileRef}
                type="file"
                accept=".json,application/json,.txt"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setJson(await readFileAsText(f));
                  e.target.value = '';
                }}
              />
            </div>
          </Field>
          {error && (
            <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={create}
            className="px-4 py-1.5 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Create run
          </button>
        </div>
      )}
      {result && (
        <div className="mt-2 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5">
          {result}
        </div>
      )}
    </section>
  );
}

const inputCls =
  'w-full px-2 py-1.5 text-[12px] border border-slate-300 rounded-md bg-white outline-none focus:border-blue-400';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

// --- Run list -----------------------------------------------------------------

function RunListSection({
  state,
  onDeleteRun,
  onUpdateRunMeta,
  onOpenRun,
}: {
  state: AppState;
  onDeleteRun: (id: string) => void;
  onUpdateRunMeta: (id: string, patch: Partial<Run>) => void;
  onOpenRun: (id: string) => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);

  const runs = useMemo(
    () =>
      [...state.runs].sort(
        (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0),
      ),
    [state.runs],
  );

  if (runs.length === 0) {
    return (
      <section>
        <h2 className="font-bold text-[16px] text-slate-900 mb-2">Runs</h2>
        <div className="text-[13px] text-slate-400 italic border border-dashed border-slate-200 rounded-lg p-6 text-center">
          No runs yet. Add one above — each run is one AI output (≤10 themes) tagged with model,
          positionality, research question, and condition.
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-bold text-[16px] text-slate-900 mb-2">
        Runs <span className="text-slate-400 font-normal text-[13px]">({runs.length})</span>
      </h2>
      <ul className="space-y-2">
        {runs.map((run) => {
          const rated = run.themes.filter(isFullyRated).length;
          const corpus = run.corpusId
            ? state.corpora.find((c) => c.id === run.corpusId)?.name
            : undefined;
          const means = [
            { k: 'G', v: meanScore(run.themes.map((t) => t.rating.grounding)) },
            { k: 'RQF', v: meanScore(run.themes.map((t) => t.rating.researchQuestionFit)) },
            { k: 'IL', v: meanScore(run.themes.map((t) => t.rating.interpretationLevel)) },
            { k: 'PN', v: meanScore(run.themes.map((t) => t.rating.aiPriorNovelty)) },
            { k: 'AN', v: meanScore(run.themes.map((t) => t.rating.analyticalNovelty)) },
            { k: 'PI', v: meanScore(run.themes.map((t) => t.rating.positionalityInfluence)) },
          ].filter((m) => m.v !== null);
          return (
            <li key={run.id} className="border border-slate-200 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                {run.model && <Chip label={run.model} tone="blue" />}
                {run.positionality && <Chip label={run.positionality} />}
                {run.condition && <Chip label={run.condition} />}
                {run.repeat && <Chip label={`rep ${run.repeat}`} />}
                {corpus && <Chip label={corpus} tone="amber" />}
                <span
                  className={`ml-auto text-[11px] font-mono flex-shrink-0 ${
                    rated === run.themes.length && run.themes.length > 0
                      ? 'text-emerald-600'
                      : 'text-slate-500'
                  }`}
                >
                  {rated}/{run.themes.length} rated
                </span>
              </div>
              {run.researchQuestion && (
                <div className="mt-1 text-[12px] text-slate-600 leading-snug">
                  {run.researchQuestion}
                </div>
              )}
              {means.length > 0 && (
                <div className="mt-1 text-[10px] font-mono text-slate-400">
                  {means.map((m) => `${m.k} ${m.v!.toFixed(1)}`).join(' · ')}
                </div>
              )}
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenRun(run.id)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-700 rounded transition-colors"
                >
                  Rate →
                </button>
                <button
                  type="button"
                  onClick={() => setEditId(editId === run.id ? null : run.id)}
                  className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
                >
                  {editId === run.id ? 'close' : 'edit'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Delete this run and all its ratings?')) onDeleteRun(run.id);
                  }}
                  className="px-2 py-1 text-[11px] text-red-500 hover:text-red-700 rounded hover:bg-red-50 ml-auto"
                >
                  delete
                </button>
              </div>
              {editId === run.id && (
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
                  <Field label="Model">
                    <input
                      value={run.model}
                      onChange={(e) => onUpdateRunMeta(run.id, { model: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Positionality">
                    <input
                      value={run.positionality}
                      onChange={(e) => onUpdateRunMeta(run.id, { positionality: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Research question">
                    <input
                      value={run.researchQuestion}
                      onChange={(e) =>
                        onUpdateRunMeta(run.id, { researchQuestion: e.target.value })
                      }
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Condition">
                    <input
                      value={run.condition}
                      onChange={(e) => onUpdateRunMeta(run.id, { condition: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Repeat #">
                    <input
                      value={run.repeat ?? ''}
                      onChange={(e) =>
                        onUpdateRunMeta(run.id, { repeat: e.target.value || undefined })
                      }
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Notes">
                    <input
                      value={run.notes ?? ''}
                      onChange={(e) =>
                        onUpdateRunMeta(run.id, { notes: e.target.value || undefined })
                      }
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

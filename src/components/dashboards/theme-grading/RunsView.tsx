import { useMemo, useRef, useState } from 'react';
import { runExportFilename, runThemesRatingsJSON } from './exporters';
import { buildRunName, parseRunName } from './runName';
import { Chip, isFullyRated, meanScore } from './shared';
import { docNumber, downloadJSON, readFileAsText } from './storage';
import type { AppState, Corpus, Run } from './types';
import { DATA_SOURCE_SUGGESTIONS, PROMPT_VARIANTS } from './types';

type RunMetaInput = Omit<Run, 'id' | 'themes' | 'created_at' | 'updated_at' | 'additionalText'>;

type Props = {
  state: AppState;
  onAddCorpus: (name: string, csvText: string) => { docCount: number; warnings: string[] };
  onDeleteCorpus: (id: string) => void;
  onRenameCorpus: (id: string, name: string) => void;
  onCreateRun: (
    meta: RunMetaInput,
    themesJson: string,
  ) => { themeCount: number; anchoredQuotes: number; totalQuotes: number; warnings: string[] };
  onDeleteRun: (id: string) => void;
  onUpdateRunMeta: (id: string, patch: Partial<Run>) => void;
  onOpenRun: (id: string) => void;
  onReanchorRun: (runId: string, corpusId: string) => { anchored: number; total: number };
  onReplaceRunJson: (
    runId: string,
    themesJson: string,
  ) => {
    themeCount: number;
    anchoredQuotes: number;
    totalQuotes: number;
    ratingsPreserved: number;
    warnings: string[];
  };
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
  onReanchorRun,
  onReplaceRunJson,
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
          onReanchorRun={onReanchorRun}
          onReplaceRunJson={onReplaceRunJson}
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
          columns: <code className="bg-slate-100 px-1 rounded">ai_id</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">comment</code> (D-tag ids set the D-numbers;
          otherwise row order)
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
          No data uploaded yet. Upload a CSV with an <code>ai_id</code> column and a{' '}
          <code>comment</code> column — each row becomes a document (numbered by its D-tag id, or
          by row order) that theme quotes anchor against.
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
                    {previewId === c.id ? 'Hide' : 'Preview'}
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
                      onDelete(c.id);
                      if (previewId === c.id) setPreviewId(null);
                    }}
                    className="text-[11px] text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 flex-shrink-0"
                  >
                    Delete
                  </button>
                </div>
                {previewId === c.id && (
                  <ul className="mt-2 max-h-[240px] overflow-y-auto border border-slate-100 rounded bg-slate-50/60 divide-y divide-slate-100">
                    {c.docs.slice(0, 200).map((d, i) => (
                      <li key={i} className="px-2.5 py-1.5 text-[12px] text-slate-600 flex gap-2">
                        <span className="font-mono text-[10px] text-slate-400 flex-shrink-0 pt-0.5">
                          D{docNumber(c, i)}
                          {d.extId && d.extId !== `D${docNumber(c, i)}` ? ` (${d.extId})` : ''}
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
}

// --- New run -------------------------------------------------------------------

function distinct(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v && v.trim().length > 0))];
}

const emptyMeta = {
  model: '',
  promptVariant: '',
  version: '',
  dataSource: '',
  rq: '',
  positionality: '',
  runN: '',
  notes: '',
};

function NewRunSection({
  state,
  onCreateRun,
}: {
  state: AppState;
  onCreateRun: Props['onCreateRun'];
}) {
  const [open, setOpen] = useState(false);
  const [corpusId, setCorpusId] = useState<string>('');
  const [name, setName] = useState('');
  const [meta, setMeta] = useState({ ...emptyMeta });
  const [json, setJson] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);

  const models = distinct(state.runs.map((r) => r.model));
  const promptVariants = distinct([...state.runs.map((r) => r.promptVariant), ...PROMPT_VARIANTS]);
  const dataSources = distinct([
    ...state.runs.map((r) => r.dataSource),
    ...DATA_SOURCE_SUGGESTIONS,
  ]);
  const rqs = distinct(state.runs.map((r) => r.rq));
  const positionalities = distinct(state.runs.map((r) => r.positionality));

  const effectiveCorpusId = corpusId || state.corpora[0]?.id || '';

  // Pasting/typing a full run name autofills whatever fields it can parse.
  const applyName = (v: string) => {
    setName(v);
    const parsed = parseRunName(v);
    setMeta((m) => ({
      ...m,
      model: parsed.model ?? m.model,
      promptVariant: parsed.promptVariant ?? m.promptVariant,
      version: parsed.version ?? m.version,
      dataSource: parsed.dataSource ?? m.dataSource,
      rq: parsed.rq ?? m.rq,
      positionality: parsed.positionality ?? m.positionality,
      runN: parsed.runN ?? m.runN,
    }));
  };

  const setField = (k: keyof typeof emptyMeta) => (v: string) =>
    setMeta((m) => ({ ...m, [k]: v }));

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
          model: meta.model.trim(),
          promptVariant: meta.promptVariant.trim(),
          version: meta.version.trim().replace(/^v/i, ''),
          dataSource: meta.dataSource.trim(),
          rq: meta.rq.trim(),
          positionality: meta.positionality.trim(),
          runN: meta.runN.trim().replace(/^run/i, '') || undefined,
          notes: meta.notes.trim() || undefined,
        },
        json,
      );
      setResult(
        `Run created: ${r.themeCount} themes, ${r.anchoredQuotes}/${r.totalQuotes} quotes found in data.` +
          (r.warnings.length > 0 ? ` ${r.warnings.join(' ')}` : ''),
      );
      setJson('');
      setName('');
      setMeta((m) => ({ ...m, runN: '', notes: '' }));
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
          {open ? 'Close' : '+ Add run'}
        </button>
      </div>
      {open && (
        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <Field label="Run name (autofills the fields below)">
            <input
              value={name}
              onChange={(e) => applyName(e.target.value)}
              placeholder="{model}_{promptvariant}-v{version}_{datasource}_{rq}_{positionality}_run{n}"
              className={`${inputCls} font-mono`}
            />
          </Field>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Model">
              <input
                list="tg-models"
                value={meta.model}
                onChange={(e) => setField('model')(e.target.value)}
                placeholder="claude, chatgpt5.5, gemini"
                className={inputCls}
              />
              <datalist id="tg-models">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="Prompt variant">
              <input
                list="tg-prompt-variants"
                value={meta.promptVariant}
                onChange={(e) => setField('promptVariant')(e.target.value)}
                placeholder="engineered-data"
                className={inputCls}
              />
              <datalist id="tg-prompt-variants">
                {promptVariants.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="Version">
              <input
                value={meta.version}
                onChange={(e) => setField('version')(e.target.value)}
                placeholder="2"
                className={inputCls}
              />
            </Field>
            <Field label="Data source">
              <input
                list="tg-data-sources"
                value={meta.dataSource}
                onChange={(e) => setField('dataSource')(e.target.value)}
                placeholder="160-als-comments"
                className={inputCls}
              />
              <datalist id="tg-data-sources">
                {dataSources.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="RQ (shorthand)">
              <input
                list="tg-rqs"
                value={meta.rq}
                onChange={(e) => setField('rq')(e.target.value)}
                placeholder="rq1"
                className={inputCls}
              />
              <datalist id="tg-rqs">
                {rqs.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="Positionality">
              <input
                list="tg-positionalities"
                value={meta.positionality}
                onChange={(e) => setField('positionality')(e.target.value)}
                placeholder="p1"
                className={inputCls}
              />
              <datalist id="tg-positionalities">
                {positionalities.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="Run #">
              <input
                value={meta.runN}
                onChange={(e) => setField('runN')(e.target.value)}
                placeholder="1"
                className={inputCls}
              />
            </Field>
            <Field label="Anchor against">
              <select
                value={effectiveCorpusId}
                onChange={(e) => setCorpusId(e.target.value)}
                className={inputCls}
              >
                {state.corpora.length === 0 && <option value="">— no data uploaded —</option>}
                {state.corpora.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.docs.length} docs)
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <input
              value={meta.notes}
              onChange={(e) => setField('notes')(e.target.value)}
              placeholder="optional"
              className={inputCls}
            />
          </Field>
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
                Upload .json
              </button>
              <input
                ref={jsonFileRef}
                type="file"
                accept=".json,application/json,.txt"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setJson(await readFileAsText(f));
                    // A file named to the convention autofills the fields too.
                    if (!name) applyName(f.name);
                  }
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
  onReanchorRun,
  onReplaceRunJson,
}: {
  state: AppState;
  onDeleteRun: (id: string) => void;
  onUpdateRunMeta: (id: string, patch: Partial<Run>) => void;
  onOpenRun: (id: string) => void;
  onReanchorRun: (runId: string, corpusId: string) => { anchored: number; total: number };
  onReplaceRunJson: Props['onReplaceRunJson'];
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [reanchorReport, setReanchorReport] = useState<Record<string, string>>({});
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const replaceTargetId = useRef<string | null>(null);

  const handleReplaceFile = async (file: File) => {
    const runId = replaceTargetId.current;
    if (!runId) return;
    try {
      const r = onReplaceRunJson(runId, await readFileAsText(file));
      setReanchorReport((m) => ({
        ...m,
        [runId]:
          `Replaced: ${r.themeCount} themes, ${r.anchoredQuotes}/${r.totalQuotes} quotes in data, ` +
          `${r.ratingsPreserved} rated theme${r.ratingsPreserved === 1 ? '' : 's'} kept.` +
          (r.warnings.length > 0 ? ` ${r.warnings.join(' ')}` : ''),
      }));
    } catch (e) {
      setReanchorReport((m) => ({
        ...m,
        [runId]: `Replace failed: ${e instanceof Error ? e.message : String(e)}`,
      }));
    }
  };

  const runs = useMemo(
    () => [...state.runs].sort((a, b) => buildRunName(a).localeCompare(buildRunName(b))),
    [state.runs],
  );

  if (runs.length === 0) {
    return (
      <section>
        <h2 className="font-bold text-[16px] text-slate-900 mb-2">Runs</h2>
        <div className="text-[13px] text-slate-400 italic border border-dashed border-slate-200 rounded-lg p-6 text-center">
          No runs yet. Add one above — each run is one AI output (≤10 themes) named{' '}
          <code className="text-[11px] bg-slate-100 px-1 rounded">
            {'{model}_{promptvariant}-v{version}_{datasource}_{rq}_{positionality}_run{n}'}
          </code>
          .
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-bold text-[16px] text-slate-900 mb-2">
        Runs <span className="text-slate-400 font-normal text-[13px]">({runs.length})</span>
      </h2>
      <input
        ref={replaceFileRef}
        type="file"
        accept=".json,application/json,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleReplaceFile(f);
          e.target.value = '';
        }}
      />
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
            { k: 'N', v: meanScore(run.themes.map((t) => t.rating.novelty)) },
            { k: 'DC', v: meanScore(run.themes.map((t) => t.rating.dataContribution)) },
            { k: 'PC', v: meanScore(run.themes.map((t) => t.rating.positionalityContribution)) },
          ].filter((m) => m.v !== null);
          return (
            <li key={run.id} className="border border-slate-200 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[12px] font-bold text-slate-800 break-all">
                  {buildRunName(run)}
                </span>
                <span
                  className={`ml-auto text-[11px] font-mono flex-shrink-0 ${
                    rated === run.themes.length && run.themes.length > 0
                      ? 'text-emerald-600'
                      : 'text-slate-500'
                  }`}
                >
                  {rated}/{run.themes.length} Rated
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                {run.model && <Chip label={run.model} tone="blue" />}
                {run.promptVariant && <Chip label={run.promptVariant} />}
                {run.version && <Chip label={`v${run.version}`} />}
                {run.dataSource && <Chip label={run.dataSource} tone="amber" />}
                {run.rq && <Chip label={run.rq} />}
                {run.positionality && <Chip label={run.positionality} />}
                {run.runN && <Chip label={`run${run.runN}`} />}
                {corpus && <Chip label={corpus} tone="amber" />}
              </div>
              <div className="mt-1 text-[10px] font-mono text-slate-400">
                {(() => {
                  const total = run.themes.reduce((s, t) => s + t.quotes.length, 0);
                  const inData = run.themes.reduce(
                    (s, t) => s + t.quotes.filter((q) => q.anchor).length,
                    0,
                  );
                  const parts = [`${inData}/${total} quotes in data`];
                  for (const m of means) parts.push(`${m.k} ${m.v!.toFixed(1)}`);
                  return parts.join(' · ');
                })()}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenRun(run.id)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-700 rounded transition-colors"
                >
                  Rate
                </button>
                <button
                  type="button"
                  onClick={() => downloadJSON(runExportFilename(run), runThemesRatingsJSON(run, state))}
                  className="px-2 py-1 text-[11px] font-semibold text-slate-600 border border-slate-300 rounded hover:bg-slate-100 transition-colors"
                  title="Download this run's themes + ratings as JSON"
                >
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => setEditId(editId === run.id ? null : run.id)}
                  className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
                >
                  {editId === run.id ? 'Close' : 'Edit'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Delete this run and all its ratings?')) onDeleteRun(run.id);
                  }}
                  className="px-2 py-1 text-[11px] text-red-500 hover:text-red-700 rounded hover:bg-red-50 ml-auto"
                >
                  Delete
                </button>
              </div>
              {editId === run.id && (
                <>
                <div className="mt-2 flex items-end gap-2 flex-wrap border-t border-slate-100 pt-2">
                  <Field label="Anchor against">
                    <select
                      value={run.corpusId ?? ''}
                      onChange={(e) =>
                        onUpdateRunMeta(run.id, { corpusId: e.target.value || null })
                      }
                      className={inputCls}
                    >
                      <option value="">— none —</option>
                      {state.corpora.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.docs.length} docs)
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button
                    type="button"
                    disabled={!run.corpusId}
                    onClick={() => {
                      if (!run.corpusId) return;
                      const r = onReanchorRun(run.id, run.corpusId);
                      setReanchorReport((m) => ({
                        ...m,
                        [run.id]: `${r.anchored}/${r.total} quotes found in data.`,
                      }));
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors disabled:opacity-40"
                    title="Match every quote against the selected data again"
                  >
                    Re-match quotes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      replaceTargetId.current = run.id;
                      replaceFileRef.current?.click();
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                    title="Re-upload this run's themes JSON — themes matched by name keep their ratings"
                  >
                    Replace JSON
                  </button>
                  {reanchorReport[run.id] && (
                    <span className="text-[11px] text-emerald-700">{reanchorReport[run.id]}</span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 border-t border-slate-100 pt-2">
                  <Field label="Model">
                    <input
                      value={run.model}
                      onChange={(e) => onUpdateRunMeta(run.id, { model: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Prompt variant">
                    <input
                      value={run.promptVariant}
                      onChange={(e) => onUpdateRunMeta(run.id, { promptVariant: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Version">
                    <input
                      value={run.version}
                      onChange={(e) => onUpdateRunMeta(run.id, { version: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Data source">
                    <input
                      value={run.dataSource}
                      onChange={(e) => onUpdateRunMeta(run.id, { dataSource: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="RQ (shorthand)">
                    <input
                      value={run.rq}
                      onChange={(e) => onUpdateRunMeta(run.id, { rq: e.target.value })}
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
                  <Field label="Run #">
                    <input
                      value={run.runN ?? ''}
                      onChange={(e) =>
                        onUpdateRunMeta(run.id, { runN: e.target.value || undefined })
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
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

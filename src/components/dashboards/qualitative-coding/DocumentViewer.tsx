import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  annotationsForDoc,
  codePathString,
  flattenTree,
  buildCodeTree,
  resolveColor,
  segmentText,
} from './compute';
import { MarkdownEditor, type QcLinkOptions } from './Markdown';
import { ResizeHandle, RowResizeHandle } from './Resizable';
import { cryptoRandomId, emDash } from './storage';
import type { Annotation, Code, Document, MetadataField } from './types';

type Props = {
  doc: Document;
  codes: Code[];
  annotations: Annotation[];
  metadataSchema: MetadataField[];
  selectedCodeId: string | null;
  showCodeDefinitions: boolean;
  codebookOpen: boolean;
  notesWidth: number;
  annotationsPanelHeight: number;
  annotationsPanelCollapsed: boolean;
  metadataCollapsed: boolean;
  onResizeNotes: (n: number) => void;
  onResizeAnnotationsPanel: (n: number) => void;
  onToggleAnnotationsPanel: () => void;
  onToggleMetadata: () => void;
  onToggleCodebook: () => void;
  onUpdateDoc: (patch: Partial<Document>) => void;
  onAddAnnotation: (start: number, end: number, codeId: string, note?: string, id?: string) => void;
  onDeleteAnnotation: (id: string) => void;
  onUpdateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  onSendAnnotationToNote?: (
    annData: { id: string; start: number; end: number; codeId: string },
  ) => void;
  canSendToNote?: boolean;
  qcLinkOptions?: QcLinkOptions;
  onJumpToQcLink?: (href: string) => void;
  onClose?: () => void;
  showPaneControls?: boolean;
  onPaneDragStart?: () => void;
  onPaneDragEnd?: () => void;
};

type PendingSelection = {
  start: number;
  end: number;
  rect: { top: number; left: number; right: number; bottom: number };
};

export default function DocumentViewer({
  doc,
  codes,
  annotations,
  metadataSchema,
  selectedCodeId,
  showCodeDefinitions,
  codebookOpen,
  notesWidth,
  annotationsPanelHeight,
  annotationsPanelCollapsed,
  metadataCollapsed,
  onResizeNotes,
  onResizeAnnotationsPanel,
  onToggleAnnotationsPanel,
  onToggleMetadata,
  onToggleCodebook,
  onUpdateDoc,
  onAddAnnotation,
  onDeleteAnnotation,
  onUpdateAnnotation,
  onSendAnnotationToNote,
  canSendToNote,
  qcLinkOptions,
  onJumpToQcLink,
  onClose,
  showPaneControls,
  onPaneDragStart,
  onPaneDragEnd,
}: Props) {
  if (doc.kind === 'note') {
    return (
      <NoteDocViewer
        doc={doc}
        qcLinkOptions={qcLinkOptions}
        onUpdateDoc={onUpdateDoc}
        onJumpToQcLink={onJumpToQcLink}
        onClose={onClose}
        showPaneControls={showPaneControls}
        onPaneDragStart={onPaneDragStart}
        onPaneDragEnd={onPaneDragEnd}
      />
    );
  }
  const [mode, setMode] = useState<'view' | 'edit'>(doc.text ? 'view' : 'edit');
  const [draftText, setDraftText] = useState(doc.text);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [focusedAnnotationId, setFocusedAnnotationId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  // Slow wheel scrolling in the doc body for finer-grained navigation.
  // Native onWheel in React is passive, so use a non-passive listener.
  useEffect(() => {
    const el = bodyScrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return; // leave browser zoom alone
      // Default deltaY is ~100px per tick on most setups; halve it.
      e.preventDefault();
      el.scrollTop += e.deltaY * 0.55;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    setDraftText(doc.text);
    setMode(doc.text ? 'view' : 'edit');
    setPending(null);
    setFocusedAnnotationId(null);
  }, [doc.id]);

  const docAnnotations = useMemo(
    () => annotationsForDoc(annotations, doc.id),
    [annotations, doc.id],
  );

  const segments = useMemo(
    () => segmentText(doc.text, docAnnotations, pending ?? undefined),
    [doc.text, docAnnotations, pending],
  );

  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      if (!pending) return;
      const target = e.target as Node;
      // Click anywhere outside the popover closes it (including back inside
      // the doc, where the user may want to start a new selection).
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      setPending(null);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [pending]);

  // Capture any selection that finalises anywhere on the page, as long as it
  // started inside our document container. Robust against the user releasing
  // the mouse outside the container or selecting via keyboard.
  useEffect(() => {
    if (mode !== 'view') return;
    const handler = () => {
      // Defer one frame so the selection is finalised by the browser.
      requestAnimationFrame(() => {
        const sel = window.getSelection();
        const container = containerRef.current;
        if (!sel || !container || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        // Only react if at least one endpoint lives in our container.
        if (
          !container.contains(range.startContainer) &&
          !container.contains(range.endContainer)
        ) {
          return;
        }
        if (sel.isCollapsed) {
          // Don't blow away an open popover just because the user clicked
          // inside their own selection — only clear if the popover isn't open.
          if (!pending) setPending(null);
          return;
        }
        // Clamp the range to the container in case selection extends outside.
        const start = rangeOffset(
          container,
          container.contains(range.startContainer) ? range.startContainer : container,
          container.contains(range.startContainer) ? range.startOffset : 0,
        );
        const end = rangeOffset(
          container,
          container.contains(range.endContainer) ? range.endContainer : container,
          container.contains(range.endContainer)
            ? range.endOffset
            : container.childNodes.length,
        );
        if (start < 0 || end < 0 || start === end) {
          return;
        }
        const r = range.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;
        setPending({
          start: Math.min(start, end),
          end: Math.max(start, end),
          rect: {
            top: r.top + scrollY,
            left: r.left + scrollX,
            right: r.right + scrollX,
            bottom: r.bottom + scrollY,
          },
        });
        setFocusedAnnotationId(null);
      });
    };
    document.addEventListener('mouseup', handler);
    document.addEventListener('keyup', handler);
    return () => {
      document.removeEventListener('mouseup', handler);
      document.removeEventListener('keyup', handler);
    };
  }, [mode, pending]);

  const handleMouseUp = () => {
    // Kept as a no-op trigger so onMouseUp/onKeyUp handlers on the container
    // still fire. The real work happens in the document-level listener above.
  };

  const commitEdit = () => {
    if (draftText === doc.text) {
      setMode('view');
      return;
    }
    const newLen = draftText.length;
    const docAnns = annotations.filter((a) => a.docId === doc.id);
    for (const a of docAnns) {
      if (a.start >= newLen) {
        onDeleteAnnotation(a.id);
      } else if (a.end > newLen) {
        onUpdateAnnotation(a.id, { end: newLen });
      }
    }
    onUpdateDoc({ text: draftText });
    setMode('view');
  };

  return (
    <div className="flex-1 min-w-0 flex">
    <div className="flex-1 min-w-0 flex flex-col">
      {showPaneControls && (
        <div className="flex items-center px-3 py-1.5 border-b border-slate-100 bg-slate-50">
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              onPaneDragStart?.();
            }}
            onDragEnd={() => onPaneDragEnd?.()}
            className="cursor-grab text-slate-400 hover:text-slate-700 text-[12px] select-none flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white transition-colors"
            title="drag to reorder this pane"
          >
            <span>⋮⋮</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold">drag</span>
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="close this document"
              className="ml-auto w-7 h-7 rounded-md text-slate-400 hover:text-slate-900 hover:bg-white flex items-center justify-center text-[18px] transition-colors"
            >
              ×
            </button>
          )}
        </div>
      )}
      <DocHeader
        doc={doc}
        metadataSchema={metadataSchema}
        metadataCollapsed={metadataCollapsed}
        onToggleMetadata={onToggleMetadata}
        onUpdateDoc={onUpdateDoc}
      />

      <div className="px-6 py-3 flex items-center gap-2 border-b border-slate-200 bg-white sticky top-0 z-10">
        <ToggleBtn active={mode === 'view'} onClick={() => mode === 'edit' && commitEdit()}>
          Read &amp; code
        </ToggleBtn>
        <ToggleBtn active={mode === 'edit'} onClick={() => setMode('edit')}>
          Edit text
        </ToggleBtn>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={onToggleCodebook}
          title="open codebook side panel"
          className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
            codebookOpen
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Codebook
        </button>
        <button
          type="button"
          onClick={() => setNotesOpen((v) => !v)}
          className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
            notesOpen
              ? 'bg-amber-100 text-amber-900'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Notes{doc.notes && doc.notes.length > 0 ? ' •' : ''}
        </button>
        <div className="ml-auto text-[12px] text-slate-400 font-mono tabular-nums">
          {doc.text.length.toLocaleString()} chars · {countWords(doc.text).toLocaleString()} words ·{' '}
          {docAnnotations.length} annotation
          {docAnnotations.length === 1 ? '' : 's'}
        </div>
      </div>

      <div ref={bodyScrollRef} className="flex-1 overflow-auto bg-white">
        {mode === 'edit' ? (
          <div className="max-w-[760px] mx-auto px-8 py-6">
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onBlur={commitEdit}
              placeholder="Paste or type your document text here..."
              className="w-full min-h-[60vh] p-4 font-sans text-[15px] leading-[1.65] text-slate-800 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
            />
            <div className="mt-2 text-[11px] text-slate-400">
              Click <span className="font-semibold text-slate-600">Read & code</span> to commit. Annotations
              whose spans fall outside the new length will be removed or clamped.
            </div>
          </div>
        ) : (
          <div className="max-w-[760px] mx-auto px-8 py-6">
            <div
              ref={containerRef}
              onMouseUp={handleMouseUp}
              onKeyUp={handleMouseUp}
              className="font-sans text-[16px] leading-[1.7] text-slate-800 whitespace-pre-wrap break-words selection:bg-yellow-200"
              style={{ tabSize: 4 }}
            >
              {doc.text.length === 0 ? (
                <div className="text-slate-400 italic">
                  This document is empty. Switch to <span className="font-semibold">Edit text</span> to add
                  content.
                </div>
              ) : (
                segments.map((seg, i) => {
                  if (seg.annotations.length === 0) {
                    if (seg.pending) {
                      return (
                        <span
                          key={i}
                          style={{ backgroundColor: 'rgba(254, 240, 138, 0.85)' }}
                        >
                          {seg.text}
                        </span>
                      );
                    }
                    return <span key={i}>{seg.text}</span>;
                  }
                  const top = seg.annotations[seg.annotations.length - 1];
                  const color = resolveColor(codes, top.codeId);
                  const dim =
                    selectedCodeId !== null &&
                    !seg.annotations.some((a) => a.codeId === selectedCodeId);
                  const isFocused =
                    focusedAnnotationId !== null &&
                    seg.annotations.some((a) => a.id === focusedAnnotationId);
                  return (
                    <span
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocusedAnnotationId(top.id);
                      }}
                      className={`cursor-pointer rounded-sm transition-opacity ${
                        dim ? 'opacity-30' : ''
                      }`}
                      style={{
                        backgroundColor: seg.pending
                          ? 'rgba(254, 240, 138, 0.85)'
                          : hexAlpha(color, isFocused ? 0.4 : 0.2),
                        boxShadow: isFocused ? `inset 0 -2px 0 ${color}` : `inset 0 -1px 0 ${color}`,
                      }}
                      title={seg.annotations
                        .map((a) => codePathString(codes, a.codeId))
                        .join(' · ')}
                    >
                      {seg.text}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <AnnotationsPanel
        doc={doc}
        codes={codes}
        annotations={docAnnotations}
        focusedAnnotationId={focusedAnnotationId}
        showDefinitions={showCodeDefinitions}
        collapsed={annotationsPanelCollapsed}
        height={annotationsPanelHeight}
        onToggleCollapsed={onToggleAnnotationsPanel}
        onResize={onResizeAnnotationsPanel}
        onFocus={setFocusedAnnotationId}
        onDelete={onDeleteAnnotation}
        onUpdate={onUpdateAnnotation}
        onSendToNote={onSendAnnotationToNote}
      />

      {pending && (
        <SelectionPopover
          ref={popoverRef}
          pending={pending}
          codes={codes}
          text={doc.text}
          showDefinitions={showCodeDefinitions}
          canSendToNote={!!canSendToNote && !!onSendAnnotationToNote}
          onPick={(codeId, note, sendToNote) => {
            const id = cryptoRandomId();
            onAddAnnotation(pending.start, pending.end, codeId, note, id);
            if (sendToNote && onSendAnnotationToNote) {
              onSendAnnotationToNote({
                id,
                start: pending.start,
                end: pending.end,
                codeId,
              });
            }
            setPending(null);
            window.getSelection()?.removeAllRanges();
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
    {notesOpen && (
      <aside
        className="flex-shrink-0 border-l border-slate-200 bg-amber-50/40 flex flex-col min-h-0 relative"
        style={{ width: `${notesWidth}px` }}
      >
        <ResizeHandle
          side="left"
          width={notesWidth}
          min={280}
          max={640}
          onChange={onResizeNotes}
        />
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-amber-700">
              My notes
            </div>
            <div className="text-[11px] text-slate-500">
              Your thoughts about this document. Not part of the coded data.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNotesOpen(false)}
            className="text-slate-400 hover:text-slate-800 text-[16px]"
            aria-label="close notes"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <MarkdownEditor
            value={doc.notes ?? ''}
            onChange={(v) => onUpdateDoc({ notes: v })}
            placeholder="Write your thoughts, questions, hypotheses about this document. Markdown supported."
            minHeight={520}
          />
        </div>
      </aside>
    )}
    </div>
  );
}

function DocHeader({
  doc,
  metadataSchema,
  metadataCollapsed,
  onToggleMetadata,
  onUpdateDoc,
}: {
  doc: Document;
  metadataSchema: MetadataField[];
  metadataCollapsed: boolean;
  onToggleMetadata: () => void;
  onUpdateDoc: (patch: Partial<Document>) => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [folder, setFolder] = useState(doc.folder ?? '');
  useEffect(() => {
    setTitle(doc.title);
    setFolder(doc.folder ?? '');
  }, [doc.id]);

  return (
    <div className="px-8 pt-6 pb-4 border-b border-slate-200 bg-white">
      <div className="max-w-[760px] mx-auto mb-2 flex items-center gap-1.5 text-[11px] text-slate-400">
        <span className="text-slate-300">📁</span>
        <input
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          onBlur={() => {
            const v = folder.trim();
            const next = v || undefined;
            if (next !== doc.folder) onUpdateDoc({ folder: next });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          placeholder="folder (use / for nesting, e.g. Interviews/Round 1)"
          className="flex-1 px-1 py-0.5 text-[12px] text-slate-600 placeholder-slate-300 bg-transparent border-none focus:outline-none focus:bg-slate-50 rounded"
        />
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(emDash(e.target.value))}
        onBlur={() => {
          const v = title.trim() || 'Untitled document';
          if (v !== doc.title) onUpdateDoc({ title: v });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        placeholder="Document title"
        className="w-full max-w-[760px] mx-auto block px-0 py-0 font-sans font-bold text-[28px] leading-tight text-slate-900 placeholder-slate-300 border-none focus:outline-none focus:ring-0 bg-transparent"
        style={{ letterSpacing: '-0.02em' }}
      />
      {metadataSchema.length > 0 && (
        <div className="max-w-[760px] mx-auto mt-3">
          <button
            type="button"
            onClick={onToggleMetadata}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500 hover:text-slate-800 transition-colors px-1 py-0.5 rounded hover:bg-slate-100"
            title={metadataCollapsed ? 'show metadata' : 'hide metadata'}
          >
            <span className="text-[10px] text-slate-400 w-3">{metadataCollapsed ? '▸' : '▾'}</span>
            <span>
              Metadata · {metadataSchema.length} field{metadataSchema.length === 1 ? '' : 's'}
            </span>
          </button>
          {!metadataCollapsed && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {metadataSchema.map((field) => (
                <MetadataInput
                  key={field.key}
                  field={field}
                  value={doc.metadata[field.key] ?? null}
                  onChange={(v) =>
                    onUpdateDoc({
                      metadata: { ...doc.metadata, [field.key]: v },
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetadataInput({
  field,
  value,
  onChange,
}: {
  field: MetadataField;
  value: string | number | null;
  onChange: (v: string | number | null) => void;
}) {
  const common = 'px-2 py-1 text-[13px] text-slate-700 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-white';
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
        {field.label}
      </span>
      {field.type === 'enum' ? (
        <select
          value={value === null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value || null)}
          className={common}
        >
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : field.type === 'number' ? (
        <input
          type="number"
          value={value === null ? '' : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? null : Number(v));
          }}
          className={`${common} w-[100px]`}
        />
      ) : field.type === 'date' ? (
        <input
          type="date"
          value={value === null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value || null)}
          className={common}
        />
      ) : (
        <input
          type="text"
          value={value === null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value || null)}
          className={`${common} w-[160px]`}
        />
      )}
    </label>
  );
}

type PopoverProps = {
  pending: PendingSelection;
  codes: Code[];
  text: string;
  showDefinitions: boolean;
  canSendToNote: boolean;
  onPick: (codeId: string, note?: string, sendToNote?: boolean) => void;
  onCancel: () => void;
};

const SelectionPopover = forwardRef<HTMLDivElement, PopoverProps>(function SelectionPopover(
  { pending, codes, text, showDefinitions, canSendToNote, onPick, onCancel },
  ref,
) {
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [sendToNote, setSendToNote] = useState(false);
  const flat = useMemo(() => flattenTree(buildCodeTree(codes)), [codes]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flat;
    return flat.filter((n) =>
      codePathString(codes, n.code.id).toLowerCase().includes(q),
    );
  }, [flat, query, codes]);

  const commit = (codeId: string) =>
    onPick(codeId, note.trim() || undefined, sendToNote);

  return (
    <div
      ref={ref}
      role="dialog"
      className="fixed z-50 w-[360px] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
      style={{
        top: pending.rect.bottom - window.scrollY + 8,
        left: Math.min(
          window.innerWidth - 380,
          Math.max(8, pending.rect.left - window.scrollX),
        ),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center border-b border-slate-100">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={codes.length === 0 ? 'No codes yet — add one in the sidebar' : 'Search codes…'}
          disabled={codes.length === 0}
          className="flex-1 px-3.5 py-2.5 text-[13px] focus:outline-none focus:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-400"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered.length > 0) {
              commit(filtered[0].code.id);
            }
            if (e.key === 'Escape') onCancel();
          }}
        />
        <button
          type="button"
          onClick={onCancel}
          className="flex-shrink-0 w-8 h-8 mr-1 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center text-[16px] transition-colors"
          aria-label="close"
          title="close (Esc)"
        >
          ×
        </button>
      </div>
      <div className="max-h-[380px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-[12px] text-slate-400 italic text-center">
            No matching codes.
          </div>
        ) : (
          filtered.map((n) => {
            const color = resolveColor(codes, n.code.id);
            return (
              <button
                key={n.code.id}
                type="button"
                onClick={() => commit(n.code.id)}
                className="w-full flex items-start gap-2 px-3 py-1.5 text-left hover:bg-blue-50 transition-colors"
                style={{ paddingLeft: `${12 + n.depth * 14}px` }}
                title={n.code.description ?? undefined}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0 ring-1 ring-black/5 mt-1"
                  style={{ background: color }}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] text-slate-800 truncate">{n.code.name}</span>
                  {showDefinitions && n.code.description && (
                    <span className="block text-[11px] text-slate-500 leading-tight line-clamp-2 mt-0.5">
                      {n.code.description}
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
      <div className="border-t border-slate-100 p-2.5 bg-slate-50">
        <textarea
          value={note}
          onChange={(e) => setNote(emDash(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && filtered.length > 0) {
              e.preventDefault();
              commit(filtered[0].code.id);
            }
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="Optional note for this annotation…"
          rows={1}
          className="w-full px-2.5 py-1.5 text-[12px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
        />
        {canSendToNote && (
          <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-900 cursor-pointer">
            <input
              type="checkbox"
              checked={sendToNote}
              onChange={(e) => setSendToNote(e.target.checked)}
              className="accent-amber-600"
            />
            Also link this annotation in the open note
          </label>
        )}
      </div>
    </div>
  );
});

function AnnotationsPanel({
  doc,
  codes,
  annotations,
  focusedAnnotationId,
  showDefinitions,
  collapsed,
  height,
  onToggleCollapsed,
  onResize,
  onFocus,
  onDelete,
  onUpdate,
  onSendToNote,
}: {
  doc: Document;
  codes: Code[];
  annotations: Annotation[];
  focusedAnnotationId: string | null;
  showDefinitions: boolean;
  collapsed: boolean;
  height: number;
  onToggleCollapsed: () => void;
  onResize: (n: number) => void;
  onFocus: (id: string | null) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Annotation>) => void;
  onSendToNote?: (annData: { id: string; start: number; end: number; codeId: string }) => void;
}) {
  if (annotations.length === 0) {
    return (
      <div className="border-t border-slate-200 bg-slate-50 px-8 py-3">
        <div className="max-w-[760px] mx-auto text-[12px] text-slate-400 italic">
          No annotations yet. Select text above and pick a code from the popover to begin.
        </div>
      </div>
    );
  }
  return (
    <div
      className="border-t border-slate-200 bg-slate-50 relative flex flex-col"
      style={{ height: collapsed ? 'auto' : `${height}px` }}
    >
      {!collapsed && (
        <RowResizeHandle
          edge="top"
          height={height}
          min={120}
          max={800}
          onChange={onResize}
        />
      )}
      <div className="px-8 py-2 flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex items-center gap-1.5 text-[10px] uppercase font-semibold tracking-[0.12em] text-slate-500 hover:text-slate-800 transition-colors"
          title={collapsed ? 'show annotations' : 'hide annotations'}
        >
          <span className="text-[10px] text-slate-400 w-3">{collapsed ? '▸' : '▾'}</span>
          <span>Annotations · {annotations.length}</span>
        </button>
      </div>
      {collapsed ? null : (
      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-3">
      <div className="max-w-[760px] mx-auto">
        <ul className="space-y-1.5">
          {annotations.map((a) => {
            const codeForA = codes.find((c) => c.id === a.codeId);
            const color = resolveColor(codes, a.codeId);
            const path = codePathString(codes, a.codeId);
            const focused = focusedAnnotationId === a.id;
            return (
              <li
                key={a.id}
                onClick={() => onFocus(focused ? null : a.id)}
                className={`group p-2 rounded border cursor-pointer transition-colors ${
                  focused
                    ? 'bg-white border-blue-300 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0 ring-1 ring-black/5"
                    style={{ background: color }}
                  />
                  <span className="text-[12px] font-semibold text-slate-700">{path}</span>
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums ml-auto">
                    {a.start}–{a.end}
                  </span>
                  {onSendToNote && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSendToNote({
                          id: a.id,
                          start: a.start,
                          end: a.end,
                          codeId: a.codeId,
                        });
                      }}
                      className="opacity-0 group-hover:opacity-100 text-amber-600 hover:text-amber-900 text-[10px] font-semibold uppercase tracking-wider transition-opacity px-1.5 py-0.5 rounded hover:bg-amber-50"
                      title="send a link to the first open note pane"
                    >
                      → note
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(a.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 text-[14px] transition-opacity"
                    title="delete"
                  >
                    ×
                  </button>
                </div>
                {(focused || showDefinitions) && codeForA?.description && (
                  <div className="mt-1 text-[11px] text-slate-500 leading-snug border-l-2 border-slate-200 pl-2">
                    {codeForA.description}
                  </div>
                )}
                <div className="mt-1 text-[13px] text-slate-700 italic">
                  “{doc.text.slice(a.start, a.end).slice(0, 200)}
                  {a.end - a.start > 200 ? '…' : ''}”
                </div>
                {focused && (
                  <textarea
                    value={a.note ?? ''}
                    onChange={(e) => onUpdate(a.id, { note: emDash(e.target.value) })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Add a note..."
                    rows={2}
                    className="mt-2 w-full px-2 py-1 text-[12px] border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>
      </div>
      )}
    </div>
  );
}

function ToggleBtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-[12px] font-semibold rounded-md transition-colors ${
        active
          ? 'bg-slate-900 text-white shadow-sm'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function rangeOffset(container: HTMLElement, node: Node, offset: number): number {
  if (!container.contains(node)) return -1;
  const range = document.createRange();
  range.selectNodeContents(container);
  try {
    range.setEnd(node, offset);
  } catch {
    return -1;
  }
  return range.toString().length;
}

function NoteDocViewer({
  doc,
  qcLinkOptions,
  onUpdateDoc,
  onJumpToQcLink,
  onClose,
  showPaneControls,
  onPaneDragStart,
  onPaneDragEnd,
}: {
  doc: Document;
  qcLinkOptions?: QcLinkOptions;
  onUpdateDoc: (patch: Partial<Document>) => void;
  onJumpToQcLink?: (href: string) => void;
  onClose?: () => void;
  showPaneControls?: boolean;
  onPaneDragStart?: () => void;
  onPaneDragEnd?: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  useEffect(() => setTitle(doc.title), [doc.id]);

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col">
      {showPaneControls && (
        <div className="flex items-center px-3 py-1.5 border-b border-slate-100 bg-amber-50/60">
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              onPaneDragStart?.();
            }}
            onDragEnd={() => onPaneDragEnd?.()}
            className="cursor-grab text-amber-700/60 hover:text-amber-900 text-[12px] select-none flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white transition-colors"
            title="drag to reorder this pane"
          >
            <span>⋮⋮</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold">drag</span>
          </span>
          <span className="ml-2 text-[10px] uppercase tracking-wider font-semibold text-amber-700">
            note
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="close this note"
              className="ml-auto w-7 h-7 rounded-md text-slate-400 hover:text-slate-900 hover:bg-white flex items-center justify-center text-[18px] transition-colors"
            >
              ×
            </button>
          )}
        </div>
      )}
      <div className="px-6 pt-5 pb-3 border-b border-slate-200 bg-white">
        <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-amber-700 mb-1">
          Note
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(emDash(e.target.value))}
          onBlur={() => {
            const v = title.trim() || 'Untitled note';
            if (v !== doc.title) onUpdateDoc({ title: v });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          placeholder="Note title"
          className="w-full font-sans font-bold text-[24px] leading-tight text-slate-900 placeholder-slate-300 border-none focus:outline-none focus:ring-0 bg-transparent"
          style={{ letterSpacing: '-0.02em' }}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-amber-50/30">
        <MarkdownEditor
          value={doc.text}
          onChange={(v) => onUpdateDoc({ text: v })}
          onQcLinkClick={onJumpToQcLink}
          qcLinkOptions={qcLinkOptions}
          defaultTab="preview"
          placeholder="Write commentary, link annotations from other docs, take running notes. Markdown supported."
          minHeight={500}
        />
      </div>
    </div>
  );
}

function countWords(text: string): number {
  if (!text) return 0;
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

function hexAlpha(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

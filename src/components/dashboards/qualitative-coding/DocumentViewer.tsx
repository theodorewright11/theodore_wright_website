import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  annRanges,
  annotationsForDoc,
  buildCodeTree,
  buildLines,
  codePathString,
  descendantIds,
  flattenTree,
  nextPaletteColor,
  resolveColor,
  segmentText,
  type LinesMode,
} from './compute';
import AnnotationEditModal from './AnnotationEditModal';
import CodeEditModal from './CodeEditModal';
import ColorPicker from './ColorPicker';
import { MarkdownEditor, type QcLinkOptions } from './Markdown';
import { ResizeHandle, RowResizeHandle } from './Resizable';
import { cryptoRandomId, emDash } from './storage';
import type { Annotation, Code, Document, MetadataField } from './types';
import ThemeMembershipEditor from './ThemeMembershipEditor';

// Rubric anchors for annotation accuracy (1–5). Shown as button tooltips.
const ACCURACY_RUBRIC = [
  '1 · code does not capture this segment',
  '2 · loosely captures — notably ambiguous label',
  '3 · partially captures with some ambiguity',
  '4 · mostly captures with minor ambiguity',
  '5 · precisely captures — clear, informative shorthand',
];

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
  onAddRangeToAnnotation?: (id: string, start: number, end: number) => void;
  onRemoveRangeFromAnnotation?: (id: string, rangeIdx: number) => void;
  onSendAnnotationToNote?: (
    annData: {
      id: string;
      ranges: { start: number; end: number }[];
      codeId: string;
    },
  ) => void;
  // Full theme list for the active project (so the annotations panel can show
  // current memberships + the add UI inline).
  themes?: import('./types').Theme[];
  onLinkAnnotationToTheme?: (
    themeId: string,
    annotationId: string,
    weight: 'core' | 'supporting',
  ) => void;
  onUnlinkAnnotationFromTheme?: (themeId: string, annotationId: string) => void;
  // Add the current selection to a theme directly. Subsumed annotations get
  // linked individually; if none, the raw span is stored as an uncoded
  // highlight on the theme. Returns counts for the optional toast.
  onAddThemeFromSelection?: (
    themeId: string,
    selStart: number,
    selEnd: number,
    weight: 'core' | 'supporting',
  ) => { linkedCount: number; uncodedAdded: boolean };
  showThemeAddInPopover?: boolean;
  onHideThemeAddInPopover?: () => void;
  onShowThemeAddInPopover?: () => void;
  // When set, the doc body highlights annotations linked to this theme and
  // dims everything else. Works in parallel with selectedCodeId.
  selectedThemeId?: string | null;
  onSetSelectedThemeId?: (id: string | null) => void;
  // Toggle whether code highlights show on text (and the line-view code
  // margin renders). Defaults to on.
  showCodes?: boolean;
  onToggleShowCodes?: () => void;
  // Toggle whether theme core/supporting underlines paint by default.
  showThemes?: boolean;
  onToggleShowThemes?: () => void;
  canSendToNote?: boolean;
  qcLinkOptions?: QcLinkOptions;
  onCreateCode?: (
    name: string,
    parentId?: string | null,
    color?: string | null,
  ) => string;
  onUpdateCode?: (codeId: string, patch: Partial<Code>) => void;
  onAddParentLink?: (codeId: string, parentId: string) => void;
  onRemoveParentLink?: (codeId: string, parentId: string) => void;
  lineView?: boolean;
  onToggleLineView?: () => void;
  linesMode?: 'sentence' | 'chars';
  linesCharsN?: number;
  onSetLinesMode?: (m: 'sentence' | 'chars') => void;
  onSetLinesCharsN?: (n: number) => void;
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
  onAddRangeToAnnotation,
  onRemoveRangeFromAnnotation,
  onSendAnnotationToNote,
  themes: themesProp,
  onLinkAnnotationToTheme,
  onUnlinkAnnotationFromTheme,
  onAddThemeFromSelection,
  showThemeAddInPopover = true,
  onHideThemeAddInPopover,
  onShowThemeAddInPopover,
  selectedThemeId = null,
  onSetSelectedThemeId,
  showCodes = true,
  onToggleShowCodes,
  showThemes = false,
  onToggleShowThemes,
  canSendToNote,
  qcLinkOptions,
  onCreateCode,
  onUpdateCode,
  onAddParentLink,
  onRemoveParentLink,
  lineView,
  onToggleLineView,
  linesMode,
  linesCharsN,
  onSetLinesMode,
  onSetLinesCharsN,
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
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
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

  // When a theme is selected from the doc toolbar, compute which annotations
  // are part of it (direct links + auto-include codes) and which ranges in
  // this doc were added directly to the theme as uncoded highlights.
  const selectedTheme = useMemo(
    () =>
      selectedThemeId
        ? (themesProp ?? []).find((t) => t.id === selectedThemeId) ?? null
        : null,
    [themesProp, selectedThemeId],
  );
  const themeAnnotationWeights = useMemo(() => {
    const m = new Map<string, 'core' | 'supporting'>();
    if (!selectedTheme) return m;
    for (const link of selectedTheme.annotationLinks) {
      m.set(link.annotationId, link.weight);
    }
    if (selectedTheme.includeCodeIds.length > 0) {
      const codeIdSet = new Set<string>();
      for (const cid of selectedTheme.includeCodeIds) {
        for (const d of descendantIds(codes, cid)) codeIdSet.add(d);
      }
      for (const a of docAnnotations) {
        if (m.has(a.id)) continue;
        if (codeIdSet.has(a.codeId)) m.set(a.id, 'supporting');
      }
    }
    return m;
  }, [selectedTheme, codes, docAnnotations]);
  const themeUncodedDocRanges = useMemo(() => {
    if (!selectedTheme) return [] as { start: number; end: number; weight: 'core' | 'supporting' }[];
    const out: { start: number; end: number; weight: 'core' | 'supporting' }[] = [];
    for (const h of selectedTheme.uncodedHighlights ?? []) {
      if (h.docId !== doc.id) continue;
      for (const r of h.ranges ?? []) out.push({ start: r.start, end: r.end, weight: h.weight });
    }
    return out;
  }, [selectedTheme, doc.id]);
  const segments = useMemo(
    () =>
      segmentText(
        doc.text,
        docAnnotations,
        pending ?? undefined,
        themeUncodedDocRanges,
      ),
    [doc.text, docAnnotations, pending, themeUncodedDocRanges],
  );

  const lines = useMemo(
    () => buildLines(doc.text, linesMode ?? 'sentence', linesCharsN ?? 100),
    [doc.text, linesMode, linesCharsN],
  );

  const renderSegment = (seg: ReturnType<typeof segmentText>[number], key: React.Key) => {
    // When themes are toggled on, figure out the strongest weight (core >
    // supporting) for the chosen theme. If no specific theme is selected,
    // default to checking ALL themes — text in any theme gets underlined.
    const themeWeight: 'core' | 'supporting' | null = (() => {
      if (!showThemes) return null;
      const themesToCheck = selectedTheme
        ? [selectedTheme]
        : (themesProp ?? []);
      let hasCore = false;
      let hasSupporting = false;
      for (const t of themesToCheck) {
        // Direct annotation links covering any annotation on this segment
        for (const a of seg.annotations) {
          const link = t.annotationLinks.find((l) => l.annotationId === a.id);
          if (link) {
            if (link.weight === 'core') hasCore = true;
            else hasSupporting = true;
          }
        }
        // Auto-include via codeIds
        if (t.includeCodeIds.length > 0) {
          const codeSet = new Set<string>();
          for (const cid of t.includeCodeIds) {
            for (const d of descendantIds(codes, cid)) codeSet.add(d);
          }
          for (const a of seg.annotations) {
            if (codeSet.has(a.codeId)) hasSupporting = true;
          }
        }
        // Uncoded highlights — only relevant when no annotations on segment
        if (seg.themeHighlight) {
          for (const h of t.uncodedHighlights ?? []) {
            if (h.docId !== doc.id) continue;
            for (const r of h.ranges ?? []) {
              if (r.start <= seg.start && r.end >= seg.end) {
                if (h.weight === 'core') hasCore = true;
                else hasSupporting = true;
              }
            }
          }
        }
      }
      if (hasCore) return 'core';
      if (hasSupporting) return 'supporting';
      return null;
    })();
    if (seg.annotations.length === 0) {
      if (seg.pending) {
        return (
          <span
            key={key}
            style={{ backgroundColor: 'rgba(254, 240, 138, 0.85)' }}
          >
            {seg.text}
          </span>
        );
      }
      // Uncoded theme-only segment (no annotations on this stretch).
      if (showThemes && themeWeight) {
        const violet = '#8b5cf6';
        return (
          <span
            key={key}
            style={{
              backgroundColor:
                themeWeight === 'core'
                  ? hexAlpha(violet, 0.38)
                  : hexAlpha(violet, 0.16),
              boxShadow:
                themeWeight === 'core'
                  ? `inset 0 -3px 0 ${violet}`
                  : `inset 0 -1px 0 ${hexAlpha(violet, 0.55)}`,
            }}
            title={
              selectedTheme
                ? `In theme "${selectedTheme.name}" (${themeWeight}, uncoded)`
                : `In a theme (${themeWeight}, uncoded)`
            }
          >
            {seg.text}
          </span>
        );
      }
      return <span key={key}>{seg.text}</span>;
    }
    const top = seg.annotations[seg.annotations.length - 1];
    const color = resolveColor(codes, top.codeId);
    const dim =
      (selectedCodeId !== null &&
        !seg.annotations.some((a) => a.codeId === selectedCodeId)) ||
      (showThemes && selectedTheme !== null && themeWeight === null);
    const isFocused =
      focusedAnnotationId !== null &&
      seg.annotations.some((a) => a.id === focusedAnnotationId);
    // Default code highlight only paints when Codes toggle is on.
    const baseShadow = !showCodes
      ? ''
      : isFocused
        ? `inset 0 -2px 0 ${color}`
        : `inset 0 -1px 0 ${color}`;
    // Theme underline paints on top when Themes is on AND the segment is in
    // a theme (the selected one, or any theme if none is picked).
    const themeShadow =
      themeWeight === 'core'
        ? `${baseShadow ? ', ' : ''}inset 0 -3px 0 ${color}`
        : themeWeight === 'supporting'
          ? `${baseShadow ? ', ' : ''}inset 0 -1px 0 ${hexAlpha(color, 0.55)}`
          : '';
    const bgAlpha = themeWeight === 'core' ? 0.4 : isFocused ? 0.4 : 0.2;
    return (
      <span
        key={key}
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
            : showCodes
              ? hexAlpha(color, bgAlpha)
              : 'transparent',
          boxShadow: baseShadow + themeShadow,
        }}
        title={
          seg.annotations.map((a) => codePathString(codes, a.codeId)).join(' · ') +
          (themeWeight ? ` · in theme (${themeWeight})` : '')
        }
      >
        {seg.text}
      </span>
    );
  };

  const annotationsByLine = useMemo(() => {
    const map = new Map<number, Annotation[]>();
    for (const a of docAnnotations) {
      // Place the annotation chip on the first line touched by any of its
      // ranges. Multi-range annotations only get one chip — the panel below
      // lists every range.
      const ranges = annRanges(a);
      const firstStart =
        ranges.length === 0 ? 0 : Math.min(...ranges.map((r) => r.start));
      const line = lines.find((l) => firstStart >= l.start && firstStart <= l.end);
      if (!line) continue;
      const arr = map.get(line.number) ?? [];
      arr.push(a);
      map.set(line.number, arr);
    }
    return map;
  }, [lines, docAnnotations]);

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

  // Ctrl/Cmd-C while a selection popover is open copies the selected span to
  // the clipboard. The popover steals focus via autoFocus on its search input,
  // which means native copy on the doc selection doesn't fire — so synthesise
  // it here.
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key !== 'c' && e.key !== 'C') return;
      const target = e.target as HTMLElement | null;
      // If the user is typing in an input that has its own selected text, let
      // the browser handle copy normally.
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const hasOwnSel =
          target.selectionStart != null &&
          target.selectionEnd != null &&
          target.selectionStart !== target.selectionEnd;
        if (hasOwnSel) return;
      }
      e.preventDefault();
      const span = doc.text.slice(pending.start, pending.end);
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(span).catch(() => {});
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pending, doc.text]);

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
        // Keep focusedAnnotationId so the popover can offer "Move range to
        // this selection" for the focused annotation.
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
      // Truncate ranges that extend past the new doc length; drop any range
      // that starts past the end. If no ranges remain, delete the annotation.
      const ranges = annRanges(a);
      const clamped = ranges
        .filter((r) => r.start < newLen)
        .map((r) => ({ start: r.start, end: Math.min(r.end, newLen) }));
      if (clamped.length === 0) {
        onDeleteAnnotation(a.id);
      } else if (
        clamped.length !== ranges.length ||
        clamped.some((r, i) => r.end !== ranges[i].end)
      ) {
        onUpdateAnnotation(a.id, { ranges: clamped });
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

      <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-200 bg-white sticky top-0 z-10 overflow-x-auto">
        <ToggleBtn active={mode === 'view'} onClick={() => mode === 'edit' && commitEdit()}>
          Read &amp; code
        </ToggleBtn>
        <ToggleBtn active={mode === 'edit'} onClick={() => setMode('edit')}>
          Edit text
        </ToggleBtn>
        <div className="w-px h-5 bg-slate-200 mx-1 flex-shrink-0" />
        <button
          type="button"
          onClick={onToggleCodebook}
          title="open codebook side panel"
          className={`flex-shrink-0 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
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
          className={`flex-shrink-0 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
            notesOpen
              ? 'bg-amber-100 text-amber-900'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Notes{doc.notes && doc.notes.length > 0 ? ' •' : ''}
        </button>
        {onToggleLineView && (
          <button
            type="button"
            onClick={onToggleLineView}
            title={
              lineView
                ? 'switch to paragraph view'
                : 'show line numbers + code margin'
            }
            className={`flex-shrink-0 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
              lineView
                ? 'bg-emerald-100 text-emerald-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Lines
          </button>
        )}
        {onToggleShowCodes && (
          <button
            type="button"
            onClick={onToggleShowCodes}
            title={
              showCodes
                ? 'hide code highlights / code margin'
                : 'show code highlights / code margin'
            }
            className={`flex-shrink-0 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
              showCodes
                ? 'bg-blue-100 text-blue-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Codes
          </button>
        )}
        {themesProp && themesProp.length > 0 && onToggleShowThemes && (
          <button
            type="button"
            onClick={onToggleShowThemes}
            title={
              showThemes
                ? 'hide theme underlines / theme margin'
                : 'underline text by core/supporting for the selected theme'
            }
            className={`flex-shrink-0 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
              showThemes
                ? 'bg-violet-100 text-violet-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Themes
          </button>
        )}
        {showThemes && themesProp && themesProp.length > 1 && onSetSelectedThemeId && (
          <select
            value={selectedThemeId ?? ''}
            onChange={(e) => onSetSelectedThemeId(e.target.value || null)}
            className="flex-shrink-0 px-2 py-1.5 text-[12px] font-medium rounded-md border border-violet-300 bg-violet-50 text-violet-800"
            title="pick which theme to highlight"
          >
            <option value="">All themes</option>
            {themesProp.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        {lineView && onSetLinesMode && (
          <div className="flex items-center bg-slate-100 rounded-md p-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => onSetLinesMode('sentence')}
              className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors ${
                (linesMode ?? 'sentence') === 'sentence'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sentences
            </button>
            <button
              type="button"
              onClick={() => onSetLinesMode('chars')}
              className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors ${
                linesMode === 'chars'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Chars
            </button>
            {linesMode === 'chars' && onSetLinesCharsN && (
              <input
                type="number"
                value={linesCharsN ?? 100}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n > 0 && n < 100000) onSetLinesCharsN(n);
                }}
                min={20}
                max={2000}
                step={10}
                className="ml-1 w-[56px] px-1.5 py-0.5 text-[11px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                title="chars per line"
              />
            )}
          </div>
        )}
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
        ) : lineView ? (
          <div className="max-w-[1100px] mx-auto px-6 py-6">
            <div
              ref={containerRef}
              onMouseUp={handleMouseUp}
              onKeyUp={handleMouseUp}
              className="font-sans text-[15px] text-slate-800 selection:bg-yellow-200"
              style={{ tabSize: 4 }}
            >
              {doc.text.length === 0 ? (
                <div className="text-slate-400 italic">
                  This document is empty. Switch to{' '}
                  <span className="font-semibold">Edit text</span> to add content.
                </div>
              ) : (
                lines.map((line) => {
                  const segsInLine = segments
                    .filter((s) => s.start < line.end + 1 && s.end > line.start)
                    .map((s) => ({
                      ...s,
                      start: Math.max(s.start, line.start),
                      end: Math.min(s.end, line.end),
                      text: doc.text.slice(
                        Math.max(s.start, line.start),
                        Math.min(s.end, line.end),
                      ),
                    }))
                    .filter((s) => s.text.length > 0);
                  const annsHere = annotationsByLine.get(line.number) ?? [];
                  return (
                    <div
                      key={line.number}
                      className="flex gap-3 py-0.5 border-l-2 border-transparent hover:border-slate-200"
                    >
                      <span className="w-10 text-right text-[11px] text-slate-300 select-none mt-1 font-mono flex-shrink-0">
                        {line.number}
                      </span>
                      <div
                        data-line-start={line.start}
                        className="flex-1 min-w-0 leading-[1.65] whitespace-pre-wrap break-words"
                      >
                        {segsInLine.length === 0
                          ? line.text.length === 0
                            ? ' '
                            : line.text
                          : segsInLine.map((seg, i) =>
                              renderSegment(seg, `${line.number}-${i}`),
                            )}
                      </div>
                      <div className="w-[260px] flex-shrink-0 flex flex-wrap gap-1 mt-0.5 self-start">
                        {annsHere.map((a) => {
                          const color = resolveColor(codes, a.codeId);
                          const path = codePathString(codes, a.codeId);
                          const focused = focusedAnnotationId === a.id;
                          return (
                            <span
                              key={a.id}
                              className="group/chip inline-flex items-start gap-0.5 max-w-full"
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFocusedAnnotationId(focused ? null : a.id);
                                }}
                                className={`text-[11px] px-1.5 py-0.5 rounded ring-1 transition-all text-left leading-snug break-words ${
                                  focused
                                    ? 'ring-slate-700 shadow-sm'
                                    : 'ring-black/5 hover:ring-slate-400'
                                }`}
                                style={{
                                  backgroundColor: hexAlpha(color, focused ? 0.4 : 0.18),
                                  color: '#1e293b',
                                }}
                                title={a.note ? `${path} — ${a.note}` : path}
                              >
                                {path}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingAnnotationId(a.id);
                                }}
                                title="edit this annotation (accuracy, note, themes)"
                                className="opacity-0 group-hover/chip:opacity-100 text-[10px] text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded w-4 h-4 flex items-center justify-center transition-opacity self-center"
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteAnnotation(a.id);
                                }}
                                title="delete this annotation"
                                className="opacity-0 group-hover/chip:opacity-100 text-[12px] text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded w-4 h-4 flex items-center justify-center transition-opacity self-center leading-none"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
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
                segments.map((seg, i) => renderSegment(seg, i))
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
        themes={themesProp}
        onLinkToTheme={onLinkAnnotationToTheme}
        onUnlinkFromTheme={onUnlinkAnnotationFromTheme}
        onRemoveRange={onRemoveRangeFromAnnotation}
        onEditAnnotation={(annId) => setEditingAnnotationId(annId)}
      />

      {pending && (() => {
        const focusedAnn = focusedAnnotationId
          ? docAnnotations.find((a) => a.id === focusedAnnotationId)
          : null;
        const focusedRanges = focusedAnn ? annRanges(focusedAnn) : [];
        const alreadyHasRange = focusedRanges.some(
          (r) => r.start === pending.start && r.end === pending.end,
        );
        const popoverFocused = focusedAnn
          ? {
              id: focusedAnn.id,
              codePath: codePathString(codes, focusedAnn.codeId),
              color: resolveColor(codes, focusedAnn.codeId),
              ranges: focusedRanges,
              alreadyHasRange,
            }
          : undefined;
        return (
        <SelectionPopover
          ref={popoverRef}
          pending={pending}
          codes={codes}
          text={doc.text}
          showDefinitions={showCodeDefinitions}
          canSendToNote={!!canSendToNote && !!onSendAnnotationToNote}
          onCreateCode={onCreateCode}
          focusedAnnotation={popoverFocused}
          onMoveFocused={
            popoverFocused && !alreadyHasRange
              ? () => {
                  onUpdateAnnotation(popoverFocused.id, {
                    ranges: [{ start: pending.start, end: pending.end }],
                  });
                  setPending(null);
                  window.getSelection()?.removeAllRanges();
                }
              : undefined
          }
          onAddRangeToFocused={
            popoverFocused && !alreadyHasRange && onAddRangeToAnnotation
              ? () => {
                  onAddRangeToAnnotation(
                    popoverFocused.id,
                    pending.start,
                    pending.end,
                  );
                  setPending(null);
                  window.getSelection()?.removeAllRanges();
                }
              : undefined
          }
          themes={themesProp}
          showThemeAdd={showThemeAddInPopover}
          onHideThemeAdd={onHideThemeAddInPopover}
          onShowThemeAdd={onShowThemeAddInPopover}
          onAddToTheme={
            onAddThemeFromSelection
              ? (themeId, weight) =>
                  onAddThemeFromSelection(
                    themeId,
                    pending.start,
                    pending.end,
                    weight,
                  )
              : undefined
          }
          onAfterThemeAdd={() => {
            setPending(null);
            window.getSelection()?.removeAllRanges();
          }}
          onPick={(codeIds, note, sendToNote) => {
            for (const codeId of codeIds) {
              const id = cryptoRandomId();
              onAddAnnotation(pending.start, pending.end, codeId, note, id);
              if (sendToNote && onSendAnnotationToNote) {
                onSendAnnotationToNote({
                  id,
                  ranges: [{ start: pending.start, end: pending.end }],
                  codeId,
                });
              }
            }
            setPending(null);
            window.getSelection()?.removeAllRanges();
          }}
          onCancel={() => setPending(null)}
        />
        );
      })()}
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
    {editingCodeId && onUpdateCode && (() => {
      const editingCode = codes.find((c) => c.id === editingCodeId);
      if (!editingCode) return null;
      return (
        <CodeEditModal
          code={editingCode}
          allCodes={codes}
          onSave={(patch) => onUpdateCode(editingCodeId, patch)}
          onAddParent={onAddParentLink}
          onRemoveParent={onRemoveParentLink}
          onClose={() => setEditingCodeId(null)}
        />
      );
    })()}
    {editingAnnotationId && (() => {
      const annBeingEdited = docAnnotations.find((a) => a.id === editingAnnotationId);
      if (!annBeingEdited) return null;
      return (
        <AnnotationEditModal
          annotation={annBeingEdited}
          codes={codes}
          themes={themesProp ?? []}
          onUpdate={(patch) => onUpdateAnnotation(editingAnnotationId, patch)}
          onLinkToTheme={(themeId, w) =>
            onLinkAnnotationToTheme?.(themeId, editingAnnotationId, w)
          }
          onUnlinkFromTheme={(themeId) =>
            onUnlinkAnnotationFromTheme?.(themeId, editingAnnotationId)
          }
          onDelete={() => onDeleteAnnotation(editingAnnotationId)}
          onClose={() => setEditingAnnotationId(null)}
        />
      );
    })()}
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
    <div className="px-8 pt-3 pb-2 border-b border-slate-200 bg-white">
      <div className="max-w-[760px] mx-auto flex items-baseline gap-2 flex-wrap">
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
          className="flex-1 min-w-[200px] px-0 py-0 font-sans font-bold text-[20px] leading-tight text-slate-900 placeholder-slate-300 border-none focus:outline-none focus:ring-0 bg-transparent"
          style={{ letterSpacing: '-0.015em' }}
        />
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
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
            placeholder="folder"
            className="w-[180px] px-1 py-0.5 text-[11px] text-slate-600 placeholder-slate-300 bg-transparent border-none focus:outline-none focus:bg-slate-50 rounded"
          />
        </div>
      </div>
      {metadataSchema.length > 0 && (
        <div className="max-w-[760px] mx-auto mt-1.5">
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
  onPick: (codeIds: string[], note?: string, sendToNote?: boolean) => void;
  onCreateCode?: (
    name: string,
    parentId?: string | null,
    color?: string | null,
  ) => string;
  onCancel: () => void;
  focusedAnnotation?: {
    id: string;
    codePath: string;
    color: string;
    ranges: { start: number; end: number }[];
    alreadyHasRange: boolean;
  };
  onMoveFocused?: () => void;
  onAddRangeToFocused?: () => void;
  themes?: import('./types').Theme[];
  // When invoked, applies the subsume-or-uncode rule against the selection.
  onAddToTheme?: (
    themeId: string,
    weight: 'core' | 'supporting',
  ) => { linkedCount: number; uncodedAdded: boolean };
  // Called once after the user commits a (possibly multi) theme-add batch.
  onAfterThemeAdd?: () => void;
  showThemeAdd?: boolean;
  onHideThemeAdd?: () => void;
  onShowThemeAdd?: () => void;
};

const SelectionPopover = forwardRef<HTMLDivElement, PopoverProps>(function SelectionPopover(
  {
    pending,
    codes,
    text,
    showDefinitions,
    canSendToNote,
    onPick,
    onCreateCode,
    onCancel,
    focusedAnnotation,
    onAddRangeToFocused,
    onMoveFocused,
    themes: popoverThemes,
    onAddToTheme,
    onAfterThemeAdd,
    showThemeAdd = true,
    onHideThemeAdd,
    onShowThemeAdd,
  },
  ref,
) {
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [sendToNote, setSendToNote] = useState(false);
  const [multiMode, setMultiMode] = useState(false);
  const [pickedCodeIds, setPickedCodeIds] = useState<Set<string>>(new Set());
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  // Default to the next palette colour so root codes don't end up colourless.
  // null = inherit from parent (only meaningful when createParentId is set).
  const [createColor, setCreateColor] = useState<string | null>(() =>
    nextPaletteColor(codes),
  );
  // Tree view (with duplicates for multi-parent codes) for browsing, plus a
  // by-id-deduped variant so the search results show each code once.
  const flat = useMemo(() => flattenTree(buildCodeTree(codes)), [codes]);
  const flatUnique = useMemo(() => {
    const seen = new Set<string>();
    return flat.filter((n) => {
      if (seen.has(n.code.id)) return false;
      seen.add(n.code.id);
      return true;
    });
  }, [flat]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Always use the deduped list — same code shouldn't appear twice in the
    // popover even when it has multiple parents. Also avoids the duplicate
    // React-key bug that caused ghost rows to persist when typing into the
    // search box.
    if (!q) return flatUnique;
    return flatUnique.filter((n) => n.code.name.toLowerCase().includes(q));
  }, [flatUnique, query]);
  const trimmedQuery = query.trim();
  const hasExactMatch = useMemo(
    () =>
      !!trimmedQuery &&
      codes.some((c) => c.name.toLowerCase() === trimmedQuery.toLowerCase()),
    [codes, trimmedQuery],
  );
  const canCreate = !!onCreateCode && trimmedQuery.length > 0 && !hasExactMatch;

  const commitOne = (codeId: string) =>
    onPick([codeId], note.trim() || undefined, sendToNote);

  const commitMany = () => {
    if (pickedCodeIds.size === 0) return;
    onPick([...pickedCodeIds], note.trim() || undefined, sendToNote);
  };

  const togglePick = (codeId: string) => {
    setPickedCodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(codeId)) next.delete(codeId);
      else next.add(codeId);
      return next;
    });
  };

  const toggleMulti = () => {
    setMultiMode((v) => {
      if (v) setPickedCodeIds(new Set());
      return !v;
    });
  };

  const createAndPick = () => {
    if (!onCreateCode) return;
    const name = trimmedQuery;
    if (!name) return;
    // Pass undefined to let the root pick (next palette / inherit), pass the
    // chosen hex to override.
    const id = onCreateCode(name, createParentId, createColor ?? undefined);
    if (!id) return;
    if (multiMode) {
      setPickedCodeIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setQuery('');
    } else {
      commitOne(id);
    }
  };

  const handleEnter = () => {
    if (filtered.length === 0) {
      if (canCreate) createAndPick();
      return;
    }
    if (multiMode) togglePick(filtered[0].code.id);
    else commitOne(filtered[0].code.id);
  };

  // Flip above the selection when there isn't enough room below. 480px is the
  // popover's largest reasonable height (search + list capped at 380px +
  // header + bottom note). If we'd overflow the viewport bottom, place above.
  const POPOVER_EST_HEIGHT = 480;
  const selBottom = pending.rect.bottom - window.scrollY;
  const selTop = pending.rect.top - window.scrollY;
  const flipAbove = selBottom + 8 + POPOVER_EST_HEIGHT > window.innerHeight - 8;
  const topPx = flipAbove
    ? Math.max(8, selTop - POPOVER_EST_HEIGHT - 8)
    : selBottom + 8;

  return (
    <div
      ref={ref}
      role="dialog"
      className="fixed z-50 w-[380px] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex flex-col"
      style={{
        top: topPx,
        maxHeight: `calc(100vh - 16px)`,
        left: Math.min(
          window.innerWidth - 400,
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
            if (e.key === 'Enter') handleEnter();
            if (e.key === 'Escape') onCancel();
          }}
        />
        <button
          type="button"
          onClick={toggleMulti}
          className={`flex-shrink-0 h-8 mr-1 px-2 rounded text-[11px] font-semibold transition-colors ${
            multiMode
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
          title={multiMode ? 'switch to single-pick' : 'pick multiple codes at once'}
        >
          {multiMode ? `Multi · ${pickedCodeIds.size}` : 'Multi'}
        </button>
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
        {showThemeAdd && popoverThemes && popoverThemes.length > 0 && onAddToTheme && (
          <AddToThemeBlock
            themes={popoverThemes}
            onAddToTheme={onAddToTheme}
            onAfterAdd={onAfterThemeAdd}
            onHide={onHideThemeAdd}
          />
        )}
        {!showThemeAdd && popoverThemes && popoverThemes.length > 0 && onShowThemeAdd && (
          <div className="bg-violet-50/60 border-b border-violet-100 px-3 py-1.5 flex items-center justify-between text-[11px]">
            <span className="text-violet-700">Theme picker hidden</span>
            <button
              type="button"
              onClick={onShowThemeAdd}
              className="text-violet-700 hover:text-violet-900 font-semibold underline"
            >
              show
            </button>
          </div>
        )}
        {focusedAnnotation && onAddRangeToFocused && (
          <div className="bg-blue-50 border-b border-blue-100">
            <button
              type="button"
              onClick={onAddRangeToFocused}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-100 transition-colors"
              title="add this selection as another range of the focused annotation"
            >
              <span
                className="w-4 h-4 rounded-sm text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0"
                style={{ background: focusedAnnotation.color }}
              >
                +
              </span>
              <span className="text-[13px] text-blue-900 min-w-0 flex-1 leading-snug">
                Add this selection to{' '}
                <span className="font-semibold">“{focusedAnnotation.codePath}”</span>
                <span className="block text-[10px] text-blue-700 font-mono tabular-nums mt-0.5">
                  now {focusedAnnotation.ranges.length} range
                  {focusedAnnotation.ranges.length === 1 ? '' : 's'} → {focusedAnnotation.ranges.length + 1}
                </span>
              </span>
            </button>
          </div>
        )}
        {focusedAnnotation && onMoveFocused && (
          <div className="bg-blue-50/60 border-b border-blue-100">
            <button
              type="button"
              onClick={onMoveFocused}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-100 transition-colors"
              title="replace ALL of the focused annotation's ranges with just this selection"
            >
              <span
                className="w-4 h-4 rounded-sm text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0"
                style={{ background: focusedAnnotation.color }}
              >
                ↔
              </span>
              <span className="text-[13px] text-blue-900 min-w-0 flex-1 leading-snug">
                Replace{' '}
                <span className="font-semibold">“{focusedAnnotation.codePath}”</span>{' '}
                with just this selection
                <span className="block text-[10px] text-blue-700 font-mono tabular-nums mt-0.5">
                  drops {focusedAnnotation.ranges.length} existing range
                  {focusedAnnotation.ranges.length === 1 ? '' : 's'}
                </span>
              </span>
            </button>
          </div>
        )}
        {canCreate && (
          <div className="bg-emerald-50 border-b border-emerald-100">
            <button
              type="button"
              onClick={createAndPick}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-emerald-100 transition-colors"
              title="create a new code with this name"
            >
              <span className="w-4 h-4 rounded-sm bg-emerald-600 text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0">
                +
              </span>
              <span className="text-[13px] text-emerald-900 min-w-0 flex-1">
                Create code{' '}
                <span className="font-semibold">“{trimmedQuery}”</span>
                {createParentId && (() => {
                  const parent = codes.find((c) => c.id === createParentId);
                  return parent ? (
                    <span className="text-emerald-700">
                      {' '}under <em className="font-medium">{parent.name}</em>
                    </span>
                  ) : null;
                })()}
              </span>
            </button>
            <div className="px-3 pb-2 -mt-1 flex items-center gap-2">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-700">
                Parent
              </span>
              <select
                value={createParentId ?? ''}
                onChange={(e) => setCreateParentId(e.target.value || null)}
                className="flex-1 min-w-0 px-2 py-1 text-[11px] border border-emerald-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
              >
                <option value="">(top level)</option>
                {[...flatUnique]
                  .sort((a, b) =>
                    a.code.name.localeCompare(b.code.name, undefined, { sensitivity: 'base' }),
                  )
                  .map((n) => (
                    <option key={n.pathKey} value={n.code.id}>
                      {codePathString(codes, n.code.id)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="px-3 pb-2 flex items-start gap-2">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-700 pt-0.5">
                Color
              </span>
              <div className="flex-1 min-w-0">
                <ColorPicker
                  value={createColor}
                  onChange={setCreateColor}
                  allowInherit={createParentId !== null}
                  size="sm"
                />
              </div>
            </div>
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-[12px] text-slate-400 italic text-center">
            {canCreate ? 'No matching codes — create one above.' : 'No matching codes.'}
          </div>
        ) : (
          filtered.map((n) => {
            const color = resolveColor(codes, n.code.id);
            const picked = pickedCodeIds.has(n.code.id);
            return (
              <button
                key={n.pathKey}
                type="button"
                onClick={() =>
                  multiMode ? togglePick(n.code.id) : commitOne(n.code.id)
                }
                className={`w-full flex items-start gap-2 px-3 py-1.5 text-left transition-colors ${
                  picked ? 'bg-blue-100 hover:bg-blue-200' : 'hover:bg-blue-50'
                }`}
                style={{ paddingLeft: `${12 + n.depth * 14}px` }}
                title={n.code.description ?? undefined}
              >
                {multiMode && (
                  <span
                    className={`flex-shrink-0 w-3.5 h-3.5 rounded-sm border mt-0.5 flex items-center justify-center transition-colors ${
                      picked
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {picked && (
                      <span className="text-[10px] leading-none">✓</span>
                    )}
                  </span>
                )}
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0 ring-1 ring-black/5 mt-1"
                  style={{ background: color }}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] text-slate-800 leading-snug break-words">
                    {n.code.name}
                  </span>
                  {showDefinitions && n.code.description && (
                    <span className="block text-[11px] text-slate-500 leading-tight mt-0.5 break-words">
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
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (multiMode) commitMany();
              else if (filtered.length > 0) commitOne(filtered[0].code.id);
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
            Also link {multiMode && pickedCodeIds.size > 1 ? 'each annotation' : 'this annotation'} in
            the open note
          </label>
        )}
        {multiMode && (
          <button
            type="button"
            onClick={commitMany}
            disabled={pickedCodeIds.size === 0}
            className="mt-2 w-full px-3 py-2 text-[13px] font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            Commit {pickedCodeIds.size === 0
              ? '— pick codes above'
              : pickedCodeIds.size === 1
                ? '1 code'
                : `${pickedCodeIds.size} codes`}
          </button>
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
  themes,
  onLinkToTheme,
  onUnlinkFromTheme,
  onRemoveRange,
  onEditAnnotation,
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
  onSendToNote?: (annData: {
    id: string;
    ranges: { start: number; end: number }[];
    codeId: string;
  }) => void;
  themes?: import('./types').Theme[];
  onLinkToTheme?: (
    themeId: string,
    annotationId: string,
    weight: 'core' | 'supporting',
  ) => void;
  onUnlinkFromTheme?: (themeId: string, annotationId: string) => void;
  onRemoveRange?: (id: string, rangeIdx: number) => void;
  onEditAnnotation?: (annotationId: string) => void;
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
      <div className="px-8 py-1 flex items-center gap-2 flex-shrink-0">
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
            const ranges = annRanges(a);
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
                  {ranges.length > 1 && (
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider text-purple-700 bg-purple-100 rounded px-1.5 py-0.5"
                      title={`This annotation spans ${ranges.length} disjoint ranges`}
                    >
                      {ranges.length} ranges
                    </span>
                  )}
                  {a.accuracy && (
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-100 rounded px-1.5 py-0.5"
                      title={`Accuracy ${a.accuracy}/5${a.accuracyNotes ? ' — ' + a.accuracyNotes : ''}`}
                    >
                      Acc {a.accuracy}/5
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums ml-auto">
                    {ranges.map((r) => `${r.start}–${r.end}`).join(', ')}
                  </span>
                  {onEditAnnotation && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditAnnotation(a.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-900 text-[12px] transition-opacity px-1 py-0.5 rounded hover:bg-slate-100"
                      title="edit this annotation (accuracy, note, themes)"
                    >
                      ✎
                    </button>
                  )}
                  {onSendToNote && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSendToNote({
                          id: a.id,
                          ranges,
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
                    title="delete this whole annotation"
                  >
                    ×
                  </button>
                </div>
                {(focused || showDefinitions) && codeForA?.description && (
                  <div className="mt-1 text-[11px] text-slate-500 leading-snug border-l-2 border-slate-200 pl-2">
                    {codeForA.description}
                  </div>
                )}
                <div className="mt-1 space-y-1">
                  {ranges.length === 0 && (
                    <div className="text-[12px] text-slate-400 italic">
                      (no ranges — this annotation is empty)
                    </div>
                  )}
                  {ranges.map((r, idx) => {
                    const slice = doc.text.slice(r.start, r.end);
                    return (
                      <div key={idx} className="text-[13px] text-slate-700 italic flex items-start gap-1.5 group/range">
                        <span className="flex-1 min-w-0">
                          “{slice.slice(0, 200)}
                          {slice.length > 200 ? '…' : ''}”
                        </span>
                        {onRemoveRange && ranges.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveRange(a.id, idx);
                            }}
                            className="opacity-0 group-hover/range:opacity-100 flex-shrink-0 text-slate-400 hover:text-red-600 text-[14px] leading-none transition-opacity"
                            title="remove just this range"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {focused && a.note && (
                  <div className="mt-1 text-[12px] text-amber-900 bg-amber-50 border-l-2 border-amber-300 pl-3 py-1.5 leading-snug whitespace-pre-wrap">
                    {a.note}
                  </div>
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

// Compact theme-picker shown at the very top of the selection popover. Lets
// you add the current selection to any theme as Core or Supporting without
// going through the code-pick flow. If existing annotations are fully
// subsumed by the selection, each gets linked individually; otherwise the
// raw span is stored as an uncoded highlight on the theme.
function AddToThemeBlock({
  themes,
  onAddToTheme,
  onAfterAdd,
  onHide,
}: {
  themes: import('./types').Theme[];
  onAddToTheme: (
    themeId: string,
    weight: 'core' | 'supporting',
  ) => { linkedCount: number; uncodedAdded: boolean };
  onAfterAdd?: () => void;
  onHide?: () => void;
}) {
  const [picks, setPicks] = useState<Map<string, 'core' | 'supporting'>>(new Map());
  const apply = () => {
    for (const [tid, w] of picks) onAddToTheme(tid, w);
    setPicks(new Map());
    onAfterAdd?.();
  };
  const setWeight = (themeId: string, weight: 'core' | 'supporting') => {
    setPicks((prev) => {
      const next = new Map(prev);
      if (next.get(themeId) === weight) next.delete(themeId);
      else next.set(themeId, weight);
      return next;
    });
  };
  return (
    <div className="bg-violet-50 border-b border-violet-100 px-3 py-2">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[12px] text-violet-900 font-semibold">
          Add this selection to themes
        </span>
        <div className="flex items-center gap-1">
          {picks.size > 0 && (
            <button
              type="button"
              onClick={apply}
              className="px-2 py-1 text-[10px] uppercase font-semibold tracking-wider bg-violet-700 text-white hover:bg-violet-800 rounded"
            >
              Add to {picks.size}
            </button>
          )}
          {onHide && (
            <button
              type="button"
              onClick={onHide}
              className="text-[10px] text-violet-500 hover:text-violet-800 px-1.5 py-0.5"
              title="hide this block (re-enable on the Info page)"
            >
              hide
            </button>
          )}
        </div>
      </div>
      <div className="max-h-[140px] overflow-y-auto space-y-0.5">
        {themes.map((t) => {
          const cur = picks.get(t.id);
          return (
            <div
              key={t.id}
              className="flex items-center gap-1.5 text-[11px] py-0.5"
            >
              <span className="flex-1 min-w-0 text-violet-900 break-words">
                {t.name}
              </span>
              <button
                type="button"
                onClick={() => setWeight(t.id, 'core')}
                className={`px-1.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider rounded ${
                  cur === 'core'
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                }`}
              >
                Core
              </button>
              <button
                type="button"
                onClick={() => setWeight(t.id, 'supporting')}
                className={`px-1.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider rounded ${
                  cur === 'supporting'
                    ? 'bg-violet-700 text-white'
                    : 'bg-violet-100 text-violet-800 hover:bg-violet-200'
                }`}
              >
                Supporting
              </button>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-violet-700 mt-1.5 italic">
        Subsumed annotations link individually; otherwise the raw span is added uncoded.
      </div>
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
  // Line-view: each line's content div has data-line-start. Find the nearest
  // ancestor with that attribute and compute the offset within it, then add
  // the line start. Avoids global concatenation losing track of newlines
  // (which aren't in the DOM in line-view mode).
  let el: Node | null = node;
  while (el && el !== container) {
    if (el instanceof HTMLElement && el.dataset.lineStart != null) {
      const lineStart = Number(el.dataset.lineStart);
      const sub = document.createRange();
      sub.selectNodeContents(el);
      try {
        sub.setEnd(node, offset);
      } catch {
        return -1;
      }
      return lineStart + sub.toString().length;
    }
    el = el.parentNode;
  }
  // Inline view fallback below.
  return rangeOffsetInline(container, node, offset);
}

function rangeOffsetInline(container: HTMLElement, node: Node, offset: number): number {
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

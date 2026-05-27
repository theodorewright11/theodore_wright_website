import { useMemo, useRef, useState } from 'react';
import { codePathString } from './compute';
import { emDash } from './storage';
import type { Annotation, Code, Document } from './types';

export type QcLinkOptions = {
  projectId: string;
  docs: Document[];
  annotations: Annotation[];
  codes: Code[];
};

export function renderMarkdown(src: string): string {
  if (!src) return '';
  let text = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_m, _lang, body) => {
    return `<pre><code>${body.replace(/\n$/, '')}</code></pre>`;
  });

  const lines = text.split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let inBq = false;
  let paragraphBuf: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuf.length) {
      out.push(`<p>${inline(paragraphBuf.join(' '))}</p>`);
      paragraphBuf = [];
    }
  };
  const closeLists = () => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
    if (inBq) {
      out.push('</blockquote>');
      inBq = false;
    }
  };

  for (const raw of lines) {
    if (raw.startsWith('<pre>') || raw.startsWith('</code></pre>')) {
      flushParagraph();
      closeLists();
      out.push(raw);
      continue;
    }
    const line = raw.trimEnd();
    if (line.trim() === '') {
      flushParagraph();
      closeLists();
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      flushParagraph();
      closeLists();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (inBq) {
        out.push('</blockquote>');
        inBq = false;
      }
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (inBq) {
        out.push('</blockquote>');
        inBq = false;
      }
      if (!inOl) {
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushParagraph();
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (!inBq) {
        out.push('<blockquote>');
        inBq = true;
      }
      out.push(`<p>${inline(line.replace(/^>\s?/, ''))}</p>`);
      continue;
    }
    closeLists();
    paragraphBuf.push(line);
  }
  flushParagraph();
  closeLists();
  return out.join('\n');
}

function inline(s: string): string {
  s = s.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\\])\*([^*]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\\])_([^_]+)_/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    if (/^qc(anno|doc):\/\//i.test(url)) {
      // Internal annotation / doc link: rendered as a pill button. The container
      // intercepts clicks via event delegation (see MarkdownRendered).
      return `<a href="${escapeAttr(url)}" data-qc-anchor="1" class="qc-anchor-link">${label}</a>`;
    }
    const safeUrl = /^(https?:|\/)/i.test(url) ? url : '#';
    return `<a href="${escapeAttr(safeUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return s;
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;');
}

type EditorProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  onQcLinkClick?: (href: string) => void;
  qcLinkOptions?: QcLinkOptions;
};

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minHeight = 240,
  onQcLinkClick,
  qcLinkOptions,
}: EditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [qcPickerOpen, setQcPickerOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const insertAtCursor = (text: string) => {
    const ta = taRef.current;
    if (!ta) {
      onChange(value + text);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const surround = (left: string, right: string = left) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const inserted = `${left}${selected || 'text'}${right}`;
    const next = value.slice(0, start) + inserted + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursorStart = start + left.length;
      const cursorEnd = cursorStart + (selected || 'text').length;
      ta.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const linePrefix = (prefix: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const lineStart = before.lastIndexOf('\n') + 1;
    const selected = value.slice(lineStart, end);
    const transformed = selected
      .split('\n')
      .map((l) => (l.startsWith(prefix) ? l : prefix + l))
      .join('\n');
    const next = value.slice(0, lineStart) + transformed + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(lineStart, lineStart + transformed.length);
    });
  };

  const insertLink = () => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || 'link text';
    const inserted = `[${selected}](https://)`;
    const next = value.slice(0, start) + inserted + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const urlStart = start + selected.length + 3;
      ta.setSelectionRange(urlStart, urlStart + 8);
    });
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 bg-slate-50">
        <button
          type="button"
          onClick={() => setTab('write')}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
            tab === 'write'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
            tab === 'preview'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          Preview
        </button>
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <ToolBtn onClick={() => linePrefix('# ')} title="Heading 1">
          H1
        </ToolBtn>
        <ToolBtn onClick={() => linePrefix('## ')} title="Heading 2">
          H2
        </ToolBtn>
        <ToolBtn onClick={() => linePrefix('### ')} title="Heading 3">
          H3
        </ToolBtn>
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <ToolBtn onClick={() => surround('**')} title="Bold (Ctrl+B)">
          <span className="font-bold">B</span>
        </ToolBtn>
        <ToolBtn onClick={() => surround('*')} title="Italic (Ctrl+I)">
          <span className="italic">I</span>
        </ToolBtn>
        <ToolBtn onClick={() => surround('`')} title="Inline code">
          <span className="font-mono text-[10px]">{'< >'}</span>
        </ToolBtn>
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <ToolBtn onClick={() => linePrefix('- ')} title="Bullet list">
          •
        </ToolBtn>
        <ToolBtn onClick={() => linePrefix('1. ')} title="Numbered list">
          1.
        </ToolBtn>
        <ToolBtn onClick={() => linePrefix('> ')} title="Quote">
          ❝
        </ToolBtn>
        <ToolBtn onClick={insertLink} title="Link">
          🔗
        </ToolBtn>
        {qcLinkOptions && (
          <>
            <div className="w-px h-4 bg-slate-300 mx-1" />
            <button
              type="button"
              onClick={() => setQcPickerOpen((v) => !v)}
              title="Insert a link to a document or annotation in this project"
              className={`px-2 h-6 text-[11px] font-semibold rounded transition-colors flex items-center gap-1 ${
                qcPickerOpen
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-700 hover:bg-amber-100'
              }`}
            >
              @ link
            </button>
          </>
        )}
      </div>
      {qcLinkOptions && qcPickerOpen && (
        <QcLinkPicker
          options={qcLinkOptions}
          onClose={() => setQcPickerOpen(false)}
          onInsert={(md) => {
            insertAtCursor(md);
            setQcPickerOpen(false);
          }}
        />
      )}
      {tab === 'write' ? (
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(emDash(e.target.value))}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
              e.preventDefault();
              surround('**');
            } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
              e.preventDefault();
              surround('*');
            }
          }}
          placeholder={placeholder}
          className="w-full p-4 font-sans text-[14px] leading-[1.65] text-slate-800 border-0 focus:outline-none resize-y bg-white"
          style={{ minHeight }}
        />
      ) : (
        <div
          className="md-preview p-4 text-[14px] text-slate-800"
          style={{ minHeight }}
          onClick={(e) => {
            if (!onQcLinkClick) return;
            const target = (e.target as HTMLElement).closest('a[data-qc-anchor]');
            if (target instanceof HTMLAnchorElement) {
              e.preventDefault();
              onQcLinkClick(target.getAttribute('href') ?? '');
            }
          }}
          dangerouslySetInnerHTML={{
            __html:
              value.trim().length === 0
                ? '<p class="text-slate-400 italic">Nothing to preview yet.</p>'
                : renderMarkdown(value),
          }}
        />
      )}
    </div>
  );
}

export function MarkdownRendered({
  text,
  className,
  onQcLinkClick,
}: {
  text: string;
  className?: string;
  onQcLinkClick?: (href: string) => void;
}) {
  if (!text || !text.trim()) {
    return (
      <div className={`md-preview text-slate-400 italic ${className ?? ''}`}>
        Nothing here yet.
      </div>
    );
  }
  return (
    <div
      className={`md-preview ${className ?? ''}`}
      onClick={
        onQcLinkClick
          ? (e) => {
              const target = (e.target as HTMLElement).closest('a[data-qc-anchor]');
              if (target instanceof HTMLAnchorElement) {
                e.preventDefault();
                onQcLinkClick(target.getAttribute('href') ?? '');
              }
            }
          : undefined
      }
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  );
}

function ToolBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="w-7 h-6 flex items-center justify-center text-[12px] text-slate-600 hover:bg-slate-200 rounded transition-colors"
    >
      {children}
    </button>
  );
}

function QcLinkPicker({
  options,
  onInsert,
  onClose,
}: {
  options: QcLinkOptions;
  onInsert: (markdown: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'doc' | 'annotation'>('doc');
  const [query, setQuery] = useState('');

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const docs = options.docs.filter((d) => d.kind !== 'note');
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.folder ?? '').toLowerCase().includes(q),
    );
  }, [options.docs, query]);

  const filteredAnnos = useMemo(() => {
    const q = query.trim().toLowerCase();
    const docById = new Map(options.docs.map((d) => [d.id, d]));
    const items = options.annotations.map((a) => {
      const doc = docById.get(a.docId);
      const span = doc ? doc.text.slice(a.start, a.end).slice(0, 80) : '';
      const path = codePathString(options.codes, a.codeId);
      return { a, doc, span, path };
    });
    if (!q) return items;
    return items.filter(
      (item) =>
        item.span.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q) ||
        (item.doc?.title ?? '').toLowerCase().includes(q),
    );
  }, [options.annotations, options.docs, options.codes, query]);

  const buildDocLink = (d: Document) => {
    const label = d.title || 'Untitled';
    return `[${label.replace(/[\[\]]/g, '')}](qcdoc://${options.projectId}/${d.id})`;
  };

  const buildAnnoLink = (item: { a: Annotation; doc?: Document; span: string; path: string }) => {
    const truncated = item.a.end - item.a.start > 80 ? '…' : '';
    const span = item.span.replace(/\s+/g, ' ');
    const docTitle = item.doc?.title ?? 'doc';
    const label = `${docTitle} · ${item.path} · "${span}${truncated}"`;
    return `[${label.replace(/[\[\]]/g, '')}](qcanno://${options.projectId}/${item.a.docId}/${item.a.id})`;
  };

  return (
    <div className="absolute z-30 mt-1 left-2 w-[400px] max-h-[400px] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex flex-col">
      <div className="flex items-center gap-1 p-2 border-b border-slate-100 bg-slate-50">
        <button
          type="button"
          onClick={() => setMode('doc')}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
            mode === 'doc' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          Document
        </button>
        <button
          type="button"
          onClick={() => setMode('annotation')}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
            mode === 'annotation'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          Annotation
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-slate-400 hover:text-slate-900 text-[16px] w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200"
          title="close"
        >
          ×
        </button>
      </div>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={mode === 'doc' ? 'Search documents…' : 'Search annotations…'}
        className="px-3 py-2 text-[13px] border-b border-slate-100 focus:outline-none focus:bg-slate-50"
      />
      <div className="flex-1 overflow-y-auto">
        {mode === 'doc' ? (
          filteredDocs.length === 0 ? (
            <div className="px-3 py-4 text-[12px] text-slate-400 italic text-center">
              No documents match.
            </div>
          ) : (
            filteredDocs.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onInsert(buildDocLink(d))}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-50 transition-colors"
              >
                <div className="text-[13px] text-slate-800 truncate">
                  {d.title || 'Untitled'}
                </div>
                {d.folder && (
                  <div className="text-[10px] text-slate-400 font-mono">{d.folder}</div>
                )}
              </button>
            ))
          )
        ) : filteredAnnos.length === 0 ? (
          <div className="px-3 py-4 text-[12px] text-slate-400 italic text-center">
            No annotations match.
          </div>
        ) : (
          filteredAnnos.map((item) => (
            <button
              key={item.a.id}
              type="button"
              onClick={() => onInsert(buildAnnoLink(item))}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-700 truncate">
                  {item.path}
                </span>
                <span className="text-[10px] text-slate-400 truncate ml-auto">
                  {item.doc?.title}
                </span>
              </div>
              <div className="text-[12px] text-slate-600 italic mt-0.5 line-clamp-2">
                “{item.span}
                {item.a.end - item.a.start > 80 ? '…' : ''}”
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

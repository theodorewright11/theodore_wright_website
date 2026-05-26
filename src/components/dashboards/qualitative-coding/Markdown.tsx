import { useRef, useState } from 'react';
import { emDash } from './storage';

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
    const safeUrl = /^(https?:|\/)/i.test(url) ? url : '#';
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return s;
}

type EditorProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
};

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minHeight = 240,
}: EditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const taRef = useRef<HTMLTextAreaElement>(null);

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
      </div>
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

export function MarkdownRendered({ text, className }: { text: string; className?: string }) {
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

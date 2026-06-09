import { useEffect, useState } from 'react';
import { codePathString, resolveColor } from './compute';
import { emDash } from './storage';
import ThemeMembershipEditor from './ThemeMembershipEditor';
import type { Annotation, Code, Theme } from './types';

const ACCURACY_RUBRIC = [
  '1 · code does not capture this segment',
  '2 · loosely captures — notably ambiguous label',
  '3 · partially captures with some ambiguity',
  '4 · mostly captures with minor ambiguity',
  '5 · precisely captures — clear, informative shorthand',
];

type Props = {
  annotation: Annotation;
  codes: Code[];
  themes: Theme[];
  onUpdate: (patch: Partial<Annotation>) => void;
  onLinkToTheme: (themeId: string, weight: 'core' | 'supporting') => void;
  onUnlinkFromTheme: (themeId: string) => void;
  onDelete: () => void;
  onClose: () => void;
};

// Modal for editing a SINGLE annotation — accuracy rating, free-text note,
// theme memberships. Specifically does NOT include code-level fields like
// specificity (those live in CodeEditModal).
export default function AnnotationEditModal({
  annotation: a,
  codes,
  themes,
  onUpdate,
  onLinkToTheme,
  onUnlinkFromTheme,
  onDelete,
  onClose,
}: Props) {
  const code = codes.find((c) => c.id === a.codeId);
  const color = resolveColor(codes, a.codeId);
  const codePath = codePathString(codes, a.codeId);

  const [note, setNote] = useState(a.note ?? '');
  const [accuracyNotes, setAccuracyNotes] = useState(a.accuracyNotes ?? '');
  useEffect(() => {
    setNote(a.note ?? '');
    setAccuracyNotes(a.accuracyNotes ?? '');
  }, [a.id]);

  const dirty =
    note !== (a.note ?? '') || accuracyNotes !== (a.accuracyNotes ?? '');

  const commitText = () => {
    const patch: Partial<Annotation> = {};
    if (note !== (a.note ?? '')) patch.note = note;
    if (accuracyNotes !== (a.accuracyNotes ?? ''))
      patch.accuracyNotes = accuracyNotes.trim() || undefined;
    if (Object.keys(patch).length > 0) onUpdate(patch);
  };

  const save = () => {
    commitText();
    onClose();
  };

  const tryClose = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    onClose();
  };

  // Theme membership map for the editor.
  const currentLinks = new Map<string, 'core' | 'supporting'>();
  for (const t of themes) {
    const link = t.annotationLinks.find((l) => l.annotationId === a.id);
    if (link) currentLinks.set(t.id, link.weight);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-16 px-4"
      onClick={tryClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-[560px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-500">
              Edit annotation
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-sm ring-1 ring-black/5 flex-shrink-0"
                style={{ background: color }}
              />
              <div className="text-[14px] font-semibold text-slate-800 break-words">
                {codePath}
              </div>
            </div>
            {code?.description && (
              <p className="mt-1 text-[11px] text-slate-500 italic leading-snug border-l-2 border-slate-200 pl-2">
                {code.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={tryClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none w-8 h-8 flex items-center justify-center flex-shrink-0"
            aria-label="close"
          >
            ×
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          <section>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                Accuracy
              </label>
              <span className="text-[10px] text-slate-400">
                how well this code fits THIS segment · 1 unhelpful → 5 precise
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    onUpdate({
                      accuracy: a.accuracy === n
                        ? undefined
                        : (n as 1 | 2 | 3 | 4 | 5),
                    })
                  }
                  title={ACCURACY_RUBRIC[n - 1]}
                  className={`w-9 h-9 rounded-md border text-[13px] font-semibold transition-colors ${
                    a.accuracy === n
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {n}
                </button>
              ))}
              {a.accuracy && (
                <button
                  type="button"
                  onClick={() => onUpdate({ accuracy: undefined })}
                  className="ml-1 text-[11px] text-slate-400 hover:text-slate-700"
                  title="clear rating"
                >
                  clear
                </button>
              )}
            </div>
            <textarea
              value={accuracyNotes}
              onChange={(e) => setAccuracyNotes(emDash(e.target.value))}
              onBlur={commitText}
              placeholder="Why this score? (optional)"
              rows={2}
              className="mt-2 w-full px-3 py-2 text-[12px] border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
            />
          </section>

          <section>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(emDash(e.target.value))}
              onBlur={commitText}
              placeholder="Add a note about this annotation…"
              rows={3}
              className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
            />
          </section>

          {themes.length > 0 && (
            <section>
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">
                Themes
              </label>
              <ThemeMembershipEditor
                themes={themes}
                currentLinks={currentLinks}
                onLink={(themeId, w) => onLinkToTheme(themeId, w)}
                onUnlink={(themeId) => onUnlinkFromTheme(themeId)}
              />
            </section>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Delete this annotation? This cannot be undone.')) {
                onDelete();
                onClose();
              }
            }}
            className="text-[12px] text-slate-500 hover:text-red-600 px-2 py-1.5 rounded hover:bg-red-50"
          >
            Delete annotation
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={tryClose}
              className="px-3 py-2 text-[13px] font-medium text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="px-5 py-2 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

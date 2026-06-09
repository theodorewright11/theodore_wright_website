import { useState } from 'react';
import type { Theme } from './types';

type Props = {
  themes: Theme[];
  // Membership of the annotation across all themes (themeId → weight).
  currentLinks: Map<string, 'core' | 'supporting'>;
  onLink: (themeId: string, weight: 'core' | 'supporting') => void;
  onUnlink: (themeId: string) => void;
  compact?: boolean; // tighter spacing for inline use in Explore cards
};

// Editor that surfaces an annotation's theme memberships and lets you add
// or remove themes inline. Used in:
//   - AnnotationEditModal
//   - ExploreView annotation cards (flat + by-code modes)
// The "+ add to theme" button opens a multi-select picker that lists every
// theme with Core / Supporting toggle buttons. You can pick weights for
// several themes at once and click "Add to N" to apply.
export default function ThemeMembershipEditor({
  themes,
  currentLinks,
  onLink,
  onUnlink,
  compact = false,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picks, setPicks] = useState<Map<string, 'core' | 'supporting'>>(new Map());
  if (themes.length === 0) return null;

  const padY = compact ? 'py-0.5' : 'py-1';
  const text = compact ? 'text-[10px]' : 'text-[11px]';

  const setWeight = (themeId: string, weight: 'core' | 'supporting') => {
    setPicks((prev) => {
      const next = new Map(prev);
      if (next.get(themeId) === weight) next.delete(themeId);
      else next.set(themeId, weight);
      return next;
    });
  };
  const apply = () => {
    for (const [tid, w] of picks) onLink(tid, w);
    setPicks(new Map());
    setPickerOpen(false);
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`${text} uppercase tracking-wider font-semibold text-slate-500`}>
          Themes
        </span>
        {[...currentLinks.entries()].map(([themeId, weight]) => {
          const t = themes.find((x) => x.id === themeId);
          if (!t) return null;
          const isCore = weight === 'core';
          return (
            <span
              key={themeId}
              className={`inline-flex items-center gap-0.5 ${padY} pl-1.5 pr-0.5 rounded ${text} font-semibold ${
                isCore ? 'bg-amber-500 text-white' : 'bg-violet-100 text-violet-800'
              }`}
              title={`${t.name} · ${weight}`}
            >
              <button
                type="button"
                onClick={() => onLink(themeId, isCore ? 'supporting' : 'core')}
                className="hover:underline"
                title="toggle core / supporting"
              >
                {t.name} · {isCore ? 'Core' : 'Supporting'}
              </button>
              <button
                type="button"
                onClick={() => onUnlink(themeId)}
                className={`px-0.5 rounded hover:bg-white/30 ${
                  isCore ? 'text-white' : 'text-violet-600 hover:bg-violet-200'
                }`}
                title="remove from theme"
              >
                ×
              </button>
            </span>
          );
        })}
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className={`${text} font-semibold text-violet-700 border border-violet-200 hover:bg-violet-50 rounded ${padY} px-1.5`}
        >
          {pickerOpen ? 'Done' : '+ add to themes'}
        </button>
      </div>
      {pickerOpen && (
        <div className="mt-1.5 border border-violet-200 rounded bg-violet-50/60 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-violet-100 bg-violet-50">
            <span className="text-[11px] font-semibold text-violet-900">
              Pick themes + weights
            </span>
            {picks.size > 0 && (
              <button
                type="button"
                onClick={apply}
                className="px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wider bg-violet-700 text-white hover:bg-violet-800 rounded"
              >
                Add to {picks.size}
              </button>
            )}
          </div>
          <div className="max-h-[180px] overflow-y-auto">
            {themes.map((t) => {
              const cur = picks.get(t.id);
              const linkedWeight = currentLinks.get(t.id);
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-1.5 text-[11px] px-2 py-1 hover:bg-white"
                >
                  <span className="flex-1 min-w-0 text-violet-900 break-words">
                    {t.name}
                    {linkedWeight && (
                      <span className="ml-1 text-[9px] uppercase tracking-wider text-slate-400">
                        (already {linkedWeight})
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWeight(t.id, 'core')}
                    disabled={linkedWeight === 'core'}
                    className={`px-1.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider rounded ${
                      cur === 'core'
                        ? 'bg-amber-500 text-white'
                        : linkedWeight === 'core'
                          ? 'bg-slate-100 text-slate-400'
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    }`}
                  >
                    Core
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeight(t.id, 'supporting')}
                    disabled={linkedWeight === 'supporting'}
                    className={`px-1.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider rounded ${
                      cur === 'supporting'
                        ? 'bg-violet-700 text-white'
                        : linkedWeight === 'supporting'
                          ? 'bg-slate-100 text-slate-400'
                          : 'bg-violet-100 text-violet-800 hover:bg-violet-200'
                    }`}
                  >
                    Supporting
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

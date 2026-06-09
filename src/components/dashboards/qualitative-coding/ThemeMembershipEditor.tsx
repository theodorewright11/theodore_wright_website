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

// Compact editor that surfaces an annotation's theme memberships and lets you
// add / remove / change weight inline. Used in:
//   - DocumentViewer's focused-annotation panel
//   - ExploreView annotation cards (flat + by-code modes)
export default function ThemeMembershipEditor({
  themes,
  currentLinks,
  onLink,
  onUnlink,
  compact = false,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  if (themes.length === 0) return null;

  const padY = compact ? 'py-0.5' : 'py-1';
  const text = compact ? 'text-[10px]' : 'text-[11px]';

  return (
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
      {pickerOpen ? (
        <select
          autoFocus
          value=""
          onChange={(e) => {
            const val = e.target.value;
            if (!val) {
              setPickerOpen(false);
              return;
            }
            const [tid, w] = val.split('::');
            onLink(tid, w as 'core' | 'supporting');
            setPickerOpen(false);
          }}
          onBlur={() => setPickerOpen(false)}
          className={`${text} pl-1 pr-5 ${padY} border border-violet-300 rounded bg-white text-violet-700`}
        >
          <option value="">Add to theme…</option>
          {themes.map((t) => {
            const cur = currentLinks.get(t.id);
            return (
              <optgroup key={t.id} label={t.name}>
                <option value={`${t.id}::core`} disabled={cur === 'core'}>
                  + Core{cur === 'core' ? ' (already)' : ''}
                </option>
                <option value={`${t.id}::supporting`} disabled={cur === 'supporting'}>
                  + Supporting{cur === 'supporting' ? ' (already)' : ''}
                </option>
              </optgroup>
            );
          })}
        </select>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={`${text} font-semibold text-violet-700 border border-violet-200 hover:bg-violet-50 rounded ${padY} px-1.5`}
        >
          + add to theme
        </button>
      )}
    </div>
  );
}

import { useState } from 'react';
import { getShades } from './compute';
import { PALETTE } from './types';

type Props = {
  value: string | null;
  onChange: (next: string | null) => void;
  allowInherit?: boolean;
  size?: 'sm' | 'md';
};

// 5 shade levels per palette base, from lightest to darkest.
const SHADE_GRID = PALETTE.map((base) => getShades(base, 5));

export default function ColorPicker({ value, onChange, allowInherit, size = 'md' }: Props) {
  const [showShades, setShowShades] = useState(false);
  const swatch = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`${swatch} rounded ring-1 transition-transform ${
              value === c ? 'ring-slate-700 scale-110' : 'ring-black/10 hover:scale-110'
            }`}
            style={{ background: c }}
            aria-label={`color ${c}`}
          />
        ))}
        <button
          type="button"
          onClick={() => setShowShades((v) => !v)}
          className={`text-[10px] px-1.5 py-0.5 rounded hover:bg-slate-100 ${
            showShades ? 'text-slate-800 font-semibold' : 'text-slate-500'
          }`}
          title={showShades ? 'hide shade grid' : 'show shade grid'}
        >
          {showShades ? '− shades' : '+ shades'}
        </button>
        {allowInherit && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`text-[10px] px-1.5 py-0.5 rounded hover:bg-slate-100 ${
              value === null ? 'text-slate-800 font-semibold' : 'text-slate-500'
            }`}
          >
            inherit
          </button>
        )}
      </div>
      {showShades && (
        <div className="flex flex-col gap-0.5 p-1.5 bg-slate-50 rounded-md border border-slate-200">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex gap-0.5">
              {SHADE_GRID.map((shades, col) => {
                const c = shades[row];
                return (
                  <button
                    key={`${col}-${row}`}
                    type="button"
                    onClick={() => onChange(c)}
                    className={`${swatch} rounded-sm ring-1 transition-transform ${
                      value === c
                        ? 'ring-slate-700 scale-110 z-10'
                        : 'ring-black/10 hover:scale-110'
                    }`}
                    style={{ background: c }}
                    aria-label={`color ${c}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

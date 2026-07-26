import { useEffect, useMemo, useState } from 'react';
import type { CategoryEntry } from './types';

type Props = {
  categories: CategoryEntry[];
  onClose: () => void;
  // `renames` maps an old `detailed` key to a new one; the dashboard migrates
  // existing transactions + budgets so a rename doesn't strand history.
  onSave: (next: CategoryEntry[], renames: { from: string; to: string }[]) => void;
};

type Row = {
  rowId: string;
  broad: string;
  mid: string;
  detailed: string;
  original: string | null;  // the detailed key this row started as; null = newly added
};

function seedRows(categories: CategoryEntry[]): Row[] {
  return categories.map(c => ({
    rowId: crypto.randomUUID(),
    broad: c.broad, mid: c.mid, detailed: c.detailed, original: c.detailed,
  }));
}

export default function CategoriesModal({ categories, onClose, onSave }: Props) {
  const [rows, setRows] = useState<Row[]>(() => seedRows(categories));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const broadOptions = useMemo(
    () => [...new Set(rows.map(r => r.broad.trim()).filter(Boolean))].sort(), [rows]);
  const midOptions = useMemo(
    () => [...new Set(rows.map(r => r.mid.trim()).filter(Boolean))].sort(), [rows]);

  function setField(rowId: string, field: 'broad' | 'mid' | 'detailed', value: string) {
    setRows(prev => prev.map(r => r.rowId === rowId ? { ...r, [field]: value } : r));
  }
  function addRow() {
    // Prefill broad/mid from the last row so adding a sibling is one field.
    const last = rows[rows.length - 1];
    setRows(prev => [...prev, {
      rowId: crypto.randomUUID(),
      broad: last?.broad ?? '', mid: last?.mid ?? '', detailed: '', original: null,
    }]);
  }
  function removeRow(rowId: string) {
    setRows(prev => prev.filter(r => r.rowId !== rowId));
  }

  function handleSave() {
    setError(null);
    const trimmed = rows.map(r => ({
      ...r, broad: r.broad.trim(), mid: r.mid.trim(), detailed: r.detailed.trim(),
    }));
    for (const r of trimmed) {
      if (!r.detailed) { setError('Every category needs a name (the Detailed field).'); return; }
      if (!r.broad || !r.mid) { setError(`"${r.detailed}" needs both a Broad group and a Mid group.`); return; }
    }
    const keys = trimmed.map(r => r.detailed);
    const dup = keys.find((k, i) => keys.indexOf(k) !== i);
    if (dup) { setError(`Duplicate category name "${dup}". Detailed names must be unique.`); return; }

    const next: CategoryEntry[] = trimmed.map(r => ({ broad: r.broad, mid: r.mid, detailed: r.detailed }));
    const renames = trimmed
      .filter(r => r.original && r.original !== r.detailed)
      .map(r => ({ from: r.original!, to: r.detailed }));

    const survivingOriginals = new Set(trimmed.map(r => r.original).filter(Boolean) as string[]);
    const deleted = categories.map(c => c.detailed).filter(k => !survivingOriginals.has(k));
    if (deleted.length > 0) {
      const ok = window.confirm(
        `Deleting ${deleted.length} categor${deleted.length === 1 ? 'y' : 'ies'} (${deleted.join(', ')}). ` +
        `Any transactions or budgets filed under ${deleted.length === 1 ? 'it' : 'them'} will show as "Uncategorized" until re-filed. Continue?`
      );
      if (!ok) return;
    }

    onSave(next, renames);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 pt-12 pb-8 overflow-y-auto"
         onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
           className="bg-paper border border-rule rounded-sm w-full max-w-[680px] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
        <h3 className="font-display font-semibold text-[20px] text-ink m-0 mb-1"
            style={{ letterSpacing: '-0.02em' }}>Manage categories</h3>
        <p className="font-serif text-[13px] text-muted m-0 mb-4" style={{ textWrap: 'pretty' }}>
          <span className="text-ink-soft">Detailed</span> is the name stored on each transaction and budget.
          Renaming it re-files existing history automatically; deleting a category leaves its history Uncategorized.
        </p>

        <div className="grid grid-cols-[1fr_1fr_1fr_28px] gap-2 px-1 mb-1 font-mono text-[10px] uppercase text-muted"
             style={{ letterSpacing: '0.12em' }}>
          <span>Broad</span><span>Mid</span><span>Detailed</span><span></span>
        </div>

        <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-1.5">
          {rows.map(r => (
            <div key={r.rowId} className="grid grid-cols-[1fr_1fr_1fr_28px] gap-2 items-center">
              <input value={r.broad} onChange={e => setField(r.rowId, 'broad', e.target.value)}
                     list="finance-broad-options" placeholder="Broad"
                     className="bg-paper border border-rule rounded-sm px-2 py-1 text-[13px] font-serif text-ink focus:outline-none focus:border-accent" />
              <input value={r.mid} onChange={e => setField(r.rowId, 'mid', e.target.value)}
                     list="finance-mid-options" placeholder="Mid"
                     className="bg-paper border border-rule rounded-sm px-2 py-1 text-[13px] font-serif text-ink focus:outline-none focus:border-accent" />
              <input value={r.detailed} onChange={e => setField(r.rowId, 'detailed', e.target.value)}
                     placeholder="Detailed"
                     className="bg-paper border border-rule rounded-sm px-2 py-1 text-[13px] font-serif text-ink focus:outline-none focus:border-accent" />
              <button type="button" onClick={() => removeRow(r.rowId)} title="Delete category"
                      className="font-mono text-[14px] text-muted hover:text-accent transition-colors text-center">×</button>
            </div>
          ))}
        </div>

        <datalist id="finance-broad-options">
          {broadOptions.map(o => <option key={o} value={o} />)}
        </datalist>
        <datalist id="finance-mid-options">
          {midOptions.map(o => <option key={o} value={o} />)}
        </datalist>

        <button type="button" onClick={addRow}
                className="mt-3 font-mono text-[10px] uppercase text-muted hover:text-accent bg-paper border border-rule hover:border-accent rounded-sm px-3 py-1.5 transition-colors"
                style={{ letterSpacing: '0.08em' }}>+ Add category</button>

        {error && <p className="mt-4 text-[13px] font-serif text-accent m-0">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose}
                  className="font-mono text-[11px] uppercase text-muted hover:text-ink transition-colors px-3 py-1.5"
                  style={{ letterSpacing: '0.08em' }}>Cancel</button>
          <button type="button" onClick={handleSave}
                  className="font-mono text-[11px] uppercase text-accent border border-accent hover:bg-accent hover:text-paper transition-colors px-3 py-1.5"
                  style={{ letterSpacing: '0.08em' }}>Save categories</button>
        </div>
      </div>
    </div>
  );
}

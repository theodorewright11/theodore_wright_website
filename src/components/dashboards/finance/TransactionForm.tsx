import { useEffect, useState } from 'react';
import type { Transaction, Account } from './types';
import { ACCOUNTS } from './types';
import { CATEGORIES, groupByBroadMid } from './categories';

type Props = {
  initial?: Transaction | null;
  onSubmit: (tx: Transaction) => void;
  onCancel: () => void;
  onDelete?: () => void;
};

function nowIso() {
  return new Date().toISOString();
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function TransactionForm({ initial, onSubmit, onCancel, onDelete }: Props) {
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [item, setItem] = useState(initial?.item ?? '');
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '');
  const [account, setAccount] = useState<Account>(initial?.account ?? 'Amex');
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0].detailed);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amtNum = parseFloat(amount);
    if (!item.trim()) { setError('Item is required.'); return; }
    if (!Number.isFinite(amtNum) || amtNum <= 0) { setError('Amount must be a positive number.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Date must be YYYY-MM-DD.'); return; }

    const now = nowIso();
    const tx: Transaction = {
      id: initial?.id ?? crypto.randomUUID(),
      date,
      item: item.trim(),
      amount: amtNum,
      account,
      category,
      notes: notes.trim() || undefined,
      created_at: initial?.created_at ?? now,
      updated_at: now,
    };
    onSubmit(tx);
  }

  const grouped = groupByBroadMid();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 pt-16 pb-8 overflow-y-auto"
         onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-paper border border-rule rounded-sm w-full max-w-[520px] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
      >
        <h3 className="font-display font-semibold text-[20px] text-ink m-0 mb-5"
            style={{ letterSpacing: '-0.02em' }}>
          {initial ? 'Edit transaction' : 'Add transaction'}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block font-mono text-[10px] uppercase text-muted mb-1"
                   style={{ letterSpacing: '0.12em' }}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                   className="w-full bg-paper border border-rule rounded-sm px-2 py-1.5 text-[14px] font-serif text-ink focus:outline-none focus:border-accent" />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-muted mb-1"
                   style={{ letterSpacing: '0.12em' }}>Item</label>
            <input type="text" value={item} onChange={e => setItem(e.target.value)}
                   placeholder="e.g. Walmart"
                   className="w-full bg-paper border border-rule rounded-sm px-2 py-1.5 text-[14px] font-serif text-ink focus:outline-none focus:border-accent" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[10px] uppercase text-muted mb-1"
                     style={{ letterSpacing: '0.12em' }}>Amount (USD)</label>
              <input type="number" step="0.01" min="0" value={amount}
                     onChange={e => setAmount(e.target.value)} placeholder="0.00"
                     className="w-full bg-paper border border-rule rounded-sm px-2 py-1.5 text-[14px] font-mono text-ink focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase text-muted mb-1"
                     style={{ letterSpacing: '0.12em' }}>Account</label>
              <select value={account} onChange={e => setAccount(e.target.value as Account)}
                      className="w-full bg-paper border border-rule rounded-sm px-2 py-1.5 text-[14px] font-serif text-ink focus:outline-none focus:border-accent">
                {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-muted mb-1"
                   style={{ letterSpacing: '0.12em' }}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full bg-paper border border-rule rounded-sm px-2 py-1.5 text-[14px] font-serif text-ink focus:outline-none focus:border-accent">
              {[...grouped.entries()].map(([broad, midMap]) => (
                <optgroup key={broad} label={broad}>
                  {[...midMap.values()].flat().map(c => (
                    <option key={c.detailed} value={c.detailed}>{c.detailed} ({c.mid})</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-muted mb-1"
                   style={{ letterSpacing: '0.12em' }}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                      className="w-full bg-paper border border-rule rounded-sm px-2 py-1.5 text-[14px] font-serif text-ink focus:outline-none focus:border-accent resize-none" />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-[13px] font-serif text-accent m-0">{error}</p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <div>
            {onDelete && initial && (
              <button type="button" onClick={() => {
                if (window.confirm('Delete this transaction?')) onDelete();
              }} className="font-mono text-[11px] uppercase text-muted hover:text-accent transition-colors px-2 py-1.5"
                      style={{ letterSpacing: '0.08em' }}>Delete</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCancel}
                    className="font-mono text-[11px] uppercase text-muted hover:text-ink transition-colors px-3 py-1.5"
                    style={{ letterSpacing: '0.08em' }}>Cancel</button>
            <button type="submit"
                    className="font-mono text-[11px] uppercase text-accent border border-accent hover:bg-accent hover:text-paper transition-colors px-3 py-1.5"
                    style={{ letterSpacing: '0.08em' }}>{initial ? 'Save' : 'Add'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

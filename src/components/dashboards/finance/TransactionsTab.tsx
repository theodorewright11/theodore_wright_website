import { useMemo, useRef, useState } from 'react';
import type { Transaction, Account } from './types';
import { ACCOUNTS } from './types';
import { CATEGORIES, lookupCategory, isValidCategory } from './categories';
import { formatMoney } from './compute';
import { transactionsToCsv, csvToTransactions, downloadFile } from './storage';
import TransactionForm from './TransactionForm';

type Props = {
  transactions: Transaction[];
  onAdd: (tx: Transaction) => void;
  onUpdate: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onReplaceAll: (txs: Transaction[]) => void;
  onAppend: (txs: Transaction[]) => void;
  /** Only set when Sheets is connected — surfaces a one-time seed action from
   *  the legacy `Spending Log` tab in the same workbook. */
  onSeedFromSpendingLog?: () => void;
};

type SortKey = 'date' | 'item' | 'category' | 'account' | 'amount';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 100;

export default function TransactionsTab({ transactions, onAdd, onUpdate, onDelete, onReplaceAll, onAppend, onSeedFromSpendingLog }: Props) {
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState<Account | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter(t => {
      if (q && !t.item.toLowerCase().includes(q)) return false;
      if (accountFilter !== 'All' && t.account !== accountFilter) return false;
      if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      return true;
    });
  }, [transactions, search, accountFilter, categoryFilter, from, to]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string | number; let bv: string | number;
      switch (sortKey) {
        case 'amount': av = a.amount; bv = b.amount; break;
        case 'date':   av = a.date; bv = b.date; break;
        case 'item':   av = a.item.toLowerCase(); bv = b.item.toLowerCase(); break;
        case 'category': av = a.category; bv = b.category; break;
        case 'account':  av = a.account;  bv = b.account; break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const visible = sorted.slice(0, (page + 1) * PAGE_SIZE);
  const total = filtered.reduce((s, t) => s + t.amount, 0);

  function setSort(k: SortKey) {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir(k === 'amount' || k === 'date' ? 'desc' : 'asc'); }
    setPage(0);
  }

  function handleImportClick(mode: 'append' | 'replace') {
    const f = fileInput.current?.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const txs = csvToTransactions(text);
      if (txs.length === 0) {
        alert('No valid transactions found in that CSV. Required headers: id,date,item,amount,account,category.');
        return;
      }
      if (mode === 'replace') {
        if (!window.confirm(`Replace all ${transactions.length} transactions with ${txs.length} from this file?`)) return;
        onReplaceAll(txs);
      } else {
        onAppend(txs);
      }
      if (fileInput.current) fileInput.current.value = '';
    };
    reader.readAsText(f);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar — own bar */}
      <div className="bg-paper border border-rule rounded-md px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap shadow-[0_1px_2px_rgba(26,22,20,0.03)]">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display font-semibold text-[20px] text-ink m-0"
              style={{ letterSpacing: '-0.02em' }}>Transactions</h2>
          <span className="font-mono text-[10px] uppercase text-muted"
                style={{ letterSpacing: '0.12em' }}>
            {filtered.length} of {transactions.length} · {formatMoney(total)}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden"
                 onChange={() => { /* held until user picks mode */ }} />
          <button onClick={() => fileInput.current?.click()}
                  className="font-mono text-[10px] uppercase text-muted hover:text-accent border border-rule hover:border-accent rounded-sm px-2 py-1.5 transition-colors"
                  style={{ letterSpacing: '0.08em' }}>Pick CSV…</button>
          <button onClick={() => handleImportClick('append')}
                  className="font-mono text-[10px] uppercase text-muted hover:text-accent transition-colors px-2 py-1.5"
                  style={{ letterSpacing: '0.08em' }}>Import (append)</button>
          <button onClick={() => handleImportClick('replace')}
                  className="font-mono text-[10px] uppercase text-muted hover:text-accent transition-colors px-2 py-1.5"
                  style={{ letterSpacing: '0.08em' }}>Import (replace)</button>
          <button onClick={() => downloadFile('finance-transactions.csv', transactionsToCsv(transactions))}
                  className="font-mono text-[10px] uppercase text-muted hover:text-accent border border-rule hover:border-accent rounded-sm px-2 py-1.5 transition-colors"
                  style={{ letterSpacing: '0.08em' }}>Export CSV</button>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
                  className="font-mono text-[10px] uppercase text-accent border border-accent hover:bg-accent hover:text-paper rounded-sm px-3 py-1.5 transition-colors"
                  style={{ letterSpacing: '0.08em' }}>+ Add</button>
        </div>
      </div>

      {/* Seed-from-Spending-Log callout — only when Sheets is connected and
          the dashboard's transactions tab is empty. One-click historical import. */}
      {onSeedFromSpendingLog && transactions.length === 0 && (
        <div className="bg-accent/5 border border-accent rounded-md px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <span className="font-serif text-[13px] text-ink-soft">
            First time? Import your historical transactions from the legacy{' '}
            <code className="font-mono text-[12px] bg-paper border border-rule rounded-sm px-1 py-px">Spending Log</code>{' '}
            tab in your workbook.
          </span>
          <button onClick={onSeedFromSpendingLog}
                  className="font-mono text-[10px] uppercase text-accent border border-accent hover:bg-accent hover:text-paper rounded-sm px-3 py-1.5 transition-colors whitespace-nowrap"
                  style={{ letterSpacing: '0.08em' }}>
            Seed from Spending Log
          </button>
        </div>
      )}

      {/* Filters — paper panel */}
      <div className="bg-paper border border-rule rounded-md p-3 grid grid-cols-2 md:grid-cols-5 gap-3 shadow-[0_1px_2px_rgba(26,22,20,0.03)]">
        <div>
          <label className="block font-mono text-[10px] uppercase text-muted mb-1"
                 style={{ letterSpacing: '0.12em' }}>Search</label>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                 placeholder="Item…"
                 className="w-full bg-paper border border-rule rounded-sm px-2 py-1.5 text-[13px] font-serif text-ink focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase text-muted mb-1"
                 style={{ letterSpacing: '0.12em' }}>Account</label>
          <select value={accountFilter} onChange={e => { setAccountFilter(e.target.value as Account | 'All'); setPage(0); }}
                  className="w-full bg-paper border border-rule rounded-sm px-2 py-1.5 text-[13px] font-serif text-ink focus:outline-none focus:border-accent">
            <option value="All">All</option>
            {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase text-muted mb-1"
                 style={{ letterSpacing: '0.12em' }}>Category</label>
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(0); }}
                  className="w-full bg-paper border border-rule rounded-sm px-2 py-1.5 text-[13px] font-serif text-ink focus:outline-none focus:border-accent">
            <option value="All">All</option>
            {CATEGORIES.map(c => <option key={c.detailed} value={c.detailed}>{c.detailed}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase text-muted mb-1"
                 style={{ letterSpacing: '0.12em' }}>From</label>
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(0); }}
                 className="w-full bg-paper border border-rule rounded-sm px-2 py-1.5 text-[13px] font-serif text-ink focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase text-muted mb-1"
                 style={{ letterSpacing: '0.12em' }}>To</label>
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(0); }}
                 className="w-full bg-paper border border-rule rounded-sm px-2 py-1.5 text-[13px] font-serif text-ink focus:outline-none focus:border-accent" />
        </div>
      </div>

      {/* Table — paper panel */}
      <div className="bg-paper border border-rule rounded-md overflow-hidden shadow-[0_1px_2px_rgba(26,22,20,0.03)]">
        <div className="grid grid-cols-[110px_1fr_180px_70px_100px_60px] gap-3 px-3 py-2 border-b border-rule bg-paper-edge/50 font-mono text-[10px] uppercase text-muted"
             style={{ letterSpacing: '0.12em' }}>
          <button onClick={() => setSort('date')} className="text-left hover:text-accent transition-colors">Date {sortKey==='date' ? (sortDir==='asc'?'▴':'▾') : ''}</button>
          <button onClick={() => setSort('item')} className="text-left hover:text-accent transition-colors">Item {sortKey==='item' ? (sortDir==='asc'?'▴':'▾') : ''}</button>
          <button onClick={() => setSort('category')} className="text-left hover:text-accent transition-colors">Category {sortKey==='category' ? (sortDir==='asc'?'▴':'▾') : ''}</button>
          <button onClick={() => setSort('account')} className="text-left hover:text-accent transition-colors">Acct {sortKey==='account' ? (sortDir==='asc'?'▴':'▾') : ''}</button>
          <button onClick={() => setSort('amount')} className="text-right hover:text-accent transition-colors">Amount {sortKey==='amount' ? (sortDir==='asc'?'▴':'▾') : ''}</button>
          <span></span>
        </div>

        {visible.length === 0 ? (
          <div className="py-12 text-center font-serif italic text-muted">
            <p className="m-0">{transactions.length === 0 ? 'No transactions yet. Click + Add to log one, or import a CSV.' : 'No transactions match these filters.'}</p>
          </div>
        ) : (
          visible.map((t, idx) => {
            const cat = lookupCategory(t.category);
            const validCat = isValidCategory(t.category);
            return (
              <div key={t.id}
                   className={'grid grid-cols-[110px_1fr_180px_70px_100px_60px] gap-3 px-3 py-2 items-baseline transition-colors hover:bg-accent/[0.04] ' + (
                     idx > 0 ? 'border-t border-rule-soft ' : ''
                   ) + (idx % 2 === 1 ? 'bg-paper-edge/25' : '')}>
                <span className="font-mono text-[12px] text-ink-soft tabular-nums">{t.date}</span>
                <span className="font-serif text-[14px] text-ink truncate" title={t.item}>{t.item}</span>
                <span className={'font-serif text-[13px] truncate ' + (validCat ? 'text-ink-soft' : 'text-accent')}
                      title={cat ? `${cat.broad} → ${cat.mid} → ${cat.detailed}` : (t.category || 'Uncategorized')}>
                  {t.category || '—'}
                </span>
                <span className="font-mono text-[11px] uppercase text-muted"
                      style={{ letterSpacing: '0.08em' }}>{t.account}</span>
                <span className="font-mono text-[13px] text-ink text-right tabular-nums">{formatMoney(t.amount)}</span>
                <button onClick={() => { setEditing(t); setShowForm(true); }}
                        className="font-mono text-[10px] uppercase text-muted hover:text-accent transition-colors text-right"
                        style={{ letterSpacing: '0.08em' }}>Edit</button>
              </div>
            );
          })
        )}
      </div>

      {sorted.length > visible.length && (
        <div className="text-center">
          <button onClick={() => setPage(p => p + 1)}
                  className="font-mono text-[11px] uppercase text-muted hover:text-accent bg-paper border border-rule hover:border-accent rounded-sm px-3 py-1.5 transition-colors"
                  style={{ letterSpacing: '0.08em' }}>
            Load {Math.min(PAGE_SIZE, sorted.length - visible.length)} more
          </button>
        </div>
      )}

      {showForm && (
        <TransactionForm
          initial={editing}
          onSubmit={(tx) => {
            if (editing) onUpdate(tx); else onAdd(tx);
            setShowForm(false); setEditing(null);
          }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onDelete={editing ? () => { onDelete(editing.id); setShowForm(false); setEditing(null); } : undefined}
        />
      )}
    </div>
  );
}

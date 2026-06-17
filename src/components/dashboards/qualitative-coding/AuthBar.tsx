import { useEffect, useRef, useState } from 'react';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

type Props = {
  configured: boolean;
  email: string | undefined;
  syncStatus: SyncStatus;
  lastError: string | null;
  fileCount: number;
  onSignIn: () => void;
  onSignOut: () => void;
  onPullAll: () => void;
  onSyncNow: () => void;
};

export default function AuthBar({
  configured,
  email,
  syncStatus,
  lastError,
  fileCount,
  onSignIn,
  onSignOut,
  onPullAll,
  onSyncNow,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current && !rootRef.current.contains(t)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!configured) {
    return (
      <div className="relative" ref={rootRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Drive sync not configured"
          className="px-3 py-1.5 text-[12px] font-medium rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
        >
          local only
        </button>
        {open && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-full mt-1 w-[320px] z-30 bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-left"
          >
            <div className="text-[13px] font-semibold text-slate-800 mb-1">
              Drive sync not configured
            </div>
            <div className="text-[12px] text-slate-500 leading-snug">
              Set <code className="text-[11px] bg-slate-100 px-1 rounded">PUBLIC_GOOGLE_CLIENT_ID</code>{' '}
              in <code className="text-[11px] bg-slate-100 px-1 rounded">.env</code> (same OAuth client as
              Finance/Time Tracker, with Drive API enabled). Then restart the dev server.
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!email) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="px-3.5 py-1.5 text-[12px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
      >
        Sign in to sync
      </button>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
      >
        <SyncDot status={syncStatus} />
        <span className="hidden sm:inline truncate max-w-[160px]">{email}</span>
        <span className="text-slate-400 text-[9px]">▾</span>
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1 w-[300px] z-30 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
        >
          <div className="px-3.5 py-2.5 border-b border-slate-100">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">
              Signed in
            </div>
            <div className="text-[13px] text-slate-800 truncate">{email}</div>
          </div>
          <div className="px-3.5 py-2.5 text-[12px] text-slate-500 border-b border-slate-100">
            {fileCount} project{fileCount === 1 ? '' : 's'} synced ·{' '}
            <SyncLabel status={syncStatus} />
            {lastError && (
              <div className="mt-1 text-[11px] text-red-600 leading-snug">{lastError}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSyncNow();
            }}
            className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 transition-colors border-b border-slate-100"
          >
            <div className="text-[13px] font-medium text-slate-800">Sync now</div>
            <div className="text-[11px] text-slate-500 leading-snug">
              Push the current project to Drive immediately (skips the 800ms auto-save wait).
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onPullAll();
            }}
            className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 transition-colors"
          >
            <div className="text-[13px] font-medium text-slate-800">Refresh from Drive</div>
            <div className="text-[11px] text-slate-500 leading-snug">
              Re-fetch every project from Drive (use after editing on another device).
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="w-full text-left px-3.5 py-2.5 text-[13px] text-slate-700 hover:bg-slate-100 border-t border-slate-100 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function SyncDot({ status }: { status: SyncStatus }) {
  const color =
    status === 'idle'
      ? 'bg-emerald-500'
      : status === 'syncing'
        ? 'bg-blue-500 animate-pulse'
        : status === 'error'
          ? 'bg-red-500'
          : 'bg-slate-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function SyncLabel({ status }: { status: SyncStatus }) {
  switch (status) {
    case 'idle':
      return <span className="text-emerald-600">synced</span>;
    case 'syncing':
      return <span className="text-blue-600">syncing…</span>;
    case 'error':
      return <span className="text-red-600">error</span>;
    case 'offline':
      return <span className="text-slate-500">offline</span>;
  }
}

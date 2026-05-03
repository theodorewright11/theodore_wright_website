import type { SyncState } from './FinanceDashboard';

type Props = {
  configured: boolean;
  email?: string;
  sync: SyncState;
  lastError?: string;
  onSignIn: () => void;
  onSignOut: () => void;
  onRetry: () => void;
};

export default function AuthBar({ configured, email, sync, lastError, onSignIn, onSignOut, onRetry }: Props) {
  if (!configured) {
    return (
      <span className="font-mono text-[10px] uppercase text-muted px-2"
            title="Set PUBLIC_GOOGLE_CLIENT_ID and PUBLIC_FINANCE_SHEET_ID in .env to enable Sheets sync."
            style={{ letterSpacing: '0.08em' }}>
        local only · sync not configured
      </span>
    );
  }

  if (!email) {
    return (
      <button onClick={onSignIn}
              className="font-mono text-[10px] uppercase text-accent border border-accent hover:bg-accent hover:text-paper rounded-sm px-3 py-1.5 transition-colors"
              style={{ letterSpacing: '0.08em' }}>
        Sign in to sync
      </button>
    );
  }

  // Signed in
  const dot = sync === 'syncing' ? 'bg-accent-soft animate-pulse'
            : sync === 'error'   ? 'bg-accent'
            : sync === 'offline' ? 'bg-muted'
            :                      'bg-accent-soft';
  const label = sync === 'syncing' ? 'syncing…'
              : sync === 'error'   ? 'sync error'
              : sync === 'offline' ? 'offline'
              :                      'synced';

  return (
    <div className="flex items-center gap-2">
      <span className={'inline-block w-1.5 h-1.5 rounded-full ' + dot}
            title={lastError ?? label} />
      <span className="font-mono text-[10px] uppercase text-muted"
            style={{ letterSpacing: '0.08em' }}>{label}</span>
      {sync === 'error' && (
        <button onClick={onRetry}
                className="font-mono text-[10px] uppercase text-accent hover:underline transition-colors"
                style={{ letterSpacing: '0.08em' }}>retry</button>
      )}
      <span className="font-mono text-[10px] text-muted/70 truncate max-w-[180px]" title={email}>{email}</span>
      <button onClick={onSignOut}
              className="font-mono text-[10px] uppercase text-muted hover:text-accent transition-colors"
              style={{ letterSpacing: '0.08em' }}>sign out</button>
    </div>
  );
}

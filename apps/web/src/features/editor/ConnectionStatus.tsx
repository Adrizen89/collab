export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';

export function ConnectionStatus({ status, synced }: { status: RealtimeStatus; synced: boolean }) {
  const view = {
    connected: {
      cls: 'status-connected',
      label: synced ? 'Synchronisé' : 'Connecté — synchronisation…',
    },
    connecting: { cls: 'status-connecting', label: 'Reconnexion en cours…' },
    disconnected: {
      cls: 'status-disconnected',
      label: 'Hors ligne — vos modifications sont conservées localement',
    },
  }[status];

  return (
    <span className={`status-pill ${view.cls}`} title="État de la synchronisation temps réel">
      <span className="status-dot" />
      {view.label}
    </span>
  );
}

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { DocumentInviteView } from '@collab/shared';
import { api, ApiClientError } from '../../lib/api';

export function InvitePanel({ documentId, canManage }: { documentId: string; canManage: boolean }) {
  const [invites, setInvites] = useState<DocumentInviteView[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInvites(await api.listInvites(documentId));
    } catch {
      /* l'accès est déjà garanti par la page ; on ignore une liste indisponible */
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await api.invite(documentId, email.trim());
      setEmail('');
      setInfo('Personne invitée avec succès.');
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Invitation impossible');
    }
  };

  const remove = async (inviteId: string) => {
    try {
      await api.removeInvite(documentId, inviteId);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Retrait impossible');
    }
  };

  return (
    <div className="card sidebar-panel">
      <h3 className="panel-title">Personnes invitées</h3>

      {invites.length === 0 ? (
        <p className="muted" style={{ marginTop: 0 }}>Personne pour l’instant.</p>
      ) : (
        <ul className="invite-list">
          {invites.map((inv) => (
            <li key={inv.id}>
              <span>{inv.user.displayName}</span>
              {canManage ? (
                <button type="button" className="icon-btn" title="Retirer" onClick={() => remove(inv.id)}>
                  ✕
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <form onSubmit={submit}>
          {error ? <div className="alert alert-error">{error}</div> : null}
          {info ? <div className="alert alert-success">{info}</div> : null}
          <div className="row">
            <input
              className="input"
              type="email"
              placeholder="email@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-sm">
              Inviter
            </button>
          </div>
        </form>
      ) : (
        <p className="muted">Seul le propriétaire peut gérer les invitations.</p>
      )}
    </div>
  );
}

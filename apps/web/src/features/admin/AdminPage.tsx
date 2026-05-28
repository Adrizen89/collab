import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { PublicUser, UserRole } from '@collab/shared';
import { api, ApiClientError } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

export function AdminPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('MEMBER');

  const load = useCallback(async () => {
    setError(null);
    try {
      setUsers(await api.adminUsers());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Chargement impossible');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await api.adminCreateUser({ email: email.trim(), displayName: displayName.trim(), password, role });
      setInfo(`Compte créé : ${email.trim()}`);
      setEmail('');
      setDisplayName('');
      setPassword('');
      setRole('MEMBER');
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Création impossible');
    }
  };

  const toggleBlocked = async (target: PublicUser) => {
    setError(null);
    try {
      await api.adminSetBlocked(target.id, !target.isBlocked);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Action impossible');
    }
  };

  return (
    <div>
      <h1 className="page-title">Administration</h1>
      <p className="page-subtitle">Gestion des comptes utilisateurs.</p>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {info ? <div className="alert alert-success">{info}</div> : null}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="panel-title">Créer un compte</h3>
        <form onSubmit={createUser}>
          <div className="row" style={{ marginBottom: 12 }}>
            <input
              className="input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="input"
              type="text"
              placeholder="Nom affiché"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div className="row">
            <div className="password-field" style={{ flex: 1 }}>
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mot de passe (8 caractères min.)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                title={showPassword ? 'Masquer' : 'Afficher'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {showPassword ? (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  ) : (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1 4.24 4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            <select
              className="input"
              style={{ maxWidth: 160 }}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="MEMBER">Membre</option>
              <option value="ADMIN">Administrateur</option>
            </select>
            <button type="submit" className="btn">
              Créer
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 className="panel-title">Comptes ({users.length})</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>2FA</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.displayName}</td>
                <td>{u.email}</td>
                <td>
                  {u.role === 'ADMIN' ? <span className="badge">admin</span> : 'membre'}
                </td>
                <td>{u.twoFactorEnabled ? '✅' : '—'}</td>
                <td>
                  {u.isBlocked ? (
                    <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Bloqué</span>
                  ) : (
                    <span style={{ color: 'var(--success)' }}>Actif</span>
                  )}
                </td>
                <td>
                  {u.id !== me?.id ? (
                    <button
                      type="button"
                      className={`btn btn-sm ${u.isBlocked ? '' : 'btn-danger'}`}
                      onClick={() => toggleBlocked(u)}
                    >
                      {u.isBlocked ? 'Débloquer' : 'Bloquer'}
                    </button>
                  ) : (
                    <span className="muted">vous</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

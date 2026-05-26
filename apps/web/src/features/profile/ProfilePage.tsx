import { useState, type FormEvent } from 'react';
import { api, ApiClientError } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // 2FA
  const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState('');

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await api.updateProfile({
        displayName: displayName.trim() || undefined,
        currentPassword: newPassword ? currentPassword : undefined,
        newPassword: newPassword || undefined,
      });
      setCurrentPassword('');
      setNewPassword('');
      await refreshUser();
      setInfo('Profil mis à jour.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Mise à jour impossible');
    }
  };

  const start2fa = async () => {
    setError(null);
    try {
      const res = await api.setup2fa();
      setSetup({ qrDataUrl: res.qrDataUrl, secret: res.secret });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Configuration 2FA impossible');
    }
  };

  const enable2fa = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.enable2fa(code.trim());
      setSetup(null);
      setCode('');
      await refreshUser();
      setInfo('Double authentification activée.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Code invalide');
    }
  };

  const disable2fa = async () => {
    const c = window.prompt('Entrez un code 2FA valide pour la désactiver :');
    if (!c) return;
    setError(null);
    try {
      await api.disable2fa(c.trim());
      await refreshUser();
      setInfo('Double authentification désactivée.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Désactivation impossible');
    }
  };

  return (
    <div>
      <h1 className="page-title">Mon profil</h1>
      <p className="page-subtitle">{user?.email}</p>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {info ? <div className="alert alert-success">{info}</div> : null}

      <div className="card" style={{ marginBottom: 20, maxWidth: 520 }}>
        <h3 className="panel-title">Informations</h3>
        <form onSubmit={saveProfile}>
          <div className="field">
            <label htmlFor="dn">Nom affiché</label>
            <input
              id="dn"
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="cp">Mot de passe actuel (pour le changer)</label>
            <input
              id="cp"
              className="input"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="np">Nouveau mot de passe</label>
            <input
              id="np"
              className="input"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn">
            Enregistrer
          </button>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <h3 className="panel-title">Double authentification (2FA)</h3>
        {user?.twoFactorEnabled ? (
          <div>
            <p style={{ color: 'var(--success)', fontWeight: 600 }}>✅ Activée</p>
            <button type="button" className="btn btn-danger btn-sm" onClick={disable2fa}>
              Désactiver
            </button>
          </div>
        ) : setup ? (
          <form onSubmit={enable2fa}>
            <p className="muted" style={{ marginTop: 0 }}>
              Scannez ce QR code dans votre application d’authentification, puis saisissez le code.
            </p>
            <img src={setup.qrDataUrl} alt="QR code 2FA" style={{ width: 180, height: 180 }} />
            <p className="muted">
              Clé manuelle : <code>{setup.secret}</code>
            </p>
            <div className="row">
              <input
                className="input"
                placeholder="Code à 6 chiffres"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-sm">
                Activer
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn btn-sm" onClick={start2fa}>
            Configurer la 2FA
          </button>
        )}
      </div>
    </div>
  );
}

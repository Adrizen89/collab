import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ApiClientError } from '../../lib/api';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login({
        email: email.trim(),
        password,
        twoFactorCode: needs2fa ? twoFactorCode.trim() : undefined,
      });
      if (result === '2fa') {
        setNeeds2fa(true);
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <form className="card login-card" onSubmit={onSubmit}>
        <h1 className="page-title">📝 CollabDocs</h1>
        <p className="page-subtitle">Connectez-vous pour accéder à vos documents.</p>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            required
            value={email}
            disabled={needs2fa}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <div className="password-field">
            <input
              id="password"
              className="input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              disabled={needs2fa}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              disabled={needs2fa}
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
        </div>

        {needs2fa ? (
          <div className="field">
            <label htmlFor="code">Code de double authentification</label>
            <input
              id="code"
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              required
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
            />
          </div>
        ) : null}

        <button type="submit" className="btn" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}

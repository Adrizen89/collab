import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-brand">
          📝 CollabDocs
        </Link>
        <nav className="app-nav">
          <Link to="/">Documents</Link>
          {user?.role === 'ADMIN' ? <Link to="/admin">Administration</Link> : null}
          <Link to="/profile">Profil</Link>
        </nav>
        <div className="app-user">
          <span className="app-user-name">
            {user?.displayName}
            {user?.role === 'ADMIN' ? <span className="badge">admin</span> : null}
          </span>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

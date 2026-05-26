import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './features/auth/LoginPage';
import { DocumentsPage } from './features/documents/DocumentsPage';
import { EditorPage } from './features/editor/EditorPage';
import { AdminPage } from './features/admin/AdminPage';
import { ProfilePage } from './features/profile/ProfilePage';

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="screen-center">Chargement…</div>;
  }

  // Visiteur non connecté : uniquement le formulaire de connexion (CLAUDE.md §1).
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DocumentsPage />} />
        <Route path="/documents/:id" element={<EditorPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        {user.role === 'ADMIN' ? <Route path="/admin" element={<AdminPage />} /> : null}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

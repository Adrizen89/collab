import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { DocumentNode, DocumentType } from '@collab/shared';
import { api, ApiClientError } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { TreeView } from './TreeView';

export function DocumentsPage() {
  const { user } = useAuth();
  const [tree, setTree] = useState<DocumentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // parentId de l'élément en cours de création : undefined = pas de formulaire,
  // null = racine, string = dans un dossier.
  const [creatingParent, setCreatingParent] = useState<string | null | undefined>(undefined);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<DocumentType>('TEXT');

  const load = useCallback(async () => {
    setError(null);
    try {
      setTree(await api.tree());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startCreate = (parentId: string | null) => {
    setCreatingParent(parentId);
    setNewName('');
    setNewType('TEXT');
  };

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (creatingParent === undefined || !newName.trim()) return;
    try {
      await api.createDocument({
        name: newName.trim(),
        type: newType,
        parentId: creatingParent,
      });
      setCreatingParent(undefined);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Création impossible');
    }
  };

  const handleRename = async (node: DocumentNode) => {
    const name = window.prompt('Nouveau nom :', node.name);
    if (!name || name.trim() === node.name) return;
    try {
      await api.renameDocument(node.id, name.trim());
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Renommage impossible');
    }
  };

  const handleDelete = async (node: DocumentNode) => {
    const sure = window.confirm(
      `Supprimer « ${node.name} »${node.type === 'FOLDER' ? ' et tout son contenu' : ''} ? Cette action est irréversible.`,
    );
    if (!sure) return;
    try {
      await api.deleteDocument(node.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Suppression impossible');
    }
  };

  return (
    <div>
      <h1 className="page-title">Mes documents</h1>
      <p className="page-subtitle">
        Arborescence de vos dossiers et documents, et ceux partagés avec vous.
      </p>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        <div className="toolbar-actions" style={{ marginBottom: 16 }}>
          <button type="button" className="btn btn-sm" onClick={() => startCreate(null)}>
            ＋ Nouveau (racine)
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}>
            ↻ Rafraîchir
          </button>
        </div>

        {creatingParent !== undefined ? (
          <form className="row" onSubmit={submitCreate} style={{ marginBottom: 16 }}>
            <input
              className="input"
              autoFocus
              placeholder={creatingParent === null ? 'Nom (à la racine)' : 'Nom (dans le dossier)'}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <select
              className="input"
              style={{ maxWidth: 150 }}
              value={newType}
              onChange={(e) => setNewType(e.target.value as DocumentType)}
            >
              <option value="TEXT">Document texte</option>
              <option value="FOLDER">Dossier</option>
            </select>
            <button type="submit" className="btn btn-sm">
              Créer
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setCreatingParent(undefined)}
            >
              Annuler
            </button>
          </form>
        ) : null}

        {loading ? (
          <p className="muted">Chargement…</p>
        ) : (
          <TreeView
            nodes={tree}
            currentUserId={user!.id}
            onCreateChild={startCreate}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}

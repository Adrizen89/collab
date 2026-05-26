import { useNavigate } from 'react-router-dom';
import type { DocumentNode } from '@collab/shared';

interface TreeViewProps {
  nodes: DocumentNode[];
  currentUserId: string;
  onCreateChild: (parentId: string) => void;
  onRename: (node: DocumentNode) => void;
  onDelete: (node: DocumentNode) => void;
}

const TYPE_ICON: Record<DocumentNode['type'], string> = {
  FOLDER: '📁',
  TEXT: '📄',
  FILE: '📎',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TreeItem({
  node,
  currentUserId,
  onCreateChild,
  onRename,
  onDelete,
}: { node: DocumentNode } & Omit<TreeViewProps, 'nodes'>) {
  const navigate = useNavigate();
  const isShared = node.ownerId !== currentUserId;
  const canOpen = node.type === 'TEXT';

  const open = () => {
    if (canOpen) navigate(`/documents/${node.id}`);
  };

  return (
    <li>
      <div className="tree-item" onClick={open} style={{ cursor: canOpen ? 'pointer' : 'default' }}>
        <span>{TYPE_ICON[node.type]}</span>
        <span className="tree-name">
          {node.name}
          {isShared ? <span className="badge badge-muted" style={{ marginLeft: 8 }}>partagé</span> : null}
        </span>
        <span className="tree-meta">
          {node.lastModifiedBy ? `${node.lastModifiedBy.displayName} · ` : ''}
          {formatDate(node.lastModifiedAt)}
        </span>
        <span className="tree-actions" onClick={(e) => e.stopPropagation()}>
          {node.type === 'FOLDER' ? (
            <button
              type="button"
              className="icon-btn"
              title="Ajouter dans ce dossier"
              onClick={() => onCreateChild(node.id)}
            >
              ＋
            </button>
          ) : null}
          {!isShared ? (
            <>
              <button type="button" className="icon-btn" title="Renommer" onClick={() => onRename(node)}>
                ✏️
              </button>
              <button type="button" className="icon-btn" title="Supprimer" onClick={() => onDelete(node)}>
                🗑️
              </button>
            </>
          ) : null}
        </span>
      </div>
      {node.children.length > 0 ? (
        <ul className="tree-children">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              currentUserId={currentUserId}
              onCreateChild={onCreateChild}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function TreeView({ nodes, ...rest }: TreeViewProps) {
  if (nodes.length === 0) {
    return <div className="empty-state">Aucun document. Créez votre premier document ci-dessus.</div>;
  }
  return (
    <ul className="tree">
      {nodes.map((node) => (
        <TreeItem key={node.id} node={node} {...rest} />
      ))}
    </ul>
  );
}

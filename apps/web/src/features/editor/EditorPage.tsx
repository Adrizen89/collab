import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next';
import type { DocumentMeta } from '@collab/shared';
import { api, ApiClientError, getAccessToken } from '../../lib/api';
import { config } from '../../lib/config';
import { useAuth } from '../../auth/AuthContext';
import { ConnectionStatus, type RealtimeStatus } from './ConnectionStatus';
import { InvitePanel } from './InvitePanel';
import { CallPanel } from '../call/CallPanel';

// Couleur stable par utilisateur (curseur/sélection awareness).
const USER_COLORS = ['#30bced', '#6eeb83', '#ffbc42', '#ee6352', '#9b5de5', '#00bbf9'];
function colorFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return USER_COLORS[h % USER_COLORS.length];
}

export function EditorPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const hostRef = useRef<HTMLDivElement>(null);

  const [meta, setMeta] = useState<DocumentMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const [synced, setSynced] = useState(false);
  const [peers, setPeers] = useState(1);

  useEffect(() => {
    let view: EditorView | null = null;
    let provider: WebsocketProvider | null = null;
    let idb: IndexeddbPersistence | null = null;
    let ydoc: Y.Doc | null = null;
    let cancelled = false;

    void (async () => {
      try {
        // Récupère les métadonnées + vérifie l'accès avant d'ouvrir la room.
        const content = await api.documentContent(id);
        if (cancelled) return;
        setMeta(content);
        if (content.type !== 'TEXT') {
          setError('Ce document n’est pas un document texte éditable.');
          return;
        }

        ydoc = new Y.Doc();
        const ytext = ydoc.getText('codemirror');

        // Persistance locale : les éditions survivent à une déconnexion et
        // resynchronisent à la reconnexion (pas de perte de données).
        idb = new IndexeddbPersistence(`collabdocs-${id}`, ydoc);

        const token = getAccessToken() ?? '';
        provider = new WebsocketProvider(`${config.realtimeUrl}/yjs`, id, ydoc, {
          params: { token },
        });

        provider.awareness.setLocalStateField('user', {
          name: user?.displayName ?? 'Anonyme',
          color: colorFor(user?.id ?? 'anon'),
        });
        provider.on('status', (e: { status: RealtimeStatus }) => {
          if (!cancelled) setStatus(e.status);
        });
        provider.on('sync', (isSynced: boolean) => {
          if (!cancelled) setSynced(isSynced);
        });
        const onAwareness = () => {
          if (!cancelled && provider) setPeers(provider.awareness.getStates().size);
        };
        provider.awareness.on('change', onAwareness);
        onAwareness();

        const undoManager = new Y.UndoManager(ytext);
        if (!hostRef.current || cancelled) return;

        view = new EditorView({
          parent: hostRef.current,
          state: EditorState.create({
            doc: ytext.toString(),
            extensions: [
              lineNumbers(),
              highlightActiveLine(),
              drawSelection(),
              history(),
              EditorView.lineWrapping,
              keymap.of([
                ...yUndoManagerKeymap,
                ...defaultKeymap,
                ...historyKeymap,
                indentWithTab,
              ]),
              markdown(),
              // Binding Yjs ↔ CodeMirror (synchro + curseurs distants).
              yCollab(ytext, provider.awareness, { undoManager }),
            ],
          }),
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : 'Document inaccessible');
        }
      }
    })();

    return () => {
      cancelled = true;
      view?.destroy();
      provider?.destroy();
      void idb?.destroy();
      ydoc?.destroy();
    };
  }, [id, user]);

  if (error) {
    return (
      <div className="card">
        <div className="alert alert-error">{error}</div>
        <Link to="/">← Retour aux documents</Link>
      </div>
    );
  }

  const isOwner = meta?.ownerId === user?.id;

  return (
    <div>
      <Link to="/" className="muted">
        ← Tous les documents
      </Link>

      <div className="editor-layout" style={{ marginTop: 12 }}>
        <div className="editor-main">
          <div className="editor-toolbar">
            <div>
              <strong>{meta?.name ?? 'Document'}</strong>
              <div className="tree-meta">
                {peers} participant{peers > 1 ? 's' : ''} en ligne
              </div>
            </div>
            <ConnectionStatus status={status} synced={synced} />
          </div>
          <div className="editor-host" ref={hostRef} />
        </div>

        <aside>
          {meta ? <InvitePanel documentId={id} canManage={!!isOwner} /> : null}
          <CallPanel documentId={id} />
        </aside>
      </div>
    </div>
  );
}

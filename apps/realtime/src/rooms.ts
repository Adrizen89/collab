import { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { loadState, saveState } from './persistence.js';
import { logger } from './logger.js';
import { PERSIST_INTERVAL_MS } from './env.js';

// Types de messages du protocole y-websocket.
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

interface Room {
  docId: string;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  /** Connexions → identifiants awareness qu'elles contrôlent (pour nettoyage). */
  conns: Map<WebSocket, Set<number>>;
  /** Modifié depuis la dernière persistance ? */
  dirty: boolean;
  /** Dernier utilisateur ayant édité (pour `lastModifiedById`). */
  lastEditorId: string | null;
}

// Une room par document. On stocke la promesse pour éviter une double initialisation.
const rooms = new Map<string, Promise<Room>>();

function broadcast(room: Room, message: Uint8Array, exclude?: WebSocket): void {
  room.conns.forEach((_ids, conn) => {
    if (conn !== exclude && conn.readyState === WebSocket.OPEN) {
      conn.send(message);
    }
  });
}

async function createRoom(docId: string): Promise<Room> {
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  const room: Room = {
    docId,
    doc,
    awareness,
    conns: new Map(),
    dirty: false,
    lastEditorId: null,
  };

  // Amorce avec l'état persisté (origine 'persistence' = ne pas marquer dirty).
  const initial = await loadState(docId);
  if (initial) {
    Y.applyUpdate(doc, initial, 'persistence');
  }

  doc.on('update', (update: Uint8Array, origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    broadcast(room, encoding.toUint8Array(encoder), origin instanceof WebSocket ? origin : undefined);

    if (origin !== 'persistence') {
      room.dirty = true;
    }
  });

  awareness.on(
    'update',
    (
      changes: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      const changed = changes.added.concat(changes.updated, changes.removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, changed),
      );
      broadcast(room, encoding.toUint8Array(encoder), origin instanceof WebSocket ? origin : undefined);

      if (origin instanceof WebSocket) {
        const ids = room.conns.get(origin);
        if (ids) {
          changes.added.forEach((id) => ids.add(id));
          changes.removed.forEach((id) => ids.delete(id));
        }
      }
    },
  );

  logger.info(`Room ouverte : ${docId}`);
  return room;
}

export function getRoom(docId: string): Promise<Room> {
  let roomPromise = rooms.get(docId);
  if (!roomPromise) {
    roomPromise = createRoom(docId);
    rooms.set(docId, roomPromise);
  }
  return roomPromise;
}

function toUint8Array(data: ArrayBuffer | Buffer | Buffer[]): Uint8Array {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (Array.isArray(data)) {
    return new Uint8Array(Buffer.concat(data));
  }
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/** Branche une connexion authentifiée sur une room déjà chargée. */
export function handleConnection(conn: WebSocket, room: Room, userId: string): void {
  conn.binaryType = 'arraybuffer';
  room.conns.set(conn, new Set());

  conn.on('message', (data: ArrayBuffer | Buffer | Buffer[]) => {
    try {
      const decoder = decoding.createDecoder(toUint8Array(data));
      const messageType = decoding.readVarUint(decoder);
      switch (messageType) {
        case MESSAGE_SYNC: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, room.doc, conn);
          room.lastEditorId = userId; // toute édition est attribuée à cet utilisateur
          if (encoding.length(encoder) > 1) {
            conn.send(encoding.toUint8Array(encoder));
          }
          break;
        }
        case MESSAGE_AWARENESS: {
          awarenessProtocol.applyAwarenessUpdate(
            room.awareness,
            decoding.readVarUint8Array(decoder),
            conn,
          );
          break;
        }
        default:
          break;
      }
    } catch (err) {
      logger.error('Message WS illisible', err);
    }
  });

  conn.on('close', () => {
    const ids = room.conns.get(conn);
    room.conns.delete(conn);
    if (ids && ids.size > 0) {
      awarenessProtocol.removeAwarenessStates(room.awareness, Array.from(ids), null);
    }
    if (room.conns.size === 0) {
      void closeRoom(room);
    }
  });

  // Étape 1 du handshake : envoyer notre vecteur d'état (SyncStep1).
  const syncEncoder = encoding.createEncoder();
  encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(syncEncoder, room.doc);
  conn.send(encoding.toUint8Array(syncEncoder));

  // Envoyer l'awareness existante.
  const states = room.awareness.getStates();
  if (states.size > 0) {
    const awEncoder = encoding.createEncoder();
    encoding.writeVarUint(awEncoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      awEncoder,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(states.keys())),
    );
    conn.send(encoding.toUint8Array(awEncoder));
  }
}

/** Persiste l'état complet du document si modifié. */
async function persistRoom(room: Room): Promise<void> {
  if (!room.dirty) {
    return;
  }
  try {
    const state = Y.encodeStateAsUpdate(room.doc);
    await saveState(room.docId, state, room.lastEditorId);
    room.dirty = false;
    logger.info(`État persisté : ${room.docId}`);
  } catch (err) {
    // On garde dirty=true : nouvel essai au prochain cycle (anti-perte, CLAUDE.md §12).
    logger.error(`Persistance ${room.docId} échouée`, err);
  }
}

/** Dernier client parti : on persiste puis on libère la room. */
async function closeRoom(room: Room): Promise<void> {
  if (room.conns.size > 0) {
    return;
  }
  await persistRoom(room);
  room.awareness.destroy();
  room.doc.destroy();
  rooms.delete(room.docId);
  logger.info(`Room fermée : ${room.docId}`);
}

/** Persistance périodique de toutes les rooms modifiées. */
export function startPersistenceLoop(): void {
  setInterval(() => {
    rooms.forEach((roomPromise) => {
      void roomPromise.then((room) => {
        if (room.dirty) {
          void persistRoom(room);
        }
      });
    });
  }, PERSIST_INTERVAL_MS);
}

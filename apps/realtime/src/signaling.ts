import { WebSocket } from 'ws';
import { logger } from './logger.js';

/**
 * Signalisation WebRTC.
 * Simple relais des messages SDP / ICE entre pairs d'un même document.
 * Si cette brique échoue, la synchro Yjs continue de fonctionner.
 */
const signalRooms = new Map<string, Set<WebSocket>>();

export function handleSignalingConnection(ws: WebSocket, documentId: string): void {
  let peers = signalRooms.get(documentId);
  if (!peers) {
    peers = new Set();
    signalRooms.set(documentId, peers);
  }
  peers.add(ws);

  ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
    const text = data.toString();
    peers!.forEach((peer) => {
      if (peer !== ws && peer.readyState === WebSocket.OPEN) {
        peer.send(text);
      }
    });
  });

  ws.on('close', () => {
    peers!.delete(ws);
    if (peers!.size === 0) {
      signalRooms.delete(documentId);
    }
  });

  logger.info(`Pair de signalisation connecté : ${documentId}`);
}

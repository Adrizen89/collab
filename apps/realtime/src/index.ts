import http from 'node:http';
import type { Duplex } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { WebSocketServer } from 'ws';
import { env } from './env.js';
import { logger } from './logger.js';
import { verifyToken, userCanAccess } from './auth.js';
import { getRoom, handleConnection, startPersistenceLoop } from './rooms.js';
import { handleSignalingConnection } from './signaling.js';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"status":"ok"}');
    return;
  }
  res.writeHead(404);
  res.end();
});

// Connexions WebSocket gérées manuellement à l'upgrade (pour valider le JWT avant).
const yjsWss = new WebSocketServer({ noServer: true });
const rtcWss = new WebSocketServer({ noServer: true });

interface ParsedUpgrade {
  pathname: string;
  token: string | null;
}

function parseUpgrade(req: IncomingMessage): ParsedUpgrade {
  const url = new URL(req.url ?? '/', 'http://localhost');
  // Token transmis via sous-protocole WS (évite de le mettre dans l'URL, CLAUDE.md §9).
  // Fallback query `?token=` toléré pour le débogage local.
  const proto = req.headers['sec-websocket-protocol'];
  let token: string | null = null;
  if (typeof proto === 'string' && proto.length > 0) {
    token = proto.split(',')[0]?.trim() ?? null;
  }
  if (!token) {
    token = url.searchParams.get('token');
  }
  return { pathname: url.pathname, token };
}

function reject(socket: Duplex, code: number): void {
  const labels: Record<number, string> = {
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
  };
  socket.write(`HTTP/1.1 ${code} ${labels[code] ?? 'Bad Request'}\r\n\r\n`);
  socket.destroy();
}

server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
  void (async () => {
    try {
      const { pathname, token } = parseUpgrade(req);
      const payload = token ? verifyToken(token) : null;
      if (!payload) {
        reject(socket, 401);
        return;
      }

      const yjsMatch = /^\/yjs\/([\w-]+)$/.exec(pathname);
      const rtcMatch = /^\/rtc\/([\w-]+)$/.exec(pathname);
      const docId = yjsMatch?.[1] ?? rtcMatch?.[1];

      if (!docId) {
        reject(socket, 404);
        return;
      }

      // Autorisation vérifiée serveur : pas de room sans accès (CLAUDE.md §9).
      const allowed = await userCanAccess(payload.sub, docId);
      if (!allowed) {
        reject(socket, 403);
        return;
      }

      if (yjsMatch) {
        const room = await getRoom(docId); // charge l'état avant d'accepter la connexion
        yjsWss.handleUpgrade(req, socket, head, (ws) => {
          handleConnection(ws, room, payload.sub);
        });
      } else {
        rtcWss.handleUpgrade(req, socket, head, (ws) => {
          handleSignalingConnection(ws, docId);
        });
      }
    } catch (err) {
      logger.error('Échec de l\'upgrade WebSocket', err);
      reject(socket, 500);
    }
  })();
});

startPersistenceLoop();

server.listen(env.REALTIME_PORT, () => {
  logger.info(`Serveur Realtime en écoute sur le port ${env.REALTIME_PORT}`);
});

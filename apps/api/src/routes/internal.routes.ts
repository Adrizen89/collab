import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../env.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/error.js';
import { forbidden } from '../lib/errors.js';
import { loadYjsState, saveYjsState, userCanAccess } from '../services/document.service.js';

export const internalRouter = Router();

/**
 * Authentifie les appels Realtime → API par un secret partagé.
 * Ce routeur n'est jamais exposé au client final.
 */
function requireInternalSecret(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.headers['x-internal-secret'];
  if (provided !== env.INTERNAL_API_SECRET) {
    throw forbidden('Secret interne invalide');
  }
  next();
}

internalRouter.use(requireInternalSecret);

// Contrôle d'accès demandé par le serveur Realtime à l'ouverture d'une room.
internalRouter.get(
  '/documents/:id/access/:userId',
  asyncHandler(async (req, res) => {
    const allowed = await userCanAccess(req.params.userId, req.params.id);
    res.json({ allowed });
  }),
);

// État initial pour amorcer une room Yjs.
internalRouter.get(
  '/documents/:id/state',
  asyncHandler(async (req, res) => {
    const buffer = await loadYjsState(req.params.id);
    res.json({ yjsState: buffer ? buffer.toString('base64') : null });
  }),
);

const saveSchema = z.object({
  state: z.string(), // état Yjs encodé base64
  lastModifiedById: z.string().nullish(),
});

// Persistance déclenchée par intervalle / fermeture de room côté Realtime.
internalRouter.post(
  '/documents/:id/state',
  validateBody(saveSchema),
  asyncHandler(async (req, res) => {
    const { state, lastModifiedById } = req.body as z.infer<typeof saveSchema>;
    await saveYjsState(req.params.id, state, lastModifiedById ?? null);
    res.status(204).end();
  }),
);

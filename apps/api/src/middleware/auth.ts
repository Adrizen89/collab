import type { NextFunction, Request, Response } from 'express';
import { unauthorized, forbidden } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';

/**
 * Exige un access token JWT valide dans l'en-tête Authorization.
 * Renseigne `req.auth`. Ne fait JAMAIS confiance au client : tout est vérifié serveur.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Token d\'accès manquant');
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    throw unauthorized('Token d\'accès invalide ou expiré');
  }
}

/** Exige le rôle ADMIN (à chaîner après requireAuth). */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.role !== 'ADMIN') {
    throw forbidden('Réservé aux administrateurs');
  }
  next();
}

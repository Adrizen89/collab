import type { NextFunction, Request, Response } from 'express';
import type { ApiError } from '@collab/shared';
import { HttpError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/**
 * Enveloppe un handler async pour router les rejets vers le middleware d'erreur
 * (Express 4 n'attrape pas les promesses rejetées tout seul).
 */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req as T, res, next).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response): void {
  const body: ApiError = { error: 'Route introuvable' };
  res.status(404).json(body);
}

/** Middleware d'erreur terminal : jamais de stack trace renvoyée au client. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    const body: ApiError = { error: err.message };
    if (err.details) {
      body.details = err.details;
    }
    res.status(err.status).json(body);
    return;
  }

  logger.error('Erreur non gérée', err);
  const body: ApiError = { error: 'Erreur interne du serveur' };
  res.status(500).json(body);
}

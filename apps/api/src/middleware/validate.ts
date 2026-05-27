import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { badRequest } from '../lib/errors.js';

/**
 * Valide et type le corps de requête via un schéma Zod : on ne fait jamais
 * confiance au client. Remplace req.body par la version validée.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details: Record<string, string> = {};
        for (const issue of err.issues) {
          details[issue.path.join('.') || '_'] = issue.message;
        }
        throw badRequest('Données invalides', details);
      }
      throw err;
    }
  };
}

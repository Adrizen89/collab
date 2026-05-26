// Erreur HTTP métier : le middleware d'erreur la transforme en réponse
// `{ error }` propre avec le bon code (cf. CLAUDE.md §7).
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (msg: string, details?: Record<string, string>) =>
  new HttpError(400, msg, details);
export const unauthorized = (msg = 'Non authentifié') => new HttpError(401, msg);
export const forbidden = (msg = 'Action non autorisée') => new HttpError(403, msg);
export const notFound = (msg = 'Ressource introuvable') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

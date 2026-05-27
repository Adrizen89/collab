import jwt from 'jsonwebtoken';
import type { AccessTokenPayload } from '@collab/shared';
import { env } from './env.js';
import { logger } from './logger.js';

/** Vérifie l'access token JWT présenté à l'ouverture de la connexion WS. */
export function verifyToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (typeof decoded === 'string') {
      return null;
    }
    return {
      sub: String(decoded.sub),
      role: decoded.role as AccessTokenPayload['role'],
      email: String(decoded.email),
    };
  } catch {
    return null;
  }
}

/**
 * Demande à l'API si l'utilisateur a accès au document.
 */
export async function userCanAccess(userId: string, documentId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${env.API_INTERNAL_URL}/internal/documents/${documentId}/access/${userId}`,
      { headers: { 'x-internal-secret': env.INTERNAL_API_SECRET } },
    );
    if (!res.ok) {
      return false;
    }
    const data = (await res.json()) as { allowed: boolean };
    return data.allowed;
  } catch (err) {
    logger.error('Vérification d\'accès impossible (API injoignable ?)', err);
    return false;
  }
}

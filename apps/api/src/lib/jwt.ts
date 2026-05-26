import jwt from 'jsonwebtoken';
import type { AccessTokenPayload } from '@collab/shared';
import { env } from '../env.js';

/** Signe un access token court (stateless). */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
  });
}

/** Vérifie un access token et renvoie son payload, ou lève si invalide/expiré. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === 'string') {
    throw new Error('Token malformé');
  }
  return {
    sub: String(decoded.sub),
    role: decoded.role as AccessTokenPayload['role'],
    email: String(decoded.email),
  };
}

/** Convertit une durée type "15m" / "7d" en millisecondes. */
export function durationToMs(duration: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Durée invalide : ${duration}`);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const factors: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * factors[unit];
}

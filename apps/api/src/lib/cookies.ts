import type { CookieOptions, Response } from 'express';
import { env } from '../env.js';
import { durationToMs } from './jwt.js';

export const REFRESH_COOKIE = 'refreshToken';

/** Options du cookie refresh : httpOnly (anti-XSS), sameSite, secure en prod. */
function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: durationToMs(env.JWT_REFRESH_TTL),
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
}

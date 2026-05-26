import { Router } from 'express';
import { z } from 'zod';
import type { LoginResponse, RefreshResponse, TwoFactorRequiredResponse } from '@collab/shared';
import { login, refresh, logout } from '../services/auth.service.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/error.js';
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE } from '../lib/cookies.js';
import { unauthorized } from '../lib/errors.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  twoFactorCode: z.string().optional(),
});

authRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password, twoFactorCode } = req.body as z.infer<typeof loginSchema>;
    const result = await login(email, password, twoFactorCode);

    if (result.kind === '2fa-required') {
      const body: TwoFactorRequiredResponse = { twoFactorRequired: true };
      res.status(200).json(body);
      return;
    }

    setRefreshCookie(res, result.tokens.refreshToken);
    const body: LoginResponse = { accessToken: result.tokens.accessToken, user: result.user };
    res.status(200).json(body);
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) {
      throw unauthorized('Aucun refresh token');
    }
    const tokens = await refresh(token);
    setRefreshCookie(res, tokens.refreshToken);
    const body: RefreshResponse = { accessToken: tokens.accessToken };
    res.status(200).json(body);
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (token) {
      await logout(token);
    }
    clearRefreshCookie(res);
    res.status(204).end();
  }),
);

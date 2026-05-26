import { Router } from 'express';
import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '@collab/shared';
import type { PublicUser, TwoFactorSetupResponse } from '@collab/shared';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/error.js';
import { getPublicUser, updateProfile } from '../services/user.service.js';
import {
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  qrCodeDataUrl,
} from '../services/twofactor.service.js';

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user: PublicUser = await getPublicUser(req.auth!.sub);
    res.json(user);
  }),
);

const updateSchema = z
  .object({
    displayName: z.string().min(1).max(80).optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH).optional(),
  })
  .refine((v) => v.displayName !== undefined || v.newPassword !== undefined, {
    message: 'Aucune modification fournie',
  });

profileRouter.patch(
  '/',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateSchema>;
    const user = await updateProfile(req.auth!.sub, body);
    res.json(user);
  }),
);

// ── 2FA (secondaire) ──
profileRouter.post(
  '/2fa/setup',
  asyncHandler(async (req, res) => {
    const setup: TwoFactorSetupResponse = await setupTwoFactor(req.auth!.sub);
    const qrDataUrl = await qrCodeDataUrl(setup.otpauthUrl);
    res.json({ ...setup, qrDataUrl });
  }),
);

const codeSchema = z.object({ code: z.string().min(6).max(8) });

profileRouter.post(
  '/2fa/enable',
  validateBody(codeSchema),
  asyncHandler(async (req, res) => {
    await enableTwoFactor(req.auth!.sub, (req.body as z.infer<typeof codeSchema>).code);
    res.status(204).end();
  }),
);

profileRouter.post(
  '/2fa/disable',
  validateBody(codeSchema),
  asyncHandler(async (req, res) => {
    await disableTwoFactor(req.auth!.sub, (req.body as z.infer<typeof codeSchema>).code);
    res.status(204).end();
  }),
);

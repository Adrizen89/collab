import { Router } from 'express';
import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '@collab/shared';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/error.js';
import { createUser, listUsers, setBlocked } from '../services/user.service.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH),
  displayName: z.string().trim().min(1).max(80),
  role: z.enum(['MEMBER', 'ADMIN']).optional(),
});

const blockedSchema = z.object({ isBlocked: z.boolean() });

adminRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    res.json(await listUsers());
  }),
);

adminRouter.post(
  '/users',
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createUserSchema>;
    res.status(201).json(await createUser(body));
  }),
);

adminRouter.patch(
  '/users/:id/blocked',
  validateBody(blockedSchema),
  asyncHandler(async (req, res) => {
    const { isBlocked } = req.body as z.infer<typeof blockedSchema>;
    res.json(await setBlocked(req.auth!.sub, req.params.id, isBlocked));
  }),
);

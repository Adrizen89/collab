import { Router } from 'express';
import { z } from 'zod';
import { DOCUMENT_NAME_MAX_LENGTH } from '@collab/shared';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/error.js';
import {
  listTree,
  createDocument,
  renameDocument,
  deleteDocument,
  getDocumentContent,
  inviteUser,
  listInvites,
  removeInvite,
} from '../services/document.service.js';

export const documentRouter = Router();
documentRouter.use(requireAuth);

const nameField = z.string().trim().min(1).max(DOCUMENT_NAME_MAX_LENGTH);

const createSchema = z.object({
  name: nameField,
  type: z.enum(['TEXT', 'FILE', 'FOLDER']),
  parentId: z.string().nullish(),
});

const renameSchema = z.object({ name: nameField });
const inviteSchema = z.object({ email: z.string().email() });

documentRouter.get(
  '/tree',
  asyncHandler(async (req, res) => {
    res.json(await listTree(req.auth!.sub));
  }),
);

documentRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const doc = await createDocument(req.auth!.sub, {
      name: body.name,
      type: body.type,
      parentId: body.parentId ?? null,
    });
    res.status(201).json(doc);
  }),
);

documentRouter.get(
  '/:id/content',
  asyncHandler(async (req, res) => {
    res.json(await getDocumentContent(req.auth!.sub, req.params.id));
  }),
);

documentRouter.patch(
  '/:id',
  validateBody(renameSchema),
  asyncHandler(async (req, res) => {
    const { name } = req.body as z.infer<typeof renameSchema>;
    res.json(await renameDocument(req.auth!.sub, req.params.id, name));
  }),
);

documentRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteDocument(req.auth!.sub, req.auth!.role, req.params.id);
    res.status(204).end();
  }),
);

documentRouter.get(
  '/:id/invites',
  asyncHandler(async (req, res) => {
    res.json(await listInvites(req.auth!.sub, req.params.id));
  }),
);

documentRouter.post(
  '/:id/invites',
  validateBody(inviteSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body as z.infer<typeof inviteSchema>;
    const invite = await inviteUser(req.auth!.sub, req.params.id, email);
    res.status(201).json(invite);
  }),
);

documentRouter.delete(
  '/:id/invites/:inviteId',
  asyncHandler(async (req, res) => {
    await removeInvite(req.auth!.sub, req.params.id, req.params.inviteId);
    res.status(204).end();
  }),
);

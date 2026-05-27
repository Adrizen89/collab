import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { badRequest } from './errors.js';

// Dossier de stockage HORS de la racine web
export const UPLOADS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../uploads',
);
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo

// Types MIME autorisés → extension régénérée (on ne fait pas confiance au nom client).
const ALLOWED_TYPES = new Map<string, string>([
  ['application/pdf', '.pdf'],
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp'],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_TYPES.get(file.mimetype) ?? '';
    // Nom totalement régénéré : pas de path traversal, pas de collision.
    cb(null, `${randomBytes(16).toString('hex')}${ext}`);
  },
});

const uploadSingle = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé (PDF, PNG, JPEG, GIF, WebP uniquement)'));
    }
  },
}).single('file');

/** Middleware d'upload : convertit toute erreur multer en 400 propre. */
export function handleUpload(req: Request, res: Response, next: NextFunction): void {
  uploadSingle(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(badRequest(err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux (max 10 Mo)' : err.message));
      return;
    }
    if (err instanceof Error) {
      next(badRequest(err.message));
      return;
    }
    next();
  });
}

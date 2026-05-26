import type { Document, User } from '@prisma/client';
import type { DocumentMeta, PublicUser } from '@collab/shared';

/** Transforme un User Prisma en vue publique (sans aucun secret). */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isBlocked: user.isBlocked,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}

type DocumentWithModifier = Document & {
  lastModifiedBy?: Pick<User, 'id' | 'displayName'> | null;
};

/** Transforme un Document Prisma en métadonnées exposables (sans le contenu binaire). */
export function toDocumentMeta(doc: DocumentWithModifier): DocumentMeta {
  return {
    id: doc.id,
    name: doc.name,
    type: doc.type,
    parentId: doc.parentId,
    fileUrl: doc.fileUrl,
    lastModifiedAt: doc.lastModifiedAt.toISOString(),
    lastModifiedBy: doc.lastModifiedBy
      ? { id: doc.lastModifiedBy.id, displayName: doc.lastModifiedBy.displayName }
      : null,
    ownerId: doc.ownerId,
  };
}

import type { Document } from '@prisma/client';
import type {
  CreateDocumentRequest,
  DocumentContent,
  DocumentInviteView,
  DocumentMeta,
  DocumentNode,
  UserRole,
} from '@collab/shared';
import { prisma } from '../lib/prisma.js';
import { toDocumentMeta, toPublicUser } from '../lib/mappers.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';

// Sélection commune incluant l'auteur de la dernière modification (léger).
const modifierSelect = { select: { id: true, displayName: true } } as const;

// ─────────────────────────────────────────────────────────────
// Autorisation (toujours vérifiée côté serveur — CLAUDE.md §9)
// ─────────────────────────────────────────────────────────────

/** Renvoie le document si l'utilisateur peut le VOIR/ÉDITER (propriétaire ou invité). */
async function assertCanAccess(userId: string, documentId: string): Promise<Document> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    throw notFound('Document introuvable');
  }
  if (doc.ownerId === userId) {
    return doc;
  }
  const invite = await prisma.documentInvite.findUnique({
    where: { documentId_userId: { documentId, userId } },
  });
  if (!invite) {
    throw forbidden('Vous n\'avez pas accès à ce document');
  }
  return doc;
}

/** Variante booléenne (sans exception) pour le contrôle d'accès Realtime. */
export async function userCanAccess(userId: string, documentId: string): Promise<boolean> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { ownerId: true },
  });
  if (!doc) {
    return false;
  }
  if (doc.ownerId === userId) {
    return true;
  }
  const invite = await prisma.documentInvite.findUnique({
    where: { documentId_userId: { documentId, userId } },
  });
  return invite !== null;
}

/** Renvoie le document si l'utilisateur en est PROPRIÉTAIRE (invitation, renommage). */
async function assertOwner(userId: string, documentId: string): Promise<Document> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    throw notFound('Document introuvable');
  }
  if (doc.ownerId !== userId) {
    throw forbidden('Seul le propriétaire peut effectuer cette action');
  }
  return doc;
}

// ─────────────────────────────────────────────────────────────
// Arborescence
// ─────────────────────────────────────────────────────────────

/** Tri : dossiers d'abord, puis ordre alphabétique insensible à la casse. */
function sortNodes(nodes: DocumentNode[]): void {
  nodes.sort((a, b) => {
    if (a.type === 'FOLDER' && b.type !== 'FOLDER') return -1;
    if (a.type !== 'FOLDER' && b.type === 'FOLDER') return 1;
    return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
  });
  for (const n of nodes) {
    if (n.children.length) sortNodes(n.children);
  }
}

/**
 * Arborescence visible par l'utilisateur : ses documents (hiérarchie complète)
 * + les documents partagés avec lui (placés à la racine, non dépliés).
 */
export async function listTree(userId: string): Promise<DocumentNode[]> {
  const owned = await prisma.document.findMany({
    where: { ownerId: userId },
    include: { lastModifiedBy: modifierSelect },
  });
  const shared = await prisma.document.findMany({
    where: { invites: { some: { userId } }, NOT: { ownerId: userId } },
    include: { lastModifiedBy: modifierSelect },
  });

  const nodes = new Map<string, DocumentNode>();
  for (const doc of owned) {
    nodes.set(doc.id, { ...toDocumentMeta(doc), children: [] });
  }

  const roots: DocumentNode[] = [];
  for (const doc of owned) {
    const node = nodes.get(doc.id)!;
    const parent = doc.parentId ? nodes.get(doc.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Les documents partagés apparaissent comme racines pour l'invité.
  for (const doc of shared) {
    roots.push({ ...toDocumentMeta(doc), children: [] });
  }

  sortNodes(roots);
  return roots;
}

// ─────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────

export async function createDocument(
  userId: string,
  input: CreateDocumentRequest,
): Promise<DocumentMeta> {
  if (input.parentId) {
    const parent = await prisma.document.findUnique({ where: { id: input.parentId } });
    if (!parent) {
      throw badRequest('Dossier parent introuvable');
    }
    if (parent.ownerId !== userId) {
      throw forbidden('Vous ne pouvez créer que dans vos propres dossiers');
    }
    if (parent.type !== 'FOLDER') {
      throw badRequest('Le parent doit être un dossier');
    }
  }

  const doc = await prisma.document.create({
    data: {
      name: input.name,
      type: input.type,
      parentId: input.parentId ?? null,
      ownerId: userId,
      lastModifiedById: userId,
      lastModifiedAt: new Date(),
    },
    include: { lastModifiedBy: modifierSelect },
  });
  return toDocumentMeta(doc);
}

export async function renameDocument(
  userId: string,
  documentId: string,
  name: string,
): Promise<DocumentMeta> {
  await assertOwner(userId, documentId);
  const doc = await prisma.document.update({
    where: { id: documentId },
    data: { name, lastModifiedById: userId, lastModifiedAt: new Date() },
    include: { lastModifiedBy: modifierSelect },
  });
  return toDocumentMeta(doc);
}

/** Suppression : propriétaire OU administrateur (CLAUDE.md §6). Cascade sur enfants + invitations. */
export async function deleteDocument(
  userId: string,
  role: UserRole,
  documentId: string,
): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    throw notFound('Document introuvable');
  }
  if (doc.ownerId !== userId && role !== 'ADMIN') {
    throw forbidden('Seul le propriétaire ou un administrateur peut supprimer');
  }
  await prisma.document.delete({ where: { id: documentId } });
}

/** Contenu d'un document (état Yjs encodé base64). Accès propriétaire ou invité. */
export async function getDocumentContent(
  userId: string,
  documentId: string,
): Promise<DocumentContent> {
  const doc = await assertCanAccess(userId, documentId);
  const full = await prisma.document.findUnique({
    where: { id: documentId },
    include: { lastModifiedBy: modifierSelect },
  });
  return {
    ...toDocumentMeta(full!),
    yjsState: doc.content ? Buffer.from(doc.content).toString('base64') : null,
  };
}

// ─────────────────────────────────────────────────────────────
// Persistance Yjs (appelée par le serveur Realtime via la route interne)
// ─────────────────────────────────────────────────────────────

/**
 * Sauvegarde l'état Yjs binaire d'un document et met à jour les métadonnées
 * de dernière modification (invariant CLAUDE.md §6).
 */
export async function saveYjsState(
  documentId: string,
  base64State: string,
  lastModifiedById: string | null,
): Promise<void> {
  const buffer = Buffer.from(base64State, 'base64');
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    throw notFound('Document introuvable');
  }
  await prisma.document.update({
    where: { id: documentId },
    data: {
      content: buffer,
      lastModifiedAt: new Date(),
      ...(lastModifiedById ? { lastModifiedById } : {}),
    },
  });
}

/** État Yjs brut (Buffer) pour initialiser une room côté Realtime. */
export async function loadYjsState(documentId: string): Promise<Buffer | null> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    throw notFound('Document introuvable');
  }
  return doc.content ? Buffer.from(doc.content) : null;
}

// ─────────────────────────────────────────────────────────────
// Invitations
// ─────────────────────────────────────────────────────────────

export async function inviteUser(
  ownerId: string,
  documentId: string,
  email: string,
): Promise<DocumentInviteView> {
  await assertOwner(ownerId, documentId);

  const invitee = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!invitee) {
    throw notFound('Aucun utilisateur avec cet email');
  }
  if (invitee.id === ownerId) {
    throw badRequest('Vous êtes déjà propriétaire de ce document');
  }

  const existing = await prisma.documentInvite.findUnique({
    where: { documentId_userId: { documentId, userId: invitee.id } },
  });
  if (existing) {
    throw conflict('Cette personne est déjà invitée');
  }

  const invite = await prisma.documentInvite.create({
    data: { documentId, userId: invitee.id },
  });
  return {
    id: invite.id,
    documentId,
    user: toPublicUser(invitee),
    createdAt: invite.createdAt.toISOString(),
  };
}

export async function listInvites(
  userId: string,
  documentId: string,
): Promise<DocumentInviteView[]> {
  await assertCanAccess(userId, documentId);
  const invites = await prisma.documentInvite.findMany({
    where: { documentId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });
  return invites.map((i) => ({
    id: i.id,
    documentId: i.documentId,
    user: toPublicUser(i.user),
    createdAt: i.createdAt.toISOString(),
  }));
}

export async function removeInvite(
  ownerId: string,
  documentId: string,
  inviteId: string,
): Promise<void> {
  await assertOwner(ownerId, documentId);
  const invite = await prisma.documentInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.documentId !== documentId) {
    throw notFound('Invitation introuvable');
  }
  await prisma.documentInvite.delete({ where: { id: inviteId } });
}

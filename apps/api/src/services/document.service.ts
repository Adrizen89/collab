import path from 'node:path';
import fs from 'node:fs/promises';
import * as Y from 'yjs';
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
import { UPLOADS_DIR } from '../lib/uploads.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';

const modifierSelect = { select: { id: true, displayName: true } } as const;

function decodeYjsToText(buffer: Buffer | Uint8Array): string {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, new Uint8Array(buffer));
  const ytext = ydoc.getText('codemirror');
  return ytext.toString();
}

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

  for (const doc of shared) {
    roots.push({ ...toDocumentMeta(doc), children: [] });
  }

  sortNodes(roots);
  return roots;
}

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

/** Suppression : propriétaire ou administrateur. Cascade sur enfants + invitations. */
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
  // Nettoyage best-effort du fichier sur disque si c'est un FILE.
  if (doc.type === 'FILE' && doc.fileUrl) {
    await fs.unlink(path.join(UPLOADS_DIR, doc.fileUrl)).catch(() => undefined);
  }
  await prisma.document.delete({ where: { id: documentId } });
}


interface UploadedFile {
  filename: string;
  mimetype: string;
  originalname: string;
}

/** Attache (ou remplace) le fichier d'un document FILE. Propriétaire uniquement. */
export async function attachFile(
  userId: string,
  documentId: string,
  file: UploadedFile,
): Promise<DocumentMeta> {
  const doc = await assertOwner(userId, documentId);
  if (doc.type !== 'FILE') {
    throw badRequest('Ce document n\'est pas de type fichier');
  }
  // Remplacement : supprimer l'ancien fichier physique.
  if (doc.fileUrl) {
    await fs.unlink(path.join(UPLOADS_DIR, doc.fileUrl)).catch(() => undefined);
  }
  const updated = await prisma.document.update({
    where: { id: documentId },
    data: {
      fileUrl: file.filename,
      fileMimeType: file.mimetype,
      fileName: file.originalname,
      lastModifiedById: userId,
      lastModifiedAt: new Date(),
    },
    include: { lastModifiedBy: modifierSelect },
  });
  return toDocumentMeta(updated);
}

interface FileInfo {
  path?: string;
  mime: string;
  name: string;
  content?: Buffer;
  isText?: boolean;
}

/** Renvoie le chemin disque + métadonnées d'un fichier. Accès propriétaire ou invité. */
export async function getFile(
  userId: string,
  documentId: string,
): Promise<FileInfo> {
  const doc = await assertCanAccess(userId, documentId);
  if (doc.type === 'TEXT') {
    const text = doc.content ? decodeYjsToText(doc.content) : '';
    return {
      mime: 'text/plain',
      name: `${doc.name}.txt`,
      content: Buffer.from(text, 'utf-8'),
      isText: true,
    };
  }
  if (doc.type !== 'FILE' || !doc.fileUrl) {
    throw notFound('Aucun fichier attaché à ce document');
  }
  return {
    path: path.join(UPLOADS_DIR, doc.fileUrl),
    mime: doc.fileMimeType ?? 'application/octet-stream',
    name: doc.fileName ?? doc.name,
  };
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

/** Sauvegarde l'état Yjs binaire et met à jour les métadonnées de dernière modification. */
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

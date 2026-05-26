import bcrypt from 'bcryptjs';
import type { CreateUserRequest, PublicUser } from '@collab/shared';
import { prisma } from '../lib/prisma.js';
import { toPublicUser } from '../lib/mappers.js';
import { hashPassword } from './auth.service.js';
import { badRequest, conflict, notFound, unauthorized } from '../lib/errors.js';

export async function getPublicUser(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw notFound('Utilisateur introuvable');
  }
  return toPublicUser(user);
}

interface UpdateProfileInput {
  displayName?: string;
  currentPassword?: string;
  newPassword?: string;
}

/** Modification du profil (secondaire) : nom affiché et/ou mot de passe. */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw notFound('Utilisateur introuvable');
  }

  const data: { displayName?: string; passwordHash?: string } = {};
  if (input.displayName) {
    data.displayName = input.displayName;
  }
  if (input.newPassword) {
    if (!input.currentPassword) {
      throw badRequest('Le mot de passe actuel est requis pour le changer');
    }
    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!ok) {
      throw unauthorized('Mot de passe actuel incorrect');
    }
    data.passwordHash = await hashPassword(input.newPassword);
  }

  const updated = await prisma.user.update({ where: { id: userId }, data });
  return toPublicUser(updated);
}

/** Crée un compte (réservé ADMIN — pas d'inscription publique, CLAUDE.md §6). */
export async function createUser(input: CreateUserRequest): Promise<PublicUser> {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw conflict('Un compte existe déjà avec cet email');
  }
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: input.displayName,
      role: input.role ?? 'MEMBER',
    },
  });
  return toPublicUser(user);
}

export async function listUsers(): Promise<PublicUser[]> {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  return users.map(toPublicUser);
}

/** Bloque / débloque un compte. Un admin ne peut pas se bloquer lui-même. */
export async function setBlocked(
  actingAdminId: string,
  targetUserId: string,
  isBlocked: boolean,
): Promise<PublicUser> {
  if (actingAdminId === targetUserId) {
    throw badRequest('Vous ne pouvez pas modifier le statut de votre propre compte');
  }
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    throw notFound('Utilisateur introuvable');
  }
  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { isBlocked },
  });

  // Si on bloque, on révoque ses refresh tokens pour couper l'accès au prochain refresh.
  if (isBlocked) {
    await prisma.refreshToken.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  return toPublicUser(updated);
}

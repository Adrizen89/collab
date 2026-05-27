import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import type { User } from '@prisma/client';
import type { AuthTokens, PublicUser } from '@collab/shared';
import { prisma } from '../lib/prisma.js';
import { signAccessToken, durationToMs } from '../lib/jwt.js';
import { toPublicUser } from '../lib/mappers.js';
import { env } from '../env.js';
import { unauthorized } from '../lib/errors.js';

const BCRYPT_ROUNDS = 12;

export type LoginResult =
  | { kind: 'ok'; tokens: AuthTokens; user: PublicUser }
  | { kind: '2fa-required' };

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Authentifie un utilisateur. Vérifie : existence, mot de passe, compte non bloqué,
 * et code 2FA si activé. Messages volontairement génériques (pas d'oracle d'énumération).
 */
export async function login(
  email: string,
  password: string,
  twoFactorCode?: string,
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Même message que mot de passe faux : ne révèle pas si l'email existe.
  if (!user) {
    throw unauthorized('Identifiants invalides');
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    throw unauthorized('Identifiants invalides');
  }

  // Un compte bloqué ne peut pas se connecter.
  if (user.isBlocked) {
    throw unauthorized('Ce compte est bloqué. Contactez un administrateur.');
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!twoFactorCode) {
      return { kind: '2fa-required' };
    }
    const valid = authenticator.verify({ token: twoFactorCode, secret: user.twoFactorSecret });
    if (!valid) {
      throw unauthorized('Code de double authentification invalide');
    }
  }

  const tokens = await issueTokens(user);
  return { kind: 'ok', tokens, user: toPublicUser(user) };
}

/** Émet un access token (JWT) + un refresh token opaque persisté (révocable). */
export async function issueTokens(user: User): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });

  const refreshToken = randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + durationToMs(env.JWT_REFRESH_TTL));
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt },
  });

  return { accessToken, refreshToken };
}

/** Rotation du refresh token : révoque l'ancien, en émet un nouveau. */
export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw unauthorized('Refresh token invalide ou expiré');
  }
  if (stored.user.isBlocked) {
    throw unauthorized('Ce compte est bloqué.');
  }

  // Révoque l'ancien (rotation) puis émet une nouvelle paire.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return issueTokens(stored.user);
}

/** Déconnexion : révoque le refresh token fourni s'il existe. */
export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

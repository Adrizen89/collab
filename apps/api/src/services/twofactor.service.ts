import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import type { TwoFactorSetupResponse } from '@collab/shared';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound, unauthorized } from '../lib/errors.js';

const ISSUER = 'CollabDocs';

/** Génère un secret TOTP (pas encore activé) et l'URL otpauth pour le QR code. */
export async function setupTwoFactor(userId: string): Promise<TwoFactorSetupResponse> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw notFound('Utilisateur introuvable');
  }
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(user.email, ISSUER, secret);

  // Stocké mais pas encore actif : l'activation exige une vérification réussie.
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret, twoFactorEnabled: false },
  });

  return { otpauthUrl, secret };
}

/** URL data: du QR code (utilitaire optionnel pour le front). */
export async function qrCodeDataUrl(otpauthUrl: string): Promise<string> {
  return qrcode.toDataURL(otpauthUrl);
}

/** Vérifie un premier code et active la 2FA. */
export async function enableTwoFactor(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) {
    throw badRequest('Aucune configuration 2FA en attente. Lancez d\'abord la configuration.');
  }
  const valid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
  if (!valid) {
    throw unauthorized('Code invalide');
  }
  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
}

/** Désactive la 2FA après vérification d'un code valide. */
export async function disableTwoFactor(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret || !user.twoFactorEnabled) {
    throw badRequest('La 2FA n\'est pas activée');
  }
  const valid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
  if (!valid) {
    throw unauthorized('Code invalide');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: null, twoFactorEnabled: false },
  });
}

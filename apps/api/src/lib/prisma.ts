import { PrismaClient } from '@prisma/client';

// Instance unique partagée par toute l'application.
export const prisma = new PrismaClient();

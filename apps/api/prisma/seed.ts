// Crée l'administrateur initial.
import { PrismaClient } from '@prisma/client';
// @ts-ignore
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@collab.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!';
  const displayName = process.env.SEED_ADMIN_NAME ?? 'Administrateur';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.info(`ℹ️  Admin déjà présent : ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, passwordHash, displayName, role: 'ADMIN' },
  });
  console.info(`✅ Administrateur créé : ${email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('❌ Échec du seed :', err);
    await prisma.$disconnect();
    process.exit(1);
  });

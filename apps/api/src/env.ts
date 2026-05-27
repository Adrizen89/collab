import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Charge le `.env` à la racine du monorepo (3 niveaux au-dessus de src/ ou dist/).
const rootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');
loadEnv({ path: rootEnv });

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  INTERNAL_API_SECRET: z.string().min(8),
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@collab.local'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin1234!'),
  SEED_ADMIN_NAME: z.string().default('Administrateur'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Échec au démarrage = on arrête net, pas de serveur à moitié configuré.
  console.error('❌ Variables d\'environnement invalides :', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

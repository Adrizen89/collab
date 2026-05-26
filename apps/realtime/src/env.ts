import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

const rootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');
loadEnv({ path: rootEnv });

const envSchema = z.object({
  JWT_ACCESS_SECRET: z.string().min(16),
  INTERNAL_API_SECRET: z.string().min(8),
  REALTIME_PORT: z.coerce.number().default(4001),
  API_INTERNAL_URL: z.string().url().default('http://localhost:4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variables d\'environnement invalides :', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Intervalle de persistance de l'état Yjs vers l'API (ms).
export const PERSIST_INTERVAL_MS = 5000;

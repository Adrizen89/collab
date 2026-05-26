import { env } from './env.js';
import { logger } from './logger.js';

/** Charge l'état Yjs initial d'un document depuis l'API. Renvoie null si vide/indisponible. */
export async function loadState(documentId: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`${env.API_INTERNAL_URL}/internal/documents/${documentId}/state`, {
      headers: { 'x-internal-secret': env.INTERNAL_API_SECRET },
    });
    if (!res.ok) {
      logger.warn(`Chargement état ${documentId} : statut ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { yjsState: string | null };
    if (!data.yjsState) {
      return null;
    }
    return new Uint8Array(Buffer.from(data.yjsState, 'base64'));
  } catch (err) {
    logger.error(`Chargement état ${documentId} impossible`, err);
    return null;
  }
}

/**
 * Persiste l'état Yjs vers l'API. Lève en cas d'échec pour que l'appelant
 * conserve l'indicateur "dirty" et réessaie au prochain cycle.
 */
export async function saveState(
  documentId: string,
  state: Uint8Array,
  lastModifiedById: string | null,
): Promise<void> {
  const res = await fetch(`${env.API_INTERNAL_URL}/internal/documents/${documentId}/state`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': env.INTERNAL_API_SECRET,
    },
    body: JSON.stringify({
      state: Buffer.from(state).toString('base64'),
      lastModifiedById,
    }),
  });
  if (!res.ok) {
    throw new Error(`Persistance ${documentId} échouée : statut ${res.status}`);
  }
}

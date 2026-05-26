import type {
  CreateDocumentRequest,
  CreateUserRequest,
  DocumentContent,
  DocumentInviteView,
  DocumentMeta,
  DocumentNode,
  LoginRequest,
  LoginResponse,
  PublicUser,
  RefreshResponse,
  TwoFactorRequiredResponse,
  TwoFactorSetupResponse,
} from '@collab/shared';
import { config } from './config';

// ─────────────────────────────────────────────────────────────
// Gestion du token : access token gardé EN MÉMOIRE (pas localStorage,
// anti-XSS). Le refresh token vit dans un cookie httpOnly géré par l'API.
// ─────────────────────────────────────────────────────────────

let accessToken: string | null = null;
export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}

let onAuthFailure: (() => void) | null = null;
export function setOnAuthFailure(fn: (() => void) | null): void {
  onAuthFailure = fn;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// Rafraîchissement single-flight : un seul appel /auth/refresh à la fois.
let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${config.apiUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      return false;
    }
    const data = (await res.json()) as RefreshResponse;
    accessToken = data.accessToken;
    return true;
  } catch {
    return false;
  }
}

function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (accessToken) {
      headers.authorization = `Bearer ${accessToken}`;
    }
    return fetch(`${config.apiUrl}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      credentials: 'include',
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  };

  let res = await send();

  // Access token expiré : on tente un refresh transparent, puis on rejoue.
  if (res.status === 401 && accessToken !== null) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await send();
    }
  }

  if (res.status === 401) {
    onAuthFailure?.();
  }

  if (!res.ok) {
    let message = 'Une erreur est survenue';
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch {
      /* corps non JSON */
    }
    throw new ApiClientError(message, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

export async function login(
  body: LoginRequest,
): Promise<LoginResponse | TwoFactorRequiredResponse> {
  const res = await fetch(`${config.apiUrl}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as
    | LoginResponse
    | TwoFactorRequiredResponse
    | { error?: string };
  if (!res.ok) {
    throw new ApiClientError(
      'error' in data && data.error ? data.error : 'Connexion impossible',
      res.status,
    );
  }
  return data as LoginResponse | TwoFactorRequiredResponse;
}

/** Au chargement de l'app : tente de restaurer la session via le cookie refresh. */
export async function bootstrapSession(): Promise<PublicUser | null> {
  const ok = await tryRefresh();
  if (!ok) {
    return null;
  }
  return request<PublicUser>('/me');
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${config.apiUrl}/auth/logout`, { method: 'POST', credentials: 'include' });
  } finally {
    accessToken = null;
  }
}

export const api = {
  // Profil
  me: () => request<PublicUser>('/me'),
  updateProfile: (body: { displayName?: string; currentPassword?: string; newPassword?: string }) =>
    request<PublicUser>('/me', { method: 'PATCH', body }),
  setup2fa: () =>
    request<TwoFactorSetupResponse & { qrDataUrl: string }>('/me/2fa/setup', { method: 'POST' }),
  enable2fa: (code: string) => request<void>('/me/2fa/enable', { method: 'POST', body: { code } }),
  disable2fa: (code: string) =>
    request<void>('/me/2fa/disable', { method: 'POST', body: { code } }),

  // Documents
  tree: () => request<DocumentNode[]>('/documents/tree'),
  createDocument: (body: CreateDocumentRequest) =>
    request<DocumentMeta>('/documents', { method: 'POST', body }),
  renameDocument: (id: string, name: string) =>
    request<DocumentMeta>(`/documents/${id}`, { method: 'PATCH', body: { name } }),
  deleteDocument: (id: string) => request<void>(`/documents/${id}`, { method: 'DELETE' }),
  documentContent: (id: string) => request<DocumentContent>(`/documents/${id}/content`),
  listInvites: (id: string) => request<DocumentInviteView[]>(`/documents/${id}/invites`),
  invite: (id: string, email: string) =>
    request<DocumentInviteView>(`/documents/${id}/invites`, { method: 'POST', body: { email } }),
  removeInvite: (id: string, inviteId: string) =>
    request<void>(`/documents/${id}/invites/${inviteId}`, { method: 'DELETE' }),

  // Administration
  adminUsers: () => request<PublicUser[]>('/admin/users'),
  adminCreateUser: (body: CreateUserRequest) =>
    request<PublicUser>('/admin/users', { method: 'POST', body }),
  adminSetBlocked: (id: string, isBlocked: boolean) =>
    request<PublicUser>(`/admin/users/${id}/blocked`, { method: 'PATCH', body: { isBlocked } }),
};

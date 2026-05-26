/**
 * Contrat de types partagé entre l'API, le serveur Realtime et le front.
 * SOURCE DE VÉRITÉ unique des structures échangées (cf. CLAUDE.md §7).
 * Toute évolution d'un type ici doit être annoncée à l'équipe.
 */

// ─────────────────────────────────────────────────────────────
// Énumérations (alignées sur le schéma Prisma)
// ─────────────────────────────────────────────────────────────

export type UserRole = 'MEMBER' | 'ADMIN';
export type DocumentType = 'TEXT' | 'FILE' | 'FOLDER';

// ─────────────────────────────────────────────────────────────
// Entités (vues "publiques", jamais le passwordHash ni le secret 2FA)
// ─────────────────────────────────────────────────────────────

/** Utilisateur tel qu'exposé au client. Ne contient JAMAIS de secret. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isBlocked: boolean;
  twoFactorEnabled: boolean;
  createdAt: string; // ISO 8601
}

/** Document ou dossier dans l'arborescence. */
export interface DocumentMeta {
  id: string;
  name: string;
  type: DocumentType;
  parentId: string | null;
  /** Pour les FILE non textuels uniquement. */
  fileUrl: string | null;
  lastModifiedAt: string; // ISO 8601
  lastModifiedBy: DocumentAuthor | null;
  ownerId: string;
}

/** Auteur léger d'une dernière modification (affiché dans l'arborescence). */
export interface DocumentAuthor {
  id: string;
  displayName: string;
}

/** Nœud d'arborescence : un document avec ses enfants (dossiers). */
export interface DocumentNode extends DocumentMeta {
  children: DocumentNode[];
}

/** Contenu complet d'un document texte (état Yjs sérialisé en base64). */
export interface DocumentContent extends DocumentMeta {
  /** État Yjs encodé base64, ou null si le document est encore vide. */
  yjsState: string | null;
}

export interface DocumentInviteView {
  id: string;
  documentId: string;
  user: PublicUser;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// DTO — Authentification
// ─────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
  /** Code TOTP à 6 chiffres si la 2FA est activée pour ce compte. */
  twoFactorCode?: string;
}

/** Paire de tokens — usage interne serveur. Le refresh token transite par un cookie httpOnly. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Réponse exposée au client : l'access token (gardé en mémoire), jamais le refresh. */
export interface AccessTokenResponse {
  accessToken: string;
}

export interface LoginResponse extends AccessTokenResponse {
  user: PublicUser;
}

/** Renvoyé quand l'identifiant est bon mais qu'un code 2FA est requis. */
export interface TwoFactorRequiredResponse {
  twoFactorRequired: true;
}

export type RefreshResponse = AccessTokenResponse;

/** Payload encodé dans l'access token JWT. */
export interface AccessTokenPayload {
  sub: string; // user id
  role: UserRole;
  email: string;
}

// ─────────────────────────────────────────────────────────────
// DTO — Documents
// ─────────────────────────────────────────────────────────────

export interface CreateDocumentRequest {
  name: string;
  type: DocumentType;
  parentId?: string | null;
}

export interface RenameDocumentRequest {
  name: string;
}

export interface InviteUserRequest {
  /** Email de la personne à inviter sur le document. */
  email: string;
}

// ─────────────────────────────────────────────────────────────
// DTO — Administration
// ─────────────────────────────────────────────────────────────

export interface CreateUserRequest {
  email: string;
  password: string;
  displayName: string;
  role?: UserRole;
}

export interface SetBlockedRequest {
  isBlocked: boolean;
}

// ─────────────────────────────────────────────────────────────
// DTO — 2FA (secondaire)
// ─────────────────────────────────────────────────────────────

export interface TwoFactorSetupResponse {
  /** URL otpauth:// à afficher en QR code. */
  otpauthUrl: string;
  /** Secret base32 (affiché en secours si le QR ne passe pas). */
  secret: string;
}

export interface TwoFactorVerifyRequest {
  code: string;
}

// ─────────────────────────────────────────────────────────────
// Réponses d'erreur — forme unique (cf. CLAUDE.md §7)
// ─────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  /** Détails de validation éventuels, champ -> message. */
  details?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────
// Protocole de signalisation WebRTC (audio — secondaire)
// ─────────────────────────────────────────────────────────────

export type SignalMessage =
  | { type: 'call-offer'; documentId: string; sdp: string; from: string }
  | { type: 'call-answer'; documentId: string; sdp: string; from: string }
  | { type: 'ice-candidate'; documentId: string; candidate: string; from: string }
  | { type: 'call-end'; documentId: string; from: string };

// ─────────────────────────────────────────────────────────────
// Constantes partagées
// ─────────────────────────────────────────────────────────────

export const PASSWORD_MIN_LENGTH = 8;
export const DOCUMENT_NAME_MAX_LENGTH = 120;

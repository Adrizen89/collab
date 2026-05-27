import type { AccessTokenPayload } from '@collab/shared';

// Augmente Express.Request pour transporter l'identité authentifiée.
declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
    }
  }
}

export {};

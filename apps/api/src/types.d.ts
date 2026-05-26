import type { AccessTokenPayload } from '@collab/shared';

// Augmente Express.Request pour transporter l'identité authentifiée.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
    }
  }
}

export {};

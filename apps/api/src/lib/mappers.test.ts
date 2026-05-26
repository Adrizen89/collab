import { describe, it, expect } from 'vitest';
import type { User } from '@prisma/client';
import { toPublicUser } from './mappers.js';

describe('toPublicUser', () => {
  it('expose les champs publics sans jamais divulguer de secret', () => {
    const user = {
      id: 'u1',
      email: 'alice@collab.local',
      passwordHash: '$2a$12$SECRET_HASH_VALUE',
      displayName: 'Alice',
      role: 'MEMBER',
      isBlocked: false,
      twoFactorSecret: 'TOTP_SECRET_BASE32',
      twoFactorEnabled: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    } as unknown as User;

    const pub = toPublicUser(user);

    expect(pub).toEqual({
      id: 'u1',
      email: 'alice@collab.local',
      displayName: 'Alice',
      role: 'MEMBER',
      isBlocked: false,
      twoFactorEnabled: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    // Aucun secret ne doit fuiter dans la vue publique.
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toContain('SECRET_HASH_VALUE');
    expect(serialized).not.toContain('TOTP_SECRET_BASE32');
  });
});

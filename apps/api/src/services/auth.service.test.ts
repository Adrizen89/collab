import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@prisma/client';

// Prisma est mocké : ces tests sont unitaires (aucune base requise).
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma.js';
import { login, hashPassword } from './auth.service.js';

function makeUser(overrides: Partial<User>): User {
  return {
    id: 'u1',
    email: 'alice@collab.local',
    passwordHash: '',
    displayName: 'Alice',
    role: 'MEMBER',
    isBlocked: false,
    twoFactorSecret: null,
    twoFactorEnabled: false,
    createdAt: new Date(),
    ...overrides,
  } as User;
}

describe('login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hache et vérifie un mot de passe (bcrypt)', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).not.toBe('correct horse battery');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser({ passwordHash: hash }));
    vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as never);
    const result = await login('alice@collab.local', 'correct horse battery');
    expect(result.kind).toBe('ok');
  });

  it('refuse un mot de passe incorrect', async () => {
    const hash = await hashPassword('correct horse battery');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser({ passwordHash: hash }));
    await expect(login('alice@collab.local', 'mauvais')).rejects.toThrow();
  });

  it('refuse un compte bloqué même avec le bon mot de passe', async () => {
    const hash = await hashPassword('correct horse battery');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      makeUser({ passwordHash: hash, isBlocked: true }),
    );
    await expect(login('alice@collab.local', 'correct horse battery')).rejects.toThrow(/bloqué/i);
  });

  it('refuse un email inconnu sans révéler son inexistence', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    await expect(login('inconnu@collab.local', 'peu importe')).rejects.toThrow(/invalides/i);
  });
});

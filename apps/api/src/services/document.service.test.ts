import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    document: { findUnique: vi.fn(), update: vi.fn() },
    documentInvite: { findUnique: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma.js';
import { userCanAccess, saveYjsState } from './document.service.js';

describe('userCanAccess (autorisation par document)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('autorise le propriétaire', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ ownerId: 'u1' } as never);
    expect(await userCanAccess('u1', 'd1')).toBe(true);
  });

  it('refuse un utilisateur ni propriétaire ni invité', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ ownerId: 'owner' } as never);
    vi.mocked(prisma.documentInvite.findUnique).mockResolvedValue(null);
    expect(await userCanAccess('intrus', 'd1')).toBe(false);
  });

  it('autorise un invité', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ ownerId: 'owner' } as never);
    vi.mocked(prisma.documentInvite.findUnique).mockResolvedValue({ id: 'inv1' } as never);
    expect(await userCanAccess('invite', 'd1')).toBe(true);
  });

  it('refuse l’accès à un document inexistant', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);
    expect(await userCanAccess('u1', 'fantome')).toBe(false);
  });
});

describe('saveYjsState (persistance)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('décode l’état base64 et persiste les octets + l’auteur', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: 'd1' } as never);
    vi.mocked(prisma.document.update).mockResolvedValue({} as never);

    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const base64 = Buffer.from(bytes).toString('base64');

    await saveYjsState('d1', base64, 'u1');

    const updateArg = vi.mocked(prisma.document.update).mock.calls[0][0];
    const stored = updateArg.data.content as Buffer;
    expect(Buffer.from(stored).equals(Buffer.from(bytes))).toBe(true);
    expect(updateArg.data.lastModifiedById).toBe('u1');
  });
});

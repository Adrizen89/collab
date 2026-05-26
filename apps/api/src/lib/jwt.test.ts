import { describe, it, expect } from 'vitest';
import { durationToMs, signAccessToken, verifyAccessToken } from './jwt.js';

describe('durationToMs', () => {
  it('convertit les durées en millisecondes', () => {
    expect(durationToMs('30s')).toBe(30_000);
    expect(durationToMs('15m')).toBe(900_000);
    expect(durationToMs('7d')).toBe(604_800_000);
  });

  it('rejette une durée invalide', () => {
    expect(() => durationToMs('abc')).toThrow();
  });
});

describe('access token JWT', () => {
  it('signe puis vérifie le même payload (roundtrip)', () => {
    const token = signAccessToken({ sub: 'u1', role: 'ADMIN', email: 'admin@collab.local' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('u1');
    expect(payload.role).toBe('ADMIN');
    expect(payload.email).toBe('admin@collab.local');
  });

  it('rejette un token falsifié', () => {
    expect(() => verifyAccessToken('pas.un.jwt')).toThrow();
  });
});

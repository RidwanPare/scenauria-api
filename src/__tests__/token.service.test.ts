import {
  signAccessToken,
  verifyAccessToken,
  generateRawRefreshToken,
  hashToken,
  generateResetToken,
  verifyResetToken,
} from '../services/token.service';

describe('token.service', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const orgId = '660e8400-e29b-41d4-a716-446655440000';
  const role = 'owner';

  describe('signAccessToken', () => {
    it('retourne un string non vide', () => {
      const token = signAccessToken(userId, orgId, role);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('verifyAccessToken', () => {
    it('retourne le payload pour un token valide', () => {
      const token = signAccessToken(userId, orgId, role);
      const payload = verifyAccessToken(token);
      expect(payload.userId).toBe(userId);
      expect(payload.orgId).toBe(orgId);
      expect(payload.role).toBe(role);
    });

    it('lève une erreur pour un token invalide', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });
  });

  describe('generateRawRefreshToken', () => {
    it('retourne une string hex de 128 chars', () => {
      const token = generateRawRefreshToken();
      expect(typeof token).toBe('string');
      expect(token).toMatch(/^[a-f0-9]{128}$/);
    });

    it('génère des tokens uniques', () => {
      const t1 = generateRawRefreshToken();
      const t2 = generateRawRefreshToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('hashToken', () => {
    it('retourne un hash sha256 hex de 64 chars', () => {
      const hash = hashToken('sometoken');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('est déterministe', () => {
      expect(hashToken('abc')).toBe(hashToken('abc'));
    });

    it('est différent pour des inputs différents', () => {
      expect(hashToken('abc')).not.toBe(hashToken('def'));
    });
  });

  describe('generateResetToken + verifyResetToken', () => {
    it('verifyResetToken retourne le userId pour un token valide', () => {
      const token = generateResetToken(userId);
      const result = verifyResetToken(token);
      expect(result.userId).toBe(userId);
    });

    it('verifyResetToken lève une erreur pour un token de type wrong', () => {
      // An access token is NOT a reset token
      const accessToken = signAccessToken(userId, orgId, role);
      expect(() => verifyResetToken(accessToken)).toThrow();
    });
  });
});

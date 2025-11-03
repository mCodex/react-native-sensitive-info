import { getErrorMessage, isNotFoundError } from '../internal/errors';

describe('internal/errors', () => {
  describe('isNotFoundError', () => {
    it('detects tagged Error instances', () => {
      expect(isNotFoundError(new Error('Failure [E_NOT_FOUND] happened'))).toBe(
        true
      );
    });

    it('detects tagged strings', () => {
      expect(isNotFoundError('Oops [E_NOT_FOUND] missing')).toBe(true);
    });

    it('returns false for unrelated payloads', () => {
      expect(isNotFoundError(new Error('No tag here'))).toBe(false);
      expect(isNotFoundError('All good')).toBe(false);
      expect(isNotFoundError({})).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('returns messages for Error instances', () => {
      expect(getErrorMessage(new Error('native failure'))).toBe(
        'native failure'
      );
    });

    it('returns the string payload as-is', () => {
      expect(getErrorMessage('[E_NATIVE] fatal')).toBe('[E_NATIVE] fatal');
    });

    it('falls back to a generic message', () => {
      expect(getErrorMessage(undefined)).toBe('An unknown error occurred');
    });
  });
});

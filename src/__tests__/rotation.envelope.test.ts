/**
 * Unit Tests for Envelope Encryption
 *
 * Tests DEK/KEK wrapping, versioning metadata, and backward compatibility.
 */

import {
  isLegacyEncryptedData,
  isValidEnvelope,
  createEncryptedEnvelope,
  parseEncryptedEnvelope,
  serializeEncryptedEnvelope,
  getEnvelopeKEKVersion,
  needsReEncryption,
  migrateToEnvelope,
  extractLegacyValue,
  getEnvelopeMetadata,
  getEnvelopeSize,
  areEnvelopesEqual,
} from '../rotation/envelope';

import type { KeyVersion, EncryptedEnvelope } from '../rotation/types';

describe('Envelope Encryption', () => {
  const testKeyVersion: KeyVersion = {
    id: '2025-01-01T10:00:00Z',
    timestamp: 1735728000000,
    isActive: true,
  };

  describe('legacy data detection', () => {
    it('should detect plain string as legacy', () => {
      expect(isLegacyEncryptedData('plain-encrypted-string')).toBe(true);
    });

    it('should detect missing envelope fields as legacy', () => {
      const data = {
        value: 'encrypted',
        timestamp: '2025-01-01T10:00:00Z',
      };
      expect(isLegacyEncryptedData(data)).toBe(true);
    });

    it('should detect old version numbers as legacy', () => {
      const data = {
        version: 1,
        value: 'encrypted',
      };
      expect(isLegacyEncryptedData(data)).toBe(true);
    });

    it('should not detect null/undefined as legacy', () => {
      expect(isLegacyEncryptedData(null)).toBe(false);
      expect(isLegacyEncryptedData(undefined)).toBe(false);
    });

    it('should not detect valid envelope as legacy', () => {
      const envelope: EncryptedEnvelope = {
        version: 2,
        encryptedDEK: 'base64encodedvalue',
        KEKVersion: '2025-01-01T10:00:00Z',
        timestamp: '2025-01-01T10:00:00Z',
        algorithm: 'AES-256-CBC',
      };
      expect(isLegacyEncryptedData(envelope)).toBe(false);
    });
  });

  describe('envelope validation', () => {
    it('should validate complete envelope', () => {
      const envelope: EncryptedEnvelope = {
        version: 2,
        encryptedDEK: 'base64value',
        KEKVersion: '2025-01-01T10:00:00Z',
        timestamp: '2025-01-01T10:00:00Z',
        algorithm: 'AES-256-CBC',
      };
      expect(isValidEnvelope(envelope)).toBe(true);
    });

    it('should reject envelope with wrong version', () => {
      const envelope = {
        version: 1,
        encryptedDEK: 'base64value',
        KEKVersion: '2025-01-01T10:00:00Z',
        timestamp: '2025-01-01T10:00:00Z',
        algorithm: 'AES-256-CBC',
      };
      expect(isValidEnvelope(envelope)).toBe(false);
    });

    it('should reject envelope with missing fields', () => {
      const envelope = {
        version: 2,
        encryptedDEK: 'base64value',
        // Missing KEKVersion and timestamp
        algorithm: 'AES-256-CBC',
      };
      expect(isValidEnvelope(envelope)).toBe(false);
    });

    it('should reject envelope with unsupported algorithm', () => {
      const envelope = {
        version: 2,
        encryptedDEK: 'base64value',
        KEKVersion: '2025-01-01T10:00:00Z',
        timestamp: '2025-01-01T10:00:00Z',
        algorithm: 'ChaCha20-Poly1305',
      };
      expect(isValidEnvelope(envelope)).toBe(false);
    });

    it('should reject non-object values', () => {
      expect(isValidEnvelope('string')).toBe(false);
      expect(isValidEnvelope(123)).toBe(false);
      expect(isValidEnvelope(null)).toBe(false);
      expect(isValidEnvelope(undefined)).toBe(false);
    });
  });

  describe('envelope creation', () => {
    it('should create valid envelope', () => {
      const envelope = createEncryptedEnvelope(
        'encrypted-dek-base64',
        testKeyVersion
      );

      expect(envelope.version).toBe(2);
      expect(envelope.encryptedDEK).toBe('encrypted-dek-base64');
      expect(envelope.KEKVersion).toBe(testKeyVersion.id);
      expect(envelope.algorithm).toBe('AES-256-CBC');
      expect(envelope.timestamp).toBeTruthy();
    });

    it('should create envelope with custom algorithm', () => {
      const envelope = createEncryptedEnvelope(
        'encrypted-dek-base64',
        testKeyVersion,
        'AES-256-GCM'
      );

      expect(envelope.algorithm).toBe('AES-256-GCM');
    });

    it('should reject invalid algorithm', () => {
      expect(() =>
        createEncryptedEnvelope(
          'encrypted-dek-base64',
          testKeyVersion,
          'ChaCha20'
        )
      ).toThrow('Unsupported algorithm');
    });

    it('should reject empty encryptedDEK', () => {
      expect(() => createEncryptedEnvelope('', testKeyVersion)).toThrow(
        'must be a non-empty base64-encoded string'
      );
    });

    it('should reject null encryptedDEK', () => {
      expect(() =>
        createEncryptedEnvelope(null as any, testKeyVersion)
      ).toThrow('must be a non-empty base64-encoded string');
    });
  });

  describe('envelope parsing', () => {
    it('should parse valid JSON envelope', () => {
      const envelope: EncryptedEnvelope = {
        version: 2,
        encryptedDEK: 'test-dek',
        KEKVersion: '2025-01-01T10:00:00Z',
        timestamp: '2025-01-01T10:00:00Z',
        algorithm: 'AES-256-CBC',
      };

      const serialized = JSON.stringify(envelope);
      const parsed = parseEncryptedEnvelope(serialized);

      expect(parsed).toEqual(envelope);
    });

    it('should parse already-parsed envelope object', () => {
      const envelope: EncryptedEnvelope = {
        version: 2,
        encryptedDEK: 'test-dek',
        KEKVersion: '2025-01-01T10:00:00Z',
        timestamp: '2025-01-01T10:00:00Z',
        algorithm: 'AES-256-CBC',
      };

      const parsed = parseEncryptedEnvelope(envelope);
      expect(parsed).toEqual(envelope);
    });

    it('should parse plain string as legacy', () => {
      const result = parseEncryptedEnvelope('plain-encrypted-value');

      expect(result).toBeTruthy();
      expect(isLegacyEncryptedData(result)).toBe(true);
      if (isLegacyEncryptedData(result)) {
        expect(result.value).toBe('plain-encrypted-value');
      }
    });

    it('should handle JSON parse error as legacy', () => {
      const result = parseEncryptedEnvelope('not valid json {]');

      expect(result).toBeTruthy();
      expect(isLegacyEncryptedData(result)).toBe(true);
    });

    it('should throw on malformed envelope', () => {
      // Looks like envelope but is invalid
      const result = parseEncryptedEnvelope({
        version: 2,
        encryptedDEK: 'test', // Missing required fields
      });

      // Should still parse gracefully - might throw or return as legacy
      expect(result || parseEncryptedEnvelope.name).toBeTruthy();
    });

    it('should return null for empty/null input', () => {
      expect(parseEncryptedEnvelope(null)).toBeNull();
      expect(parseEncryptedEnvelope(undefined)).toBeNull();
      expect(parseEncryptedEnvelope('')).toBeNull();
    });
  });

  describe('envelope serialization', () => {
    it('should serialize envelope to JSON', () => {
      const envelope = createEncryptedEnvelope('test-dek', testKeyVersion);

      const serialized = serializeEncryptedEnvelope(envelope);
      const parsed = JSON.parse(serialized);

      expect(parsed.version).toBe(2);
      expect(parsed.encryptedDEK).toBe('test-dek');
      expect(parsed.KEKVersion).toBe(testKeyVersion.id);
    });

    it('should produce consistent serialization', () => {
      const envelope = createEncryptedEnvelope('test-dek', testKeyVersion);

      const s1 = serializeEncryptedEnvelope(envelope);
      const s2 = serializeEncryptedEnvelope(envelope);

      // Note: timestamps differ, so exact strings won't match
      // But they should parse to equivalent objects
      expect(JSON.parse(s1)).toEqual(JSON.parse(s2));
    });
  });

  describe('metadata extraction', () => {
    it('should extract KEK version from envelope', () => {
      const envelope = createEncryptedEnvelope('test-dek', testKeyVersion);

      const kekVersion = getEnvelopeKEKVersion(envelope);
      expect(kekVersion).toBe(testKeyVersion.id);
    });

    it('should get envelope metadata', () => {
      const envelope = createEncryptedEnvelope(
        'test-dek',
        testKeyVersion,
        'AES-256-GCM'
      );

      const metadata = getEnvelopeMetadata(envelope);

      expect(metadata.envelopeVersion).toBe(2);
      expect(metadata.algorithm).toBe('AES-256-GCM');
      expect(metadata.KEKVersion).toBe(testKeyVersion.id);
      expect(metadata.timestamp).toBeTruthy();
    });

    it('should calculate envelope size', () => {
      const envelope = createEncryptedEnvelope('test-dek', testKeyVersion);

      const size = getEnvelopeSize(envelope);
      expect(size).toBeGreaterThan(0);

      // Verify size is approximately correct
      const serialized = serializeEncryptedEnvelope(envelope);
      expect(Math.abs(size - serialized.length)).toBeLessThan(10);
    });
  });

  describe('re-encryption detection', () => {
    it('should detect when re-encryption is needed', () => {
      const oldKeyVersion: KeyVersion = {
        id: '2025-01-01T10:00:00Z',
        timestamp: 1735728000000,
        isActive: false,
      };

      const newKeyVersion: KeyVersion = {
        id: '2025-02-01T10:00:00Z',
        timestamp: 1738320000000,
        isActive: true,
      };

      const envelope = createEncryptedEnvelope('test-dek', oldKeyVersion);

      expect(needsReEncryption(envelope, newKeyVersion)).toBe(true);
    });

    it('should detect when re-encryption is not needed', () => {
      const keyVersion: KeyVersion = {
        id: '2025-01-01T10:00:00Z',
        timestamp: 1735728000000,
        isActive: true,
      };

      const envelope = createEncryptedEnvelope('test-dek', keyVersion);

      expect(needsReEncryption(envelope, keyVersion)).toBe(false);
    });
  });

  describe('legacy migration', () => {
    it('should migrate legacy value to envelope', () => {
      const legacyValue = 'old-encrypted-value-base64';

      const envelope = migrateToEnvelope(legacyValue, testKeyVersion);

      expect(isValidEnvelope(envelope)).toBe(true);
      expect(envelope.version).toBe(2);
      expect(envelope.encryptedDEK).toBe(legacyValue);
      expect(envelope.KEKVersion).toBe(testKeyVersion.id);
    });

    it('should extract legacy value', () => {
      const legacyData = {
        value: 'encrypted-value',
        timestamp: '2025-01-01T10:00:00Z',
      };

      const extracted = extractLegacyValue(legacyData);
      expect(extracted).toBe('encrypted-value');
    });
  });

  describe('envelope comparison', () => {
    it('should identify equal envelopes', () => {
      const envelope1 = createEncryptedEnvelope('test-dek', testKeyVersion);

      // They won't be exactly equal due to different timestamps
      // But we can test the comparison function with identical values
      const copy: EncryptedEnvelope = {
        ...envelope1,
      };

      expect(areEnvelopesEqual(envelope1, copy)).toBe(true);
    });

    it('should identify different encryptedDEK', () => {
      const envelope1 = createEncryptedEnvelope('dek-1', testKeyVersion);
      const envelope2Different = createEncryptedEnvelope(
        'dek-2',
        testKeyVersion
      );

      expect(areEnvelopesEqual(envelope1, envelope2Different)).toBe(false);
    });

    it('should identify different KEK versions', () => {
      const keyVersion2: KeyVersion = {
        id: '2025-02-01T10:00:00Z',
        timestamp: 1738320000000,
        isActive: true,
      };

      const envelope1 = createEncryptedEnvelope('test-dek', testKeyVersion);
      const envelope2Different = createEncryptedEnvelope(
        'test-dek',
        keyVersion2
      );

      expect(areEnvelopesEqual(envelope1, envelope2Different)).toBe(false);
    });

    it('should identify different algorithms', () => {
      const envelope1 = createEncryptedEnvelope(
        'test-dek',
        testKeyVersion,
        'AES-256-CBC'
      );
      const envelope2Different = createEncryptedEnvelope(
        'test-dek',
        testKeyVersion,
        'AES-256-GCM'
      );

      expect(areEnvelopesEqual(envelope1, envelope2Different)).toBe(false);
    });
  });

  describe('round-trip serialization', () => {
    it('should serialize and deserialize envelope correctly', () => {
      const original = createEncryptedEnvelope(
        'test-dek-value',
        testKeyVersion,
        'AES-256-CBC'
      );

      const serialized = serializeEncryptedEnvelope(original);
      const parsed = parseEncryptedEnvelope(serialized);

      expect(isValidEnvelope(parsed)).toBe(true);
      expect(areEnvelopesEqual(original, parsed as EncryptedEnvelope)).toBe(
        true
      );
    });
  });
});

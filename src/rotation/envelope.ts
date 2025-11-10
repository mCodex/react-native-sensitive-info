/**
 * Envelope Encryption Implementation
 *
 * Implements the Data Encryption Key (DEK) / Key Encryption Key (KEK) pattern:
 * - DEKs directly encrypt user data (never stored directly, always wrapped)
 * - KEKs wrap/unwrap DEKs and are the primary rotation target
 * - Enables efficient rotation without re-encrypting all user data
 */

import type {
  EncryptedEnvelope,
  KeyVersion,
  LegacyEncryptedData,
} from './types';

const ENVELOPE_VERSION = 2;
const SUPPORTED_ALGORITHMS = ['AES-256-CBC', 'AES-256-GCM'];

/**
 * Determines if a value is a legacy (pre-versioned) encrypted data format.
 *
 * Legacy data is either:
 * - A plain string (raw encrypted value from before versioning)
 * - Unable to be parsed as an envelope
 */
export function isLegacyEncryptedData(
  data: unknown
): data is LegacyEncryptedData {
  if (typeof data === 'string') {
    return true;
  }

  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // If it has version field and it's not the current version, still check if it's old format
  if (typeof obj.version === 'number' && obj.version < ENVELOPE_VERSION) {
    // Could be an older envelope or legacy format
    // For now, treat older envelopes as requiring migration
    return !isValidEnvelope(data);
  }

  // If it doesn't have the required envelope fields, it's likely legacy
  return (
    !('encryptedDEK' in obj) ||
    !('KEKVersion' in obj) ||
    !('timestamp' in obj) ||
    !('algorithm' in obj)
  );
}

/**
 * Validates that data conforms to the current EncryptedEnvelope format.
 */
export function isValidEnvelope(data: unknown): data is EncryptedEnvelope {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const envelope = data as Record<string, unknown>;

  return (
    typeof envelope.version === 'number' &&
    envelope.version === ENVELOPE_VERSION &&
    typeof envelope.encryptedDEK === 'string' &&
    typeof envelope.KEKVersion === 'string' &&
    typeof envelope.timestamp === 'string' &&
    typeof envelope.algorithm === 'string' &&
    SUPPORTED_ALGORITHMS.includes(envelope.algorithm as string)
  );
}

/**
 * Creates a new encrypted envelope wrapping a DEK with metadata.
 *
 * @param encryptedDEK Base64-encoded encrypted data encryption key
 * @param currentKeyVersion The KEK version used to encrypt the DEK
 * @param algorithm Encryption algorithm identifier
 * @returns Complete envelope with versioning metadata
 */
export function createEncryptedEnvelope(
  encryptedDEK: string,
  currentKeyVersion: KeyVersion,
  algorithm: string = 'AES-256-CBC'
): EncryptedEnvelope {
  if (!SUPPORTED_ALGORITHMS.includes(algorithm)) {
    throw new Error(
      `Unsupported algorithm: ${algorithm}. Supported: ${SUPPORTED_ALGORITHMS.join(', ')}`
    );
  }

  if (!encryptedDEK || typeof encryptedDEK !== 'string') {
    throw new Error('encryptedDEK must be a non-empty base64-encoded string');
  }

  const now = new Date().toISOString();

  return {
    version: ENVELOPE_VERSION,
    encryptedDEK,
    KEKVersion: currentKeyVersion.id,
    timestamp: now,
    algorithm,
  };
}

/**
 * Parses an envelope from JSON, with fallback to legacy format detection.
 * Handles graceful degradation if envelope is malformed.
 *
 * @param data Stringified or parsed envelope/legacy data
 * @returns Parsed envelope or null if data cannot be interpreted
 * @throws Error if data appears to be envelope format but is invalid
 */
export function parseEncryptedEnvelope(
  data: string | object | null | undefined
): EncryptedEnvelope | LegacyEncryptedData | null {
  if (!data) {
    return null;
  }

  let parsed: unknown;

  // If it's a string, try to parse as JSON first
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      // If JSON parsing fails, treat entire string as legacy encrypted value
      return { value: data };
    }
  } else {
    parsed = data;
  }

  // Check if it's a valid current-version envelope
  if (isValidEnvelope(parsed)) {
    return parsed;
  }

  // Check if it's legacy format
  if (isLegacyEncryptedData(parsed)) {
    return typeof parsed === 'string'
      ? { value: parsed }
      : (parsed as LegacyEncryptedData);
  }

  // If it looks like it was meant to be an envelope but is invalid, throw
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    ('version' in parsed || 'encryptedDEK' in parsed)
  ) {
    throw new Error(
      `Invalid envelope format. Expected version ${ENVELOPE_VERSION} with complete metadata.`
    );
  }

  // Treat as legacy
  return typeof parsed === 'string'
    ? { value: parsed }
    : (parsed as LegacyEncryptedData);
}

/**
 * Serializes an envelope to JSON string.
 */
export function serializeEncryptedEnvelope(
  envelope: EncryptedEnvelope
): string {
  return JSON.stringify(envelope);
}

/**
 * Extracts the KEK version from an envelope, needed to select the right key for decryption.
 */
export function getEnvelopeKEKVersion(envelope: EncryptedEnvelope): string {
  return envelope.KEKVersion;
}

/**
 * Checks if an envelope requires re-encryption with a new key version.
 * Returns true if envelope's KEK version doesn't match the current active key version.
 */
export function needsReEncryption(
  envelope: EncryptedEnvelope,
  currentKeyVersion: KeyVersion
): boolean {
  return envelope.KEKVersion !== currentKeyVersion.id;
}

/**
 * Migrates a legacy encrypted value to the current versioned envelope format.
 * Does not perform re-encryption; wraps the existing encrypted value.
 *
 * @param legacyValue The raw encrypted value from legacy storage
 * @param currentKeyVersion The current active key version
 * @returns New envelope wrapping the legacy value
 *
 * @note This is used during migration to attach versioning metadata
 * to legacy encrypted data without re-encrypting it.
 */
export function migrateToEnvelope(
  legacyValue: string,
  currentKeyVersion: KeyVersion
): EncryptedEnvelope {
  // The legacy value becomes the encryptedDEK in our envelope
  // (we're treating existing encrypted data as a wrapped key)
  return createEncryptedEnvelope(legacyValue, currentKeyVersion, 'AES-256-CBC');
}

/**
 * Extracts the raw encrypted value from legacy data for decryption.
 * Used when decrypting data that wasn't properly versioned.
 */
export function extractLegacyValue(legacy: LegacyEncryptedData): string {
  return legacy.value;
}

/**
 * Batch metadata extraction for multiple envelopes.
 * Useful for planning re-encryption operations.
 */
export interface EnvelopeMetadata {
  readonly envelopeVersion: number;
  readonly algorithm: string;
  readonly KEKVersion: string;
  readonly timestamp: string;
}

export function getEnvelopeMetadata(
  envelope: EncryptedEnvelope
): EnvelopeMetadata {
  return {
    envelopeVersion: envelope.version,
    algorithm: envelope.algorithm,
    KEKVersion: envelope.KEKVersion,
    timestamp: envelope.timestamp,
  };
}

/**
 * Calculates total size of an envelope (useful for batch operations).
 */
export function getEnvelopeSize(envelope: EncryptedEnvelope): number {
  return serializeEncryptedEnvelope(envelope).length;
}

/**
 * Compares two envelopes to determine if they're equivalent.
 * Used for validation after re-encryption.
 */
export function areEnvelopesEqual(
  envelope1: EncryptedEnvelope,
  envelope2: EncryptedEnvelope
): boolean {
  return (
    envelope1.version === envelope2.version &&
    envelope1.algorithm === envelope2.algorithm &&
    envelope1.KEKVersion === envelope2.KEKVersion &&
    envelope1.encryptedDEK === envelope2.encryptedDEK
  );
}

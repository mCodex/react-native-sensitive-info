/**
 * Key Rotation Types & Interfaces
 *
 * Defines the contract for automatic key rotation across iOS and Android platforms,
 * including envelope encryption metadata, rotation policies, and status tracking.
 */

/**
 * Represents a specific version of a key used for encryption/decryption.
 * Keys are versioned by timestamp to enable progressive rotation without data loss.
 */
export interface KeyVersion {
  /** ISO 8601 timestamp when this key was generated/rotated */
  readonly id: string;
  /** Timestamp in milliseconds since epoch for sorting */
  readonly timestamp: number;
  /** Whether this key is currently active for new encryptions */
  readonly isActive: boolean;
  /** Platform-specific key identifier (e.g., Android KeyStore alias) */
  readonly platformKeyId?: string;
}

/**
 * Versioned envelope format that wraps encrypted data and metadata.
 *
 * @example
 * ```json
 * {
 *   "version": 2,
 *   "encryptedDEK": "base64-encoded-aes-256-cbc-encrypted-dek",
 *   "KEKVersion": "2025-11-01T10:00:00Z",
 *   "timestamp": "2025-11-01T10:00:00Z",
 *   "algorithm": "AES-256-CBC"
 * }
 * ```
 */
export interface EncryptedEnvelope {
  /** Envelope format version - increment when breaking changes occur */
  readonly version: number;
  /** Base64-encoded Data Encryption Key encrypted with KEK */
  readonly encryptedDEK: string;
  /** ISO 8601 timestamp of the KEK that encrypted this DEK */
  readonly KEKVersion: string;
  /** ISO 8601 timestamp when this envelope was created */
  readonly timestamp: string;
  /** Encryption algorithm used (e.g., "AES-256-CBC") */
  readonly algorithm: string;
}

/**
 * Legacy format for backward compatibility with non-versioned encrypted data.
 * Used during migration to versioned envelopes.
 */
export interface LegacyEncryptedData {
  /** Raw encrypted value without version information */
  readonly value: string;
  /** Optional timestamp if available */
  readonly timestamp?: string;
}

/**
 * Configurable rotation policy that controls when and how keys are rotated.
 */
export interface RotationPolicy {
  /** Enable automatic time-based rotation */
  readonly enabled: boolean;
  /** Rotation interval in milliseconds (default: 90 days) */
  readonly rotationIntervalMs: number;
  /** Enable rotation on biometric enrollment changes */
  readonly rotateOnBiometricChange: boolean;
  /** Enable rotation on device credential updates */
  readonly rotateOnCredentialChange: boolean;
  /** Allow manual/user-initiated rotation */
  readonly manualRotationEnabled: boolean;
  /** Maximum number of key versions to keep during transition (default: 2) */
  readonly maxKeyVersions: number;
  /** Enable background re-encryption of old keys (if supported) */
  readonly backgroundReEncryption: boolean;
}

/**
 * Describes the result of a rotation operation.
 */
export interface RotationStatus {
  /** Whether a rotation is currently in progress */
  readonly isRotating: boolean;
  /** Currently active key version */
  readonly currentKeyVersion: KeyVersion | null;
  /** All available key versions during transition period */
  readonly availableKeyVersions: KeyVersion[];
  /** Timestamp of the last completed rotation */
  readonly lastRotationTimestamp: string | null;
  /** Reason for the last rotation (if any) */
  readonly lastRotationReason?: string;
  /** Number of items pending re-encryption with new key */
  readonly itemsPendingReEncryption: number;
  /** Platform-specific rotation status details */
  readonly platformStatus?: Record<string, unknown>;
}

/**
 * Event emitted when key rotation begins.
 */
export interface RotationStartedEvent {
  readonly type: 'rotation:started';
  readonly timestamp: string;
  readonly reason:
    | 'time-based'
    | 'biometric-change'
    | 'credential-change'
    | 'manual';
  readonly currentKeyVersion: KeyVersion;
  readonly newKeyVersion: KeyVersion;
}

/**
 * Event emitted when key rotation completes successfully.
 */
export interface RotationCompletedEvent {
  readonly type: 'rotation:completed';
  readonly timestamp: string;
  readonly oldKeyVersion: KeyVersion;
  readonly newKeyVersion: KeyVersion;
  readonly duration: number; // milliseconds
  readonly itemsReEncrypted: number;
}

/**
 * Event emitted when key rotation fails.
 */
export interface RotationFailedEvent {
  readonly type: 'rotation:failed';
  readonly timestamp: string;
  readonly reason: string;
  readonly error: Error;
  readonly recoverable: boolean;
}

/**
 * Event emitted when biometric enrollment or device credential changes are detected.
 */
export interface BiometricChangeEvent {
  readonly type: 'biometric-change' | 'credential-change';
  readonly timestamp: string;
  readonly platform: 'ios' | 'android';
  readonly actionRequired?: boolean; // true if immediate rotation is needed
}

/** Union of all rotation-related events */
export type RotationEvent =
  | RotationStartedEvent
  | RotationCompletedEvent
  | RotationFailedEvent
  | BiometricChangeEvent;

/**
 * Configuration options for initiating a manual rotation.
 */
export interface RotationOptions {
  /** Force immediate rotation, bypassing policy checks */
  readonly force?: boolean;
  /** Reason for manual rotation (for audit logging) */
  readonly reason?: string;
  /** Custom metadata to attach to rotation event */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Result of a migration operation.
 */
export interface MigrationResult {
  readonly success: boolean;
  readonly itemsMigrated: number;
  readonly itemsFailed: number;
  readonly timestamp: string;
  readonly errors?: string[];
}

/**
 * Callback signatures for rotation lifecycle events.
 */
export type RotationEventCallback = (
  event: RotationEvent
) => void | Promise<void>;

/**
 * Audit log entry for key rotation events.
 */
export interface RotationAuditEntry {
  readonly timestamp: string;
  readonly eventType:
    | 'key_generated'
    | 'key_rotated'
    | 'key_deleted'
    | 'migration_started'
    | 'migration_completed'
    | 'rotation_failed'
    | 'biometric_enrollment_changed'
    | 'device_credential_changed';
  readonly keyVersion?: string;
  readonly itemsAffected?: number;
  readonly details?: Record<string, unknown>;
  readonly error?: string;
}

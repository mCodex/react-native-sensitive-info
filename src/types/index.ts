/**
 * @fileoverview Type definitions for React Native Sensitive Info v5.6.0
 *
 * Provides comprehensive TypeScript interfaces optimized for:
 * - Tree-shaking: Unused types are eliminated from bundles
 * - Auto-completion: Precise discriminated unions for IDE hints
 * - Performance: Minimal runtime overhead, compile-time safety
 *
 * @version 5.6.0
 */

/**
 * Authentication prompt text configuration
 *
 * Customizes the biometric/passcode authentication dialog shown to users
 *
 * @example
 * ```typescript
 * const prompt: AuthenticationPrompt = {
 *   title: 'Unlock Your Account',
 *   subtitle: 'Verify your identity to access your token',
 *   description: 'Face ID will be used to authenticate'
 * };
 * ```
 */
export interface AuthenticationPrompt {
  /** Primary heading (required) */
  readonly title: string;

  /** Secondary subheading (optional) */
  readonly subtitle?: string;

  /** Additional description text (optional) */
  readonly description?: string;

  /** Negative button text, defaults to "Cancel" (optional) */
  readonly negativeButtonText?: string;
}

/**
 * Access control levels for stored secrets
 *
 * Determines which authentication methods are allowed to access the data
 */
export type AccessControl =
  | 'devicePasscode'
  | 'biometryOrDevicePasscode'
  | 'biometryCurrentSet'
  | 'biometryAndDevicePasscode';

/**
 * Security level indicators
 *
 * Describes the hardware backing and security guarantees
 */
export type SecurityLevel =
  | 'secureEnclave'
  | 'strongBox'
  | 'hardwareBacked'
  | 'biometricProtected'
  | 'passcodeProtected'
  | 'software';

/**
 * Error codes returned by failed operations
 *
 * Use these codes to handle specific error scenarios
 *
 * @example
 * ```typescript
 * try {
 *   await SensitiveInfo.getItem('key');
 * } catch (err) {
 *   if (err.code === 'E_AUTH_CANCELED') {
 *     console.log('User canceled authentication');
 *   } else if (err.code === 'E_BIOMETRY_LOCKOUT') {
 *     console.log('Too many failed attempts');
 *   }
 * }
 * ```
 */
export enum ErrorCode {
  /** Authentication failed (wrong biometric, etc) */
  AUTH_FAILED = 'E_AUTH_FAILED',

  /** User canceled authentication */
  AUTH_CANCELED = 'E_AUTH_CANCELED',

  /** Authentication timed out */
  AUTH_TIMEOUT = 'E_AUTH_TIMEOUT',

  /** Too many failed biometric attempts, try passcode */
  BIOMETRY_LOCKOUT = 'E_BIOMETRY_LOCKOUT',

  /** Biometric not available on device */
  BIOMETRY_NOT_AVAILABLE = 'E_BIOMETRY_NOT_AVAILABLE',

  /** Stored key was invalidated (e.g., biometric changed) */
  KEY_INVALIDATED = 'E_KEY_INVALIDATED',

  /** Decryption failed (corrupted data, wrong key) */
  DECRYPTION_FAILED = 'E_DECRYPTION_FAILED',

  /** Encryption failed */
  ENCRYPTION_FAILED = 'E_ENCRYPTION_FAILED',

  /** Keystore/Keychain unavailable */
  KEYSTORE_UNAVAILABLE = 'E_KEYSTORE_UNAVAILABLE',

  /** Migration from v5.x format failed */
  MIGRATION_FAILED = 'E_MIGRATION_FAILED',
}

/**
 * Metadata about a stored secret
 *
 * Provides information about how and when the secret was stored
 *
 * @example
 * ```typescript
 * const result = await SensitiveInfo.setItem('key', 'value');
 * console.log(result.metadata?.securityLevel); // "secureEnclave"
 * console.log(result.metadata?.timestamp);     // "2024-10-22T18:30:00.000Z"
 * ```
 */
export interface ItemMetadata {
  /** ISO 8601 timestamp of storage */
  readonly timestamp: string;

  /** Security level actually applied */
  readonly securityLevel: SecurityLevel;

  /** Access control applied */
  readonly accessControl: AccessControl;

  /** Whether automatic migration occurred */
  readonly migratedFromV5?: boolean;
}

/**
 * Configuration options for storage operations
 *
 * Use discriminated unions to ensure type safety
 *
 * @example
 * ```typescript
 * // With biometric authentication
 * const optionsWithBiometric: StorageOptions = {
 *   keychainService: 'myapp',
 *   accessControl: 'biometryOrDevicePasscode',
 *   authenticationPrompt: {
 *     title: 'Authenticate'
 *   }
 * };
 *
 * // Simple device passcode
 * const optionsSimple: StorageOptions = {
 *   keychainService: 'myapp',
 *   accessControl: 'devicePasscode'
 * };
 * ```
 */
export interface StorageOptions {
  /** Keychain service for data isolation (required) */
  readonly keychainService: string;

  /** Access control policy (default: 'biometryOrDevicePasscode') */
  readonly accessControl?: AccessControl;

  /** Authentication prompt for storage operations */
  readonly authenticationPrompt?: Readonly<AuthenticationPrompt>;

  /** Metadata about operation */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Configuration options for retrieval operations
 *
 * Allows customizing the authentication prompt shown during `getItem()`
 *
 * @example
 * ```typescript
 * const options: RetrievalOptions = {
 *   keychainService: 'myapp',
 *   prompt: {
 *     title: 'Unlock to Access Token',
 *     subtitle: 'Verify your identity'
 *   }
 * };
 * ```
 */
export interface RetrievalOptions {
  /** Keychain service to retrieve from */
  readonly keychainService: string;

  /** Authentication prompt for retrieval */
  readonly prompt?: Readonly<AuthenticationPrompt>;
}

/**
 * Result of a storage operation
 *
 * Includes operation status and optional metadata
 *
 * @example
 * ```typescript
 * const result = await SensitiveInfo.setItem('key', 'value');
 * if (result.success) {
 *   console.log('Stored with level:', result.metadata?.securityLevel);
 * }
 * ```
 */
export interface OperationResult {
  /** True if operation succeeded */
  readonly success: boolean;

  /** Metadata about the operation */
  readonly metadata?: Readonly<ItemMetadata>;

  /** Human-readable error message (if failed) */
  readonly error?: string;
}

/**
 * Device capabilities information
 *
 * Describes what security features are available on this device
 *
 * @example
 * ```typescript
 * const capabilities = await SensitiveInfo.getSupportedSecurityLevels();
 *
 * if (capabilities.secureEnclave) {
 *   console.log('Using Secure Enclave for maximum security');
 * } else if (capabilities.biometry) {
 *   console.log('Using biometric authentication');
 * } else {
 *   console.log('Using device passcode');
 * }
 * ```
 */
export interface DeviceCapabilities {
  /** Whether device has Secure Enclave (iOS 16+, macOS 13+, visionOS all, Android 9+) */
  readonly secureEnclave: boolean;

  /** Whether biometric authentication is available */
  readonly biometry: boolean;

  /** Type of biometric available: 'faceID', 'touchID', 'fingerprint', 'opticID' */
  readonly biometryType?: 'faceID' | 'touchID' | 'fingerprint' | 'opticID';

  /** Whether device credential (PIN/pattern) is available */
  readonly deviceCredential: boolean;

  /** Whether data syncs across devices (iCloud Keychain, etc) */
  readonly iCloudSync: boolean;

  /** Current platform */
  readonly platform: 'iOS' | 'macOS' | 'visionOS' | 'watchOS' | 'Android';
}

/**
 * Comprehensive error with code and message
 *
 * Thrown by SensitiveInfo operations
 *
 * @example
 * ```typescript
 * try {
 *   await SensitiveInfo.getItem('key');
 * } catch (error) {
 *   if (error instanceof SensitiveInfoError) {
 *     console.error(`Error ${error.code}: ${error.message}`);
 *   }
 * }
 * ```
 */
export class SensitiveInfoError extends Error {
  constructor(
    public readonly code: ErrorCode | string,
    message: string,
    public readonly nativeError?: unknown
  ) {
    super(message);
    this.name = 'SensitiveInfoError';
  }
}

/**
 * Type guard for SensitiveInfoError
 *
 * @example
 * ```typescript
 * catch (error) {
 *   if (isSensitiveInfoError(error)) {
 *     console.log(error.code); // Has code property
 *   }
 * }
 * ```
 */
export function isSensitiveInfoError(
  error: unknown
): error is SensitiveInfoError {
  return error instanceof SensitiveInfoError;
}

/**
 * Readonly array of platform names
 *
 * @example
 * ```typescript
 * const supportedPlatforms: readonly string[] = SUPPORTED_PLATFORMS;
 * console.log(supportedPlatforms); // ["iOS", "macOS", "visionOS", "watchOS", "Android"]
 * ```
 */
export const SUPPORTED_PLATFORMS = [
  'iOS',
  'macOS',
  'visionOS',
  'watchOS',
  'Android',
] as const;

/**
 * Minimum supported versions per platform
 *
 * @example
 * ```typescript
 * console.log(MIN_VERSIONS.iOS);     // "13.0"
 * console.log(MIN_VERSIONS.macOS);   // "10.15"
 * ```
 */
export const MIN_VERSIONS = {
  iOS: '13.0',
  macOS: '10.15',
  visionOS: '1.0',
  watchOS: '6.0',
  Android: '8',
} as const;

/**
 * Default access control level
 */
export const DEFAULT_ACCESS_CONTROL: AccessControl = 'biometryOrDevicePasscode';

/**
 * Default keychain service name if not provided
 */
export const DEFAULT_KEYCHAIN_SERVICE = 'default';

/**
 * Maximum length for stored values (in bytes)
 * Ensures compatibility across all platforms
 */
export const MAX_VALUE_LENGTH = 10 * 1024 * 1024; // 10MB

/**
 * @fileoverview React Native Sensitive Info v5.6.0 - Unified Type Definitions
 *
 * Comprehensive, strongly-typed interfaces optimized for:
 * - Tree-shaking: Zero unused code in production bundles
 * - VSCode autocomplete: Full JSDoc with examples
 * - Type safety: Discriminated unions prevent invalid combinations
 * - Performance: Minimal runtime overhead
 *
 * @version 5.6.0
 * @since 5.0.0
 */

/* ============================================================================
 * ACCESS CONTROL & AUTHENTICATION
 * ============================================================================ */

/**
 * Access control policy for secret access
 *
 * Determines which authentication method is required to access stored secrets.
 * The implementation automatically falls back to supported levels on the device.
 *
 * **Fallback Chain:**
 * `secureEnclaveBiometry` → `biometryCurrentSet` → `devicePasscode` → `software`
 *
 * @see {@link AuthenticationPrompt} for customizing auth dialogs
 *
 * @example
 * ```typescript
 * // Strongest: Secure Enclave + Biometric + Device Passcode
 * const policy: AccessControl = 'secureEnclaveBiometry';
 *
 * // Biometric only (revoke if biometrics change)
 * const currentSet: AccessControl = 'biometryCurrentSet';
 *
 * // Any enrolled biometric
 * const anyBio: AccessControl = 'biometryAny';
 *
 * // Device PIN/passcode required
 * const passcode: AccessControl = 'devicePasscode';
 *
 * // No additional protection (development only)
 * const none: AccessControl = 'none';
 * ```
 */
export type AccessControl =
  | 'secureEnclaveBiometry' // iOS Secure Enclave + Biometric + Passcode (strongest)
  | 'biometryCurrentSet' // Current biometric enrollment only
  | 'biometryAny' // Any enrolled biometric
  | 'devicePasscode' // Device passcode/PIN required
  | 'none'; // No additional protection (weakest)

/**
 * Customizable text for biometric/passcode authentication prompts
 *
 * Shown when a user attempts to access a biometric-protected secret.
 * Localize these strings for your application's user base.
 *
 * **Security Note:** Don't reveal the specific secret being accessed!
 * Use generic descriptions like "Unlock your account" instead of
 * "Access payment token".
 *
 * @platform All platforms support these fields
 *
 * @example
 * ```typescript
 * // English
 * const prompt: AuthenticationPrompt = {
 *   title: 'Unlock Account',
 *   subtitle: 'Biometric authentication required',
 *   description: 'Verify your identity with Face ID or passcode',
 *   negativeButtonText: 'Cancel'
 * };
 *
 * // Spanish (localized)
 * const promptES: AuthenticationPrompt = {
 *   title: 'Desbloquear Cuenta',
 *   subtitle: 'Autenticación biométrica requerida',
 *   description: 'Verifica tu identidad con Face ID o contraseña'
 * };
 * ```
 */
export interface AuthenticationPrompt {
  /**
   * Primary heading (required)
   *
   * Keep concise (1-3 words). Examples:
   * - "Unlock Account"
   * - "Authenticate"
   * - "Verify Identity"
   *
   * Displayed prominently in the authentication dialog.
   */
  readonly title: string;

  /**
   * Secondary subheading (optional)
   *
   * Provides context. Examples:
   * - "Biometric authentication required"
   * - "Use your fingerprint"
   * - "Face ID needed"
   */
  readonly subtitle?: string;

  /**
   * Detailed description (optional)
   *
   * Explain why authentication is needed. Examples:
   * - "Verify your identity to access your account"
   * - "Authenticate to decrypt your credentials"
   * - "Required for secure access"
   *
   * **Security Best Practice:** Never mention the specific secret name!
   */
  readonly description?: string;

  /**
   * Cancel button text (optional)
   *
   * Defaults to "Cancel" if not provided.
   * iOS only; Android always shows system-localized "Cancel" button.
   *
   * @platform ios
   */
  readonly negativeButtonText?: string;
}

/* ============================================================================
 * SECURITY METADATA & LEVELS
 * ============================================================================ */

/**
 * Actual security level achieved for stored secret
 *
 * Indicates the hardware backing and security guarantees.
 * **Ordered from strongest to weakest:**
 * 1. `secureEnclave` - iOS Secure Enclave (isolated processor)
 * 2. `strongBox` - Android StrongBox (dedicated secure processor)
 * 3. `biometry` - Biometric-protected keys
 * 4. `deviceCredential` - Device passcode/PIN protected
 * 5. `software` - Software-only encryption (weakest)
 *
 * **Decision Making:** Compare actual level with expected level.
 * If `actual < expected`, warn user or prompt for re-authentication.
 *
 * @example
 * ```typescript
 * const result = await setItem('token', value, {
 *   accessControl: 'secureEnclaveBiometry'
 * });
 *
 * if (result.metadata.securityLevel === 'software') {
 *   showWarning('⚠️ This device uses software encryption. ' +
 *     'Upgrade to iOS 16+ for hardware-backed security.');
 * }
 * ```
 */
export type SecurityLevel =
  | 'secureEnclave' // iOS Secure Enclave (strongest, iOS 16+)
  | 'strongBox' // Android StrongBox (strongest, Android 9+)
  | 'biometry' // Biometric-protected key
  | 'deviceCredential' // Device passcode/PIN protected
  | 'software'; // Software-only encryption (weakest)

/**
 * Metadata describing how a secret is stored and protected
 *
 * Provides visibility into the actual security achieved. Use this to:
 * - Validate security expectations
 * - Make app-level security decisions
 * - Provide user-facing security information
 * - Log security decisions for audit trails
 *
 * **Important:** The `securityLevel` field reflects what was **actually achieved**,
 * not what was **requested**. On older devices without Secure Enclave, requesting
 * `secureEnclaveBiometry` may result in `deviceCredential` being stored.
 *
 * @example
 * ```typescript
 * const { metadata } = await setItem('auth-token', token, {
 *   accessControl: 'secureEnclaveBiometry'
 * });
 *
 * // Check actual security level
 * const isStrongSecurity = metadata.securityLevel !== 'software';
 * const isHardwareBacked = ['secureEnclave', 'strongBox'].includes(
 *   metadata.securityLevel
 * );
 *
 * // Decide whether to accept this storage
 * if (!isStrongSecurity) {
 *   throw new Error('Security requirements not met');
 * }
 * ```
 */
export interface StorageMetadata {
  /**
   * The actual security level achieved (read-only)
   *
   * This is the **highest tier actually used**, not the requested level.
   * Use to validate security expectations.
   */
  readonly securityLevel: SecurityLevel;

  /**
   * The access control policy that was applied
   *
   * May differ from the requested policy if the device doesn't support it.
   */
  readonly accessControl: AccessControl;

  /**
   * The storage backend used for persistence
   *
   * - `keychain`: iOS Keychain (preferred on iOS)
   * - `androidKeystore`: Android KeyStore (preferred on Android)
   * - `encryptedSharedPreferences`: Android encrypted SharedPreferences (fallback)
   */
  readonly backend:
    | 'keychain'
    | 'androidKeystore'
    | 'encryptedSharedPreferences';

  /**
   * UNIX timestamp (seconds since epoch) of last write
   *
   * Useful for:
   * - Detecting stale credentials (e.g., force re-auth if > 1 hour old)
   * - Audit logging
   * - Cache invalidation
   *
   * @example
   * ```typescript
   * const now = Math.floor(Date.now() / 1000);
   * const ageSeconds = now - metadata.timestamp;
   *
   * if (ageSeconds > 3600) {
   *   // Token older than 1 hour
   *   await refreshToken();
   * }
   * ```
   */
  readonly timestamp: number;
}

/**
 * Device security capabilities available on current device
 *
 * Use to adapt UI/UX based on available security features.
 *
 * @example
 * ```typescript
 * const caps = await getSupportedSecurityLevels();
 *
 * if (caps.secureEnclave) {
 *   showSecureEnclaveOption(); // Show strongest option
 * }
 *
 * if (!caps.deviceCredential) {
 *   showSecurityWarning('Set device PIN for app protection');
 * }
 * ```
 */
export interface DeviceCapabilities {
  /**
   * iOS Secure Enclave available (iOS 16+, macOS 13+, visionOS, Android 9+)
   *
   * When true, keys can be stored isolated from main OS (strongest).
   */
  readonly secureEnclave: boolean;

  /**
   * Android StrongBox available (Android 9+ with hardware support)
   *
   * When true, keys can use dedicated security processor.
   */
  readonly strongBox: boolean;

  /**
   * Biometric authentication available (Face, Fingerprint, Iris, Optic ID)
   *
   * When false, advise user to enroll biometric.
   */
  readonly biometry: boolean;

  /**
   * Biometric type available (if biometry is true)
   *
   * - `faceID`: Face recognition
   * - `touchID`: Touch ID (fingerprint)
   * - `fingerprint`: Fingerprint (Android)
   * - `opticID`: Optic ID (visionOS)
   */
  readonly biometryType?: 'faceID' | 'touchID' | 'fingerprint' | 'opticID';

  /**
   * Device credential (passcode/PIN/pattern) set
   *
   * When false, user should set device screen lock for security.
   */
  readonly deviceCredential: boolean;

  /**
   * iCloud Keychain/cross-device sync available
   *
   * When true, secrets can be synced across user's devices.
   *
   * @platform ios
   */
  readonly iCloudSync: boolean;
}

/* ============================================================================
 * STORAGE OPTIONS & CONFIGURATION
 * ============================================================================ */

/**
 * Options for storing a secret
 *
 * Configure where, how, and with what protection a secret is stored.
 *
 * @example
 * ```typescript
 * const options: StorageOptions = {
 *   keychainService: 'myapp-auth',
 *   accessControl: 'secureEnclaveBiometry',
 *   authenticationPrompt: {
 *     title: 'Store Token',
 *     description: 'Authenticate to save your session'
 *   }
 * };
 * ```
 */
export interface StorageOptions {
  /**
   * Logical namespace for organizing secrets
   *
   * Different services keep their secrets completely isolated:
   * - `keychainService: 'auth'` keeps separate from `'payments'`
   * - Useful for multi-account apps
   * - Defaults to app bundle ID (iOS) or package name (Android)
   *
   * @default App bundle/package ID
   *
   * @example
   * ```typescript
   * // Service 1: Authentication
   * await setItem('token', authToken, {
   *   keychainService: 'com.example.myapp.auth'
   * });
   *
   * // Service 2: Payments
   * await setItem('cc-token', ccToken, {
   *   keychainService: 'com.example.myapp.payments'
   * });
   *
   * // These are isolated and require separate access control
   * ```
   */
  readonly keychainService?: string;

  /**
   * Required authentication method for accessing this secret
   *
   * - `secureEnclaveBiometry`: Strongest (falls back if unavailable)
   * - `biometryCurrentSet`: Biometric only (revoked if enrollment changes)
   * - `biometryAny`: Any biometric
   * - `devicePasscode`: Device PIN/passcode only
   * - `none`: No extra protection (development only)
   *
   * @default 'secureEnclaveBiometry'
   *
   * @see {@link AccessControl} for detailed explanation of each level
   */
  readonly accessControl?: AccessControl;

  /**
   * Customizable text for authentication prompts
   *
   * Localize for your users. Only used if `accessControl` requires auth.
   *
   * @see {@link AuthenticationPrompt} for field descriptions
   */
  readonly authenticationPrompt?: Readonly<AuthenticationPrompt>;

  /**
   * iOS-specific: Enable iCloud Keychain synchronization
   *
   * When true, secret syncs to all user's iOS/macOS devices.
   * Useful for shared authentication tokens.
   *
   * **Privacy Note:** Secrets are encrypted, but stored in iCloud.
   * Ensure compliance with privacy regulations (GDPR, CCPA, etc).
   *
   * @default false
   * @platform ios
   *
   * @example
   * ```typescript
   * // Sync session token across devices
   * await setItem('session', token, {
   *   keychainService: 'myapp',
   *   iosSynchronizable: true
   * });
   * ```
   */
  readonly iosSynchronizable?: boolean;

  /**
   * iOS-specific: Keychain access group for app extension sharing
   *
   * Allows multiple apps in the same team to access this secret.
   * Format: `group.<team-id>.<identifier>`
   *
   * **Security:** Only share with trusted extensions/apps.
   * All sharing parties need matching provisioning profiles.
   *
   * @default App's main Keychain group
   * @platform ios
   *
   * @example
   * ```typescript
   * // Share token with app extension
   * await setItem('extension-token', token, {
   *   keychainService: 'myapp',
   *   keychainGroup: 'group.TEAM123.com.example.myapp'
   * });
   * ```
   */
  readonly keychainGroup?: string;

  /**
   * Android-specific: Require strong biometric only
   *
   * When true: Only Class 3 biometrics (Face/Iris recognized)
   * When false: Allow Class 1-2 biometrics (fingerprint, face patterns)
   *
   * Use true for:
   * - Banking/payment apps
   * - High-security operations
   *
   * Use false for:
   * - Better UX on devices with limited biometrics
   * - Social/content apps
   *
   * @default false
   * @platform android
   *
   * @see {@link https://developer.android.com/reference/android/hardware/biometrics/BiometricManager#getStrengths()}
   */
  readonly androidBiometricsStrongOnly?: boolean;

  /**
   * Custom metadata to attach to stored item
   *
   * Useful for tagging or categorizing secrets without exposing values.
   * Not encrypted; use only for non-sensitive metadata.
   *
   * @example
   * ```typescript
   * await setItem('token', token, {
   *   keychainService: 'myapp',
   *   metadata: {
   *     provider: 'oauth',
   *     expiresAt: Math.floor(Date.now() / 1000) + 3600,
   *     environment: 'production'
   *   }
   * });
   * ```
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Options for retrieving a stored secret
 *
 * Configure authentication prompt and service namespace.
 *
 * @example
 * ```typescript
 * const options: RetrievalOptions = {
 *   keychainService: 'myapp-auth',
 *   prompt: {
 *     title: 'Unlock Token',
 *     description: 'Authenticate to access your session'
 *   }
 * };
 * ```
 */
export interface RetrievalOptions {
  /**
   * Service namespace where secret is stored
   *
   * Must match the service used in `setItem()`.
   * If not provided, uses app bundle/package ID.
   *
   * @default App bundle/package ID
   */
  readonly keychainService?: string;

  /**
   * Customizable authentication prompt
   *
   * Only shown if the secret was stored with access control.
   * Localize for your users.
   *
   * @see {@link AuthenticationPrompt}
   */
  readonly prompt?: Readonly<AuthenticationPrompt>;
}

/* ============================================================================
 * OPERATION RESULTS
 * ============================================================================ */

/**
 * Result of a setItem operation
 *
 * Includes metadata about how the secret was stored.
 * **Always check metadata** to ensure security expectations were met!
 *
 * @example
 * ```typescript
 * const result = await setItem('token', value, {
 *   accessControl: 'secureEnclaveBiometry'
 * });
 *
 * console.log(`✓ Stored with ${result.metadata.securityLevel}`);
 *
 * if (result.metadata.securityLevel === 'software') {
 *   console.warn('⚠️ Not hardware-backed');
 * }
 * ```
 */
export interface OperationResult {
  /**
   * Metadata describing how secret was stored
   *
   * Use to validate security expectations.
   */
  readonly metadata: StorageMetadata;
}

/**
 * A stored secret with its metadata
 *
 * Returned by getItem when successful.
 *
 * @example
 * ```typescript
 * const result = await getItem('auth-token', {
 *   keychainService: 'myapp'
 * });
 *
 * if (result) {
 *   console.log(`Token: ${result.value}`);
 *   console.log(`Stored: ${new Date(result.metadata.timestamp * 1000)}`);
 * }
 * ```
 */
export interface StoredItem {
  /**
   * The decrypted secret value
   */
  readonly value: string;

  /**
   * Metadata describing how secret is protected
   */
  readonly metadata: StorageMetadata;
}

/* ============================================================================
 * ERROR HANDLING
 * ============================================================================ */

/**
 * Error codes for SensitiveInfo operations
 *
 * All errors throw with a `code` property. Use to provide
 * appropriate user feedback and error recovery.
 *
 * **Categorized by severity:**
 * - User action: E_AUTH_CANCELED, E_AUTH_FAILED
 * - Key issue: E_KEY_INVALIDATED, E_NOT_FOUND
 * - System issue: E_KEYSTORE_UNAVAILABLE, E_ENCRYPTION_FAILED
 *
 * @example
 * ```typescript
 * try {
 *   const token = await getItem('auth-token', { ... });
 * } catch (error: any) {
 *   switch (error.code) {
 *     case 'E_AUTH_CANCELED':
 *       // User pressed cancel - normal flow
 *       console.log('User canceled');
 *       break;
 *
 *     case 'E_KEY_INVALIDATED':
 *       // User changed biometrics - ask to re-authenticate
 *       console.log('Please re-authenticate');
 *       break;
 *
 *     case 'E_KEYSTORE_UNAVAILABLE':
 *       // System error - show critical message
 *       showErrorAlert('Storage unavailable. Restart device.');
 *       break;
 *   }
 * }
 * ```
 */
export enum ErrorCode {
  /**
   * The requested key doesn't exist
   *
   * This is a **normal condition**, not an error.
   * Recommended UX: Redirect to login/setup screen.
   */
  NOT_FOUND = 'E_NOT_FOUND',

  /**
   * User canceled biometric/passcode authentication
   *
   * This is expected user behavior. Don't treat as error.
   * Recommended UX: Close modal, allow retry.
   */
  AUTH_CANCELED = 'E_AUTH_CANCELED',

  /**
   * Biometric authentication failed (wrong fingerprint, etc)
   *
   * The OS allows limited retries before locking out.
   * Recommended UX: "Try again" or offer passcode fallback.
   */
  AUTH_FAILED = 'E_AUTH_FAILED',

  /**
   * Too many failed biometric attempts - locked out
   *
   * User must authenticate with device passcode.
   * Recommended UX: "Please use device passcode to unlock."
   */
  BIOMETRY_LOCKOUT = 'E_BIOMETRY_LOCKOUT',

  /**
   * The stored key has been invalidated
   *
   * Usually happens when user changes biometric enrollment.
   * iOS: Biometric enrollment changed
   * Android: Device lock settings changed
   * Recommended UX: Ask user to re-authenticate and re-save.
   */
  KEY_INVALIDATED = 'E_KEY_INVALIDATED',

  /**
   * Keystore/Keychain is unavailable or corrupted
   *
   * Rare - usually indicates serious system problems.
   * Recommended UX: Show critical error, suggest device restart.
   */
  KEYSTORE_UNAVAILABLE = 'E_KEYSTORE_UNAVAILABLE',

  /**
   * Encryption operation failed
   *
   * Possible causes:
   * - Invalid key
   * - Corrupted key material
   * - Out of memory
   * Recommended UX: Show error, offer factory reset option.
   */
  ENCRYPTION_FAILED = 'E_ENCRYPTION_FAILED',

  /**
   * Decryption operation failed
   *
   * Possible causes:
   * - Corrupted ciphertext
   * - Wrong key
   * - Data tampering detected
   * Recommended UX: Show error, offer to wipe and reset.
   */
  DECRYPTION_FAILED = 'E_DECRYPTION_FAILED',

  /**
   * Migration from v5.x format failed
   *
   * Rare - only occurs on first access if format migration fails.
   */
  MIGRATION_FAILED = 'E_MIGRATION_FAILED',
}

/**
 * Comprehensive error thrown by SensitiveInfo operations
 *
 * All SensitiveInfo errors include a `code` field for error categorization.
 *
 * @example
 * ```typescript
 * try {
 *   await getItem('key', { keychainService: 'myapp' });
 * } catch (error: any) {
 *   if (isSensitiveInfoError(error)) {
 *     console.error(`Error ${error.code}: ${error.message}`);
 *     console.error('Native error:', error.nativeError);
 *   }
 * }
 * ```
 */
export class SensitiveInfoError extends Error {
  /**
   * Machine-readable error code
   *
   * Use to make programmatic decisions.
   *
   * @see {@link ErrorCode} for list of all possible codes
   */
  readonly code: ErrorCode | string;

  /**
   * Original native error (iOS/Android)
   *
   * Useful for debugging. Contains platform-specific details.
   */
  readonly nativeError?: unknown;

  /**
   * Creates a new SensitiveInfoError
   *
   * @param code - Machine-readable error code
   * @param message - Human-readable error message
   * @param nativeError - Optional original native error
   *
   * @example
   * ```typescript
   * const error = new SensitiveInfoError(
   *   ErrorCode.AUTH_FAILED,
   *   'Biometric authentication failed',
   *   originalError
   * );
   * throw error;
   * ```
   */
  constructor(
    code: ErrorCode | string,
    message: string,
    nativeError?: unknown
  ) {
    super(message);
    this.name = 'SensitiveInfoError';
    this.code = code;
    this.nativeError = nativeError;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, SensitiveInfoError.prototype);
  }
}

/**
 * Type guard for SensitiveInfoError
 *
 * Use to safely access error code in catch blocks.
 *
 * @example
 * ```typescript
 * try {
 *   await getItem('key', { ... });
 * } catch (error: unknown) {
 *   if (isSensitiveInfoError(error)) {
 *     // Now safe to access error.code
 *     console.log(error.code);
 *   }
 * }
 * ```
 */
export function isSensitiveInfoError(
  error: unknown
): error is SensitiveInfoError {
  return error instanceof SensitiveInfoError;
}

/* ============================================================================
 * CONSTANTS & DEFAULTS
 * ============================================================================ */

/**
 * Default access control level
 *
 * Use strongest available on device with automatic fallback.
 *
 * @default 'secureEnclaveBiometry'
 */
export const DEFAULT_ACCESS_CONTROL: AccessControl = 'secureEnclaveBiometry';

/**
 * Supported platforms
 *
 * @example
 * ```typescript
 * console.log(SUPPORTED_PLATFORMS);
 * // ["iOS", "macOS", "visionOS", "watchOS", "Android"]
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
 * Minimum supported OS versions per platform
 *
 * @example
 * ```typescript
 * console.log(MIN_VERSIONS.iOS); // "13.0"
 * console.log(MIN_VERSIONS.Android); // "8"
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
 * Maximum value length (in bytes)
 *
 * Exceeding this may cause storage failures or truncation.
 *
 * @default 10485760 (10 MB)
 */
export const MAX_VALUE_LENGTH = 10 * 1024 * 1024;

/**
 * Default keychain service name
 *
 * Used if service not specified in options.
 *
 * @default 'default'
 */
export const DEFAULT_KEYCHAIN_SERVICE = 'default';

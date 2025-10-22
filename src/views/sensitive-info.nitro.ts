/**
 * sensitive-info.nitro.ts
 *
 * TypeScript definitions for the SensitiveInfo v6 API.
 *
 * **100% v5 Compatible**: Same API signatures, same behavior, but more secure!
 *
 * These types define the interface between JavaScript and native code.
 * Nitro Modules automatically generates the bridge code.
 *
 * **Security Features**:
 * - Random IV per operation (fixes v5 fixed IV vulnerability)
 * - Biometric access control (Face ID / Touch ID / Fingerprint)
 * - Hardware-backed keys (Secure Enclave on iOS, StrongBox on Android)
 * - Device credential fallback (PIN / passcode / pattern)
 * - Semantic security (same plaintext ≠ same ciphertext)
 *
 * @see HybridSensitiveInfo (native implementation)
 * @see index.ts (public API with convenience methods)
 */

/**
 * Customizable text for biometric/credential authentication prompts.
 *
 * Shown when user accesses a biometric-protected secret.
 * Localize these strings for your users.
 *
 * @example
 * ```typescript
 * const esPrompt: AuthenticationPrompt = {
 *   title: 'Desbloquea Tu Cuenta',
 *   subtitle: 'Autenticación biométrica requerida',
 *   description: 'Accede a tu token seguro',
 *   cancel: 'Cancelar'
 * }
 * ```
 */
export interface AuthenticationPrompt {
  /**
   * Primary prompt title (required).
   * Keep concise (1-2 words). Example: "Unlock Account"
   */
  readonly title: string;

  /**
   * Secondary subtitle (optional).
   * Example: "Biometric authentication required"
   */
  readonly subtitle?: string;

  /**
   * Detailed description (optional).
   * Explain why authentication is needed.
   * Example: "Access your secure session token"
   *
   * **Security Note**: Don't reveal what secret is being accessed!
   */
  readonly description?: string;

  /**
   * Cancel button text (optional, defaults to "Cancel").
   * iOS only; Android always shows "Cancel" in system locale.
   */
  readonly cancel?: string;
}

/**
 * Configuration options for sensitive data operations.
 *
 * All options are optional and have sensible defaults.
 * Prefer strongest available security on the current device.
 *
 * @example
 * ```typescript
 * const options: SensitiveInfoOptions = {
 *   service: 'myapp',              // Namespace for secrets
 *   accessControl: 'secureEnclaveBiometry', // Preferred security
 *   authenticationPrompt: {
 *     title: 'Unlock Secret',
 *     description: 'Authenticate to access your data'
 *   },
 *   iosSynchronizable: false,       // Don't sync to iCloud
 * }
 * ```
 */
export interface SensitiveInfoOptions {
  /**
   * Logical namespace for organizing secrets.
   *
   * Defaults to app bundle identifier (iOS) or package name (Android).
   * Use different services to isolate unrelated secrets.
   *
   * @default Bundle identifier
   */
  readonly service?: string;

  /**
   * Preferred security policy for storing this secret.
   *
   * The implementation automatically falls back to strongest supported
   * policy if requested level is unavailable:
   *
   * `secureEnclaveBiometry` → `biometry` → `deviceCredential` → `software`
   *
   * **Security Notes**:
   * - `secureEnclaveBiometry` (strongest): Secure Enclave + Biometric
   * - `biometryCurrentSet`: Current biometric enrollment only
   * - `biometryAny`: Any enrolled biometric
   * - `devicePasscode`: Device passcode/PIN required
   * - `none` (weakest): No additional access control
   *
   * @default 'secureEnclaveBiometry'
   */
  readonly accessControl?: AccessControl;

  /**
   * Customizable text shown in biometric/credential prompts.
   *
   * Localize for your application's user base.
   * Shown when accessing secrets with access control enabled.
   */
  readonly authenticationPrompt?: AuthenticationPrompt;

  /**
   * iOS-specific: Enable iCloud Keychain synchronization.
   *
   * When true, the secret syncs to user's other iOS/macOS devices
   * via iCloud Keychain. Useful for cross-device authentication tokens.
   *
   * **Security Note**: Secrets are encrypted end-to-end but stored in iCloud.
   * Comply with privacy regulations when syncing sensitive data.
   *
   * @default false
   * @platform ios
   */
  readonly iosSynchronizable?: boolean;

  /**
   * iOS-specific: Custom Keychain access group for sharing secrets.
   *
   * When specified, allows multiple apps in the same team to access
   * this secret (e.g., app + app extension).
   *
   * Format: `group.<team-id>.<identifier>`
   *
   * **Security Note**: Only share with trusted extensions/apps.
   * All sharing apps must have matching provisioning profiles.
   *
   * @default App's default Keychain group
   * @platform ios
   *
   * @example
   * ```typescript
   * keychainGroup: 'group.com.example.myapp'
   * ```
   */
  readonly keychainGroup?: string;

  /**
   * Android-specific: Require only strong biometric authentication.
   *
   * When true, keys are protected by Class 3 biometrics only (Face/Iris).
   * When false, allows Class 1-2 biometrics (fingerprint, face patterns).
   *
   * **Security Note**: Set to true for high-security operations (banking).
   * Set to false for better UX on devices with limited biometrics.
   *
   * @default false
   * @platform android
   *
   * @see https://developer.android.com/reference/android/hardware/biometrics/BiometricManager#Strength
   */
  readonly androidBiometricsStrongOnly?: boolean;
}

/**
 * Access control policy for secret access.
 *
 * Specifies when and how a user must authenticate to access secrets.
 */
export type AccessControl =
  | 'secureEnclaveBiometry' // Secure Enclave + Biometric (default, strongest)
  | 'biometryCurrentSet' // Current biometric enrollment only
  | 'biometryAny' // Any enrolled biometric
  | 'devicePasscode' // Device passcode/PIN required
  | 'none'; // No additional access control

/**
 * Metadata describing how a secret is protected.
 *
 * Provides visibility into the actual security level achieved,
 * not just the requested level. Use to validate security expectations.
 *
 * @example
 * ```typescript
 * const result = await setItem('token', 'secret', {
 *   accessControl: 'secureEnclaveBiometry'
 * })
 *
 * // On device without biometric:
 * console.log(result.metadata.securityLevel)  // "deviceCredential"
 * console.log(result.metadata.accessControl)   // "secureEnclaveBiometry" (requested)
 *
 * if (result.metadata.securityLevel === 'software') {
 *   showSecurityWarning('Warning: Not hardware-backed!')
 * }
 * ```
 */
export interface StorageMetadata {
  /**
   * The highest security tier actually applied (not just requested).
   *
   * - `secureEnclave`: iOS Secure Enclave (strongest)
   * - `strongBox`: Android StrongBox (very strong)
   * - `biometry`: Biometric-protected keys
   * - `deviceCredential`: Device passcode/PIN protected
   * - `software`: Software-only (weakest, use with caution)
   *
   * **Security Decision**: Use this to warn users if security is degraded.
   */
  readonly securityLevel: SecurityLevel;

  /**
   * The access control policy that was actually applied.
   *
   * May differ from the requested policy on unsupported devices.
   * Refer to this field for accurate security info.
   */
  readonly accessControl: AccessControl;

  /**
   * The native storage backend used.
   *
   * - `keychain`: iOS Keychain (preferred on iOS)
   * - `androidKeystore`: Android KeyStore (preferred on Android)
   * - `encryptedSharedPreferences`: Fallback on Android
   */
  readonly backend: StorageBackend;

  /**
   * UNIX timestamp (seconds) when this secret was last written.
   *
   * Useful for:
   * - Cache invalidation (token expiration)
   * - Audit logging
   * - Security decisions (e.g., force re-auth if old)
   *
   * @example
   * ```typescript
   * const item = await getItem('auth-token')
   * const ageSeconds = Date.now() / 1000 - item.metadata.timestamp
   *
   * if (ageSeconds > 3600) {
   *   // Token older than 1 hour, request fresh auth
   *   await refreshAuthentication()
   * }
   * ```
   */
  readonly timestamp: number;
}

/**
 * Security level achieved for a stored secret.
 *
 * Ordered from strongest (secureEnclave) to weakest (software).
 * Use to make security-aware app decisions.
 */
export type SecurityLevel =
  | 'secureEnclave' // iOS: Secure Enclave (strongest, iOS 16+)
  | 'strongBox' // Android: StrongBox (strongest, Android 9+)
  | 'biometry' // Biometric-protected (Face/Touch/Fingerprint)
  | 'deviceCredential' // Device passcode/PIN required
  | 'software'; // Software-only encryption (weakest)

/**
 * Native storage backend used for persistence.
 */
export type StorageBackend =
  | 'keychain' // iOS Keychain
  | 'androidKeystore' // Android KeyStore
  | 'encryptedSharedPreferences'; // Android SharedPreferences (fallback)

/**
 * A stored secret with its metadata.
 *
 * Returned when retrieving items. The `metadata` field provides
 * visibility into the security level and backend used for storage.
 *
 * @example
 * ```typescript
 * const item = await getItem('auth-token')
 *
 * if (item) {
 *   console.log(`Secret: ${item.value}`)
 *   console.log(`Security: ${item.metadata.securityLevel}`)
 *   console.log(`Stored: ${new Date(item.metadata.timestamp * 1000)}`)
 * }
 * ```
 */
export interface SensitiveInfoItem {
  /**
   * The decrypted secret value.
   *
   * Always included in getItem results.
   */
  readonly value: string;

  /**
   * The key under which this secret was stored.
   */
  readonly key: string;

  /**
   * The service namespace where this secret resides.
   */
  readonly service: string;

  /**
   * Security metadata describing how this secret is protected.
   *
   * Use this to make security-aware decisions in your app.
   * Example: Show warning if security level is 'software'.
   */
  readonly metadata: StorageMetadata;
}

/**
 * Result of a write operation (setItem).
 *
 * Contains metadata describing the security level achieved.
 */
export interface MutationResult {
  /**
   * Metadata describing how the secret was stored.
   *
   * **Always check this** to ensure security expectations were met!
   */
  readonly metadata: StorageMetadata;
}

/**
 * Platform capabilities available on the current device.
 *
 * Use to tailor UX before requesting sensitive operations.
 *
 * @example
 * ```typescript
 * const caps = await getSupportedSecurityLevels()
 *
 * if (caps.secureEnclave) {
 *   showSecureEnclaveOption()
 * }
 *
 * if (!caps.biometry) {
 *   disableBiometricUI()
 * }
 * ```
 */
export interface SecurityAvailability {
  /**
   * iOS Secure Enclave available (iOS 16+ with hardware support).
   *
   * When true, secrets can be stored isolated from OS.
   * @platform ios
   */
  readonly secureEnclave: boolean;

  /**
   * Android StrongBox available (Android 9+ with hardware support).
   *
   * When true, keys can use dedicated security processor.
   * @platform android
   */
  readonly strongBox: boolean;

  /**
   * Biometric authentication available (Face/Touch/Fingerprint).
   *
   * When true, can use biometry for secret access protection.
   */
  readonly biometry: boolean;

  /**
   * Device credential authentication available (passcode/PIN/pattern).
   *
   * When false, device has no authentication set up!
   * Should warn user to set device security.
   */
  readonly deviceCredential: boolean;
}

/**
 * Error codes for SensitiveInfo operations.
 *
 * All operations may throw one of these errors. Catch by error code
 * to provide appropriate user feedback.
 *
 * @example
 * ```typescript
 * try {
 *   const item = await getItem('auth-token')
 * } catch (error: any) {
 *   switch (error.code) {
 *     case 'E_NOT_FOUND':
 *       showLoginScreen()
 *       break
 *     case 'E_AUTH_FAILED':
 *       showRetryPrompt()
 *       break
 *     case 'E_KEY_INVALIDATED':
 *       showReauthenticatePrompt()
 *       break
 *     default:
 *       showErrorAlert('Storage error: ' + error.message)
 *   }
 * }
 * ```
 */
export type ErrorCode =
  /**
   * The requested key doesn't exist in the specified service.
   *
   * This is a **normal condition**, not an error. Use `hasItem()` to check
   * existence before accessing, or handle this error gracefully.
   *
   * **Recommended UX**: Redirect to initial setup/login.
   */
  | 'E_NOT_FOUND'

  /**
   * The item was found but has been invalidated (usually due to biometric change).
   *
   * When a user adds/removes/changes biometrics on their device, all
   * keys protected by biometrics are automatically invalidated by the OS.
   *
   * **Recommended UX**: Ask user to re-authenticate and re-save the secret.
   */
  | 'E_KEY_INVALIDATED'

  /**
   * User canceled biometric authentication (touched cancel button).
   *
   * This is a **normal user action**, not a failure.
   *
   * **Recommended UX**: Close the modal, let user try again later.
   */
  | 'E_AUTH_CANCELED'

  /**
   * Biometric authentication failed (wrong fingerprint, face not recognized, etc).
   *
   * The OS allows a few retries before locking out.
   *
   * **Recommended UX**: Show retry message or fallback to passcode.
   */
  | 'E_AUTH_FAILED'

  /**
   * Biometric is locked out after too many failed attempts.
   *
   * User must authenticate with device passcode to unlock.
   *
   * **Recommended UX**: Show message: "Please use device passcode to unlock."
   */
  | 'E_BIOMETRY_LOCKOUT'

  /**
   * Keystore/Keychain is unavailable (corrupted or inaccessible).
   *
   * This is rare and usually indicates serious system issues.
   *
   * **Recommended UX**: Show critical error, suggest device restart.
   */
  | 'E_KEYSTORE_UNAVAILABLE'

  /**
   * Encryption operation failed (possible key corruption).
   *
   * **Recommended UX**: Show error, offer to wipe and reset secrets.
   */
  | 'E_ENCRYPTION_FAILED'

  /**
   * Decryption operation failed (corruption, wrong key, etc).
   *
   * **Recommended UX**: Show error, offer to wipe and reset secrets.
   */
  | 'E_DECRYPTION_FAILED';

/**
 * SensitiveInfoException error structure.
 *
 * Thrown by all SensitiveInfo operations.
 */
export interface SensitiveInfoException extends Error {
  readonly code: ErrorCode;
  readonly message: string;
}

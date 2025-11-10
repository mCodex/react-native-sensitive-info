import type {
  MutationResult,
  SecurityAvailability,
  SensitiveInfoDeleteRequest,
  SensitiveInfoEnumerateRequest,
  SensitiveInfoGetRequest,
  SensitiveInfoHasRequest,
  SensitiveInfoItem,
  SensitiveInfoOptions,
  SensitiveInfoSetRequest,
} from '../sensitive-info.nitro';
import getNativeInstance from '../internal/native';
import { normalizeStorageOptions } from '../hooks/option-validator';
import { isNotFoundError, classifyError } from '../internal/error-classifier';
import { storageValidator } from '../internal/validator';

/**
 * Strongly typed façade around the underlying Nitro native object.
 * Each function handles payload normalization before delegating to native code.
 *
 * All functions in this module are designed to work seamlessly across iOS,
 * Android, and other React Native platforms, automatically adapting to the
 * best available security level (Secure Enclave, StrongBox, or software-backed).
 *
 * @see {@link https://docs.react-native-sensitive-info.dev/guides/basics} for getting started
 */
export interface SensitiveInfoApi {
  readonly setItem: typeof setItem;
  readonly getItem: typeof getItem;
  readonly hasItem: typeof hasItem;
  readonly deleteItem: typeof deleteItem;
  readonly getAllItems: typeof getAllItems;
  readonly clearService: typeof clearService;
  readonly getSupportedSecurityLevels: typeof getSupportedSecurityLevels;
}

/**
 * Persist a secret value in the platform secure storage.
 *
 * Automatically selects the best available security backend:
 * - **iOS**: Keychain with Secure Enclave (iPhone 5s+) or hardware backing
 * - **Android**: Android Keystore with StrongBox (Pixel 3+) or TEE
 *
 * @param key - Unique identifier for this secret (max 255 characters)
 * @param value - The secret data to encrypt and store
 * @param options - Storage configuration including service, access control, and platform-specific settings
 *
 * @returns Promise resolving to mutation metadata describing the applied security policy
 *
 * @throws {Error} If:
 *   - `key` exceeds 255 characters or is empty
 *   - `value` exceeds device storage capacity
 *   - Hardware security is unavailable and fallback is disabled
 *   - User cancels required biometric authentication
 *   - File system permissions are insufficient
 *
 * @example
 * ```ts
 * // Store a token with hardware-backed encryption
 * const result = await setItem('authToken', 'secret-token-value', {
 *   accessControl: 'secureEnclaveBiometry',
 *   service: 'com.example.app'
 * })
 *
 * console.log('Security level:', result.metadata.securityLevel)
 * // Output: 'secureEnclave' or 'strongBox' on capable devices
 *
 * // Store with biometric authentication required
 * await setItem('pinCode', '1234', {
 *   accessControl: 'biometry',
 *   authenticationPrompt: {
 *     title: 'Authenticate to store PIN',
 *     description: 'Face ID required'
 *   }
 * })
 *
 * // Store with device credential fallback
 * await setItem('apiKey', 'my-api-key', {
 *   accessControl: 'deviceCredential'
 * })
 * ```
 *
 * @see {@link getItem} to retrieve stored values
 * @see {@link deleteItem} to remove values
 * @see {@link SensitiveInfoOptions} for available configurations
 * @see {@link MutationResult} to understand the response structure
 *
 * @since 6.0.0
 */
export async function setItem(
  key: string,
  value: string,
  options?: SensitiveInfoOptions
): Promise<MutationResult> {
  try {
    storageValidator.validateSetOperation(key, value, options);
    const native = getNativeInstance();
    const payload: SensitiveInfoSetRequest = {
      key,
      value,
      ...normalizeStorageOptions(options),
    };
    return native.setItem(payload);
  } catch (error) {
    throw classifyError(error, { operation: 'setItem', key });
  }
}

/**
 * Retrieve a previously stored secret.
 *
 * Automatically decrypts the value using the appropriate key (which may
 * require biometric authentication depending on access control settings).
 *
 * Set `includeValue: false` to fetch only metadata without decryption,
 * which is faster and doesn't require authentication.
 *
 * @param key - The identifier of the secret to retrieve
 * @param options - Retrieval configuration including service and value inclusion preference
 *
 * @returns Promise resolving to the stored item with metadata, or `null` if not found
 *
 * @throws {Error} If:
 *   - User cancels required biometric authentication
 *   - The storage is corrupted or inaccessible
 *   - File permissions prevent access
 *   - The decryption key has been invalidated (e.g., biometric enrollment changed)
 *
 * @example
 * ```ts
 * // Retrieve a secret with value decryption
 * const item = await getItem('authToken', { service: 'com.example.session' })
 * if (item) {
 *   console.log('Found:', item.key)
 *   console.log('Value:', item.value)
 *   console.log('Security Level:', item.metadata.securityLevel)
 *   console.log('Last Modified:', new Date(item.metadata.timestamp * 1000))
 * } else {
 *   console.log('Secret not found')
 * }
 *
 * // Fetch metadata only without triggering authentication
 * const metadata = await getItem('apiKey', {
 *   service: 'com.example.session',
 *   includeValue: false
 * })
 * if (metadata) {
 *   console.log('Exists at:', metadata.metadata.timestamp)
 *   console.log('Backend:', metadata.metadata.backend)
 * }
 * ```
 *
 * @see {@link setItem} to store values
 * @see {@link hasItem} for existence checks (lighter weight)
 * @see {@link SensitiveInfoItem} to understand the response structure
 *
 * @since 6.0.0
 */
export async function getItem(
  key: string,
  options?: SensitiveInfoOptions & { includeValue?: boolean }
): Promise<SensitiveInfoItem | null> {
  try {
    storageValidator.validateGetOperation(key, options);
    const native = getNativeInstance();
    const payload: SensitiveInfoGetRequest = {
      key,
      includeValue: options?.includeValue ?? true,
      ...normalizeStorageOptions(options),
    };

    return await native.getItem(payload);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw classifyError(error, { operation: 'getItem', key });
  }
}

/**
 * Check whether a secret exists without retrieving its value.
 *
 * Lightweight operation that doesn't require decryption or authentication,
 * making it ideal for conditional UI logic or existence checks.
 *
 * @param key - The identifier to check
 * @param options - Lookup configuration including service name
 *
 * @returns Promise resolving to `true` if the secret exists, `false` otherwise
 *
 * @throws {Error} If storage access fails (permission errors, corruption, etc.)
 *
 * @example
 * ```ts
 * const exists = await hasItem('refreshToken', { service: 'com.example.session' })
 * if (exists) {
 *   // Token is available, can attempt to use it
 * } else {
 *   // Need to re-authenticate
 *   navigateTo('login')
 * }
 *
 * // Multiple checks
 * const [hasToken, hasPin] = await Promise.all([
 *   hasItem('token', { service: 'auth' }),
 *   hasItem('pinCode', { service: 'security' })
 * ])
 * ```
 *
 * @see {@link getItem} to retrieve the actual value
 * @see {@link deleteItem} to remove a secret
 *
 * @since 6.0.0
 */
export async function hasItem(
  key: string,
  options?: SensitiveInfoOptions
): Promise<boolean> {
  try {
    storageValidator.validateHasOperation(key, options);
    const native = getNativeInstance();
    const payload: SensitiveInfoHasRequest = {
      key,
      ...normalizeStorageOptions(options),
    };
    return native.hasItem(payload);
  } catch (error) {
    throw classifyError(error, { operation: 'hasItem', key });
  }
}

/**
 * Delete a stored secret permanently.
 *
 * The secret is securely erased from platform storage (Keychain or Android Keystore).
 * Once deleted, the value cannot be recovered.
 *
 * @param key - The identifier of the secret to delete
 * @param options - Deletion configuration including service name
 *
 * @returns Promise resolving to `true` if deleted, `false` if not found
 *
 * @throws {Error} If:
 *   - User cancels required biometric authentication
 *   - Storage is corrupted or inaccessible
 *   - File permissions prevent deletion
 *
 * @example
 * ```ts
 * // Delete a specific token
 * const deleted = await deleteItem('authToken', { service: 'com.example.session' })
 * if (deleted) {
 *   console.log('Token removed')
 *   // Redirect to login
 * } else {
 *   console.log('Token not found')
 * }
 *
 * // Logout flow: delete multiple items
 * await Promise.all([
 *   deleteItem('accessToken', { service: 'auth' }),
 *   deleteItem('refreshToken', { service: 'auth' }),
 *   deleteItem('sessionId', { service: 'auth' })
 * ])
 * ```
 *
 * @see {@link clearService} to delete all secrets in a service
 * @see {@link setItem} to store new values
 *
 * @since 6.0.0
 */
export async function deleteItem(
  key: string,
  options?: SensitiveInfoOptions
): Promise<boolean> {
  try {
    storageValidator.validateDeleteOperation(key, options);
    const native = getNativeInstance();
    const payload: SensitiveInfoDeleteRequest = {
      key,
      ...normalizeStorageOptions(options),
    };
    return native.deleteItem(payload);
  } catch (error) {
    throw classifyError(error, { operation: 'deleteItem', key });
  }
}

/**
 * Enumerate all secrets stored under a service.
 *
 * Returns metadata for all secrets in the service, with decrypted values included
 * only if `includeValues: true`. This is useful for:
 * - Inventory checking
 * - Syncing multiple secrets at once
 * - Exporting or migrating data
 *
 * By default, values are omitted for performance and security reasons.
 *
 * @param options - Enumeration configuration including service and value inclusion preference
 *
 * @returns Promise resolving to array of items (empty array if service has no items)
 *
 * @throws {Error} If:
 *   - User cancels biometric authentication (only if `includeValues: true`)
 *   - Storage is corrupted or inaccessible
 *   - File permissions prevent access
 *
 * @example
 * ```ts
 * // Get metadata only (fast, no auth required)
 * const items = await getAllItems({
 *   service: 'com.example.session',
 *   includeValues: false
 * })
 * console.log(`Found ${items.length} secrets`)
 * items.forEach(item => {
 *   console.log(`- ${item.key} (${item.metadata.securityLevel})`)
 * })
 *
 * // Get all items with values (requires potential auth)
 * const sessionData = await getAllItems({
 *   service: 'com.example.session',
 *   includeValues: true
 * })
 * const sessionMap = Object.fromEntries(
 *   sessionData.map(item => [item.key, item.value])
 * )
 *
 * // Check if service has any items
 * const isEmpty = (await getAllItems({ service: 'auth' })).length === 0
 * ```
 *
 * @see {@link clearService} to delete all items
 * @see {@link setItem} to store individual values
 * @see {@link getItem} to retrieve a single value
 *
 * @since 6.0.0
 */
export async function getAllItems(
  options?: SensitiveInfoEnumerateRequest
): Promise<SensitiveInfoItem[]> {
  try {
    storageValidator.validateEnumerateOperation(options);
    const native = getNativeInstance();
    const payload: SensitiveInfoEnumerateRequest = {
      includeValues: options?.includeValues ?? false,
      ...normalizeStorageOptions(options),
    };
    return native.getAllItems(payload);
  } catch (error) {
    throw classifyError(error, { operation: 'getAllItems' });
  }
}

/**
 * Remove every secret associated with a service.
 *
 * This is a bulk delete operation that securely erases all items in the service.
 * Useful for logout flows or when completely resetting stored credentials.
 *
 * All data in the service is permanently removed and cannot be recovered.
 *
 * @param options - Service configuration
 *
 * @returns Promise that resolves when all items are deleted
 *
 * @throws {Error} If:
 *   - User cancels required biometric authentication
 *   - Storage is corrupted or inaccessible
 *   - File permissions prevent deletion
 *
 * @example
 * ```ts
 * // Logout and clear all session data
 * async function logout() {
 *   try {
 *     await clearService({ service: 'com.example.session' })
 *     console.log('All session data cleared')
 *     navigateTo('login')
 *   } catch (error) {
 *     console.error('Logout failed:', error)
 *   }
 * }
 *
 * // Multiple services cleanup
 * await Promise.all([
 *   clearService({ service: 'auth' }),
 *   clearService({ service: 'preferences' }),
 *   clearService({ service: 'cache' })
 * ])
 * ```
 *
 * @see {@link deleteItem} to delete a specific secret
 * @see {@link getAllItems} to list items before clearing
 *
 * @since 6.0.0
 */
export async function clearService(
  options?: SensitiveInfoOptions
): Promise<void> {
  try {
    storageValidator.validateClearOperation(options);
    const native = getNativeInstance();
    return native.clearService(normalizeStorageOptions(options));
  } catch (error) {
    throw classifyError(error, { operation: 'clearService' });
  }
}

/**
 * Inspect which security primitives are available on the current device.
 *
 * This check determines what security levels can be used for future storage operations.
 * Call this during app initialization to understand device capabilities.
 *
 * Results include availability of:
 * - Secure Enclave (iOS 5s+, macOS)
 * - Face ID / Touch ID / Fingerprint recognition
 * - Hardware-backed keys (StrongBox on Android, Secure Enclave on iOS)
 * - Device passcode / PIN / Pattern
 *
 * @returns Promise resolving to availability information for all security backends
 *
 * @throws {Error} If system security queries fail (rare)
 *
 * @example
 * ```ts
 * // Check device capabilities during app startup
 * async function initializeApp() {
 *   const availability = await getSupportedSecurityLevels()
 *
 *   console.log('Device Capabilities:')
 *   console.log(`- Secure Enclave: ${availability.secureEnclave}`)
 *   console.log(`- Biometry: ${availability.biometry}`)
 *   console.log(`- StrongBox: ${availability.strongBox}`)
 *   console.log(`- Device Passcode: ${availability.deviceCredential}`)
 *
 *   // Adapt UI based on capabilities
 *   if (availability.biometry) {
 *     showBiometricOption()
 *   } else if (availability.deviceCredential) {
 *     showPinOption()
 *   } else {
 *     // Fallback to software-only encryption
 *     disableHardwareSecurity()
 *   }
 * }
 *
 * // Feature detection for premium features
 * const support = await getSupportedSecurityLevels()
 * const canUseTopTier = support.secureEnclave && support.biometry
 * ```
 *
 * @see {@link setItem} to store with specific access control
 * @see {@link SensitiveInfoOptions} for access control configuration
 *
 * @since 6.0.0
 */
export function getSupportedSecurityLevels(): Promise<SecurityAvailability> {
  const native = getNativeInstance();
  return native.getSupportedSecurityLevels();
}

/**
 * Convenient namespace exposing the secure storage surface area. Aids tree-shaking when consumers
 * destructure the API.
 */
export const SensitiveInfo: SensitiveInfoApi = {
  setItem,
  getItem,
  hasItem,
  deleteItem,
  getAllItems,
  clearService,
  getSupportedSecurityLevels,
};

export default SensitiveInfo;

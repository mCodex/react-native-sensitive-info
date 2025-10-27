/* eslint-disable no-restricted-exports -- Preserve the default export for backwards compatibility. */

/**
 * Core storage helpers that mirror the native Nitro surface.
 */
export {
  SensitiveInfo,
  clearService,
  deleteItem,
  getAllItems,
  getItem,
  getSupportedSecurityLevels,
  hasItem,
  setItem,
  type SensitiveInfoApi,
} from './core/storage'

export { default } from './core/storage'

/**
 * React hooks and utility types to integrate the secure store with React components.
 */
export {
  HookError,
  useHasSecret,
  useSecret,
  useSecretItem,
  useSecureOperation,
  useSecureStorage,
  useSecurityAvailability,
  type UseHasSecretOptions,
  type UseHasSecretResult,
  type UseSecretItemOptions,
  type UseSecretItemResult,
  type UseSecretOptions,
  type UseSecretResult,
  type UseSecureOperationResult,
  type UseSecureStorageOptions,
  type UseSecureStorageResult,
  type UseSecurityAvailabilityResult,
  type AsyncState,
  type VoidAsyncState,
} from './hooks'

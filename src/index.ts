/* eslint-disable no-restricted-exports -- Preserve the default export for backwards compatibility. */

export type {
  AccessControl,
  AuthenticationPrompt,
  MutationResult,
  SecurityAvailability,
  SecurityLevel,
  SensitiveInfo as SensitiveInfoModule,
  SensitiveInfoSpec,
  SensitiveInfoDeleteRequest,
  SensitiveInfoEnumerateRequest,
  SensitiveInfoGetRequest,
  SensitiveInfoHasRequest,
  SensitiveInfoItem,
  SensitiveInfoOptions,
  SensitiveInfoSetRequest,
  StorageBackend,
  StorageMetadata,
} from './sensitive-info.nitro'

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
  createHookFailureResult,
  createHookSuccessResult,
  useHasSecret,
  useSecret,
  useSecretItem,
  useSecureOperation,
  useSecureStorage,
  useSecurityAvailability,
  type HookFailureResult,
  type HookMutationResult,
  type HookSuccessResult,
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

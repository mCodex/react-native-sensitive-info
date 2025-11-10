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
} from './sensitive-info.nitro';

/**
 * Error classification and handling for type-safe error management.
 */
export {
  SensitiveInfoError,
  ErrorCode,
  isSensitiveInfoError,
  isNotFoundError,
  isAuthenticationCanceledError,
  isBiometryError,
  isSecurityError,
  getErrorMessage,
  classifyError,
} from './internal/error-classifier';

/**
 * Branded types for enhanced type safety.
 */
export {
  createStorageKey,
  createServiceName,
  createStorageValue,
  isStorageKey,
  isServiceName,
  isStorageValue,
  type StorageKey,
  type ServiceName,
  type StorageValue,
} from './internal/branded-types';

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
} from './core/storage';

export { default } from './core/storage';

/**
 * React hooks and utility types to integrate the secure store with React components.
 */
export {
  HookError,
  createHookFailureResult,
  createHookSuccessResult,
  useAsyncOperation,
  useAsyncMutation,
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
  type AsyncOperationState,
  type AsyncOperationResult,
} from './hooks';

/**
 * Key rotation for automatic key management with zero-downtime support.
 */
export {
  initializeKeyRotation,
  rotateKeys,
  getKeyVersion,
  getRotationStatus,
  setRotationPolicy,
  getRotationPolicy,
  migrateToNewKey,
  validateMigration,
  getMigrationPreview,
  reEncryptAllItems,
  on,
  off,
  handleBiometricChange,
  handleCredentialChange,
  type RotationPolicy,
  type RotationStatus,
  type RotationOptions,
  type RotationEvent,
  type RotationStartedEvent,
  type RotationCompletedEvent,
  type RotationFailedEvent,
  type KeyVersion,
  type EncryptedEnvelope,
  type MigrationResult,
  type MigrationOptions,
} from './rotation/rotation-api';

export type {
  BiometricChangeEvent,
  RotationEventCallback,
  RotationAuditEntry,
} from './rotation/types';

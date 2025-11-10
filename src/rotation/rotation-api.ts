/**
 * Key Rotation Public API
 *
 * Provides the main entry points for key rotation functionality.
 * These functions coordinate between the TypeScript business logic
 * and native platform implementations.
 */

import { getRotationManager } from './engine';

import type {
  RotationPolicy,
  RotationStatus,
  RotationOptions,
  RotationEventCallback,
  RotationEvent,
  MigrationResult,
  RotationStartedEvent,
  RotationCompletedEvent,
  RotationFailedEvent,
  KeyVersion,
  EncryptedEnvelope,
} from './types';

import {
  migrateToVersionedEnvelopes,
  validateMigrationReadiness,
  previewMigration,
} from './migration';

import type { MigrationOptions } from './migration';

import getNativeInstance from '../internal/native';

// Re-export all types for public API
export type {
  RotationPolicy,
  RotationStatus,
  RotationOptions,
  RotationEvent,
  RotationStartedEvent,
  RotationCompletedEvent,
  RotationFailedEvent,
  KeyVersion,
  EncryptedEnvelope,
  MigrationResult,
};
export type { MigrationOptions };

// Global rotation manager instance
let rotationManager: ReturnType<typeof getRotationManager> | null = null;

/**
 * Initializes the key rotation system.
 * Should be called once during app startup.
 *
 * @param policy Optional custom rotation policy
 */
export async function initializeKeyRotation(
  policy?: RotationPolicy
): Promise<void> {
  rotationManager = getRotationManager(policy);

  try {
    // Initialize the native rotation system first
    const native = getNativeInstance() as any;

    if (!native.initializeKeyRotation) {
      console.warn('Native rotation API not available. Key rotation disabled.');
      return;
    }

    // Initialize native rotation system with policy settings
    const initRequest = {
      enabled: policy?.enabled ?? true,
      rotationIntervalMs: policy?.rotationIntervalMs,
      rotateOnBiometricChange: policy?.rotateOnBiometricChange,
      rotateOnCredentialChange: policy?.rotateOnCredentialChange,
      manualRotationEnabled: policy?.manualRotationEnabled,
      maxKeyVersions: policy?.maxKeyVersions,
      backgroundReEncryption: policy?.backgroundReEncryption,
    };

    await native.initializeKeyRotation(initRequest);

    // Now get the current rotation status
    const rotationStatus = await native.getRotationStatus();

    if (rotationStatus.currentKeyVersion) {
      rotationManager.initialize(
        rotationStatus.currentKeyVersion,
        rotationStatus.availableKeyVersions || [],
        rotationStatus.lastRotationTimestamp
      );
    }
  } catch (error) {
    console.error('Failed to initialize key rotation:', error);
    throw error;
  }
} /**
 * Initiates a key rotation operation.
 *
 * If rotation is enabled in the policy and the conditions are met,
 * this will:
 * 1. Generate a new key version
 * 2. Re-encrypt all data with the new key
 * 3. Swap old and new keys atomically
 * 4. Clean up old key version after transition period
 *
 * @param options Rotation options (force, reason, metadata)
 * @throws Error if rotation fails or is not available
 *
 * @example
 * ```ts
 * // Manual rotation with custom reason
 * await rotateKeys({ reason: 'security-audit' })
 *
 * // Force rotation bypassing policy checks
 * await rotateKeys({ force: true })
 * ```
 */
export async function rotateKeys(options?: RotationOptions): Promise<void> {
  if (!rotationManager) {
    throw new Error(
      'Key rotation not initialized. Call initializeKeyRotation first.'
    );
  }

  try {
    const native = getNativeInstance() as any;

    // Determine rotation trigger
    const shouldForce = options?.force ?? false;
    const reason = (options?.reason as any) || 'manual';

    if (!shouldForce && !rotationManager.shouldRotate(reason)) {
      throw new Error(`Rotation not needed for reason "${reason}"`);
    }

    // Notify of rotation start
    const currentKeyVersion = rotationManager.getCurrentKeyVersion();
    if (currentKeyVersion) {
      await rotationManager.startRotation(currentKeyVersion, reason, options);
    }

    // Perform actual rotation via native
    const result = await native.rotateKeys({ reason });

    // Mark rotation complete
    await rotationManager.completeRotation(
      result.newKeyVersion,
      result.itemsReEncrypted,
      result.duration
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    if (rotationManager) {
      await rotationManager.failRotation(err);
    }

    throw err;
  }
}

/**
 * Gets the current active key version.
 *
 * @returns The current key version or null if not initialized
 *
 * @example
 * ```ts
 * const version = await getKeyVersion()
 * if (version) {
 *   console.log('Active key version:', version.id)
 * }
 * ```
 */
export async function getKeyVersion(): Promise<string | null> {
  if (!rotationManager) {
    return null;
  }

  const keyVersion = rotationManager.getCurrentKeyVersion();
  return keyVersion?.id ?? null;
}

export async function getRotationStatus(): Promise<RotationStatus> {
  const native = getNativeInstance() as any;

  try {
    const status = await native.getRotationStatus();
    return {
      isRotating: status.isRotating,
      currentKeyVersion: status.currentKeyVersion,
      availableKeyVersions: status.availableKeyVersions,
      lastRotationTimestamp: status.lastRotationTimestamp,
      itemsPendingReEncryption: 0, // TODO: calculate from native
    };
  } catch (error) {
    console.error('Failed to get rotation status:', error);
    return {
      isRotating: false,
      currentKeyVersion: null,
      availableKeyVersions: [],
      lastRotationTimestamp: null,
      itemsPendingReEncryption: 0,
    };
  }
}

/**
 * Updates the rotation policy.
 *
 * @param policy Partial policy updates
 *
 * @example
 * ```ts
 * setRotationPolicy({
 *   enabled: true,
 *   rotationIntervalMs: 30 * 24 * 60 * 60 * 1000, // 30 days
 *   rotateOnBiometricChange: true,
 * })
 * ```
 */
export function setRotationPolicy(policy: Partial<RotationPolicy>): void {
  if (!rotationManager) {
    rotationManager = getRotationManager(policy as any);
    return;
  }

  rotationManager.setRotationPolicy(policy);
}

/**
 * Gets the current rotation policy.
 *
 * @returns Active rotation policy
 */
export function getRotationPolicy(): RotationPolicy {
  if (!rotationManager) {
    throw new Error(
      'Key rotation not initialized. Call initializeKeyRotation first.'
    );
  }

  return rotationManager.getRotationPolicy();
}

/**
 * Registers a callback for rotation lifecycle events.
 *
 * @param eventType Type of event to listen for
 * @param callback Callback function invoked when event occurs
 *
 * @example
 * ```ts
 * onKeyRotationStarted((event) => {
 *   console.log('Rotation started at', event.timestamp)
 * })
 *
 * onKeyRotationCompleted((event) => {
 *   console.log('Rotation completed, re-encrypted', event.itemsReEncrypted, 'items')
 * })
 *
 * onKeyRotationFailed((event) => {
 *   console.error('Rotation failed:', event.reason)
 * })
 * ```
 */
export function on(
  eventType: RotationEvent['type'],
  callback: RotationEventCallback
): void {
  if (!rotationManager) {
    rotationManager = getRotationManager();
  }

  rotationManager.on(eventType, callback);
}

/**
 * Unregisters a rotation event callback.
 */
export function off(
  eventType: RotationEvent['type'],
  callback: RotationEventCallback
): void {
  if (rotationManager) {
    rotationManager.off(eventType, callback);
  }
}

/**
 * Migrates all existing (non-versioned) data to the versioned envelope format.
 *
 * This operation:
 * - Processes items in batches to avoid blocking
 * - Is non-destructive (can be safely run multiple times)
 * - Maintains all encryption and security properties
 * - Supports progress callbacks for long operations
 *
 * @param options Migration options (batch size, progress callback, etc.)
 * @returns Migration result with statistics
 *
 * @example
 * ```ts
 * const result = await migrateToNewKey({
 *   batchSize: 100,
 *   onProgress: (done, total) => console.log(`${done}/${total} items migrated`),
 * })
 *
 * console.log(`Migrated ${result.itemsMigrated} items`)
 * if (!result.success) {
 *   console.error('Some items failed:', result.errors)
 * }
 * ```
 */
export async function migrateToNewKey(
  options?: MigrationOptions
): Promise<MigrationResult> {
  if (!rotationManager) {
    throw new Error(
      'Key rotation not initialized. Call initializeKeyRotation first.'
    );
  }

  const currentKeyVersion = rotationManager.getCurrentKeyVersion();
  if (!currentKeyVersion) {
    throw new Error('No current key version available');
  }

  return migrateToVersionedEnvelopes(currentKeyVersion, options);
}

/**
 * Validates that all data is in versioned format.
 * Useful before relying on migration having completed.
 *
 * @returns Migration readiness statistics
 *
 * @example
 * ```ts
 * const stats = await validateMigration()
 * if (stats.legacyItems > 0) {
 *   console.log('Still have', stats.legacyItems, 'legacy items')
 *   await migrateToNewKey()
 * }
 * ```
 */
export async function validateMigration(options?: MigrationOptions): Promise<{
  totalItems: number;
  legacyItems: number;
  versionedItems: number;
  unreadableItems: number;
}> {
  return validateMigrationReadiness(options);
}

/**
 * Previews what would be migrated without modifying data.
 *
 * @returns Detailed preview of items and their current format
 *
 * @example
 * ```ts
 * const preview = await previewMigration()
 * console.log('Items needing migration:', preview.preview.filter(p => p.needsMigration))
 * ```
 */
export async function getMigrationPreview(options?: MigrationOptions): Promise<{
  preview: Array<{
    key: string;
    service: string;
    needsMigration: boolean;
    currentFormat: 'versioned' | 'legacy' | 'unreadable';
  }>;
}> {
  return previewMigration(options);
}

export async function reEncryptAllItems(
  options?: MigrationOptions & { batchSize?: number }
): Promise<{ itemsReEncrypted: number; errors?: string[] }> {
  const native = getNativeInstance() as any;

  try {
    const result = await native.reEncryptAllItems({
      service: options?.service,
    });

    return {
      itemsReEncrypted: result.itemsReEncrypted,
      errors: result.errors?.map((error: any) => error.error) || [],
    };
  } catch (error) {
    console.error('Re-encryption failed:', error);
    throw error;
  }
}

/**
 * Handles biometric enrollment changes.
 * Typically called from native code when the system detects enrollment changes.
 *
 * @internal
 */
export async function handleBiometricChange(
  platform: 'ios' | 'android'
): Promise<void> {
  if (!rotationManager) {
    return;
  }

  await rotationManager.handleBiometricChange(platform);

  // Trigger rotation if policy allows
  if (rotationManager.shouldRotate('biometric-change')) {
    try {
      await rotateKeys({ reason: 'security-audit' });
    } catch (error) {
      console.error('Auto-rotation after biometric change failed:', error);
    }
  }
}

/**
 * Handles device credential changes.
 * Typically called from native code when the system detects credential changes.
 *
 * @internal
 */
export async function handleCredentialChange(
  platform: 'ios' | 'android'
): Promise<void> {
  if (!rotationManager) {
    return;
  }

  await rotationManager.handleCredentialChange(platform);

  // Trigger rotation if policy allows
  if (rotationManager.shouldRotate('credential-change')) {
    try {
      await rotateKeys({ reason: 'security-audit' });
    } catch (error) {
      console.error('Auto-rotation after credential change failed:', error);
    }
  }
}

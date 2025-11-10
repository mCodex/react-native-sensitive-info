/**
 * Key Rotation Engine
 *
 * Platform-agnostic rotation logic that coordinates:
 * - Key versioning and lifecycle management
 * - Rotation trigger detection (time-based, biometric changes, manual)
 * - DEK/KEK separation and envelope management
 * - Backward compatibility with legacy (non-versioned) data
 * - Zero-downtime rotation with dual-key support
 */

import type {
  KeyVersion,
  RotationPolicy,
  RotationStatus,
  RotationEvent,
  RotationEventCallback,
  RotationOptions,
  RotationAuditEntry,
  BiometricChangeEvent,
} from './types';

/** Default rotation policy: 90 days, manual rotation allowed */
const DEFAULT_ROTATION_POLICY: RotationPolicy = {
  enabled: true,
  rotationIntervalMs: 90 * 24 * 60 * 60 * 1000, // 90 days
  rotateOnBiometricChange: true,
  rotateOnCredentialChange: true,
  manualRotationEnabled: true,
  maxKeyVersions: 2,
  backgroundReEncryption: true,
};

interface RotationManagerState {
  policy: RotationPolicy;
  currentKeyVersion: KeyVersion | null;
  availableKeyVersions: KeyVersion[];
  lastRotationTimestamp: string | null;
  isRotating: boolean;
  auditLog: RotationAuditEntry[];
  eventCallbacks: Map<string, RotationEventCallback[]>;
}

/**
 * KeyRotationManager coordinates all rotation operations.
 * This is platform-agnostic and relies on platform-specific implementations
 * for actual key generation/storage via native modules.
 */
export class KeyRotationManager {
  private state: RotationManagerState;

  private readonly maxAuditLogEntries = 1000;

  constructor(policy: RotationPolicy = DEFAULT_ROTATION_POLICY) {
    this.state = {
      policy: { ...policy },
      currentKeyVersion: null,
      availableKeyVersions: [],
      lastRotationTimestamp: null,
      isRotating: false,
      auditLog: [],
      eventCallbacks: this.createDefaultCallbacks(),
    };
  }

  /**
   * Initializes the rotation manager with the current key state.
   * Called once during app startup after native modules are loaded.
   */
  public initialize(
    currentKeyVersion: KeyVersion,
    availableKeyVersions: KeyVersion[],
    lastRotationTimestamp: string | null
  ): void {
    this.state.currentKeyVersion = currentKeyVersion;
    this.state.availableKeyVersions = availableKeyVersions;
    this.state.lastRotationTimestamp = lastRotationTimestamp;

    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      eventType: 'key_generated',
      keyVersion: currentKeyVersion.id,
      details: { availableVersions: availableKeyVersions.length },
    });
  }

  /**
   * Registers a callback to be invoked for rotation events.
   */
  public on(
    eventType: RotationEvent['type'],
    callback: RotationEventCallback
  ): void {
    if (!this.state.eventCallbacks.has(eventType)) {
      this.state.eventCallbacks.set(eventType, []);
    }
    this.state.eventCallbacks.get(eventType)!.push(callback);
  }

  /**
   * Removes a callback.
   */
  public off(
    eventType: RotationEvent['type'],
    callback: RotationEventCallback
  ): void {
    const callbacks = this.state.eventCallbacks.get(eventType);
    if (!callbacks) return;

    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Creates default event callbacks map.
   * @private
   */
  private createDefaultCallbacks(): Map<string, RotationEventCallback[]> {
    return new Map([
      ['rotation:started', []],
      ['rotation:completed', []],
      ['rotation:failed', []],
      ['biometric-change', []],
      ['credential-change', []],
    ]);
  }

  /**
   * Emits a rotation event to all registered callbacks.
   */
  private async emitEvent(event: RotationEvent): Promise<void> {
    const callbacks = this.state.eventCallbacks.get(event.type) || [];
    await Promise.all(callbacks.map((cb) => Promise.resolve(cb(event))));
  }

  /**
   * Updates the rotation policy.
   */
  public setRotationPolicy(policy: Partial<RotationPolicy>): void {
    this.state.policy = { ...this.state.policy, ...policy };
  }

  /**
   * Returns the current rotation policy.
   */
  public getRotationPolicy(): RotationPolicy {
    return { ...this.state.policy };
  }

  /**
   * Gets the current rotation status snapshot.
   */
  public getRotationStatus(): RotationStatus {
    return {
      isRotating: this.state.isRotating,
      currentKeyVersion: this.state.currentKeyVersion,
      availableKeyVersions: [...this.state.availableKeyVersions],
      lastRotationTimestamp: this.state.lastRotationTimestamp,
      itemsPendingReEncryption: 0, // Calculated by caller if needed
    };
  }

  /**
   * Determines if rotation is needed based on policy and current state.
   */
  public shouldRotate(
    reason:
      | 'time-based'
      | 'biometric-change'
      | 'credential-change' = 'time-based'
  ): boolean {
    if (!this.state.policy.enabled) {
      return false;
    }

    if (!this.state.currentKeyVersion || !this.state.lastRotationTimestamp) {
      return false; // No previous rotation recorded
    }

    switch (reason) {
      case 'time-based': {
        if (!this.state.policy.enabled) return false;
        const lastRotation = new Date(
          this.state.lastRotationTimestamp
        ).getTime();
        const now = Date.now();
        return now - lastRotation > this.state.policy.rotationIntervalMs;
      }

      case 'biometric-change':
        return this.state.policy.rotateOnBiometricChange;

      case 'credential-change':
        return this.state.policy.rotateOnCredentialChange;

      default:
        return false;
    }
  }

  /**
   * Initiates a key rotation operation.
   * Returns immediately; actual rotation happens asynchronously via native modules.
   *
   * @param newKeyVersion The newly generated key version
   * @param reason Why rotation is happening
   * @param options Additional rotation context
   */
  public async startRotation(
    newKeyVersion: KeyVersion,
    reason: 'time-based' | 'biometric-change' | 'credential-change' | 'manual',
    options?: RotationOptions
  ): Promise<void> {
    if (
      !this.state.policy.manualRotationEnabled &&
      reason === 'manual' &&
      !options?.force
    ) {
      throw new Error('Manual rotation is disabled by policy');
    }

    if (this.state.isRotating) {
      throw new Error('Rotation already in progress');
    }

    if (!this.state.currentKeyVersion) {
      throw new Error('Current key version not initialized');
    }

    this.state.isRotating = true;
    const oldKeyVersion = this.state.currentKeyVersion;

    const event: RotationEvent = {
      type: 'rotation:started',
      timestamp: new Date().toISOString(),
      reason,
      currentKeyVersion: oldKeyVersion,
      newKeyVersion,
    };

    await this.emitEvent(event);

    this.logAuditEntry({
      timestamp: event.timestamp,
      eventType: 'key_rotated',
      keyVersion: newKeyVersion.id,
      details: { reason, previous: oldKeyVersion.id, ...options?.metadata },
    });
  }

  /**
   * Marks rotation as completed.
   * Called by native modules after successfully switching keys.
   */
  public async completeRotation(
    newKeyVersion: KeyVersion,
    itemsReEncrypted: number,
    duration: number
  ): Promise<void> {
    if (!this.state.isRotating) {
      throw new Error('No rotation in progress');
    }

    if (!this.state.currentKeyVersion) {
      throw new Error('Current key version not initialized');
    }

    const oldKeyVersion = this.state.currentKeyVersion;

    // Update current key
    this.state.currentKeyVersion = newKeyVersion;
    this.state.lastRotationTimestamp = new Date().toISOString();

    // Maintain available versions for transition period
    const updatedVersions = [
      newKeyVersion,
      ...this.state.availableKeyVersions.filter(
        (v) => v.id !== oldKeyVersion.id && v.id !== newKeyVersion.id
      ),
    ];

    // Enforce max version retention
    while (
      updatedVersions.length > this.state.policy.maxKeyVersions &&
      updatedVersions[updatedVersions.length - 1]
    ) {
      updatedVersions.pop();
    }

    this.state.availableKeyVersions = updatedVersions;
    this.state.isRotating = false;

    const event: RotationEvent = {
      type: 'rotation:completed',
      timestamp: new Date().toISOString(),
      oldKeyVersion,
      newKeyVersion,
      duration,
      itemsReEncrypted,
    };

    await this.emitEvent(event);

    this.logAuditEntry({
      timestamp: event.timestamp,
      eventType: 'migration_completed',
      keyVersion: newKeyVersion.id,
      itemsAffected: itemsReEncrypted,
      details: { duration, previousVersion: oldKeyVersion.id },
    });
  }

  /**
   * Marks rotation as failed.
   * Called by native modules if rotation encounters unrecoverable errors.
   */
  public async failRotation(
    error: Error,
    recoverable: boolean = true
  ): Promise<void> {
    if (!this.state.isRotating) {
      return; // Already failed or completed
    }

    this.state.isRotating = false;

    const event: RotationEvent = {
      type: 'rotation:failed',
      timestamp: new Date().toISOString(),
      reason: error.message,
      error,
      recoverable,
    };

    await this.emitEvent(event);

    this.logAuditEntry({
      timestamp: event.timestamp,
      eventType: 'rotation_failed',
      error: error.message,
      details: { recoverable },
    });
  }

  /**
   * Handles biometric enrollment changes (iOS Face ID/Touch ID or Android biometric sensor changes).
   * Triggers key rotation if policy allows.
   */
  public async handleBiometricChange(
    platform: 'ios' | 'android'
  ): Promise<void> {
    if (!this.state.policy.rotateOnBiometricChange) {
      return;
    }

    const event: BiometricChangeEvent = {
      type: 'biometric-change',
      timestamp: new Date().toISOString(),
      platform,
      actionRequired: true,
    };

    await this.emitEvent(event);

    this.logAuditEntry({
      timestamp: event.timestamp,
      eventType: 'biometric_enrollment_changed',
      details: { platform },
    });
  }

  /**
   * Handles device credential changes (iOS passcode or Android password/PIN changes).
   */
  public async handleCredentialChange(
    platform: 'ios' | 'android'
  ): Promise<void> {
    if (!this.state.policy.rotateOnCredentialChange) {
      return;
    }

    const event: BiometricChangeEvent = {
      type: 'credential-change',
      timestamp: new Date().toISOString(),
      platform,
      actionRequired: true,
    };

    await this.emitEvent(event);

    this.logAuditEntry({
      timestamp: event.timestamp,
      eventType: 'device_credential_changed',
      details: { platform },
    });
  }

  /**
   * Determines which key version should be used to decrypt an envelope.
   * Searches through available key versions in reverse chronological order.
   */
  public findKeyVersionForDecryption(
    envelopeKEKVersion: string
  ): KeyVersion | null {
    // First, check if current key matches
    // First, check if current key matches
    if (this.state.currentKeyVersion?.id === envelopeKEKVersion) {
      return this.state.currentKeyVersion;
    }

    // Search through available versions
    return (
      this.state.availableKeyVersions.find(
        (v) => v.id === envelopeKEKVersion
      ) || null
    );
  }

  /**
   * Gets the current active key version for new encryptions.
   */
  public getCurrentKeyVersion(): KeyVersion | null {
    return this.state.currentKeyVersion;
  }

  /**
   * Gets all available key versions during transition period.
   */
  public getAvailableKeyVersions(): KeyVersion[] {
    return [...this.state.availableKeyVersions];
  }

  /**
   * Adds a new key version to the available set.
   * Typically called during initialization or after successful rotation.
   */
  public addKeyVersion(keyVersion: KeyVersion): void {
    if (!this.state.availableKeyVersions.find((v) => v.id === keyVersion.id)) {
      this.state.availableKeyVersions.push(keyVersion);
      // Sort by timestamp descending (newest first)
      this.state.availableKeyVersions.sort((a, b) => b.timestamp - a.timestamp);
    }
  }

  /**
   * Removes a key version from the available set.
   * Called during cleanup after transition period expires.
   */
  public removeKeyVersion(keyVersionId: string): void {
    this.state.availableKeyVersions = this.state.availableKeyVersions.filter(
      (v) => v.id !== keyVersionId
    );

    this.logAuditEntry({
      timestamp: new Date().toISOString(),
      eventType: 'key_deleted',
      keyVersion: keyVersionId,
    });
  }

  /**
   * Logs an audit entry for compliance and debugging.
   */
  private logAuditEntry(entry: RotationAuditEntry): void {
    this.state.auditLog.push(entry);

    // Maintain max log size
    if (this.state.auditLog.length > this.maxAuditLogEntries) {
      this.state.auditLog = this.state.auditLog.slice(-this.maxAuditLogEntries);
    }
  }

  /**
   * Retrieves audit log entries (typically for compliance/debugging).
   * Optionally filtered by event type or time range.
   */
  public getAuditLog(options?: {
    eventType?: string;
    since?: string;
    limit?: number;
  }): RotationAuditEntry[] {
    let entries = [...this.state.auditLog];

    if (options?.eventType) {
      entries = entries.filter((e) => e.eventType === options.eventType);
    }

    if (options?.since) {
      const sinceTime = new Date(options.since).getTime();
      entries = entries.filter(
        (e) => new Date(e.timestamp).getTime() >= sinceTime
      );
    }

    if (options?.limit) {
      entries = entries.slice(-options.limit);
    }

    return entries;
  }

  /**
   * Clears the audit log (typically for testing).
   */
  public clearAuditLog(): void {
    this.state.auditLog = [];
  }
}

// Singleton instance
let rotationManager: KeyRotationManager | null = null;

/**
 * Gets or creates the global rotation manager instance.
 */
export function getRotationManager(
  policy?: RotationPolicy
): KeyRotationManager {
  if (!rotationManager) {
    rotationManager = new KeyRotationManager(policy);
  }
  return rotationManager;
}

/**
 * Resets the rotation manager (primarily for testing).
 */
export function resetRotationManager(): void {
  rotationManager = null;
}

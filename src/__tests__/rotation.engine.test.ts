/**
 * Unit Tests for Key Rotation Engine
 *
 * Tests core rotation logic including:
 * - Key versioning and lifecycle
 * - Rotation policy enforcement
 * - DEK/KEK envelope management
 * - Event emission and callbacks
 * - Audit logging
 */

import {
  KeyRotationManager,
  getRotationManager,
  resetRotationManager,
} from '../rotation/engine';

import type {
  KeyVersion,
  RotationPolicy,
  RotationEvent,
} from '../rotation/types';

describe('KeyRotationManager', () => {
  beforeEach(() => {
    resetRotationManager();
  });

  describe('initialization', () => {
    it('should create manager with default policy', () => {
      const manager = new KeyRotationManager();
      const policy = manager.getRotationPolicy();

      expect(policy.enabled).toBe(true);
      expect(policy.rotationIntervalMs).toBeGreaterThan(0);
      expect(policy.maxKeyVersions).toBe(2);
    });

    it('should create manager with custom policy', () => {
      const customPolicy: RotationPolicy = {
        enabled: true,
        rotationIntervalMs: 30 * 24 * 60 * 60 * 1000, // 30 days
        rotateOnBiometricChange: false,
        rotateOnCredentialChange: false,
        manualRotationEnabled: true,
        maxKeyVersions: 3,
        backgroundReEncryption: true,
      };

      const manager = new KeyRotationManager(customPolicy);
      const policy = manager.getRotationPolicy();

      expect(policy.rotationIntervalMs).toBe(30 * 24 * 60 * 60 * 1000);
      expect(policy.maxKeyVersions).toBe(3);
      expect(policy.rotateOnBiometricChange).toBe(false);
    });

    it('should return null for uninitialized key version', () => {
      const manager = new KeyRotationManager();
      expect(manager.getCurrentKeyVersion()).toBeNull();
    });
  });

  describe('key initialization', () => {
    it('should initialize with key versions', () => {
      const manager = new KeyRotationManager();
      const now = Date.now();
      const keyVersion: KeyVersion = {
        id: '2025-01-01T00:00:00Z',
        timestamp: now,
        isActive: true,
      };

      manager.initialize(keyVersion, [keyVersion], new Date().toISOString());

      expect(manager.getCurrentKeyVersion()).toEqual(keyVersion);
      expect(manager.getAvailableKeyVersions()).toContainEqual(keyVersion);
    });

    it('should log audit entry on initialization', () => {
      const manager = new KeyRotationManager();
      const keyVersion: KeyVersion = {
        id: '2025-01-01T00:00:00Z',
        timestamp: Date.now(),
        isActive: true,
      };

      manager.initialize(keyVersion, [keyVersion], null);

      const auditLog = manager.getAuditLog();
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0]?.eventType).toBe('key_generated');
    });
  });

  describe('rotation policy', () => {
    it('should set and get rotation policy', () => {
      const manager = new KeyRotationManager();
      const newPolicy: Partial<RotationPolicy> = {
        rotationIntervalMs: 60 * 24 * 60 * 60 * 1000, // 60 days
        rotateOnBiometricChange: false,
      };

      manager.setRotationPolicy(newPolicy);
      const policy = manager.getRotationPolicy();

      expect(policy.rotationIntervalMs).toBe(60 * 24 * 60 * 60 * 1000);
      expect(policy.rotateOnBiometricChange).toBe(false);
      // Other fields should remain unchanged
      expect(policy.enabled).toBe(true);
    });

    it('should not rotate if disabled', () => {
      const manager = new KeyRotationManager({
        enabled: false,
        rotationIntervalMs: 1000,
        rotateOnBiometricChange: false,
        rotateOnCredentialChange: false,
        manualRotationEnabled: true,
        maxKeyVersions: 2,
        backgroundReEncryption: true,
      });

      const keyVersion: KeyVersion = {
        id: '2025-01-01T00:00:00Z',
        timestamp: Date.now() - 10000,
        isActive: true,
      };

      manager.initialize(
        keyVersion,
        [keyVersion],
        new Date(Date.now() - 10000).toISOString()
      );

      expect(manager.shouldRotate('time-based')).toBe(false);
    });
  });

  describe('rotation timing', () => {
    it('should detect time-based rotation need', () => {
      const manager = new KeyRotationManager({
        enabled: true,
        rotationIntervalMs: 1000, // 1 second for testing
        rotateOnBiometricChange: false,
        rotateOnCredentialChange: false,
        manualRotationEnabled: true,
        maxKeyVersions: 2,
        backgroundReEncryption: true,
      });

      const keyVersion: KeyVersion = {
        id: '2025-01-01T00:00:00Z',
        timestamp: Date.now() - 10000, // 10 seconds ago
        isActive: true,
      };

      manager.initialize(
        keyVersion,
        [keyVersion],
        new Date(Date.now() - 10000).toISOString()
      );

      expect(manager.shouldRotate('time-based')).toBe(true);
    });

    it('should not rotate before interval expires', () => {
      const manager = new KeyRotationManager({
        enabled: true,
        rotationIntervalMs: 1000 * 60 * 60, // 1 hour
        rotateOnBiometricChange: false,
        rotateOnCredentialChange: false,
        manualRotationEnabled: true,
        maxKeyVersions: 2,
        backgroundReEncryption: true,
      });

      const keyVersion: KeyVersion = {
        id: '2025-01-01T00:00:00Z',
        timestamp: Date.now() - 1000, // 1 second ago
        isActive: true,
      };

      manager.initialize(
        keyVersion,
        [keyVersion],
        new Date(Date.now() - 1000).toISOString()
      );

      expect(manager.shouldRotate('time-based')).toBe(false);
    });

    it('should respect biometric rotation policy', () => {
      const manager = new KeyRotationManager({
        enabled: true,
        rotationIntervalMs: 90 * 24 * 60 * 60 * 1000,
        rotateOnBiometricChange: true,
        rotateOnCredentialChange: false,
        manualRotationEnabled: true,
        maxKeyVersions: 2,
        backgroundReEncryption: true,
      });

      expect(manager.shouldRotate('biometric-change')).toBe(true);
      expect(manager.shouldRotate('credential-change')).toBe(false);
    });
  });

  describe('rotation lifecycle', () => {
    it('should start and complete rotation', async () => {
      const manager = new KeyRotationManager();
      const oldKeyVersion: KeyVersion = {
        id: '2025-01-01T00:00:00Z',
        timestamp: Date.now(),
        isActive: true,
      };
      const newKeyVersion: KeyVersion = {
        id: '2025-02-01T00:00:00Z',
        timestamp: Date.now() + 1000,
        isActive: true,
      };

      manager.initialize(
        oldKeyVersion,
        [oldKeyVersion],
        new Date().toISOString()
      );

      let startedEvent: RotationEvent | null = null;
      let completedEvent: RotationEvent | null = null;

      manager.on('rotation:started', (e) => {
        startedEvent = e;
      });
      manager.on('rotation:completed', (e) => {
        completedEvent = e;
      });

      await manager.startRotation(newKeyVersion, 'manual');
      await manager.completeRotation(newKeyVersion, 42, 1000);

      expect(startedEvent).not.toBeNull();
      expect(startedEvent!.type).toBe('rotation:started');

      expect(completedEvent).not.toBeNull();
      expect(completedEvent!.type).toBe('rotation:completed');
      expect(manager.getCurrentKeyVersion()?.id).toBe(newKeyVersion.id);
    });

    it('should fail rotation gracefully', async () => {
      const manager = new KeyRotationManager();
      const oldKeyVersion: KeyVersion = {
        id: '2025-01-01T00:00:00Z',
        timestamp: Date.now(),
        isActive: true,
      };
      const newKeyVersion: KeyVersion = {
        id: '2025-02-01T00:00:00Z',
        timestamp: Date.now() + 1000,
        isActive: true,
      };

      manager.initialize(
        oldKeyVersion,
        [oldKeyVersion],
        new Date().toISOString()
      );

      let failedEvent: RotationEvent | null = null;

      manager.on('rotation:failed', (e) => {
        failedEvent = e;
      });

      await manager.startRotation(newKeyVersion, 'manual');

      const error = new Error('Test error');
      await manager.failRotation(error, true);

      expect(failedEvent).not.toBeNull();
      expect(failedEvent!.type).toBe('rotation:failed');
      expect(manager.getCurrentKeyVersion()?.id).toBe(oldKeyVersion.id);
    });

    it('should prevent concurrent rotations', async () => {
      const manager = new KeyRotationManager();
      const keyVersion1: KeyVersion = {
        id: '2025-01-01T00:00:00Z',
        timestamp: Date.now(),
        isActive: true,
      };
      const keyVersion2: KeyVersion = {
        id: '2025-02-01T00:00:00Z',
        timestamp: Date.now() + 1000,
        isActive: true,
      };
      const keyVersion3: KeyVersion = {
        id: '2025-03-01T00:00:00Z',
        timestamp: Date.now() + 2000,
        isActive: true,
      };

      manager.initialize(keyVersion1, [keyVersion1], new Date().toISOString());

      await manager.startRotation(keyVersion2, 'manual');

      // Second rotation should fail
      await expect(
        manager.startRotation(keyVersion3, 'manual')
      ).rejects.toThrow('Rotation already in progress');
    });
  });

  describe('key version management', () => {
    it('should maintain available key versions', () => {
      const manager = new KeyRotationManager();
      const keyVersion1: KeyVersion = {
        id: '2025-01-01T00:00:00Z',
        timestamp: Date.now(),
        isActive: true,
      };
      const keyVersion2: KeyVersion = {
        id: '2025-02-01T00:00:00Z',
        timestamp: Date.now() + 1000,
        isActive: true,
      };

      manager.addKeyVersion(keyVersion1);
      manager.addKeyVersion(keyVersion2);

      const versions = manager.getAvailableKeyVersions();
      expect(versions).toHaveLength(2);
    });

    it('should not add duplicate key versions', () => {
      const manager = new KeyRotationManager();
      const keyVersion: KeyVersion = {
        id: '2025-01-01T00:00:00Z',
        timestamp: Date.now(),
        isActive: true,
      };

      manager.addKeyVersion(keyVersion);
      manager.addKeyVersion(keyVersion);

      const versions = manager.getAvailableKeyVersions();
      expect(versions).toHaveLength(1);
    });

    it('should remove key versions', () => {
      const manager = new KeyRotationManager();
      const keyVersion: KeyVersion = {
        id: '2025-01-01T00:00:00Z',
        timestamp: Date.now(),
        isActive: true,
      };

      manager.addKeyVersion(keyVersion);
      expect(manager.getAvailableKeyVersions()).toHaveLength(1);

      manager.removeKeyVersion(keyVersion.id);
      expect(manager.getAvailableKeyVersions()).toHaveLength(0);
    });

    it('should find key version for decryption', () => {
      const manager = new KeyRotationManager();
      const keyVersion1: KeyVersion = {
        id: 'key-v1',
        timestamp: Date.now(),
        isActive: false,
      };
      const keyVersion2: KeyVersion = {
        id: 'key-v2',
        timestamp: Date.now() + 1000,
        isActive: true,
      };

      manager.initialize(keyVersion2, [keyVersion1, keyVersion2], null);

      const envelope = {
        version: 2,
        encryptedDEK: 'abc123',
        KEKVersion: 'key-v1',
        timestamp: new Date().toISOString(),
        algorithm: 'AES-256-CBC',
      };

      const found = manager.findKeyVersionForDecryption(
        JSON.stringify(envelope)
      );
      expect(found?.id).toBe('key-v1');
    });
  });

  describe('event callbacks', () => {
    it('should emit rotation started event', async () => {
      const manager = new KeyRotationManager();
      const keyVersion1: KeyVersion = {
        id: 'key-v1',
        timestamp: Date.now(),
        isActive: true,
      };
      const keyVersion2: KeyVersion = {
        id: 'key-v2',
        timestamp: Date.now() + 1000,
        isActive: true,
      };

      manager.initialize(keyVersion1, [keyVersion1], null);

      const events: RotationEvent[] = [];
      manager.on('rotation:started', (e) => {
        events.push(e);
      });

      await manager.startRotation(keyVersion2, 'manual', {
        metadata: { test: true },
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe('rotation:started');
    });

    it('should handle multiple event callbacks', async () => {
      const manager = new KeyRotationManager();
      const keyVersion1: KeyVersion = {
        id: 'key-v1',
        timestamp: Date.now(),
        isActive: true,
      };
      const keyVersion2: KeyVersion = {
        id: 'key-v2',
        timestamp: Date.now() + 1000,
        isActive: true,
      };

      manager.initialize(keyVersion1, [keyVersion1], null);

      const callCount = { cb1: 0, cb2: 0 };

      manager.on('rotation:started', () => {
        callCount.cb1++;
      });
      manager.on('rotation:started', () => {
        callCount.cb2++;
      });

      await manager.startRotation(keyVersion2, 'manual');

      expect(callCount.cb1).toBe(1);
      expect(callCount.cb2).toBe(1);
    });

    it('should unregister event callbacks', async () => {
      const manager = new KeyRotationManager();
      const keyVersion1: KeyVersion = {
        id: 'key-v1',
        timestamp: Date.now(),
        isActive: true,
      };
      const keyVersion2: KeyVersion = {
        id: 'key-v2',
        timestamp: Date.now() + 1000,
        isActive: true,
      };

      manager.initialize(keyVersion1, [keyVersion1], null);

      const callback = jest.fn();
      manager.on('rotation:started', callback);
      manager.off('rotation:started', callback);

      await manager.startRotation(keyVersion2, 'manual');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('audit logging', () => {
    it('should log rotation events', async () => {
      const manager = new KeyRotationManager();
      const keyVersion1: KeyVersion = {
        id: 'key-v1',
        timestamp: Date.now(),
        isActive: true,
      };
      const keyVersion2: KeyVersion = {
        id: 'key-v2',
        timestamp: Date.now() + 1000,
        isActive: true,
      };

      manager.initialize(keyVersion1, [keyVersion1], null);

      await manager.startRotation(keyVersion2, 'manual');
      await manager.completeRotation(keyVersion2, 100, 5000);

      const auditLog = manager.getAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog.some((e) => e.eventType === 'key_rotated')).toBe(true);
    });

    it('should filter audit log by event type', async () => {
      const manager = new KeyRotationManager();
      const keyVersion: KeyVersion = {
        id: 'key-v1',
        timestamp: Date.now(),
        isActive: true,
      };

      manager.initialize(keyVersion, [keyVersion], null);
      manager.removeKeyVersion('key-v1');

      const auditLog = manager.getAuditLog({
        eventType: 'key_deleted',
      });
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0]?.eventType).toBe('key_deleted');
    });

    it('should limit audit log size', () => {
      const manager = new KeyRotationManager();
      const keyVersion: KeyVersion = {
        id: 'key-v1',
        timestamp: Date.now(),
        isActive: true,
      };

      manager.initialize(keyVersion, [keyVersion], null);

      // Add many entries
      for (let i = 0; i < 2000; i++) {
        manager.removeKeyVersion(`key-${i}`);
      }

      const auditLog = manager.getAuditLog();
      expect(auditLog.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance via getRotationManager', () => {
      const manager1 = getRotationManager();
      const manager2 = getRotationManager();

      expect(manager1).toBe(manager2);
    });

    it('should reset singleton', () => {
      const manager1 = getRotationManager();
      resetRotationManager();
      const manager2 = getRotationManager();

      expect(manager1).not.toBe(manager2);
    });
  });

  describe('status snapshot', () => {
    it('should return current rotation status', () => {
      const manager = new KeyRotationManager();
      const keyVersion: KeyVersion = {
        id: 'key-v1',
        timestamp: Date.now(),
        isActive: true,
      };

      manager.initialize(keyVersion, [keyVersion], new Date().toISOString());

      const status = manager.getRotationStatus();

      expect(status.isRotating).toBe(false);
      expect(status.currentKeyVersion?.id).toBe('key-v1');
      expect(status.availableKeyVersions).toHaveLength(1);
    });
  });
});

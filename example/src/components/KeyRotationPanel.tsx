import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RotationEvent } from 'react-native-sensitive-info';
import {
  initializeKeyRotation,
  rotateKeys,
  reEncryptAllItems,
  getRotationStatus,
  on,
} from 'react-native-sensitive-info';
import Card from './Card';
import ActionButton from './ActionButton';
import { formatError } from '../utils/formatError';

interface RotationStatusInfo {
  isRotating: boolean;
  currentKeyVersion: string | null;
  availableKeyVersions: number;
  lastRotationTimestamp: string | null;
}

const styles = StyleSheet.create({
  description: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  statusContainer: {
    marginTop: 14,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  statusDetail: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  messageBubble: {
    marginTop: 12,
    backgroundColor: '#0f172a0d',
    borderRadius: 12,
    padding: 12,
    minHeight: 60,
    justifyContent: 'center',
  },
  messageText: {
    fontSize: 13,
    color: '#0f172a',
    lineHeight: 18,
  },
  infoBox: {
    marginTop: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 8,
  },
  infoItem: {
    fontSize: 12,
    color: '#15803d',
    marginBottom: 4,
    lineHeight: 16,
  },
});

interface KeyRotationPanelProps {
  service: string;
}

const KeyRotationPanel: React.FC<KeyRotationPanelProps> = ({ service }) => {
  const [statusMessage, setStatusMessage] = useState(
    'Key rotation not initialized'
  );
  const [rotationStatus, setRotationStatus] =
    useState<RotationStatusInfo | null>(null);
  const [pending, setPending] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize key rotation system
  const handleInitialize = useCallback(async () => {
    setPending(true);
    try {
      await initializeKeyRotation({
        enabled: true,
        rotationIntervalMs: 30 * 24 * 60 * 60 * 1000, // 30 days for demo
        rotateOnBiometricChange: true,
        rotateOnCredentialChange: true,
        manualRotationEnabled: true,
        maxKeyVersions: 2,
        backgroundReEncryption: true,
      });

      // Set up event listeners
      on('rotation:started', (event: RotationEvent) => {
        if (event.type === 'rotation:started') {
          setStatusMessage(
            `🔄 Rotation started (${event.reason}) at ${event.timestamp}`
          );
        }
      });

      on('rotation:completed', (event: RotationEvent) => {
        if (event.type === 'rotation:completed') {
          setStatusMessage(
            `✅ Rotation completed! Re-encrypted ${event.itemsReEncrypted} items in ${event.duration}ms`
          );
        }
      });

      on('rotation:failed', (event: RotationEvent) => {
        if (event.type === 'rotation:failed') {
          setStatusMessage(`❌ Rotation failed: ${event.reason}`);
        }
      });

      on('biometric-change', (event: RotationEvent) => {
        if (
          event.type === 'biometric-change' ||
          event.type === 'credential-change'
        ) {
          setStatusMessage(
            `🔐 Change detected on ${event.platform}. Rotation may be triggered.`
          );
        }
      });

      setStatusMessage('✅ Key rotation system initialized successfully');
      setIsInitialized(true);
    } catch (err) {
      setStatusMessage(`Failed to initialize: ${formatError(err)}`);
    } finally {
      setPending(false);
    }
  }, []);

  // Perform manual key rotation
  const handleManualRotation = useCallback(async () => {
    setPending(true);
    try {
      setStatusMessage('🔄 Starting manual key rotation...');

      await rotateKeys({
        reason: 'User-initiated rotation from demo app',
        metadata: {
          demo: true,
          timestamp: new Date().toISOString(),
        },
      });

      setStatusMessage('✅ Key rotation completed successfully');

      // Refresh rotation status
      const newStatus = await getRotationStatus();
      setRotationStatus({
        isRotating: newStatus.isRotating,
        currentKeyVersion: newStatus.currentKeyVersion?.id ?? null,
        availableKeyVersions: newStatus.availableKeyVersions.length,
        lastRotationTimestamp: newStatus.lastRotationTimestamp,
      });
    } catch (err) {
      setStatusMessage(`❌ Rotation failed: ${formatError(err)}`);
    } finally {
      setPending(false);
    }
  }, []);

  // Re-encrypt all items with current key
  const handleReEncrypt = useCallback(async () => {
    setPending(true);
    try {
      setStatusMessage('🔐 Starting re-encryption of all items...');

      const result = await reEncryptAllItems({
        service,
        batchSize: 50,
      });

      setStatusMessage(
        `✅ Re-encryption completed! Processed ${result.itemsReEncrypted} items${
          result.errors ? ` with ${result.errors.length} errors` : ''
        }`
      );

      if (result.errors) {
        result.errors.slice(0, 2).forEach((err: string) => {
          // eslint-disable-next-line no-console
          console.warn('Re-encryption error:', err);
        });
      }
    } catch (err) {
      setStatusMessage(`❌ Re-encryption failed: ${formatError(err)}`);
    } finally {
      setPending(false);
    }
  }, []);

  // Get current rotation status
  const handleCheckStatus = useCallback(async () => {
    setPending(true);
    try {
      const rotationStatusData = await getRotationStatus();

      setRotationStatus({
        isRotating: rotationStatusData.isRotating,
        currentKeyVersion: rotationStatusData.currentKeyVersion?.id ?? null,
        availableKeyVersions: rotationStatusData.availableKeyVersions.length,
        lastRotationTimestamp: rotationStatusData.lastRotationTimestamp,
      });

      const lastRotationTime = rotationStatusData.lastRotationTimestamp
        ? new Date(rotationStatusData.lastRotationTimestamp).toLocaleString()
        : 'Never';

      setStatusMessage(
        `Current key: ${rotationStatusData.currentKeyVersion?.id?.substring(0, 19) || 'None'}\n` +
          `Available versions: ${rotationStatusData.availableKeyVersions.length}\n` +
          `Last rotation: ${lastRotationTime}`
      );
    } catch (err) {
      setStatusMessage(`Failed to fetch status: ${formatError(err)}`);
    } finally {
      setPending(false);
    }
  }, []);

  return (
    <Card title="🔑 Manual Key Rotation & Re-encryption">
      <Text style={styles.description}>
        Demonstrates automatic key rotation with manual triggers and data
        re-encryption capabilities.
      </Text>

      <View style={styles.buttonRow}>
        <ActionButton
          label={isInitialized ? 'Already Init' : 'Initialize'}
          onPress={handleInitialize}
          loading={pending}
          primary
        />
        <ActionButton
          label="Rotate Keys"
          onPress={handleManualRotation}
          loading={pending}
        />
        <ActionButton
          label="Re-encrypt All"
          onPress={handleReEncrypt}
          loading={pending}
        />
        <ActionButton
          label="Check Status"
          onPress={handleCheckStatus}
          loading={pending}
        />
      </View>

      {rotationStatus && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusTitle}>Current Rotation Status:</Text>
          <Text style={styles.statusDetail}>
            Status: {rotationStatus.isRotating ? '🔄 Rotating' : '✅ Ready'}
          </Text>
          <Text style={styles.statusDetail}>
            Current Key:{' '}
            {rotationStatus.currentKeyVersion?.substring(0, 19) || 'None'}
          </Text>
          <Text style={styles.statusDetail}>
            Available Versions: {rotationStatus.availableKeyVersions}
          </Text>
          <Text style={styles.statusDetail}>
            Last Rotation:{' '}
            {rotationStatus.lastRotationTimestamp
              ? new Date(rotationStatus.lastRotationTimestamp).toLocaleString()
              : 'Never'}
          </Text>
        </View>
      )}

      <View style={styles.messageBubble}>
        <Text style={styles.messageText}>{statusMessage}</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Features demonstrated:</Text>
        <Text style={styles.infoItem}>
          • Automatic key rotation with biometric triggers
        </Text>
        <Text style={styles.infoItem}>
          • Zero-loss key rotation with DEK/KEK pattern
        </Text>
        <Text style={styles.infoItem}>
          • Manual re-encryption of all stored secrets
        </Text>
        <Text style={styles.infoItem}>
          • Event-based rotation lifecycle monitoring
        </Text>
        <Text style={styles.infoItem}>
          • Backward compatibility with legacy encrypted data
        </Text>
      </View>
    </Card>
  );
};

export default KeyRotationPanel;

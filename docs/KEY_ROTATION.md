# Key Rotation

Automatically rotate encryption keys to maintain security over time, with zero-downtime re-encryption of stored secrets. This feature implements envelope encryption with key versioning, ensuring forward secrecy and compliance with security best practices.

## Security Benefits

- **Forward secrecy** — Old keys become useless even if compromised, protecting historical data
- **Compliance** — Meets security standards requiring regular key rotation (NIST, PCI DSS, etc.)
- **Post-compromise security** — Limits damage from key exposure by automatically cycling keys
- **Hardware-backed** — Uses Secure Enclave (iOS) and Keystore/StrongBox (Android) for key protection

## Advantages

- **Zero downtime** — Re-encryption happens automatically in the background
- **Event-driven** — Real-time notifications for rotation lifecycle events
- **Configurable** — Customize rotation intervals, triggers, and behavior
- **Cross-platform** — Consistent API across iOS and Android
- **Performance optimized** — Batched operations with progress tracking

## Quick Setup

```tsx
import {
  initializeKeyRotation,
  rotateKeys,
  getRotationStatus,
  onRotationEvent
} from 'react-native-sensitive-info'

// Initialize automatic rotation (30 days, biometric triggers)
await initializeKeyRotation({
  enabled: true,
  rotationIntervalMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  rotateOnBiometricChange: true,
  backgroundReEncryption: true
})

// Listen for rotation events
const unsubscribe = onRotationEvent((event) => {
  console.log(`${event.type}: ${event.reason}`)
  if (event.type === 'rotation:completed') {
    console.log(`Re-encrypted ${event.itemsReEncrypted} items`)
  }
})

// Manual rotation
const result = await rotateKeys({
  reason: 'User requested rotation'
})
console.log(`Rotated to key: ${result.newKeyVersion.id}`)

// Check status
const status = await getRotationStatus()
console.log(`Current key: ${status.currentKeyVersion?.id}`)

// Cleanup
unsubscribe()
```

## API Reference

| Method | Description |
| --- | --- |
| `initializeKeyRotation(options)` | Configure automatic key rotation settings |
| `rotateKeys(options)` | Manually trigger key rotation |
| `getRotationStatus()` | Get current rotation state and key information |
| `onRotationEvent(callback)` | Subscribe to rotation lifecycle events |
| `reEncryptAllItems(options)` | Re-encrypt all items with current key |

## Configuration Options

```typescript
interface InitializeKeyRotationRequest {
  enabled?: boolean                    // Enable/disable automatic rotation
  rotationIntervalMs?: number          // Time between rotations (default: 30 days)
  rotateOnBiometricChange?: boolean    // Trigger on biometric enrollment changes
  rotateOnCredentialChange?: boolean   // Trigger on device credential changes
  manualRotationEnabled?: boolean      // Allow manual rotation triggers
  maxKeyVersions?: number              // Maximum key versions to keep
  backgroundReEncryption?: boolean     // Re-encrypt during rotation
}
```

## Event Types

Subscribe to rotation events for real-time feedback:

```typescript
onRotationEvent((event) => {
  switch (event.type) {
    case 'rotation:started':
      console.log(`🔄 Rotation started: ${event.reason}`)
      break
    case 'rotation:completed':
      console.log(`✅ Completed: ${event.itemsReEncrypted} items in ${event.duration}ms`)
      break
    case 'rotation:failed':
      console.log(`❌ Failed: ${event.reason}`)
      break
  }
})
```

## Advanced Usage

### Custom Rotation Intervals

```tsx
// Rotate every 7 days
await initializeKeyRotation({
  rotationIntervalMs: 7 * 24 * 60 * 60 * 1000,
  enabled: true
})

// Rotate every 24 hours
await initializeKeyRotation({
  rotationIntervalMs: 24 * 60 * 60 * 1000,
  enabled: true
})
```

### Biometric Change Detection

Automatically rotate keys when fingerprints or face recognition is enrolled/changed:

```tsx
await initializeKeyRotation({
  rotateOnBiometricChange: true,
  rotateOnCredentialChange: true,
  enabled: true
})
```

This ensures that if someone adds a new fingerprint to the device, stored secrets are automatically re-encrypted with a new key (enhancing security by requiring re-authentication).

### Manual Bulk Re-encryption

Re-encrypt all items without rotating keys (useful for recovering from corrupted items or re-encrypting with new metadata):

```tsx
const result = await reEncryptAllItems({
  service: 'myapp',
  batchSize: 50
})
console.log(`Re-encrypted ${result.itemsReEncrypted} items`)
```

### Monitoring Rotation Progress

```tsx
onRotationEvent((event) => {
  if (event.type === 'rotation:completed') {
    const percentage = (event.itemsReEncrypted / event.totalItems) * 100
    console.log(`Rotation progress: ${percentage.toFixed(0)}%`)
  }
})
```

## Important Considerations

> [!WARNING]
> Key rotation is irreversible. Ensure you have backups before enabling automatic rotation in production.

> [!IMPORTANT]
> Background re-encryption may consume battery and data. Monitor performance on resource-constrained devices.

> [!NOTE]
> Rotation events are delivered asynchronously. UI updates should be handled in event callbacks.

## Troubleshooting

| Issue | Solution |
| --- | --- |
| Rotation not triggering | Check `enabled: true` and verify device time settings |
| Re-encryption failures | Some items may fail if keys are invalidated; check error details |
| Performance issues | Reduce `rotationIntervalMs` or disable `backgroundReEncryption` on low-end devices |
| Event not firing | Ensure the event listener is set up before rotation starts |
| Battery drain | Disable `backgroundReEncryption` or extend `rotationIntervalMs` |

## Example: Enterprise Security Policy

```tsx
// Enforce rotation every 30 days with biometric triggers
await initializeKeyRotation({
  enabled: true,
  rotationIntervalMs: 30 * 24 * 60 * 60 * 1000,
  rotateOnBiometricChange: true,
  rotateOnCredentialChange: true,
  backgroundReEncryption: true,
  maxKeyVersions: 10  // Keep 10 versions for rollback
})

// Log all rotation events for audit trail
onRotationEvent((event) => {
  if (event.type === 'rotation:completed') {
    // Send to compliance logging service
    logToAuditService({
      type: 'KEY_ROTATION_COMPLETED',
      timestamp: new Date(),
      itemsReEncrypted: event.itemsReEncrypted,
      duration: event.duration
    })
  }
})
```

## Interactive Demo

> [!TIP]
> Use the example app's Key Rotation panel to explore all features interactively. It includes comprehensive logging and error handling for all rotation operations.

Access via `example/` directory after installation.

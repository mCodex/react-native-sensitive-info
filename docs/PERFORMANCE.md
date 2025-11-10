# Performance Benchmarks

The Nitro rewrite in v6 removes the classic React Native bridge bottleneck that previous releases (v5 and earlier) relied on.

## Benchmark Results

| Operation (10k iterations) | v5 classic bridge | v6 Nitro hybrid | Improvement |
| --- | --- | --- | --- |
| `setItem` (string payload, metadata write) | 812 ms | 247 ms | 3.3× faster |
| `getItem` (with value) | 768 ms | 231 ms | 3.3× faster |
| `hasItem` | 544 ms | 158 ms | 3.4× faster |
| `getAllItems` (25 entries, metadata only) | 612 ms | 204 ms | 3.0× faster |

## Benchmark Setup

- **Hardware**: iPhone 15 Pro (iOS 18.0) for iOS numbers; Pixel 8 (Android 15, Tensor G3) for Android numbers
- **Method**: Repeated each operation 10,000 times in release mode, averaged across three runs
- **Timing**: Measured using the example app's built-in instrumentation harness
- **Notes**: Results focus on bridge overhead; actual wall-clock time may be dominated by secure hardware latency for certain access controls

## Performance Characteristics

On both platforms, Nitro's C++/Swift/Kotlin hybrid path keeps the secure storage calls close to their native implementations:

- Bridge overhead reduced ~70% vs React Native classic bridge (v5)
- Secure hardware latency dominates for biometric operations
- Batch operations (getAllItems) benefit most from Nitro speed gains

## Operation Costs

### Write Operations (setItem)

- **Best case** (software encryption): ~25ms
- **Average case** (Keychain/Keystore): ~50ms
- **Worst case** (Secure Enclave + biometric): ~2000ms (hardware dependent)

### Read Operations (getItem)

- **Best case** (metadata only): ~5ms
- **Average case** (with decryption): ~30ms
- **Worst case** (biometric + Secure Enclave): ~1500ms

### Batch Operations (getAllItems)

- **25 items, metadata only**: ~200ms
- **25 items, with values**: ~500ms
- **Scales linearly** with item count

## Memory Characteristics

- **Encryption keys**: Stored in hardware only (not in JS memory)
- **Decrypted values**: Held temporarily during operation, then garbage collected
- **Batch operations**: Process in small batches to prevent memory spike
- **No persistent memory overhead** for the module itself

## Best Practices for Performance

### 1. Use Metadata-Only Queries When Possible

```tsx
// Fast: Just metadata (~5ms)
const { items } = useSecureStorage({ includeValues: false })

// Slower: Full decryption (~30ms per item)
const { items } = useSecureStorage({ includeValues: true })
```

### 2. Batch Operations

Instead of calling `getItem()` in a loop, use `getAllItems()`:

```tsx
// Slow: N × 30ms per item
for (const key of keys) {
  const item = await getItem(key)
}

// Fast: Single batch operation (~200ms for 25 items)
const items = await getAllItems({ includeValues: true })
const filtered = items.filter(item => keys.includes(item.key))
```

### 3. Skip Biometric When Not Needed

Biometric authentication adds 1000-2000ms per operation. Only use when necessary:

```tsx
// Fast: No biometric (~50ms)
const item = await getItem('public-key', {
  accessControl: 'none'
})

// Slower: Biometric required (~2000ms)
const secret = await getItem('private-key', {
  accessControl: 'biometryCurrentSet'
})
```

### 4. Use Conditional Queries

```tsx
// Skip query if not needed
const { data } = useSecretItem('token', { 
  skip: !isInitialized 
})
```

### 5. Cache Device Capabilities

```tsx
// Query once, use everywhere (cached automatically)
const { data: capabilities } = useSecurityAvailability()

// Avoid querying again in child components
// Results are cached across all useSecurityAvailability calls
```

## Scaling Characteristics

- **1–10 items**: Imperceptible overhead
- **10–100 items**: Batch operations recommended
- **100+ items**: Consider pagination or filtering by service
- **1000+ items**: Implement service-based sharding

## Platform-Specific Notes

### iOS

- Keychain access is optimized for small payloads (<64KB)
- Biometric prompts reuse previous auth within a short window
- Hardware varies significantly (simulator vs device)

### Android

- EncryptedSharedPreferences performs best with <100 items per service
- Keystore operations may be slower on older devices
- StrongBox is faster than fallback software encryption when available

## Profiling

Use the example app's built-in profiler to measure your specific use cases:

1. Navigate to the Performance tab
2. Select an operation
3. Run 100+ iterations
4. View average, min, max times

## Real-World Examples

### Profile Picture Storage (~100KB payload)

```typescript
// ~300ms with biometric, ~150ms without
await setItem('profile-pic', base64Data, {
  accessControl: 'biometryCurrentSet'
})
```

### Token Management (small string)

```typescript
// ~2000ms on first auth (biometric prompt)
// ~50ms on subsequent accesses (auth cached)
const token = await getItem('auth-token', {
  accessControl: 'biometryCurrentSet'
})
```

### Batch Import (100 items)

```typescript
// ~500ms total with batch operations
// Would be ~5000ms with individual setItem calls
for (const [key, value] of entries) {
  await setItem(key, value, { service: 'import' })
}
```

## Future Optimizations

- **Keychain query caching** — Cache item metadata between reads
- **Batch re-encryption** — Optimize key rotation for large datasets
- **Compression** — Automatically compress large payloads
- **Progressive loading** — Implement lazy loading for getAllItems
- **Background sync** — Queue operations for later execution

See [Architecture](./ARCHITECTURE.md) for implementation details.

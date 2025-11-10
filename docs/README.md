# Documentation Index

Welcome to react-native-sensitive-info documentation. This is your guide to everything the library offers.

## Getting Started

- **[🚀 Main README](../README.md)** — Start here! Quick start, feature overview, installation
- **[📖 API Reference](./API.md)** — Complete method reference, options, types

## Learning Paths

### I just want to store data securely
1. Read [Quick Start](../README.md#quick-start)
2. Choose: [Hooks](./HOOKS.md) (recommended for React) or [Imperative API](./API.md)
3. Done! 🎉

### I need to understand error handling
1. Read [Error Handling](./ERROR_HANDLING.md) — All 18 error codes explained
2. See [Troubleshooting](./TROUBLESHOOTING.md) — Common issues and solutions

### I want to use advanced features
1. [Access Control](./ADVANCED.md#access-control--metadata) — Custom security policies
2. [Key Rotation](./KEY_ROTATION.md) — Automatic key versioning
3. [Batch Operations](./ADVANCED.md#bulk-operations) — Import/export patterns

### I'm experiencing an issue
1. Check [Troubleshooting FAQ](./TROUBLESHOOTING.md#frequently-asked-questions)
2. Search [Common Issues](./TROUBLESHOOTING.md#troubleshooting-guide)
3. Read [Platform-Specific](./TROUBLESHOOTING.md#platform-specific-issues) guide

### I want to contribute or set up development
1. [Development Setup](./DEVELOPMENT.md#local-development)
2. [Testing Guide](./DEVELOPMENT.md#testing)
3. [Contributing Guidelines](./DEVELOPMENT.md#contributing-guidelines)

## Documentation Files

### Core Documentation
| File | Purpose | Read Time |
| --- | --- | --- |
| [API Reference](./API.md) | Complete API documentation | 10 min |
| [React Hooks](./HOOKS.md) | All hooks with patterns & examples | 15 min |
| [Advanced Usage](./ADVANCED.md) | Custom patterns, lifecycle, bulk ops | 20 min |

### Features
| File | Purpose | Read Time |
| --- | --- | --- |
| [Key Rotation](./KEY_ROTATION.md) | Automatic key versioning & re-encryption | 10 min |
| [Error Handling](./ERROR_HANDLING.md) | Error codes, type-safe classification | 10 min |
| [Performance](./PERFORMANCE.md) | Benchmarks, optimization, scaling | 8 min |

### Detailed Information
| File | Purpose | Read Time |
| --- | --- | --- |
| [Architecture](./ARCHITECTURE.md) | System design, implementation details | 15 min |
| [Development](./DEVELOPMENT.md) | Setup, testing, contribution workflow | 20 min |
| [Troubleshooting](./TROUBLESHOOTING.md) | FAQ, debugging, platform-specific help | 15 min |

## Quick Reference

### Common Tasks

**Store a secret:**
```typescript
import { setItem } from 'react-native-sensitive-info'
await setItem('key', 'value', { service: 'myapp' })
```
→ See [API Reference](./API.md#setitem)

**Read a secret:**
```typescript
import { getItem } from 'react-native-sensitive-info'
const item = await getItem('key', { service: 'myapp' })
```
→ See [API Reference](./API.md#getitem)

**Use hooks in React:**
```tsx
import { useSecureStorage } from 'react-native-sensitive-info'
const { items, saveSecret } = useSecureStorage({ service: 'myapp' })
```
→ See [Hooks Guide](./HOOKS.md)

**Handle errors:**
```typescript
import { SensitiveInfoError, ErrorCode } from 'react-native-sensitive-info'
try {
  await setItem('key', 'value')
} catch (error) {
  if (error instanceof SensitiveInfoError && 
      error.code === ErrorCode.AuthenticationCanceled) {
    // Handle user dismissal
  }
}
```
→ See [Error Handling](./ERROR_HANDLING.md)

**Enable key rotation:**
```typescript
import { initializeKeyRotation } from 'react-native-sensitive-info'
await initializeKeyRotation({
  enabled: true,
  rotationIntervalMs: 30 * 24 * 60 * 60 * 1000
})
```
→ See [Key Rotation](./KEY_ROTATION.md)

## Platform-Specific Guides

### iOS
- Secure Enclave security → [Architecture](./ARCHITECTURE.md#ios-implementation-swift)
- Keychain configuration → [Advanced Usage](./ADVANCED.md#cross-app-keychain-sharing-ios)
- Simulator limitations → [Troubleshooting](./TROUBLESHOOTING.md#ios)

### Android
- StrongBox support → [Architecture](./ARCHITECTURE.md#android-implementation-kotlin)
- Biometric setup → [Setup](../README.md#android)
- Emulator issues → [Troubleshooting](./TROUBLESHOOTING.md#android)

## Quick Links

- 📦 [npm Package](https://www.npmjs.com/package/react-native-sensitive-info)
- 🐙 [GitHub Repository](https://github.com/mcodex/react-native-sensitive-info)
- 💬 [GitHub Discussions](https://github.com/mcodex/react-native-sensitive-info/discussions)
- 🐛 [Report Issues](https://github.com/mcodex/react-native-sensitive-info/issues)
- ⭐ [Star us on GitHub](https://github.com/mcodex/react-native-sensitive-info)

## FAQ

**Where do I start?**
Read the [Main README](../README.md) first, then choose between hooks or imperative API.

**Which version should I use?**
v6 if you can use React Native 0.76+. Otherwise, v5.6.x. See [Version Guide](../README.md#version-guide).

**How do I report a bug?**
Check [Troubleshooting](./TROUBLESHOOTING.md) first, then [file an issue](https://github.com/mcodex/react-native-sensitive-info/issues).

**Can I contribute?**
Yes! See [Contributing Guide](./DEVELOPMENT.md#contributing-guidelines).

**What's the performance impact?**
See [Performance Benchmarks](./PERFORMANCE.md) — ~3.3× faster than v5, minimal memory overhead.

More questions? Check [Troubleshooting FAQ](./TROUBLESHOOTING.md#frequently-asked-questions).

## Documentation Statistics

- **Total Documentation**: ~80 pages
- **Code Examples**: 100+
- **Platforms Covered**: iOS, Android, macOS, visionOS, watchOS
- **API Methods**: 10+ with full documentation
- **React Hooks**: 5 with patterns
- **Error Codes**: 18 documented
- **Feature Guides**: 5 advanced features

---

**Last Updated**: November 10, 2025  
**Documentation Version**: 6.0.0

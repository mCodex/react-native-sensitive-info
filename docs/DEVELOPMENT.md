# Development & Contributing

## Local Development

### Prerequisites

- Node 18+ and Yarn
- React Native 0.76+
- Xcode 15+ for iOS
- Android Studio Giraffe+ with Kotlin 1.8+
- `react-native-nitro-modules` installed

### Setup

```bash
# Install dependencies
yarn install

# Regenerate Nitro bindings
yarn codegen

# Type-check TypeScript
yarn typecheck

# Build distributable packages
yarn build

# Run tests
yarn test
```

### Development Workflow

**Modify TypeScript code** → `yarn build` → Tests automatically rerun

**Modify Swift code** (iOS) → Xcode rebuilds automatically

**Modify Kotlin code** (Android) → Android Studio rebuilds automatically

For active development, watch mode is helpful:

```bash
# Watch TypeScript changes
yarn build --watch

# Watch Nitro codegen
yarn codegen --watch

# Run tests in watch mode
yarn test --watch
```

## Project Structure

```
.
├── src/                      # TypeScript source
│   ├── index.ts             # Entry point
│   ├── core/                # Nitro bridge
│   ├── hooks/               # React hooks
│   ├── internal/            # Utilities
│   └── rotation/            # Key rotation engine
├── ios/                      # Swift native module
│   ├── HybridSensitiveInfo.swift
│   ├── KeychainItemManager.swift
│   ├── CryptoService.swift
│   └── AccessControlFactory.swift
├── android/                  # Kotlin native module
│   └── src/main/java/com/sensitiveinfo/
│       ├── HybridSensitiveInfo.kt
│       ├── KeyRotation.kt
│       └── core/
│           ├── Result.kt
│           ├── SensitiveInfoModule.kt
│           └── Extensions.kt
├── example/                  # Example app
├── docs/                     # Documentation
├── lib/                      # Built outputs
└── nitrogen/               # Nitro code generation
```

## Testing

### Run All Tests

```bash
yarn test
```

### Run Specific Test Suite

```bash
yarn test -- src/__tests__/hooks.useSecret.test.tsx
```

### Coverage Report

```bash
yarn test -- --coverage
```

### Integration Tests

```bash
# iOS
cd example && yarn ios

# Android
cd example && yarn android

# Web (if supported)
cd example && yarn web
```

## Code Style

- **TypeScript**: ESLint + Prettier (auto-format on save)
- **Swift**: Swift Format (Xcode built-in)
- **Kotlin**: ktlint (enforced in CI)

### Format Code

```bash
# TypeScript
yarn prettier --write src/

# Swift
cd ios && swift format -i *.swift

# Kotlin
cd android && ./gradlew spotlessApply
```

### Lint Code

```bash
# TypeScript
yarn lint

# Kotlin
cd android && ./gradlew spotlessCheck
```

## Building for Production

### TypeScript/React Native

```bash
# Builds CommonJS, ESM, and TypeScript definition formats
yarn build

# Output: lib/module, lib/commonjs, lib/typescript
```

### iOS

```bash
# Pod installation
cd ios && pod install

# Xcode build
open SensitiveInfoExample.xcworkspace
# Select target → Product → Build
```

### Android

```bash
# Gradle build
cd android && ./gradlew build

# Release AAR
cd android && ./gradlew assembleRelease
```

## Release Process

### 1. Prepare Release

```bash
# Create release branch
git checkout -b release/vX.Y.Z

# Update version in package.json
npm version patch/minor/major

# Update CHANGELOG
echo "## vX.Y.Z" >> CHANGELOG.md
echo "- Feature 1" >> CHANGELOG.md
echo "- Fix 1" >> CHANGELOG.md

# Commit
git add .
git commit -m "chore: release vX.Y.Z"

# Tag
git tag vX.Y.Z
```

### 2. Build & Test

```bash
# Clean build
rm -rf node_modules lib android/build ios/Pods
yarn install

# Type check
yarn typecheck

# Run tests
yarn test --coverage

# Build packages
yarn build
```

### 3. Publish

```bash
# Verify npm access
npm whoami

# Publish to npm
npm publish

# Push changes
git push origin release/vX.Y.Z
git push --tags
```

### 4. GitHub Release

Create release on GitHub with:
- Version: vX.Y.Z
- Release notes from CHANGELOG
- Link to npm package
- Highlight breaking changes

## Contributing Guidelines

### Before Starting

1. Check [GitHub issues](https://github.com/mcodex/react-native-sensitive-info/issues) for related work
2. Open an issue for significant changes
3. Discuss breaking changes with maintainers
4. Review [Code of Conduct](../CODE_OF_CONDUCT.md)

### Making Changes

1. **Fork** the repository
2. **Create branch**: `git checkout -b feature/my-feature`
3. **Make changes** with tests
4. **Type check**: `yarn typecheck`
5. **Test**: `yarn test`
6. **Lint**: `yarn lint`
7. **Commit**: `git commit -m "feat: describe change"`
8. **Push**: `git push origin feature/my-feature`
9. **PR**: Open pull request with description

### PR Checklist

- [ ] Tests pass locally (`yarn test`)
- [ ] Type errors fixed (`yarn typecheck`)
- [ ] Code formatted (`yarn prettier --write`)
- [ ] No console warnings
- [ ] Backward compatible (or breaking change documented)
- [ ] Tests added/updated for new functionality
- [ ] Documentation updated if needed
- [ ] Commit messages descriptive

### Review Process

1. CI must pass (tests, linting, type checking)
2. Code review by maintainers
3. Address feedback
4. Merge after approval

## Debugging

### Enable Verbose Logging

**TypeScript**:
```typescript
// Add console.log statements
console.log('[SensitiveInfo]', message)
```

**iOS**:
```bash
# Xcode console shows native logs with os_log level
# Set OS_LOG_DEFAULT=info in scheme environment variables
```

**Android**:
```bash
# Android Studio Logcat
adb logcat com.sensitiveinfo:V
```

### Use Debugger

**TypeScript**:
```bash
# VSCode debugger
# Press F5 or set breakpoints
```

**iOS**:
```bash
# Xcode debugger
# Set breakpoints, click Run button
```

**Android**:
```bash
# Android Studio debugger
# Set breakpoints, click Run button
```

## Common Development Tasks

### Add New Hook

1. Create `src/hooks/useMyHook.tsx`
2. Implement hook with proper typing
3. Add tests in `src/__tests__/hooks.myHook.test.tsx`
4. Export from `src/index.ts`
5. Document in `docs/HOOKS.md`

### Add New Error Code

1. Add to `ErrorCode` enum in `src/internal/error-classifier.ts`
2. Add handler in error factory
3. Add tests for new error
4. Document in `docs/ERROR_HANDLING.md`

### Add Platform Feature

1. **iOS**: Add to `ios/*.swift`
2. **Android**: Add to `android/.../com/sensitiveinfo/*.kt`
3. **TypeScript**: Update `src/sensitive-info.nitro.ts` type definitions
4. **Tests**: Add platform-specific tests
5. **Documentation**: Update relevant docs

### Update Dependencies

```bash
# Check for updates
yarn upgrade-interactive

# Update lockfile
yarn install

# Verify tests still pass
yarn test
```

## Performance Profiling

### Use React DevTools Profiler

```bash
# In example app, open React DevTools
# Go to Profiler tab
# Record interactions
# Analyze performance
```

### Use Xcode Instruments

```bash
# iOS profiling
# Xcode → Product → Profile
# Select CPU Time or Memory to profile
```

### Use Android Profiler

```bash
# Android profiling
# Android Studio → Profile → Profile 'app'
# View CPU, Memory, Network usage
```

## Continuous Integration

CI runs automatically on:
- Pull requests to `main` branch
- Commits to release branches
- Tag pushes for releases

See `.github/workflows/` for CI configuration.

### Local CI Simulation

```bash
# Run all CI checks
yarn typecheck
yarn lint
yarn test --coverage
yarn build
```

## Documentation

Documentation is in `docs/` directory. Key files:

- `ARCHITECTURE.md` — System design and module layout
- `ADVANCED.md` — Advanced usage patterns
- `ERROR_HANDLING.md` — Error codes and handling
- `KEY_ROTATION.md` — Key rotation feature
- `PERFORMANCE.md` — Performance benchmarks
- `TROUBLESHOOTING.md` — FAQ and debugging
- `HOOKS.md` — React hook patterns (main README references)

When making changes that affect user-facing APIs:
1. Update relevant documentation
2. Add examples where helpful
3. Link from main README if major feature
4. Update FAQ if it's a common question

## Questions?

- **Documentation**: Check docs/ folder and main README
- **Examples**: See example/ app for working code
- **GitHub Discussions**: Ask questions in discussions tab
- **Issues**: Report bugs with minimal reproduction

Thank you for contributing! 🎉

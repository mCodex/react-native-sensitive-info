# Performance

## Bundle policy

- `"sideEffects": false` — every public surface tree-shakes cleanly.
- Subpath exports keep the imperative API, the hooks, and the error classes in **separate**
  ESM entry points so apps only pay for what they import.
- The TypeScript-side dependency graph is intentionally flat. The whole runtime (errors,
  options, native handle, validation, storage) is a few hundred lines of JS plus the Nitro
  bridge.

| Import                                        | Approximate min+gz size† |
| --------------------------------------------- | ------------------------ |
| `react-native-sensitive-info`                 | ~3.0 KB                  |
| `react-native-sensitive-info/hooks`           | ~4.5 KB                  |
| `react-native-sensitive-info/errors`          | ~1.0 KB                  |

> † Numbers are a rough order-of-magnitude on RN Metro output; verify with your own bundler.

## Hooks

Every public hook follows the same recipe to keep re-renders cheap:

1. Inline option literals are **deep-equal cached** through `useStableOptions`. Passing a fresh
   object each render does not invalidate the underlying `useAsync` / `useMutation`.
2. `useReducer` drives the lifecycle so `setState` cannot tear (loading + data + error always
   commit together).
3. The returned object is wrapped in `useMemo` with stable identity per state transition.
4. Stable empty arrays (e.g. `EMPTY_ITEMS`) are frozen once at module scope so consumers can
   safely use referential equality.

That means you can pass result objects to `React.memo` children or to a `Context.Provider`
without paying for spurious re-renders.

## React Compiler (Babel plugin)

The hooks are written so that the React Compiler **does not** need to see the source to keep
them stable. We don't ship Compiler output; the optimization is done by hand and stays explicit.
This keeps the runtime debuggable and avoids forcing consumers onto the Compiler.

If you do enable the Compiler app-wide, the hooks remain correct: they don't rely on memo
identity behaviour the Compiler would change.

## Native call overhead

- iOS: each call is a single Keychain transaction. The Secure Enclave path adds ~20–60 ms for
  biometric prompts (user-driven).
- Android: Keystore unwrap is on the critical path. StrongBox-backed keys add ~30–80 ms for
  the IPC round-trip. `EncryptedSharedPreferences` fallback is ~3–5 ms per read.

Always avoid calling `getItem` in tight render loops — fetch once, hoist into state.

## Recommended patterns

- **List metadata, fetch on demand.** Use `getAllItems({ includeValues: false })` (or
  `useSecureStorage` with the same flag) to render a list cheaply, and only call `getItem` when
  the user explicitly asks for the value.
- **Batch on rotation.** `rotateKeys({ reEncryptEagerly: true })` walks all entries in one
  native pass. Doing it lazily per-read is fine but spreads cost across the app's lifetime.
- **Skip the biometric on enumeration.** iOS will not prompt for `hasItem` /
  `getAllItems({ includeValues: false })` — keep enumeration silent and reserve prompts for
  reads that actually need plaintext.

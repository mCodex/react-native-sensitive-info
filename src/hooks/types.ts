/**
 * Options accepted by the {@link HookError} constructor.
 */
export interface HookErrorOptions {
	/** Root cause object forwarded from the underlying API (typically a {@link SensitiveInfoError}). */
	readonly cause?: unknown
	/** Identifier describing the hook operation that failed (for example, `useSecretItem.fetch`). */
	readonly operation?: string | undefined
	/** Human-friendly hint rendered alongside the message in dev-tools / error overlays. */
	readonly hint?: string | undefined
}

/**
 * Error wrapper surfaced by the public hooks.
 *
 * Carries the original native error in `cause` plus extra UI-friendly context (`operation`,
 * `hint`) so consumers can build rich error states without unwrapping the underlying
 * {@link SensitiveInfoError}.
 *
 * @example
 * ```tsx
 * const { error } = useSecret('token', { service: 'auth' })
 * if (error) console.warn(`[${error.operation}] ${error.message} — ${error.hint}`)
 * ```
 */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: intentional type-only `cause` augmentation via interface merging; see the `HookError` interface declaration below.
export class HookError extends Error {
	/** Identifier of the hook operation that failed (e.g. `useSecret.save`). */
	readonly operation?: string | undefined

	/** UI-facing remediation hint (e.g. `'Ask the user to retry biometrics.'`). */
	readonly hint?: string | undefined

	/**
	 * @param message - Human-readable description of the failure.
	 * @param options - Additional metadata; see {@link HookErrorOptions}.
	 */
	constructor(message: string, options: HookErrorOptions = {}) {
		super(message)
		this.name = 'HookError'
		this.operation = options.operation
		this.hint = options.hint
		// Define `cause` manually instead of passing it to `super()` so this
		// compiles cleanly under TS configs whose `lib` predates ES2022 (where
		// the second `Error` constructor argument was introduced), while keeping
		// the property non-enumerable to match the native ES2022 `Error` constructor.
		//
		// We deliberately use `'cause' in options` (rather than a value check)
		// so that `new HookError(msg, { cause: undefined })` still installs the
		// property — matching native `new Error(msg, { cause: undefined })`.
		if ('cause' in options) {
			Object.defineProperty(this, 'cause', {
				value: options.cause,
				writable: true,
				configurable: true,
				enumerable: false,
			})
		}
	}
}

/**
 * Type-only declaration merge that exposes the optional `cause` property on
 * {@link HookError} for consumers compiling with a `tsconfig` `lib` target
 * that predates ES2022 (where `Error.cause` was added). Using interface
 * merging—rather than a `declare` class field—keeps the source fully erasable
 * by Babel/SWC and avoids emitting an enumerable own property.
 */
export interface HookError {
	readonly cause?: unknown
}

/**
 * Canonical async state contract returned by most hooks.
 *
 * @typeParam T - Shape of the resolved value (e.g. `string`, {@link SensitiveInfoItem}).
 */
export interface AsyncState<T> {
	/** Most recent successful value, or `null` while loading or after an error. */
	readonly data: T | null
	/** Most recent failure, or `null` when the last operation succeeded. */
	readonly error: HookError | null
	/** `true` during the initial fetch (no `data` yet). Use this to render skeletons. */
	readonly isLoading: boolean
	/** `true` while a refetch / mutation is in flight (with stale `data` still present). */
	readonly isPending: boolean
}

/**
 * Async state contract used by operations that do not emit data (e.g. `clearService`).
 */
export interface VoidAsyncState {
	/** Most recent failure, or `null` when the last operation succeeded. */
	readonly error: HookError | null
	/** `true` during the initial fetch. */
	readonly isLoading: boolean
	/** `true` while a refetch / mutation is in flight. */
	readonly isPending: boolean
}

/**
 * Successful outcome of a hook mutation helper. Use the `success` discriminant to narrow.
 */
export interface HookSuccessResult {
	/** Always `true`. Discriminant for {@link HookMutationResult}. */
	readonly success: true
	/** Always `undefined` on success — present so the union narrows cleanly. */
	readonly error?: undefined
}

/**
 * Failure outcome of a hook mutation helper. Use the `success` discriminant to narrow.
 */
export interface HookFailureResult {
	/** Always `false`. Discriminant for {@link HookMutationResult}. */
	readonly success: false
	/** {@link HookError} describing the failure. */
	readonly error: HookError
}

/**
 * Discriminated union returned by hook mutation helpers (`saveSecret`, `clearAll`, …).
 *
 * Mutations never throw — they always resolve with this union so component code can branch with
 * a simple `if (!result.success)` check.
 *
 * @example
 * ```tsx
 * const result = await saveSecret(value)
 * if (!result.success) showToast(result.error.message)
 * ```
 */
export type HookMutationResult = HookSuccessResult | HookFailureResult

/**
 * Factory used to initialise {@link AsyncState} values.
 *
 * @typeParam T - Shape of the eventual data payload.
 * @returns A frozen initial state with `isLoading: true` and no data/error.
 *
 * @example
 * ```ts
 * const [state, setState] = useState(() => createInitialAsyncState<string>())
 * ```
 */
export function createInitialAsyncState<T>(): AsyncState<T> {
	return {
		data: null,
		error: null,
		isLoading: true,
		isPending: false,
	}
}

/**
 * Factory used to initialise {@link VoidAsyncState} values.
 *
 * @returns Initial state with `isLoading: false` and no error — mutations idle by default.
 *
 * @example
 * ```ts
 * const [state, setState] = useState(() => createInitialVoidState())
 * ```
 */
export function createInitialVoidState(): VoidAsyncState {
	return {
		error: null,
		isLoading: false,
		isPending: false,
	}
}

/**
 * Helper used to return a canonical success result from mutation helpers.
 *
 * @returns `{ success: true }` — narrows {@link HookMutationResult} to {@link HookSuccessResult}.
 */
export function createHookSuccessResult(): HookSuccessResult {
	return { success: true }
}

/**
 * Helper used to return a canonical failure result from mutation helpers.
 *
 * @param error - The {@link HookError} that caused the failure.
 * @returns `{ success: false, error }` — narrows to {@link HookFailureResult}.
 */
export function createHookFailureResult(error: HookError): HookFailureResult {
	return { success: false, error }
}

export interface HookErrorOptions {
	readonly cause?: unknown
	readonly operation?: string | undefined
	readonly hint?: string | undefined
}

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: intentional type-only `cause` augmentation via interface merging
export class HookError extends Error {
	readonly operation?: string | undefined
	readonly hint?: string | undefined

	constructor(message: string, options: HookErrorOptions = {}) {
		super(message)
		this.name = 'HookError'
		this.operation = options.operation
		this.hint = options.hint
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

export interface HookError {
	readonly cause?: unknown
}

export interface AsyncState<T> {
	readonly data: T | null
	readonly error: HookError | null
	readonly isLoading: boolean
	readonly isPending: boolean
}

export interface VoidAsyncState {
	readonly error: HookError | null
	readonly isLoading: boolean
	readonly isPending: boolean
}

export interface HookSuccessResult {
	readonly success: true
	readonly error?: undefined
}

export interface HookFailureResult {
	readonly success: false
	readonly error: HookError
}

export type HookMutationResult = HookSuccessResult | HookFailureResult

export function createInitialAsyncState<T>(): AsyncState<T> {
	return {
		data: null,
		error: null,
		isLoading: true,
		isPending: false,
	}
}

export function createInitialVoidState(): VoidAsyncState {
	return {
		error: null,
		isLoading: false,
		isPending: false,
	}
}

export function createHookSuccessResult(): HookSuccessResult {
	return { success: true }
}

export function createHookFailureResult(error: HookError): HookFailureResult {
	return { success: false, error }
}

export interface HookErrorOptions {
  /** Root cause object forwarded from the underlying API. */
  readonly cause?: unknown
  /** Identifier describing the hook operation that failed (for example, `useSecretItem.fetch`). */
  readonly operation?: string
  /** Human-friendly hint rendered alongside the message. */
  readonly hint?: string
}

/**
 * Error wrapper surfaced by the public hooks.
 * Carries additional metadata to help debug issues in VS Code tooltips.
 */
export class HookError extends Error {
  readonly operation?: string

  readonly hint?: string

  constructor(
    message: string,
    { cause, operation, hint }: HookErrorOptions = {}
  ) {
    super(message, { cause })
    this.name = 'HookError'
    this.operation = operation
    this.hint = hint
  }
}

/**
 * Canonical async state contract returned by most hooks.
 */
export interface AsyncState<T> {
  readonly data: T | null
  readonly error: HookError | null
  readonly isLoading: boolean
  readonly isPending: boolean
}

/**
 * Async state contract used by operations that do not emit data.
 */
export interface VoidAsyncState {
  readonly error: HookError | null
  readonly isLoading: boolean
  readonly isPending: boolean
}

/**
 * Factory used to initialise {@link AsyncState} values.
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
 */
export function createInitialVoidState(): VoidAsyncState {
  return {
    error: null,
    isLoading: false,
    isPending: false,
  }
}

import { getErrorMessage } from '../internal/errors'
import { HookError } from './types'

/**
 * Creates a {@link HookError} enhanced with the original cause, the operation label, and an optional hint.
 */
const createHookError = (
  operation: string,
  error: unknown,
  hint?: string
): HookError =>
  new HookError(`${operation}: ${getErrorMessage(error)}`, {
    cause: error,
    operation,
    hint,
  })

export default createHookError

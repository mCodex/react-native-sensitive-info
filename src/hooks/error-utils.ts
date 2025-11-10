import {
  getErrorMessage,
  isAuthenticationCanceledError as internalIsAuthenticationCanceledError,
} from '../internal/error-classifier';
import { HookError } from './types';

/**
 * Creates a {@link HookError} enhanced with the original cause, the operation label, and an optional hint.
 */
const createHookError = (
  operation: string,
  error: unknown,
  hint?: string
): HookError =>
  new HookError(
    `${operation}: ${
      internalIsAuthenticationCanceledError(error)
        ? 'Authentication prompt canceled by the user.'
        : getErrorMessage(error)
    }`,
    {
      cause: error,
      operation,
      hint,
    }
  );

export const isAuthenticationCanceledError =
  internalIsAuthenticationCanceledError;

export default createHookError;

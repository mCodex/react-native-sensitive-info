/**
 * Shared error helpers used across infrastructure layers and hooks.
 */

const NOT_FOUND_MARKER = '[E_NOT_FOUND]';
const AUTH_CANCELED_MARKER = '[E_AUTH_CANCELED]';

const hasErrorMarker = (error: unknown, marker: string): boolean => {
  if (error instanceof Error) {
    return error.message.includes(marker);
  }
  if (typeof error === 'string') {
    return error.includes(marker);
  }
  return false;
};

export function isNotFoundError(error: unknown): boolean {
  return hasErrorMarker(error, NOT_FOUND_MARKER);
}

/**
 * Determines whether an error value represents a cancelled authentication prompt.
 */
export function isAuthenticationCanceledError(error: unknown): boolean {
  return hasErrorMarker(error, AUTH_CANCELED_MARKER);
}

/**
 * Extracts a human-readable message from arbitrary error values.
 * Falls back to a generic description when the payload is opaque.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

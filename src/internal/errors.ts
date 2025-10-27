/**
 * Shared error helpers used across infrastructure layers and hooks.
 */
export function isNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('[E_NOT_FOUND]')
  }
  if (typeof error === 'string') {
    return error.includes('[E_NOT_FOUND]')
  }
  return false
}

/**
 * Extracts a human-readable message from arbitrary error values.
 * Falls back to a generic description when the payload is opaque.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unknown error occurred'
}

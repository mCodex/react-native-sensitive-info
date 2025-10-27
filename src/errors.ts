/**
 * @internal - Error utilities
 * Centralized error handling for DRY principle
 */

/**
 * Checks if an error is a "not found" error from the native layer
 */
export function isNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message?.includes('[E_NOT_FOUND]') ?? false
  }
  if (typeof error === 'string') {
    return error.includes('[E_NOT_FOUND]')
  }
  return false
}

/**
 * Extracts meaningful error message from various error types
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

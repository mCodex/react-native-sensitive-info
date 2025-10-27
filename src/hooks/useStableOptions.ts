import { useMemo, useRef } from 'react'

/**
 * Ensures that option objects remain referentially stable between renders without sacrificing readability.
 * The helper merges the provided defaults with the latest value and caches the result until the serialised payload changes.
 *
 * @example
 * ```ts
 * const normalizedOptions = useStableOptions(
 *   { service: 'com.example.app', includeValues: false },
 *   props.options
 * )
 * ```
 */
const useStableOptions = <T extends object>(
  defaults: Partial<T>,
  options?: Partial<T> | null
): T => {
  const cacheKeyRef = useRef<string>('')
  const valueRef = useRef<T | null>(null)

  return useMemo(() => {
    const serialized = JSON.stringify(options ?? null)
    if (serialized === cacheKeyRef.current && valueRef.current != null) {
      return valueRef.current
    }

    const merged = { ...defaults, ...(options ?? {}) } as T
    cacheKeyRef.current = serialized
    valueRef.current = merged
    return merged
  }, [options, defaults])
}

export default useStableOptions

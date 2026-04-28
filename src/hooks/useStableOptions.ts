import { useRef } from 'react'
import deepEqual from './internal/deepEqual'

/**
 * Returns a referentially stable options object that only changes identity when the
 * **content** of `options` (or `defaults`) changes.
 *
 * @remarks
 * Uses a typed structural equality check (see {@link deepEqual}) instead of `JSON.stringify`,
 * so it correctly handles:
 * - Key order: `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` are treated as equal.
 * - `undefined` values: `{ a: 1, b: undefined }` and `{ a: 1 }` are treated as **different**.
 * - Non-serialisable values (`Date`, `RegExp`, `Map`, `Set`, functions) compare by identity
 *   rather than throwing.
 *
 * Option payloads must be **acyclic** — circular references are not supported and will
 * recurse until the call stack overflows. This is by contract; option objects are POJOs.
 *
 * The merged result is cached until either input changes by content, so consumers can pass
 * inline option literals without forcing downstream `useEffect` / `useMemo` invalidations.
 *
 * @example
 * ```ts
 * const stable = useStableOptions(
 *   { service: 'com.example.app', includeValues: false },
 *   props.options
 * )
 * ```
 *
 * @internal
 */
const useStableOptions = <T extends object>(
	defaults: Partial<T>,
	options?: Partial<T> | null
): T => {
	'use no memo'
	// Intentional opt-out: this hook reads multiple refs during render to compute
	// a structurally-stable identity — a pattern the React Compiler cannot
	// preserve. The whole point of the hook is to short-circuit re-derivation
	// across renders, so manual memoization is the load-bearing implementation.
	const cachedDefaultsRef = useRef<Partial<T> | null>(null)
	const cachedOptionsRef = useRef<Partial<T> | null | undefined>(undefined)
	const valueRef = useRef<T | null>(null)

	if (
		valueRef.current === null ||
		!deepEqual(cachedDefaultsRef.current, defaults) ||
		!deepEqual(cachedOptionsRef.current, options ?? null)
	) {
		cachedDefaultsRef.current = defaults
		cachedOptionsRef.current = options ?? null
		valueRef.current = { ...defaults, ...(options ?? {}) } as T
	}

	return valueRef.current
}

export default useStableOptions

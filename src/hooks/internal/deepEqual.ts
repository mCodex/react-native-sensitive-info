/**
 * Structural equality used by the hooks layer to keep memoized option references
 * stable across renders.
 *
 * @remarks
 * - Compares primitives with `Object.is` (correctly equating `NaN` and distinguishing `+0`/`-0`).
 * - Recurses into plain objects and arrays.
 * - Treats `{ a: undefined }` and `{}` as **different** (unlike `JSON.stringify`).
 * - Compares own enumerable keys only — does not walk prototypes.
 * - Returns `false` (rather than recursing) for instances of `Date`, `RegExp`, `Map`, `Set`,
 *   functions, and any other non-plain object: option payloads are POJOs by contract, and these
 *   types should never appear there. Guarding against them prevents accidental false positives.
 * - **Circular references are not supported** and will recurse until the call stack overflows.
 *   Option payloads must be acyclic; this is enforced by contract, not at runtime.
 *
 * @internal
 */
export default function deepEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true
	if (a === null || b === null) return false
	if (typeof a !== 'object' || typeof b !== 'object') return false

	const aIsArray = Array.isArray(a)
	const bIsArray = Array.isArray(b)
	if (aIsArray !== bIsArray) return false

	if (aIsArray) {
		const arrA = a as readonly unknown[]
		const arrB = b as readonly unknown[]
		if (arrA.length !== arrB.length) return false
		for (let i = 0; i < arrA.length; i++) {
			if (!deepEqual(arrA[i], arrB[i])) return false
		}
		return true
	}

	if (!isPlainObject(a) || !isPlainObject(b)) return false

	const keysA = Object.keys(a)
	const keysB = Object.keys(b)
	if (keysA.length !== keysB.length) return false

	for (const key of keysA) {
		if (!Object.hasOwn(b, key)) return false
		if (!deepEqual(a[key], b[key])) return false
	}
	return true
}

function isPlainObject(value: object): value is Record<string, unknown> {
	const proto = Object.getPrototypeOf(value)
	return proto === Object.prototype || proto === null
}

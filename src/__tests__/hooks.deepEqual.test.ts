import deepEqual from '../hooks/internal/deepEqual'

describe('hooks/internal/deepEqual', () => {
	it('returns true for identical primitives (Object.is semantics)', () => {
		expect(deepEqual(1, 1)).toBe(true)
		expect(deepEqual('a', 'a')).toBe(true)
		expect(deepEqual(Number.NaN, Number.NaN)).toBe(true)
	})

	it('returns false for differing primitives', () => {
		expect(deepEqual(1, 2)).toBe(false)
		expect(deepEqual('a', 'b')).toBe(false)
		expect(deepEqual(0, -0)).toBe(false)
	})

	it('returns false when comparing null with an object', () => {
		expect(deepEqual(null, {})).toBe(false)
		expect(deepEqual({}, null)).toBe(false)
	})

	it('returns false when comparing primitive with object', () => {
		expect(deepEqual(1, {})).toBe(false)
	})

	it('compares plain objects structurally', () => {
		expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
		expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
		expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false)
	})

	it('compares arrays structurally', () => {
		expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true)
		expect(deepEqual([1, 2], [1, 2, 3])).toBe(false)
		expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false)
	})

	it('returns false when only one side is an array', () => {
		expect(deepEqual([1], { 0: 1, length: 1 })).toBe(false)
	})

	it('recurses through nested objects and arrays', () => {
		expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true)
		expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false)
	})

	it('returns false for non-plain object instances', () => {
		expect(deepEqual(new Date(0), new Date(0))).toBe(false)
		expect(deepEqual(/a/, /a/)).toBe(false)
	})

	it('treats Object.create(null) as a plain object', () => {
		const a = Object.create(null) as Record<string, unknown>
		a.x = 1
		const b = Object.create(null) as Record<string, unknown>
		b.x = 1
		expect(deepEqual(a, b)).toBe(true)
	})
})

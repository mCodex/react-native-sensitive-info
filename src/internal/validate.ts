import { InvalidArgumentError } from '../errors'
import type { SensitiveInfoOptions } from '../sensitive-info.nitro'

/** Maximum byte length accepted for an entry key. */
export const MAX_KEY_BYTES = 1024

/** Maximum byte length accepted for a service name. */
export const MAX_SERVICE_BYTES = 1024

/** Maximum byte length accepted for a stored value (UTF-8 encoded). Default: 1 MiB. */
export const MAX_VALUE_BYTES = 1024 * 1024

/**
 * Counts the UTF-8 byte length of a string without allocating an intermediate buffer.
 *
 * @internal
 * @remarks
 * Avoids `TextEncoder` so the helper works in legacy jsdom test environments and in older RN
 * runtimes that lack the global. Handles surrogate pairs (4-byte sequences) correctly.
 */
function utf8ByteLength(input: string): number {
	let bytes = 0
	for (let i = 0; i < input.length; i++) {
		const code = input.charCodeAt(i)
		if (code < 0x80) {
			bytes += 1
		} else if (code < 0x800) {
			bytes += 2
		} else if (code >= 0xd800 && code <= 0xdbff) {
			// High surrogate. Only count as a 4-byte sequence when properly paired with a
			// following low surrogate; otherwise treat the unpaired surrogate as a 3-byte
			// replacement to avoid skipping or undercounting the next code unit.
			const next = i + 1 < input.length ? input.charCodeAt(i + 1) : 0
			if (next >= 0xdc00 && next <= 0xdfff) {
				bytes += 4
				i++
			} else {
				bytes += 3
			}
		} else {
			bytes += 3
		}
	}
	return bytes
}

/**
 * Validates a non-empty entry key.
 *
 * @internal
 * @throws {@link InvalidArgumentError} when the key is empty, whitespace-only, or exceeds {@link MAX_KEY_BYTES}.
 */
export function validateKey(key: unknown): asserts key is string {
	if (typeof key !== 'string') {
		throw new InvalidArgumentError(
			`Expected key to be a string, received ${typeof key}.`,
			{ argument: 'key' }
		)
	}
	if (key.trim().length === 0) {
		throw new InvalidArgumentError('Expected key to be a non-empty string.', {
			argument: 'key',
		})
	}
	const size = utf8ByteLength(key)
	if (size > MAX_KEY_BYTES) {
		throw new InvalidArgumentError(
			`Expected key to be at most ${MAX_KEY_BYTES} bytes (UTF-8), received ${size}.`,
			{ argument: 'key' }
		)
	}
}

/**
 * Validates the optional `service` field on user-supplied options. Undefined is allowed because
 * `normalizeOptions` will substitute the default; an explicit empty string is rejected.
 *
 * @internal
 */
export function validateService(options?: SensitiveInfoOptions): void {
	const service = options?.service
	if (service === undefined) return
	if (typeof service !== 'string') {
		throw new InvalidArgumentError(
			`Expected options.service to be a string, received ${typeof service}.`,
			{ argument: 'service' }
		)
	}
	if (service.trim().length === 0) {
		throw new InvalidArgumentError(
			'Expected options.service to be a non-empty string.',
			{ argument: 'service' }
		)
	}
	const size = utf8ByteLength(service)
	if (size > MAX_SERVICE_BYTES) {
		throw new InvalidArgumentError(
			`Expected options.service to be at most ${MAX_SERVICE_BYTES} bytes (UTF-8), received ${size}.`,
			{ argument: 'service' }
		)
	}
}

/**
 * Validates the value payload of a `setItem` call.
 *
 * @internal
 * @throws {@link InvalidArgumentError} when the value is not a string or its UTF-8 encoding exceeds {@link MAX_VALUE_BYTES}.
 */
export function validateValue(value: unknown): asserts value is string {
	if (typeof value !== 'string') {
		throw new InvalidArgumentError(
			`Expected value to be a string, received ${typeof value}.`,
			{ argument: 'value' }
		)
	}
	const size = utf8ByteLength(value)
	if (size > MAX_VALUE_BYTES) {
		throw new InvalidArgumentError(
			`Expected value to be at most ${MAX_VALUE_BYTES} bytes (UTF-8), received ${size}.`,
			{ argument: 'value' }
		)
	}
}

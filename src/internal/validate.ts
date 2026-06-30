import { InvalidArgumentError } from '../errors'
import type { SensitiveInfoOptions } from '../sensitive-info.nitro'

export const MAX_KEY_BYTES = 1024
export const MAX_SERVICE_BYTES = 1024
export const MAX_VALUE_BYTES = 1024 * 1024

function utf8ByteLength(input: string): number {
	let bytes = 0
	for (let i = 0; i < input.length; i++) {
		const code = input.charCodeAt(i)
		if (code < 0x80) {
			bytes += 1
		} else if (code < 0x800) {
			bytes += 2
		} else if (code >= 0xd800 && code <= 0xdbff) {
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

function assertNonEmptyString(
	value: unknown,
	name: string,
	maxBytes: number
): asserts value is string {
	if (typeof value !== 'string') {
		throw new InvalidArgumentError(
			`Expected ${name} to be a string, received ${typeof value}.`,
			{ argument: name }
		)
	}
	if (value.trim().length === 0) {
		throw new InvalidArgumentError(`Expected ${name} to be a non-empty string.`, {
			argument: name,
		})
	}
	const size = utf8ByteLength(value)
	if (size > maxBytes) {
		throw new InvalidArgumentError(
			`Expected ${name} to be at most ${maxBytes} bytes (UTF-8), received ${size}.`,
			{ argument: name }
		)
	}
}

export function validateKey(key: unknown): asserts key is string {
	assertNonEmptyString(key, 'key', MAX_KEY_BYTES)
}

export function validateService(options?: SensitiveInfoOptions): void {
	const service = options?.service
	if (service === undefined) return
	assertNonEmptyString(service, 'service', MAX_SERVICE_BYTES)
}

export function validateValue(value: unknown): asserts value is string {
	assertNonEmptyString(value, 'value', MAX_VALUE_BYTES)
}

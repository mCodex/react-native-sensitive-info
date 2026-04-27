import { StyleSheet, Text } from 'react-native'
import {
	isAuthenticationCanceledError,
	isIntegrityViolationError,
	isKeyInvalidatedError,
	isNotFoundError,
	isRotationFailedError,
	SensitiveInfoError,
} from 'react-native-sensitive-info/errors'

interface StatusLineProps {
	readonly message?: string | null
	readonly error?: unknown
	readonly tone?: 'info' | 'success'
}

const friendlyError = (error: unknown): string | null => {
	// Auth-cancel is a normal user gesture: render nothing.
	if (isAuthenticationCanceledError(error)) return null
	if (isNotFoundError(error)) return 'No value stored for that key yet.'
	if (isIntegrityViolationError(error))
		return 'Integrity check failed — the entry was tampered with.'
	if (isKeyInvalidatedError(error))
		return 'Encryption key was invalidated. Re-enroll biometrics and retry.'
	if (isRotationFailedError(error))
		return 'Key rotation failed. Some entries may still be on the previous key.'
	if (error instanceof SensitiveInfoError) return error.message
	if (error instanceof Error) return error.message
	return null
}

const StatusLine = ({ message, error, tone = 'info' }: StatusLineProps) => {
	const errorText = error != null ? friendlyError(error) : null
	const text = errorText ?? message
	if (!text) return null
	const isError = errorText != null
	return (
		<Text
			style={[
				styles.text,
				isError
					? styles.error
					: tone === 'success'
						? styles.success
						: styles.info,
			]}
		>
			{text}
		</Text>
	)
}

const styles = StyleSheet.create({
	text: { fontSize: 13, lineHeight: 18 },
	info: { color: '#475569' },
	success: { color: '#15803d' },
	error: { color: '#b91c1c' },
})

export default StatusLine

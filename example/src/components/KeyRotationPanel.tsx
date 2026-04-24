import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useKeyRotation } from 'react-native-sensitive-info/hooks'
import ActionButton from './ActionButton'
import Card from './Card'

interface KeyRotationPanelProps {
	readonly service: string
}

const KeyRotationPanel: React.FC<KeyRotationPanelProps> = ({ service }) => {
	const { rotate, readVersion, lastResult, error, isRotating } = useKeyRotation(
		{ service }
	)
	const [currentVersion, setCurrentVersion] = useState<number | null>(null)

	const refreshVersion = useCallback(async () => {
		const value = await readVersion()
		setCurrentVersion(value)
	}, [readVersion])

	useEffect(() => {
		refreshVersion()
	}, [refreshVersion])

	const handleRotate = useCallback(async () => {
		const ack = await rotate()
		if (ack.success) {
			await refreshVersion()
		}
	}, [refreshVersion, rotate])

	const handleRotateEager = useCallback(async () => {
		const ack = await rotate()
		if (ack.success) {
			await refreshVersion()
		}
	}, [refreshVersion, rotate])

	return (
		<Card title="Key rotation">
			<Text style={styles.hint}>
				Rotate the master key for <Text style={styles.service}>{service}</Text>.
				Existing entries are re-encrypted lazily on read by default.
			</Text>

			<View style={styles.row}>
				<Text style={styles.label}>Active version:</Text>
				<Text style={styles.value}>
					{currentVersion == null ? '—' : `v${currentVersion}`}
				</Text>
			</View>

			{lastResult != null ? (
				<View style={styles.row}>
					<Text style={styles.label}>Last rotation:</Text>
					<Text style={styles.value}>
						v{lastResult.previousVersion} → v{lastResult.newVersion} (
						{lastResult.reEncryptedCount} re-encrypted)
					</Text>
				</View>
			) : null}

			{error != null ? <Text style={styles.error}>{error.message}</Text> : null}

			<View style={styles.actions}>
				<ActionButton
					label={isRotating ? 'Rotating…' : 'Rotate (lazy)'}
					onPress={handleRotate}
					loading={isRotating}
					primary
				/>
				<ActionButton
					label="Rotate + re-encrypt all"
					onPress={handleRotateEager}
					loading={isRotating}
				/>
			</View>
		</Card>
	)
}

const styles = StyleSheet.create({
	hint: {
		fontSize: 14,
		color: '#475569',
		marginBottom: 12,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 6,
	},
	label: {
		fontSize: 13,
		color: '#64748b',
		marginRight: 6,
	},
	value: {
		fontSize: 13,
		fontWeight: '600',
		color: '#0f172a',
	},
	service: {
		fontWeight: '600',
		color: '#0f172a',
	},
	error: {
		marginTop: 8,
		fontSize: 13,
		color: '#b91c1c',
	},
	actions: {
		marginTop: 12,
		flexDirection: 'column',
		gap: 8,
	},
})

export default KeyRotationPanel

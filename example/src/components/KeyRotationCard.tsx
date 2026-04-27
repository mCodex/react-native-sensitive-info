import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { SensitiveInfoOptions } from 'react-native-sensitive-info'
import { useKeyRotation } from 'react-native-sensitive-info/hooks'
import Section from './Section'
import StatusLine from './StatusLine'

interface KeyRotationCardProps {
	readonly options: SensitiveInfoOptions
}

const KeyRotationCard = ({ options }: KeyRotationCardProps) => {
	const { rotate, readVersion, lastResult, isRotating, error } =
		useKeyRotation(options)
	const [version, setVersion] = useState<number | null>(null)

	const refresh = useCallback(async () => {
		setVersion(await readVersion())
	}, [readVersion])

	useEffect(() => {
		void refresh()
	}, [refresh])

	const handleRotate = useCallback(
		async (eager: boolean) => {
			const ack = await rotate({ reEncryptEagerly: eager })
			if (ack.success) await refresh()
		},
		[refresh, rotate]
	)

	const summary = lastResult
		? `v${lastResult.previousVersion} → v${lastResult.newVersion} · re-encrypted ${lastResult.reEncryptedCount}`
		: version != null
			? `Active version: v${version}`
			: 'Reading active version…'

	return (
		<Section title="Key rotation" subtitle={summary}>
			<View style={styles.row}>
				<Pressable
					onPress={() => handleRotate(false)}
					disabled={isRotating}
					style={[styles.button, isRotating && styles.disabled]}
				>
					<Text style={styles.label}>Rotate (lazy)</Text>
				</Pressable>
				<Pressable
					onPress={() => handleRotate(true)}
					disabled={isRotating}
					style={[styles.button, styles.primary, isRotating && styles.disabled]}
				>
					<Text style={[styles.label, styles.labelInverted]}>
						Rotate + re-encrypt
					</Text>
				</Pressable>
			</View>
			<StatusLine error={error} />
		</Section>
	)
}

const styles = StyleSheet.create({
	row: { flexDirection: 'row', gap: 8 },
	button: {
		flex: 1,
		paddingVertical: 10,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: '#cbd5e1',
		alignItems: 'center',
	},
	primary: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
	disabled: { opacity: 0.4 },
	label: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
	labelInverted: { color: '#ffffff' },
})

export default KeyRotationCard

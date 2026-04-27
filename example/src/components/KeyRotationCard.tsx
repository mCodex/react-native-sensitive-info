import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	getKeyVersion,
	type SensitiveInfoOptions,
} from 'react-native-sensitive-info'
import { useKeyRotation } from 'react-native-sensitive-info/hooks'
import Button from './Button'
import Section from './Section'
import StatusLine from './StatusLine'

interface KeyRotationCardProps {
	readonly readOptions: SensitiveInfoOptions
	readonly writeOptions: SensitiveInfoOptions
}

const formatSummary = (
	lastResult: ReturnType<typeof useKeyRotation>['lastResult'],
	version: number | null
) => {
	if (lastResult)
		return `v${lastResult.previousVersion} → v${lastResult.newVersion} · re-encrypted ${lastResult.reEncryptedCount}`
	return version != null
		? `Active version: v${version}`
		: 'Reading active version…'
}

const KeyRotationCard = ({
	readOptions,
	writeOptions,
}: KeyRotationCardProps) => {
	// Bind the hook to `writeOptions` so `rotate` carries the full policy, but
	// read the version through the bare imperative API + `readOptions` to avoid
	// an unnecessary auth prompt on iOS during the initial render.
	const { rotate, lastResult, isRotating, error } = useKeyRotation(writeOptions)
	const [version, setVersion] = useState<number | null>(null)

	const refresh = useCallback(async () => {
		try {
			setVersion(await getKeyVersion(readOptions))
		} catch {
			setVersion(null)
		}
	}, [readOptions])

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

	return (
		<Section title="Key rotation" subtitle={formatSummary(lastResult, version)}>
			<View style={styles.row}>
				<Button
					label="Rotate (lazy)"
					onPress={() => handleRotate(false)}
					isPending={isRotating}
				/>
				<Button
					label="Rotate + re-encrypt"
					onPress={() => handleRotate(true)}
					isPending={isRotating}
					variant="primary"
				/>
			</View>
			<StatusLine error={error} />
		</Section>
	)
}

const styles = StyleSheet.create({
	row: { flexDirection: 'row', gap: 8 },
})

export default KeyRotationCard

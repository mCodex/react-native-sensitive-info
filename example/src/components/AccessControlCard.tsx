import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { SecurityAvailability } from 'react-native-sensitive-info'
import { useSecurityAvailability } from 'react-native-sensitive-info/hooks'
import { ACCESS_MODES, type ModeKey } from '../constants'
import Section from './Section'
import StatusLine from './StatusLine'

interface AccessControlCardProps {
	readonly mode: ModeKey
	readonly onChange: (mode: ModeKey) => void
}

const CAPABILITY_LABELS: ReadonlyArray<
	readonly [keyof SecurityAvailability, string]
> = [
	['biometry', 'Biometry'],
	['secureEnclave', 'Secure Enclave'],
	['strongBox', 'StrongBox'],
	['deviceCredential', 'Device Credential'],
]

const buildCapabilityLine = (a: SecurityAvailability | null): string => {
	if (!a) return 'Probing secure hardware…'
	const parts = CAPABILITY_LABELS.filter(([k]) => a[k]).map(
		([, label]) => label
	)
	return parts.length === 0 ? 'Software fallback only' : parts.join(' · ')
}

const AccessControlCard = ({ mode, onChange }: AccessControlCardProps) => {
	const { data, error } = useSecurityAvailability()
	const biometryUnavailable = data?.biometry === false

	return (
		<Section title="Access control" subtitle={buildCapabilityLine(data)}>
			<View style={styles.row}>
				{ACCESS_MODES.map((entry) => {
					const selected = entry.key === mode
					const fallback =
						entry.key === 'biometric' && biometryUnavailable && !selected
					return (
						<Pressable
							key={entry.key}
							onPress={() => onChange(entry.key)}
							style={[
								styles.pill,
								selected && styles.pillSelected,
								fallback && styles.pillFallback,
							]}
						>
							<Text
								style={[
									styles.label,
									selected && styles.labelSelected,
									fallback && styles.labelFallback,
								]}
							>
								{entry.label}
								{entry.key === 'biometric' && biometryUnavailable ? ' *' : ''}
							</Text>
						</Pressable>
					)
				})}
			</View>
			{biometryUnavailable && mode === 'biometric' ? (
				<Text style={styles.warning}>
					Biometry unavailable on this device — writes will fall back to a
					software policy.
				</Text>
			) : null}
			<StatusLine error={error} />
		</Section>
	)
}

const styles = StyleSheet.create({
	row: { flexDirection: 'row', gap: 8 },
	pill: {
		flex: 1,
		paddingVertical: 10,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: '#e2e8f0',
		alignItems: 'center',
	},
	pillSelected: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
	pillFallback: { borderStyle: 'dashed', borderColor: '#cbd5e1' },
	label: { fontSize: 13, fontWeight: '600', color: '#475569' },
	labelSelected: { color: '#ffffff' },
	labelFallback: { color: '#94a3b8' },
	warning: { marginTop: 8, fontSize: 12, lineHeight: 16, color: '#b45309' },
})

export default AccessControlCard

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSecurityAvailability } from 'react-native-sensitive-info/hooks'
import { ACCESS_MODES, type ModeKey } from '../constants'
import Section from './Section'
import StatusLine from './StatusLine'

interface AccessControlCardProps {
	readonly mode: ModeKey
	readonly onChange: (mode: ModeKey) => void
}

const buildCapabilityLine = (
	availability: ReturnType<typeof useSecurityAvailability>['data']
): string => {
	if (!availability) return 'Probing secure hardware…'
	const parts: string[] = []
	if (availability.biometry) parts.push('Biometry')
	if (availability.secureEnclave) parts.push('Secure Enclave')
	if (availability.strongBox) parts.push('StrongBox')
	if (availability.deviceCredential) parts.push('Device Credential')
	return parts.length === 0 ? 'Software fallback only' : parts.join(' · ')
}

const AccessControlCard = ({ mode, onChange }: AccessControlCardProps) => {
	const { data, error } = useSecurityAvailability()

	return (
		<Section title="Access control" subtitle={buildCapabilityLine(data)}>
			<View style={styles.row}>
				{ACCESS_MODES.map((entry) => {
					const selected = entry.key === mode
					return (
						<Pressable
							key={entry.key}
							onPress={() => onChange(entry.key)}
							style={[styles.pill, selected && styles.pillSelected]}
						>
							<Text style={[styles.label, selected && styles.labelSelected]}>
								{entry.label}
							</Text>
						</Pressable>
					)
				})}
			</View>
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
	label: { fontSize: 13, fontWeight: '600', color: '#475569' },
	labelSelected: { color: '#ffffff' },
})

export default AccessControlCard

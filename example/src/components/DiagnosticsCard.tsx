import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { SensitiveInfoOptions } from 'react-native-sensitive-info'
import { getKeyVersion } from 'react-native-sensitive-info'
import { useSecurityAvailability } from 'react-native-sensitive-info/hooks'
import Section from './Section'

interface DiagnosticsCardProps {
	readonly options: SensitiveInfoOptions
}

const formatBoolean = (value: boolean) => (value ? '✓' : '—')

const DiagnosticsCard = ({ options }: DiagnosticsCardProps) => {
	const { data: availability } = useSecurityAvailability()
	const [version, setVersion] = useState<number | null>(null)

	useEffect(() => {
		let cancelled = false
		getKeyVersion(options).then((v) => {
			if (!cancelled) setVersion(v)
		})
		return () => {
			cancelled = true
		}
	}, [options])

	const rows: Array<readonly [string, string]> = [
		['Service', options.service ?? 'default'],
		['Active key version', version != null ? `v${version}` : '—'],
		['Biometry', formatBoolean(availability?.biometry ?? false)],
		['Secure Enclave', formatBoolean(availability?.secureEnclave ?? false)],
		['StrongBox', formatBoolean(availability?.strongBox ?? false)],
		[
			'Device Credential',
			formatBoolean(availability?.deviceCredential ?? false),
		],
	]

	return (
		<Section title="Diagnostics">
			{rows.map(([label, value]) => (
				<View key={label} style={styles.row}>
					<Text style={styles.label}>{label}</Text>
					<Text style={styles.value}>{value}</Text>
				</View>
			))}
		</Section>
	)
}

const styles = StyleSheet.create({
	row: { flexDirection: 'row', justifyContent: 'space-between' },
	label: { fontSize: 13, color: '#475569' },
	value: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
})

export default DiagnosticsCard

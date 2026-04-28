import { useEffect, useRef, useState } from 'react'
import { Linking, Platform, StyleSheet, Switch, Text, View } from 'react-native'
import {
	type AccessControl,
	type BiometryStatus,
	canUseAccessControlSync,
} from 'react-native-sensitive-info'
import { useSecurityAvailability } from 'react-native-sensitive-info/hooks'
import Button from './Button'
import Section from './Section'
import StatusLine from './StatusLine'

const POLICIES: readonly AccessControl[] = [
	'secureEnclaveBiometry',
	'biometryCurrentSet',
	'biometryAny',
	'devicePasscode',
	'none',
]

const STATUS_COPY: Readonly<
	Record<BiometryStatus, { label: string; tone: string; bg: string }>
> = {
	available: { label: 'Available', tone: '#065f46', bg: '#d1fae5' },
	notEnrolled: { label: 'Not enrolled', tone: '#92400e', bg: '#fef3c7' },
	notAvailable: { label: 'Not available', tone: '#991b1b', bg: '#fee2e2' },
	lockedOut: { label: 'Locked out', tone: '#9a3412', bg: '#ffedd5' },
	unknown: { label: 'Unknown', tone: '#475569', bg: '#e2e8f0' },
}

const openBiometricSettings = () => {
	if (Platform.OS === 'ios') {
		void Linking.openURL('App-Prefs:').catch(() =>
			Linking.openSettings().catch(() => {})
		)
		return
	}
	void Linking.sendIntent('android.settings.BIOMETRIC_ENROLL').catch(() =>
		Linking.openSettings().catch(() => {})
	)
}

const BiometryStatusCard = () => {
	const [refreshOnForeground, setRefreshOnForeground] = useState(false)
	const [transitionLog, setTransitionLog] = useState<string | null>(null)

	const result = useSecurityAvailability({ refreshOnForeground })

	const previousRef = useRef<BiometryStatus | null>(null)
	const status = result.data?.biometryStatus ?? null
	useEffect(() => {
		if (status === null) return
		const prev = previousRef.current
		if (prev === status) return
		previousRef.current = status
		setTransitionLog(`${prev ?? '∅'} → ${status}`)
	}, [status])

	const effectiveStatus: BiometryStatus = status ?? 'unknown'
	const copy = STATUS_COPY[effectiveStatus]

	return (
		<Section
			title="Biometric availability"
			subtitle="Disambiguate hardware vs enrollment so the toggle reflects reality."
		>
			<View style={styles.badgeRow}>
				<View style={[styles.badge, { backgroundColor: copy.bg }]}>
					<Text style={[styles.badgeText, { color: copy.tone }]}>
						{copy.label}
					</Text>
				</View>
				{result.isLoading ? <Text style={styles.muted}>Checking…</Text> : null}
			</View>

			<View style={styles.flagsGrid}>
				<Flag label="biometry" value={result.data?.biometry ?? false} />
				<Flag
					label="Secure Enclave"
					value={result.data?.secureEnclave ?? false}
				/>
				<Flag label="StrongBox" value={result.data?.strongBox ?? false} />
				<Flag
					label="Device credential"
					value={result.data?.deviceCredential ?? false}
				/>
			</View>

			<Text style={styles.sectionLabel}>Policy precheck</Text>
			{POLICIES.map((policy) => {
				const ok = result.data
					? canUseAccessControlSync(policy, result.data)
					: false
				return (
					<View key={policy} style={styles.row}>
						<Text style={styles.policy}>{policy}</Text>
						<Text
							style={[
								styles.policyValue,
								{ color: ok ? '#065f46' : '#991b1b' },
							]}
						>
							{ok ? 'OK' : 'blocked'}
						</Text>
					</View>
				)
			})}

			<View style={styles.row}>
				<Text style={styles.policy}>Auto-refresh on foreground</Text>
				<Switch
					value={refreshOnForeground}
					onValueChange={setRefreshOnForeground}
				/>
			</View>

			<View style={styles.actionRow}>
				<Button
					label="Open biometric settings"
					onPress={openBiometricSettings}
				/>
				<Button
					label="Refetch"
					variant="primary"
					onPress={() => void result.refetch()}
					isPending={result.isPending}
				/>
			</View>

			{transitionLog ? (
				<StatusLine
					tone="info"
					message={`Status transition: ${transitionLog}`}
				/>
			) : null}
		</Section>
	)
}

interface FlagProps {
	readonly label: string
	readonly value: boolean
}

const Flag = ({ label, value }: FlagProps) => (
	<View style={styles.flag}>
		<Text style={styles.flagLabel}>{label}</Text>
		<Text style={[styles.flagValue, { color: value ? '#065f46' : '#475569' }]}>
			{value ? '✓' : '—'}
		</Text>
	</View>
)

const styles = StyleSheet.create({
	badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
	badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
	muted: { fontSize: 12, color: '#64748b' },
	flagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	flag: {
		flexBasis: '48%',
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 8,
		backgroundColor: '#f1f5f9',
	},
	flagLabel: { fontSize: 12, color: '#475569' },
	flagValue: { fontSize: 12, fontWeight: '700' },
	sectionLabel: {
		fontSize: 12,
		fontWeight: '600',
		color: '#0f172a',
		marginTop: 4,
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	policy: { fontSize: 13, color: '#0f172a' },
	policyValue: { fontSize: 13, fontWeight: '600' },
	actionRow: { flexDirection: 'row', gap: 8 },
})

export default BiometryStatusCard

import React, { useCallback, useMemo, useState } from 'react'
import {
	ActivityIndicator,
	FlatList,
	Platform,
	Pressable,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'
import {
	getItem,
	useSecureStorage,
	useSecurityAvailability,
	type AccessControl,
} from 'react-native-sensitive-info'

type ModeKey = 'open' | 'biometric'

const ACCESS_MODES: Array<{
	key: ModeKey
	label: string
	description: string
	accessControl: AccessControl
}> = [
	{
		key: 'open',
		label: 'No Lock',
		description: 'Stores the value without requiring authentication.',
		accessControl: 'none',
	},
	{
		key: 'biometric',
		label: 'Biometric Lock',
		description: 'Requires the current biometric enrollment to unlock.',
		accessControl: 'biometryCurrentSet',
	},
]

function formatError(error: unknown): string {
	if (error instanceof Error) {
		return `${error.name}: ${error.message}`
	}
	return 'Something went wrong. Please try again.'
}

const DEFAULT_SERVICE = 'demo-safe'
const DEFAULT_KEY = 'favorite-color'
const DEFAULT_SECRET = 'ultramarine'

const App: React.FC = () => {
	const [service, setService] = useState(DEFAULT_SERVICE)
	const [keyName, setKeyName] = useState(DEFAULT_KEY)
	const [secret, setSecret] = useState(DEFAULT_SECRET)
	const [mode, setMode] = useState<ModeKey>('open')
	const [status, setStatus] = useState('Ready to tuck away a secret.')
	const [pending, setPending] = useState(false)

	const trimmedService = useMemo(() => {
		const next = service.trim()
		return next.length > 0 ? next : DEFAULT_SERVICE
	}, [service])

	const selectedMode = useMemo(
		() => ACCESS_MODES.find((candidate) => candidate.key === mode) || ACCESS_MODES[0],
		[mode]
	)

	const authenticationPrompt = useMemo(() => {
		if (selectedMode.key !== 'biometric') {
			return undefined
		}
		return {
			title: 'Unlock your secret',
			subtitle: 'Biometric authentication is required to continue',
			description: 'This demo stores data behind your biometric enrollment.',
			cancel: 'Cancel',
		}
	}, [selectedMode.key])

	const secureOptions = useMemo(
		() => ({
			service: trimmedService,
			accessControl: selectedMode.accessControl,
			authenticationPrompt,
			includeValues: true,
		}),
		[trimmedService, selectedMode.accessControl, authenticationPrompt]
	)

	const {
		items,
		isLoading,
		error,
		saveSecret,
		removeSecret,
		clearAll,
		refreshItems,
	} = useSecureStorage(secureOptions)

	const { data: availability } = useSecurityAvailability()
	const biometricAvailable = availability?.biometry ?? false

	const handleSave = useCallback(async () => {
		const normalizedKey = keyName.trim()
		if (normalizedKey.length === 0) {
			setStatus('Please provide a key before saving.')
			return
		}

		setPending(true)
		try {
			const result = await saveSecret(normalizedKey, secret)
			if (result.success) {
				setStatus('Secret saved securely.')
			} else {
				setStatus(result.error?.message ?? 'Unable to save the secret.')
			}
		} catch (err) {
			setStatus(formatError(err))
		} finally {
			setPending(false)
		}
	}, [keyName, saveSecret, secret])

	const handleReveal = useCallback(async () => {
		const normalizedKey = keyName.trim()
		if (normalizedKey.length === 0) {
			setStatus('Provide the key you would like to reveal.')
			return
		}

		setPending(true)
		try {
			const item = await getItem(normalizedKey, {
				service: trimmedService,
				accessControl: selectedMode.accessControl,
				authenticationPrompt,
				includeValue: true,
			})

			if (item?.value) {
				setStatus(`Secret for "${normalizedKey}" → ${item.value}`)
			} else {
				setStatus('That key has no stored value yet.')
			}
		} catch (err) {
			setStatus(formatError(err))
		} finally {
			setPending(false)
		}
	}, [authenticationPrompt, keyName, selectedMode.accessControl, trimmedService])

	const handleRemove = useCallback(async () => {
		const normalizedKey = keyName.trim()
		if (normalizedKey.length === 0) {
			setStatus('Provide the key you would like to forget.')
			return
		}

		setPending(true)
		try {
			const result = await removeSecret(normalizedKey)
			setStatus(result.success ? 'Secret deleted.' : 'Secret could not be deleted.')
		} catch (err) {
			setStatus(formatError(err))
		} finally {
			setPending(false)
		}
	}, [keyName, removeSecret])

	const handleClear = useCallback(async () => {
		setPending(true)
		try {
			const result = await clearAll()
			setStatus(result.success ? 'All secrets cleared for this service.' : 'Nothing to clear.')
		} catch (err) {
			setStatus(formatError(err))
		} finally {
			setPending(false)
		}
	}, [clearAll])

	const handleRefresh = useCallback(async () => {
		setPending(true)
		try {
			await refreshItems()
			setStatus('Inventory refreshed.')
		} catch (err) {
			setStatus(formatError(err))
		} finally {
			setPending(false)
		}
	}, [refreshItems])

	return (
		<SafeAreaView style={styles.safeArea}>
			<ScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={styles.scrollContent}
			>
				<View style={styles.header}>
					<Text style={styles.title}>Sensitive Info Playground</Text>
					<Text style={styles.subtitle}>
						Store a small secret, lock it with biometrics if you like, and review the
						inventory below.
					</Text>
				</View>

				<View style={styles.card}>
					<Text style={styles.cardTitle}>Secret details</Text>
					<TextInput
						value={service}
						onChangeText={setService}
						placeholder={DEFAULT_SERVICE}
						autoCapitalize="none"
						style={styles.input}
					/>
					<Text style={styles.inputLabel}>Service name</Text>

					<TextInput
						value={keyName}
						onChangeText={setKeyName}
						placeholder={DEFAULT_KEY}
						autoCapitalize="none"
						style={styles.input}
					/>
					<Text style={styles.inputLabel}>Key</Text>

					<TextInput
						value={secret}
						onChangeText={setSecret}
						placeholder={DEFAULT_SECRET}
						autoCapitalize="none"
						style={[styles.input, styles.secretInput]}
						multiline
					/>
					<Text style={styles.inputLabel}>Secret value</Text>
				</View>

				<View style={styles.card}>
					<Text style={styles.cardTitle}>Guard it your way</Text>
					<View style={styles.modeRow}>
						{ACCESS_MODES.map((option) => {
							const disabled = option.key === 'biometric' && !biometricAvailable
							const active = option.key === selectedMode.key

							return (
								<Pressable
									key={option.key}
									accessibilityRole="radio"
									accessibilityState={{ selected: active, disabled }}
									onPress={() => {
										if (!disabled) {
											setMode(option.key)
										}
									}}
									style={({ pressed }) => [
										styles.modeTile,
										active && styles.modeTileActive,
										disabled && styles.modeTileDisabled,
										pressed && !disabled && styles.modeTilePressed,
									]}
								>
									<Text
										style={[
											styles.modeLabel,
											active && styles.modeLabelActive,
											disabled && styles.modeLabelDisabled,
										]}
									>
										{option.label}
									</Text>
									<Text
										style={[
											styles.modeDescription,
											disabled && styles.modeLabelDisabled,
										]}
									>
										{option.description}
									</Text>
									{disabled ? (
										<Text style={styles.modeBadge}>Biometry unavailable</Text>
									) : null}
								</Pressable>
							)
						})}
					</View>
					{availability ? (
						<Text style={styles.availability}>
							Biometry • {availability.biometry ? 'Ready' : 'Unavailable'} · Secure Enclave •{' '}
							{availability.secureEnclave ? 'Ready' : 'Unavailable'}
						</Text>
					) : null}
				</View>

				<View style={styles.card}>
					<Text style={styles.cardTitle}>Actions</Text>
					<View style={styles.buttonRow}>
						<ActionButton label="Save" onPress={handleSave} loading={pending} primary />
						<ActionButton label="Reveal" onPress={handleReveal} loading={pending} />
						<ActionButton label="Delete" onPress={handleRemove} loading={pending} />
						<ActionButton label="Clear service" onPress={handleClear} loading={pending} />
						<ActionButton label="Refresh" onPress={handleRefresh} loading={pending} />
					</View>
					{error ? <Text style={styles.errorText}>{error.message}</Text> : null}
					<View style={styles.statusBubble}>
						<Text style={styles.statusText}>{status}</Text>
					</View>
				</View>

				<View style={styles.card}>
					<Text style={styles.cardTitle}>
						Secrets for “{trimmedService}”{' '}
						<Text style={styles.countBadge}>{items.length}</Text>
					</Text>
					{isLoading ? (
						<View style={styles.loadingRow}>
							<ActivityIndicator color="#2563eb" />
							<Text style={styles.loadingText}>Fetching secrets…</Text>
						</View>
					) : items.length === 0 ? (
						<Text style={styles.emptyState}>Nothing stored yet. Save a secret to see it here.</Text>
					) : (
						<FlatList
							data={items}
							keyExtractor={(item) => `${item.service}-${item.key}`}
							renderItem={({ item }) => (
								<View style={styles.secretRow}>
									<Text style={styles.secretKey}>{item.key}</Text>
									{item.value ? (
										<Text style={styles.secretValue}>{item.value}</Text>
									) : (
										<Text style={styles.secretValueMuted}>Locked value</Text>
									)}
									<Text style={styles.secretMeta}>Access · {item.metadata.accessControl}</Text>
									<Text style={styles.secretMeta}>Stored · {new Date(item.metadata.timestamp * 1000).toLocaleString()}</Text>
								</View>
							)}
							ItemSeparatorComponent={() => <View style={styles.separator} />}
							scrollEnabled={false}
						/>
					)}
				</View>
			</ScrollView>
		</SafeAreaView>
	)
}

interface ActionButtonProps {
	label: string
	onPress: () => void | Promise<void>
	loading?: boolean
	primary?: boolean
}

function ActionButton({ label, onPress, loading, primary }: ActionButtonProps) {
	const [busy, setBusy] = useState(false)

	const handlePress = useCallback(() => {
		if (busy || loading) {
			return
		}

		const result = onPress()
		if (result && typeof (result as Promise<void>).then === 'function') {
			setBusy(true)
			void (result as Promise<void>).finally(() => setBusy(false))
		}
	}, [busy, loading, onPress])

	const disabled = busy || loading

	return (
		<Pressable
			accessibilityRole="button"
			onPress={handlePress}
			style={({ pressed }) => [
				styles.actionButton,
				primary && styles.actionButtonPrimary,
				pressed && !disabled && styles.actionButtonPressed,
				disabled && styles.actionButtonDisabled,
			]}
		>
			<Text style={[styles.actionButtonLabel, primary && styles.actionButtonLabelPrimary]}>
				{label}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: '#f6f8fb',
	},
	scrollContent: {
		padding: 20,
		paddingBottom: 32,
	},
	header: {
		marginBottom: 16,
	},
	title: {
		fontSize: 26,
		fontWeight: '700',
		color: '#111827',
	},
	subtitle: {
		marginTop: 6,
		fontSize: 15,
		lineHeight: 22,
		color: '#4b5563',
	},
	card: {
		backgroundColor: '#ffffff',
		borderRadius: 18,
		padding: 18,
		marginBottom: 18,
		borderWidth: 1,
		borderColor: '#e5e7eb',
		shadowColor: '#0f172a',
		shadowOpacity: 0.04,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 4 },
		elevation: 2,
	},
	cardTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: '#0f172a',
		marginBottom: 12,
	},
	input: {
		backgroundColor: '#f9fafb',
		borderWidth: 1,
		borderColor: '#d1d5db',
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: Platform.select({ ios: 12, default: 10 }),
		fontSize: 15,
		color: '#111827',
	},
	secretInput: {
		minHeight: 72,
		textAlignVertical: 'top',
	},
	inputLabel: {
		fontSize: 12,
		color: '#6b7280',
		marginTop: 6,
		marginBottom: 12,
		textTransform: 'uppercase',
		letterSpacing: 0.7,
	},
	modeRow: {
		flexDirection: 'column',
		gap: 12,
	},
	modeTile: {
		padding: 16,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: '#dbeafe',
		backgroundColor: '#f8fbff',
	},
	modeTileActive: {
		borderColor: '#2563eb',
		backgroundColor: '#eff6ff',
	},
	modeTileDisabled: {
		borderColor: '#e5e7eb',
		backgroundColor: '#f3f4f6',
	},
	modeTilePressed: {
		opacity: 0.9,
	},
	modeLabel: {
		fontSize: 15,
		fontWeight: '600',
		color: '#1f2937',
	},
	modeLabelActive: {
		color: '#1d4ed8',
	},
	modeLabelDisabled: {
		color: '#9ca3af',
	},
	modeDescription: {
		marginTop: 6,
		fontSize: 13,
		lineHeight: 19,
		color: '#4b5563',
	},
	modeBadge: {
		marginTop: 10,
		fontSize: 12,
		fontWeight: '600',
		color: '#ef4444',
	},
	availability: {
		marginTop: 14,
		fontSize: 12,
		letterSpacing: 0.6,
		color: '#475569',
		textTransform: 'uppercase',
	},
	buttonRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 10,
	},
	actionButton: {
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderRadius: 999,
		backgroundColor: '#e2e8f0',
	},
	actionButtonPrimary: {
		backgroundColor: '#2563eb',
	},
	actionButtonPressed: {
		opacity: 0.85,
	},
	actionButtonDisabled: {
		backgroundColor: '#cbd5f5',
	},
	actionButtonLabel: {
		fontSize: 15,
		fontWeight: '600',
		color: '#1f2937',
	},
	actionButtonLabelPrimary: {
		color: '#ffffff',
	},
	errorText: {
		marginTop: 12,
		color: '#dc2626',
		fontSize: 13,
	},
	statusBubble: {
		marginTop: 14,
		backgroundColor: '#0f172a0d',
		borderRadius: 14,
		padding: 12,
	},
	statusText: {
		fontSize: 14,
		color: '#0f172a',
	},
	loadingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	loadingText: {
		fontSize: 14,
		color: '#475569',
	},
	emptyState: {
		fontSize: 14,
		color: '#6b7280',
	},
	secretRow: {
		paddingVertical: 12,
	},
	secretKey: {
		fontSize: 15,
		fontWeight: '600',
		color: '#1f2937',
	},
	secretValue: {
		marginTop: 4,
		fontSize: 15,
		color: '#0f172a',
	},
	secretValueMuted: {
		marginTop: 4,
		fontSize: 15,
		color: '#6b7280',
	},
	secretMeta: {
		marginTop: 4,
		fontSize: 12,
		color: '#94a3b8',
	},
	separator: {
		height: 1,
		backgroundColor: '#e2e8f0',
	},
	countBadge: {
		fontSize: 16,
		color: '#2563eb',
		fontWeight: '700',
	},
})

export default App

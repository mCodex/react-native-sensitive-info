import { useCallback, useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import type {
	AuthenticationPrompt,
	SensitiveInfoItem,
	SensitiveInfoOptions,
} from 'react-native-sensitive-info'
import {
	useHasSecret,
	useSecret,
	useSecureStorage,
} from 'react-native-sensitive-info/hooks'
import Field from './Field'
import Section from './Section'
import StatusLine from './StatusLine'

interface StorageCardProps {
	readonly options: SensitiveInfoOptions
	readonly authenticationPrompt?: AuthenticationPrompt
}

const PROMPT_AUTOHIDE_MS = 5_000

const StorageCard = ({ options, authenticationPrompt }: StorageCardProps) => {
	const [keyName, setKeyName] = useState('favorite-color')
	const [value, setValue] = useState('ultramarine')
	const [revealed, setRevealed] = useState<string | null>(null)
	const [revealEnabled, setRevealEnabled] = useState(false)
	const [status, setStatus] = useState<string | null>(null)

	const trimmedKey = keyName.trim()

	const storage = useSecureStorage({ ...options, includeValues: false })
	const has = useHasSecret(trimmedKey, {
		...options,
		skip: trimmedKey.length === 0,
	})
	const secret = useSecret(trimmedKey, {
		...options,
		authenticationPrompt,
		skip: !revealEnabled || trimmedKey.length === 0,
		includeValue: true,
	})

	const handleSave = useCallback(async () => {
		if (trimmedKey.length === 0) return
		const result = await storage.saveSecret(trimmedKey, value)
		setStatus(result.success ? `Saved "${trimmedKey}".` : null)
		await has.refetch()
	}, [has, storage, trimmedKey, value])

	const handleReveal = useCallback(() => {
		setStatus(null)
		setRevealEnabled(true)
		setRevealed(null)
	}, [])

	// Surface the fetched value briefly, then auto-hide for safer demo UX.
	useEffect(() => {
		if (!revealEnabled) return
		const fetched = secret.data?.value
		if (!fetched) return
		setRevealed(fetched)
		setRevealEnabled(false)
		const handle = setTimeout(() => setRevealed(null), PROMPT_AUTOHIDE_MS)
		return () => clearTimeout(handle)
	}, [revealEnabled, secret.data?.value])

	const handleDelete = useCallback(async () => {
		if (trimmedKey.length === 0) return
		const result = await storage.removeSecret(trimmedKey)
		setStatus(result.success ? `Deleted "${trimmedKey}".` : null)
		await has.refetch()
	}, [has, storage, trimmedKey])

	const handleClear = useCallback(async () => {
		const result = await storage.clearAll()
		setStatus(result.success ? 'Service cleared.' : null)
		await has.refetch()
	}, [has, storage])

	const exists = has.data === true
	const error = secret.error ?? storage.error ?? has.error

	return (
		<Section
			title="Secure storage"
			subtitle={`${storage.items.length} item(s) in this service`}
		>
			<Field
				label="Key"
				value={keyName}
				onChangeText={setKeyName}
				placeholder="favorite-color"
			/>
			<Field
				label="Value"
				value={value}
				onChangeText={setValue}
				placeholder="ultramarine"
				secureTextEntry
			/>

			<View style={styles.row}>
				<Button
					label="Save"
					onPress={handleSave}
					disabled={!trimmedKey}
					primary
				/>
				<Button label="Reveal" onPress={handleReveal} disabled={!exists} />
				<Button
					label="Delete"
					onPress={handleDelete}
					disabled={!exists}
					danger
				/>
			</View>
			<Pressable onPress={handleClear} style={styles.clearLink}>
				<Text style={styles.clearLabel}>Clear all in this service</Text>
			</Pressable>

			<StatusLine
				message={revealed ? `Value: ${revealed}` : status}
				error={error}
				tone={revealed ? 'success' : 'info'}
			/>

			<FlatList
				data={storage.items}
				keyExtractor={(item) => item.key}
				renderItem={({ item }) => <ItemRow item={item} />}
				ListEmptyComponent={
					<Text style={styles.empty}>No secrets stored yet.</Text>
				}
				scrollEnabled={false}
				ItemSeparatorComponent={() => <View style={styles.separator} />}
			/>
		</Section>
	)
}

interface ButtonProps {
	readonly label: string
	readonly onPress: () => void
	readonly disabled?: boolean
	readonly primary?: boolean
	readonly danger?: boolean
}

const Button = ({ label, onPress, disabled, primary, danger }: ButtonProps) => (
	<Pressable
		onPress={onPress}
		disabled={disabled}
		style={[
			styles.button,
			primary && styles.buttonPrimary,
			danger && styles.buttonDanger,
			disabled && styles.buttonDisabled,
		]}
	>
		<Text
			style={[
				styles.buttonLabel,
				(primary || danger) && styles.buttonLabelInverted,
			]}
		>
			{label}
		</Text>
	</Pressable>
)

const ItemRow = ({ item }: { readonly item: SensitiveInfoItem }) => (
	<View style={styles.itemRow}>
		<Text style={styles.itemKey}>{item.key}</Text>
		<View style={styles.badges}>
			<Badge text={item.metadata.securityLevel} />
			{typeof item.metadata.keyVersion === 'number' ? (
				<Badge text={`v${item.metadata.keyVersion}`} />
			) : null}
		</View>
	</View>
)

const Badge = ({ text }: { readonly text: string }) => (
	<View style={styles.badge}>
		<Text style={styles.badgeText}>{text}</Text>
	</View>
)

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
	buttonPrimary: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
	buttonDanger: { backgroundColor: '#b91c1c', borderColor: '#b91c1c' },
	buttonDisabled: { opacity: 0.4 },
	buttonLabel: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
	buttonLabelInverted: { color: '#ffffff' },
	clearLink: { alignSelf: 'flex-start' },
	clearLabel: {
		fontSize: 12,
		color: '#64748b',
		textDecorationLine: 'underline',
	},
	empty: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },
	itemRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 6,
	},
	itemKey: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
	badges: { flexDirection: 'row', gap: 6 },
	badge: {
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 999,
		backgroundColor: '#e2e8f0',
	},
	badgeText: { fontSize: 11, color: '#334155', fontWeight: '600' },
	separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#e2e8f0' },
})

export default StorageCard

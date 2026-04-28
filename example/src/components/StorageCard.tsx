import { useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import {
	clearService,
	deleteItem,
	getItem,
	type SensitiveInfoItem,
	type SensitiveInfoOptions,
	setItem,
} from 'react-native-sensitive-info'
import {
	useSecureOperation,
	useSecureStorage,
} from 'react-native-sensitive-info/hooks'
import Button from './Button'
import Field from './Field'
import Section from './Section'
import StatusLine from './StatusLine'

interface StorageCardProps {
	readonly readOptions: SensitiveInfoOptions
	readonly writeOptions: SensitiveInfoOptions
}

const REVEAL_TTL_SECONDS = 5
const STATUS_AUTOHIDE_MS = 3_500

interface RevealState {
	readonly key: string
	readonly value: string
	readonly remaining: number
}

const StorageCard = ({ readOptions, writeOptions }: StorageCardProps) => {
	const [keyName, setKeyName] = useState('favorite-color')
	const [value, setValue] = useState('ultramarine')
	const [reveal, setReveal] = useState<RevealState | null>(null)
	const [status, setStatus] = useState<string | null>(null)
	const trimmedKey = keyName.trim()

	// Listing only: bind the hook to `readOptions` to keep enumeration silent.
	const storageOptions = useMemo(
		() => ({ ...readOptions, includeValues: false }),
		[readOptions]
	)
	const storage = useSecureStorage(storageOptions)
	const exists =
		trimmedKey.length > 0 &&
		storage.items.some((item) => item.key === trimmedKey)

	// Auto-dismiss success status banner.
	useEffect(() => {
		if (!status) return
		const handle = setTimeout(() => setStatus(null), STATUS_AUTOHIDE_MS)
		return () => clearTimeout(handle)
	}, [status])

	// Reveal countdown.
	useEffect(() => {
		if (!reveal) return
		if (reveal.remaining <= 0) return setReveal(null)
		const handle = setTimeout(
			() => setReveal((p) => (p ? { ...p, remaining: p.remaining - 1 } : p)),
			1000
		)
		return () => clearTimeout(handle)
	}, [reveal])

	const refresh = storage.refreshItems

	const save = useSecureOperation()
	const revealAction = useSecureOperation()
	const remove = useSecureOperation()
	const clearAll = useSecureOperation()

	const handleSave = () =>
		void save.execute(async () => {
			if (!trimmedKey) return
			await setItem(trimmedKey, value, writeOptions)
			await refresh()
			setStatus(`Saved “${trimmedKey}”.`)
		})

	const handleReveal = () =>
		void revealAction.execute(async () => {
			if (!trimmedKey) return
			// `getItem` is the only read needing `writeOptions` — it triggers the auth
			// prompt for biometric-locked entries.
			const item = await getItem(trimmedKey, writeOptions)
			if (item?.value == null) {
				setStatus(`No value for “${trimmedKey}”.`)
				return
			}
			setReveal({
				key: trimmedKey,
				value: item.value,
				remaining: REVEAL_TTL_SECONDS,
			})
		})

	const handleRemove = () =>
		void remove.execute(async () => {
			if (!trimmedKey) return
			await deleteItem(trimmedKey, writeOptions)
			await refresh()
			setReveal((prev) => (prev?.key === trimmedKey ? null : prev))
			setStatus(`Deleted “${trimmedKey}”.`)
		})

	const handleClearAll = () =>
		void clearAll.execute(async () => {
			await clearService(readOptions)
			await refresh()
			setReveal(null)
			setStatus('Service cleared.')
		})

	const busy =
		save.isPending ||
		revealAction.isPending ||
		remove.isPending ||
		clearAll.isPending
	const error =
		save.error ??
		revealAction.error ??
		remove.error ??
		clearAll.error ??
		storage.error
	const empty = storage.items.length === 0
	const subtitle =
		storage.isLoading && empty
			? 'Loading…'
			: `${storage.items.length} item(s) in this service`
	const revealing = reveal?.key === trimmedKey

	return (
		<Section title="Secure storage" subtitle={subtitle}>
			<Field
				label="Key"
				value={keyName}
				onChangeText={setKeyName}
				placeholder="favorite-color"
				editable={!busy}
			/>
			<Field
				label="Value"
				value={value}
				onChangeText={setValue}
				placeholder="ultramarine"
				secureTextEntry
				editable={!busy}
			/>

			<View style={styles.row}>
				<Button
					label="Save"
					onPress={handleSave}
					disabled={!trimmedKey || busy}
					isPending={save.isPending}
					variant="primary"
				/>
				<Button
					label={revealing ? `Hiding in ${reveal?.remaining}s` : 'Reveal'}
					onPress={handleReveal}
					disabled={!exists || busy || revealing}
					isPending={revealAction.isPending}
				/>
				<Button
					label="Delete"
					onPress={handleRemove}
					disabled={!exists || busy}
					isPending={remove.isPending}
					variant="danger"
				/>
			</View>

			<Pressable
				onPress={handleClearAll}
				disabled={busy || empty}
				style={({ pressed }) => [
					styles.clearLink,
					(pressed || busy) && styles.clearLinkPressed,
				]}
			>
				<Text style={[styles.clearLabel, empty && styles.clearLabelDisabled]}>
					Clear all in this service
				</Text>
			</Pressable>

			{reveal ? (
				<View style={styles.revealBanner}>
					<Text style={styles.revealLabel}>{reveal.key}</Text>
					<Text style={styles.revealValue} selectable>
						{reveal.value}
					</Text>
					<Text style={styles.revealHint}>
						Hiding in {reveal.remaining}s — tap Reveal again to extend.
					</Text>
				</View>
			) : null}

			<StatusLine
				message={status}
				error={error}
				tone={status ? 'success' : 'info'}
			/>

			<FlatList
				data={storage.items}
				keyExtractor={(item) => item.key}
				renderItem={({ item }) => (
					<ItemRow
						item={item}
						onPress={() => setKeyName(item.key)}
						highlighted={item.key === trimmedKey}
					/>
				)}
				ListEmptyComponent={
					<Text style={styles.empty}>
						{storage.isLoading
							? 'Loading secrets…'
							: 'No secrets stored yet — try Save.'}
					</Text>
				}
				scrollEnabled={false}
				ItemSeparatorComponent={() => <View style={styles.separator} />}
				style={styles.list}
			/>
		</Section>
	)
}

const ItemRow = ({
	item,
	onPress,
	highlighted,
}: {
	readonly item: SensitiveInfoItem
	readonly onPress: () => void
	readonly highlighted: boolean
}) => {
	const { metadata } = item
	return (
		<Pressable
			onPress={onPress}
			style={[styles.itemRow, highlighted && styles.itemRowHighlighted]}
		>
			<Text style={styles.itemKey} numberOfLines={1}>
				{item.key}
			</Text>
			<View style={styles.badges}>
				<Badge text={metadata.securityLevel} />
				<Badge text={metadata.accessControl} subdued />
				{typeof metadata.keyVersion === 'number' ? (
					<Badge text={`v${metadata.keyVersion}`} />
				) : null}
			</View>
		</Pressable>
	)
}

const Badge = ({
	text,
	subdued,
}: {
	readonly text: string
	readonly subdued?: boolean
}) => (
	<View style={[styles.badge, subdued && styles.badgeSubdued]}>
		<Text style={[styles.badgeText, subdued && styles.badgeTextSubdued]}>
			{text}
		</Text>
	</View>
)

const styles = StyleSheet.create({
	row: { flexDirection: 'row', gap: 8 },
	clearLink: { marginTop: 12, alignSelf: 'flex-start' },
	clearLinkPressed: { opacity: 0.6 },
	clearLabel: {
		fontSize: 12,
		color: '#0f172a',
		textDecorationLine: 'underline',
	},
	clearLabelDisabled: { color: '#94a3b8', textDecorationLine: 'none' },
	revealBanner: {
		marginTop: 12,
		padding: 12,
		borderRadius: 10,
		backgroundColor: '#f0fdf4',
		borderWidth: 1,
		borderColor: '#bbf7d0',
	},
	revealLabel: {
		fontSize: 12,
		fontWeight: '600',
		color: '#166534',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	revealValue: {
		fontSize: 16,
		fontWeight: '600',
		color: '#0f172a',
		marginVertical: 4,
	},
	revealHint: { fontSize: 11, color: '#15803d' },
	list: { marginTop: 12 },
	separator: { height: 1, backgroundColor: '#e2e8f0' },
	itemRow: { paddingVertical: 8, paddingHorizontal: 4, borderRadius: 6 },
	itemRowHighlighted: { backgroundColor: '#f1f5f9' },
	itemKey: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
	badges: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
	badge: {
		paddingVertical: 2,
		paddingHorizontal: 8,
		borderRadius: 999,
		backgroundColor: '#0f172a',
	},
	badgeSubdued: { backgroundColor: '#e2e8f0' },
	badgeText: { fontSize: 11, color: '#ffffff', fontWeight: '600' },
	badgeTextSubdued: { color: '#475569' },
	empty: {
		fontSize: 13,
		color: '#94a3b8',
		paddingVertical: 16,
		textAlign: 'center',
	},
})

export default StorageCard

import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AccessControlCard from './components/AccessControlCard'
import DiagnosticsCard from './components/DiagnosticsCard'
import KeyRotationCard from './components/KeyRotationCard'
import StorageCard from './components/StorageCard'
import {
	ACCESS_MODES,
	BIOMETRIC_PROMPT,
	DEFAULT_SERVICE,
	type ModeKey,
} from './constants'

const App = () => {
	const [mode, setMode] = useState<ModeKey>('open')

	const { options, prompt } = useMemo(() => {
		const entry =
			ACCESS_MODES.find((candidate) => candidate.key === mode) ??
			ACCESS_MODES[0]
		const isBiometric = entry.key === 'biometric'
		return {
			options: {
				service: DEFAULT_SERVICE,
				accessControl: entry.accessControl,
				...(isBiometric ? { authenticationPrompt: BIOMETRIC_PROMPT } : {}),
			},
			prompt: isBiometric ? BIOMETRIC_PROMPT : undefined,
		}
	}, [mode])

	return (
		<SafeAreaView style={styles.safeArea}>
			<ScrollView
				contentContainerStyle={styles.scroll}
				keyboardShouldPersistTaps="handled"
			>
				<Text style={styles.heading}>Sensitive Info Playground</Text>
				<AccessControlCard mode={mode} onChange={setMode} />
				<StorageCard options={options} authenticationPrompt={prompt} />
				<KeyRotationCard options={options} />
				<DiagnosticsCard options={options} />
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safeArea: { flex: 1, backgroundColor: '#f1f5f9' },
	scroll: { padding: 16, paddingBottom: 32 },
	heading: {
		fontSize: 22,
		fontWeight: '700',
		color: '#0f172a',
		marginBottom: 16,
	},
})

export default App

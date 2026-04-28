import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AccessControlCard from './components/AccessControlCard'
import BiometryStatusCard from './components/BiometryStatusCard'
import DiagnosticsCard from './components/DiagnosticsCard'
import Footer from './components/Footer'
import KeyRotationCard from './components/KeyRotationCard'
import StorageCard from './components/StorageCard'
import { type ModeKey, resolveOptions } from './constants'

const App = () => {
	const [mode, setMode] = useState<ModeKey>('open')
	const { readOptions, writeOptions } = useMemo(
		() => resolveOptions(mode),
		[mode]
	)

	return (
		<SafeAreaView style={styles.safeArea}>
			<ScrollView
				contentContainerStyle={styles.scroll}
				keyboardShouldPersistTaps="handled"
			>
				<Text style={styles.heading}>Sensitive Info Playground</Text>
				<Text style={styles.subheading}>
					Production-ready secure storage with biometric, Secure Enclave, and
					StrongBox-backed policies.
				</Text>
				<AccessControlCard mode={mode} onChange={setMode} />
				<BiometryStatusCard />
				<StorageCard readOptions={readOptions} writeOptions={writeOptions} />
				<KeyRotationCard
					readOptions={readOptions}
					writeOptions={writeOptions}
				/>
				<DiagnosticsCard readOptions={readOptions} />
				<Footer />
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safeArea: { flex: 1, backgroundColor: '#f1f5f9' },
	scroll: { padding: 16, paddingBottom: 32 },
	heading: {
		fontSize: 24,
		fontWeight: '700',
		color: '#0f172a',
		marginBottom: 4,
	},
	subheading: {
		fontSize: 13,
		lineHeight: 18,
		color: '#475569',
		marginBottom: 16,
	},
})

export default App

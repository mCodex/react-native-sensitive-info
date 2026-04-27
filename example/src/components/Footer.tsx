import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import packageJson from '../../../package.json'
import { GITHUB_URL } from '../constants'

const Footer = () => {
	const version = (packageJson as { readonly version?: string }).version

	return (
		<View style={styles.container}>
			<Text style={styles.label}>
				react-native-sensitive-info{version ? ` v${version}` : ''}
			</Text>
			<Pressable
				onPress={() => {
					void Linking.openURL(GITHUB_URL)
				}}
				hitSlop={6}
			>
				<Text style={styles.link}>View on GitHub</Text>
			</Pressable>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		marginTop: 24,
		alignItems: 'center',
		gap: 4,
	},
	label: { fontSize: 11, color: '#94a3b8' },
	link: {
		fontSize: 12,
		fontWeight: '600',
		color: '#1d4ed8',
		textDecorationLine: 'underline',
	},
})

export default Footer

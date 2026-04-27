import {
	StyleSheet,
	Text,
	TextInput,
	type TextInputProps,
	View,
} from 'react-native'

interface FieldProps extends TextInputProps {
	readonly label: string
}

const Field = ({ label, style, ...inputProps }: FieldProps) => (
	<View style={styles.container}>
		<Text style={styles.label}>{label}</Text>
		<TextInput
			autoCapitalize="none"
			autoCorrect={false}
			placeholderTextColor="#94a3b8"
			style={[styles.input, style]}
			{...inputProps}
		/>
	</View>
)

const styles = StyleSheet.create({
	container: { gap: 6 },
	label: { fontSize: 12, fontWeight: '600', color: '#475569' },
	input: {
		borderWidth: 1,
		borderColor: '#e2e8f0',
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 15,
		color: '#0f172a',
		backgroundColor: '#f8fafc',
	},
})

export default Field

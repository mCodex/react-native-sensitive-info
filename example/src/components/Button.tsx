import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'

export type ButtonVariant = 'default' | 'primary' | 'danger'

interface ButtonProps {
	readonly label: string
	readonly onPress: () => void
	readonly disabled?: boolean
	readonly isPending?: boolean
	readonly variant?: ButtonVariant
}

const Button = ({
	label,
	onPress,
	disabled,
	isPending,
	variant = 'default',
}: ButtonProps) => {
	const inverted = variant !== 'default'
	const blocked = disabled || isPending
	return (
		<Pressable
			onPress={onPress}
			disabled={blocked}
			style={[
				styles.base,
				variant === 'primary' && styles.primary,
				variant === 'danger' && styles.danger,
				blocked && styles.disabled,
			]}
		>
			{isPending ? (
				<ActivityIndicator color={inverted ? '#ffffff' : '#0f172a'} />
			) : (
				<Text
					style={[styles.label, inverted && styles.labelInverted]}
					numberOfLines={1}
				>
					{label}
				</Text>
			)}
		</Pressable>
	)
}

const styles = StyleSheet.create({
	base: {
		flex: 1,
		minHeight: 38,
		paddingVertical: 10,
		paddingHorizontal: 6,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: '#cbd5e1',
		alignItems: 'center',
		justifyContent: 'center',
	},
	primary: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
	danger: { backgroundColor: '#b91c1c', borderColor: '#b91c1c' },
	disabled: { opacity: 0.45 },
	label: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
	labelInverted: { color: '#ffffff' },
})

export default Button

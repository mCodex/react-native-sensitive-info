import type { PropsWithChildren } from 'react'
import { StyleSheet, Text, View } from 'react-native'

interface SectionProps {
	readonly title: string
	readonly subtitle?: string
}

const Section = ({
	title,
	subtitle,
	children,
}: PropsWithChildren<SectionProps>) => (
	<View style={styles.container}>
		<Text style={styles.title}>{title}</Text>
		{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
		<View style={styles.body}>{children}</View>
	</View>
)

const styles = StyleSheet.create({
	container: {
		backgroundColor: '#ffffff',
		borderRadius: 14,
		padding: 16,
		marginBottom: 16,
		gap: 4,
		shadowColor: '#0f172a',
		shadowOpacity: 0.06,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 4 },
		elevation: 2,
	},
	title: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
	subtitle: { fontSize: 13, color: '#64748b' },
	body: { marginTop: 8, gap: 12 },
})

export default Section

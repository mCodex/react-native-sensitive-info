import { View, Text, StyleSheet } from 'react-native';
import { darkTheme } from '../styles/darkTheme';

export function AppHeader() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔐 Sensitive Info Demo</Text>
      <Text style={styles.subtitle}>Powered by Nitro Modules ⚡</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: darkTheme.primary,
    paddingTop: darkTheme.spacing.lg,
    paddingBottom: darkTheme.spacing.xl,
    paddingHorizontal: darkTheme.spacing.lg,
    borderBottomLeftRadius: darkTheme.borderRadius.xl,
    borderBottomRightRadius: darkTheme.borderRadius.xl,
    marginBottom: darkTheme.spacing.lg,
  },
  title: {
    fontSize: darkTheme.typography.fontSize.xxl,
    fontWeight: darkTheme.typography.fontWeight.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: darkTheme.spacing.sm,
  },
  subtitle: {
    fontSize: darkTheme.typography.fontSize.md,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
});

import { View, Text, StyleSheet, Switch } from 'react-native';
import type { Theme } from '../types';

interface AppHeaderProps {
  theme: Theme;
  isDarkMode: boolean;
  onThemeToggle: (value: boolean) => void;
}

export function AppHeader({
  theme,
  isDarkMode,
  onThemeToggle,
}: AppHeaderProps) {
  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <Text style={styles.title}>🔐 Sensitive Info Demo</Text>
      <Text style={styles.subtitle}>Powered by Nitro Modules ⚡</Text>

      <View style={styles.controls}>
        <View style={styles.themeToggle}>
          <Text style={[styles.toggleLabel, { color: theme.textSecondary }]}>
            {isDarkMode ? '🌙' : '☀️'} {isDarkMode ? 'Dark' : 'Light'}
          </Text>
          <Switch
            value={isDarkMode}
            onValueChange={onThemeToggle}
            trackColor={{ false: theme.border, true: theme.accent }}
            thumbColor={isDarkMode ? theme.background : theme.primary}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 20,
  },
  controls: {
    alignItems: 'center',
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toggleLabel: {
    fontSize: 14,
    marginRight: 10,
    color: '#FFFFFF',
  },
});

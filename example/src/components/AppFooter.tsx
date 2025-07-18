import { View, Text, StyleSheet, Platform } from 'react-native';
import type { Theme } from '../types';

interface AppFooterProps {
  theme: Theme;
}

export function AppFooter({ theme }: AppFooterProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.footerText, { color: theme.textSecondary }]}>
        🚀 Platform: {Platform.OS} {Platform.Version}
      </Text>
      <Text style={[styles.footerText, { color: theme.textSecondary }]}>
        ⚡ Built with Nitro Modules for ultimate performance
      </Text>
      <Text style={[styles.footerText, { color: theme.accent }]}>
        🔒 Your data is secured with hardware-level encryption
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
});

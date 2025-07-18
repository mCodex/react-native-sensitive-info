import { View, Text, StyleSheet, Platform } from 'react-native';
import type { Theme } from '../types';

interface PerformanceCardProps {
  lastOperation: string;
  theme: Theme;
}

export function PerformanceCard({
  lastOperation,
  theme,
}: PerformanceCardProps) {
  if (!lastOperation) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.accent }]}>
        ⚡ Last Operation
      </Text>
      <Text style={[styles.text, { color: theme.textSecondary }]}>
        {lastOperation}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  text: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

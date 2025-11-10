import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { SensitiveInfoItem } from 'react-native-sensitive-info';
import Card from './Card';

interface SecretsListProps {
  readonly items: SensitiveInfoItem[];
  readonly isLoading: boolean;
  readonly service: string;
}

const SecretsList: React.FC<SecretsListProps> = ({
  items,
  isLoading,
  service,
}) => (
  <Card
    title={
      <Text style={styles.titleRow}>
        Secrets for “{service}”{' '}
        <Text style={styles.countBadge}>{items.length}</Text>
      </Text>
    }
    headerSpacing={16}
  >
    {isLoading ? (
      <View style={styles.loadingRow}>
        <ActivityIndicator color="#2563eb" />
        <Text style={styles.loadingText}>Fetching secrets…</Text>
      </View>
    ) : items.length === 0 ? (
      <Text style={styles.emptyState}>
        Nothing stored yet. Save a secret to see it here.
      </Text>
    ) : (
      <FlatList
        data={items}
        keyExtractor={item => `${item.service}-${item.key}`}
        renderItem={({ item }) => (
          <View style={styles.secretRow}>
            <Text style={styles.secretKey}>{item.key}</Text>
            {item.value ? (
              <Text style={styles.secretValue}>{item.value}</Text>
            ) : (
              <Text style={styles.secretValueMuted}>Locked value</Text>
            )}
            <Text style={styles.secretMeta}>
              Access · {item.metadata.accessControl}
            </Text>
            <Text style={styles.secretMeta}>
              Stored ·{' '}
              {new Date(item.metadata.timestamp * 1000).toLocaleString()}
            </Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        scrollEnabled={false}
      />
    )}
  </Card>
);

const styles = StyleSheet.create({
  titleRow: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  countBadge: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#475569',
  },
  emptyState: {
    fontSize: 14,
    color: '#6b7280',
  },
  secretRow: {
    paddingVertical: 12,
  },
  secretKey: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  secretValue: {
    marginTop: 4,
    fontSize: 15,
    color: '#0f172a',
  },
  secretValueMuted: {
    marginTop: 4,
    fontSize: 15,
    color: '#6b7280',
  },
  secretMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#94a3b8',
  },
  separator: {
    height: 1,
    backgroundColor: '#e2e8f0',
  },
});

export default SecretsList;

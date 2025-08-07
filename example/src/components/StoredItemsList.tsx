import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { StoredItem } from '../types';
import { getItemIcon, getItemColor } from '../utils/helpers';
import { commonStyles } from '../styles/commonStyles';
import { darkTheme } from '../styles/darkTheme';

interface StoredItemsListProps {
  items: StoredItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onRemoveItem: (key: string) => Promise<boolean>;
}

export function StoredItemsList({
  items,
  isLoading,
  onRefresh,
  onRemoveItem,
}: StoredItemsListProps) {
  return (
    <View style={[commonStyles.card, styles.container]}>
      <View style={[commonStyles.cardHeader, styles.header]}>
        <Text style={[commonStyles.subtitle, styles.title]}>
          📋 Stored Items ({items.length})
        </Text>
        <TouchableOpacity
          style={[
            commonStyles.button,
            commonStyles.buttonSecondary,
            styles.refreshButton,
          ]}
          onPress={onRefresh}
          disabled={isLoading}
        >
          <Text style={[commonStyles.buttonText, styles.refreshButtonText]}>
            {isLoading ? '🔄' : '🔄 Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={commonStyles.emptyState}>
          <Text style={[commonStyles.emptyStateText, styles.emptyText]}>
            🔒 No items stored yet
          </Text>
          <Text style={[commonStyles.mutedText, styles.emptySubtext]}>
            Add some data to see it appear here
          </Text>
        </View>
      ) : (
        items.map((item) => (
          <View
            key={item.key}
            style={[
              styles.itemCard,
              { borderLeftColor: getItemColor(item.key) },
            ]}
          >
            <View style={styles.itemHeader}>
              <Text style={styles.itemKey}>
                {getItemIcon(item.key)} {item.key}
              </Text>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => onRemoveItem(item.key)}
              >
                <Text style={styles.deleteButtonText}>🗑️</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.itemValue} selectable>
              {item.value}
              {item.truncated && (
                <Text style={styles.truncatedIndicator}> (truncated)</Text>
              )}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: darkTheme.spacing.lg,
  },
  header: {
    marginBottom: darkTheme.spacing.md,
  },
  title: {
    flex: 1,
    marginBottom: 0,
  },
  refreshButton: {
    paddingHorizontal: darkTheme.spacing.sm,
    paddingVertical: darkTheme.spacing.xs,
  },
  refreshButtonText: {
    fontSize: darkTheme.typography.fontSize.xs,
  },
  emptyText: {
    color: darkTheme.textSecondary,
  },
  emptySubtext: {
    textAlign: 'center',
  },
  itemCard: {
    padding: darkTheme.spacing.md,
    backgroundColor: darkTheme.inputBackground,
    borderRadius: darkTheme.borderRadius.md,
    borderWidth: 1,
    borderColor: darkTheme.border,
    borderLeftWidth: 4,
    marginBottom: darkTheme.spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: darkTheme.spacing.sm,
  },
  itemKey: {
    fontSize: darkTheme.typography.fontSize.md,
    fontWeight: darkTheme.typography.fontWeight.semibold,
    color: darkTheme.text,
    flex: 1,
  },
  deleteButton: {
    backgroundColor: darkTheme.danger,
    paddingHorizontal: darkTheme.spacing.sm,
    paddingVertical: darkTheme.spacing.xs,
    borderRadius: darkTheme.borderRadius.sm,
    marginLeft: darkTheme.spacing.sm,
  },
  deleteButtonText: {
    fontSize: darkTheme.typography.fontSize.xs,
  },
  itemValue: {
    fontSize: darkTheme.typography.fontSize.sm,
    color: darkTheme.textSecondary,
    fontFamily: 'Menlo',
    lineHeight: 20,
  },
  truncatedIndicator: {
    fontStyle: 'italic',
    fontSize: darkTheme.typography.fontSize.xs,
    color: darkTheme.accent,
  },
});

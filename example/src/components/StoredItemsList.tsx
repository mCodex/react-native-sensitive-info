import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Theme, StoredItem } from '../types';
import { getItemIcon, getItemColor } from '../utils/helpers';
import { commonStyles } from '../styles/commonStyles';

interface StoredItemsListProps {
  theme: Theme;
  items: StoredItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onRemoveItem: (key: string) => Promise<boolean>;
}

export function StoredItemsList({
  theme,
  items,
  isLoading,
  onRefresh,
  onRemoveItem,
}: StoredItemsListProps) {
  return (
    <View
      style={[
        commonStyles.section,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={commonStyles.sectionHeader}>
        <Text style={[commonStyles.sectionTitle, { color: theme.text }]}>
          📋 Stored Items ({items.length})
        </Text>
        <TouchableOpacity
          style={[
            commonStyles.refreshButton,
            { backgroundColor: theme.accent },
          ]}
          onPress={onRefresh}
          disabled={isLoading}
        >
          <Text style={commonStyles.refreshButtonText}>
            {isLoading ? '🔄' : '🔄 Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={commonStyles.emptyState}>
          <Text
            style={[
              commonStyles.emptyStateText,
              { color: theme.textSecondary },
            ]}
          >
            🔒 No items stored yet
          </Text>
          <Text
            style={[
              commonStyles.emptyStateSubtext,
              { color: theme.textSecondary },
            ]}
          >
            Add some data to see it appear here
          </Text>
        </View>
      ) : (
        items.map((item) => (
          <View
            key={item.key}
            style={[
              styles.itemCard,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                borderLeftColor: getItemColor(item.key),
              },
            ]}
          >
            <View style={styles.itemHeader}>
              <Text style={[styles.itemKey, { color: theme.text }]}>
                {getItemIcon(item.key)} {item.key}
              </Text>
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: theme.danger }]}
                onPress={() => onRemoveItem(item.key)}
              >
                <Text style={styles.deleteButtonText}>🗑️</Text>
              </TouchableOpacity>
            </View>
            <Text
              style={[styles.itemValue, { color: theme.textSecondary }]}
              selectable
            >
              {item.value}
              {item.truncated && (
                <Text
                  style={[styles.truncatedIndicator, { color: theme.accent }]}
                >
                  {' '}
                  (truncated)
                </Text>
              )}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  itemCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemKey: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  deleteButtonText: {
    fontSize: 12,
  },
  itemValue: {
    fontSize: 14,
    fontFamily: 'Menlo',
    lineHeight: 20,
  },
  truncatedIndicator: {
    fontStyle: 'italic',
    fontSize: 12,
  },
});

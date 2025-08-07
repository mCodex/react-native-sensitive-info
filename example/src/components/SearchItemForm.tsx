import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { commonStyles } from '../styles/commonStyles';
import { darkTheme } from '../styles/darkTheme';

interface SearchItemFormProps {
  isLoading: boolean;
  onSearchItem: (key: string) => Promise<string | null>;
}

export function SearchItemForm({
  isLoading,
  onSearchItem,
}: SearchItemFormProps) {
  const [searchKey, setSearchKey] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);

  const handleSearch = async () => {
    const result = await onSearchItem(searchKey);
    setSearchResult(result);
  };

  return (
    <View style={[commonStyles.card, styles.container]}>
      <Text style={[commonStyles.subtitle, styles.title]}>🔍 Search Item</Text>

      <TextInput
        style={commonStyles.input}
        placeholder="Enter key to search"
        placeholderTextColor={darkTheme.textMuted}
        value={searchKey}
        onChangeText={setSearchKey}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isLoading}
      />

      <TouchableOpacity
        style={[
          commonStyles.button,
          commonStyles.buttonSecondary,
          styles.button,
        ]}
        onPress={handleSearch}
        disabled={isLoading || !searchKey.trim()}
      >
        <Text style={commonStyles.buttonText}>
          {isLoading ? '🔄 Searching...' : '🔍 Search'}
        </Text>
      </TouchableOpacity>

      {searchResult !== null && (
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Result for "{searchKey}":</Text>
          <Text style={styles.resultValue} selectable>
            {searchResult || 'null (not found)'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: darkTheme.spacing.lg,
  },
  title: {
    marginBottom: darkTheme.spacing.md,
  },
  button: {
    marginTop: darkTheme.spacing.sm,
  },
  resultCard: {
    marginTop: darkTheme.spacing.md,
    padding: darkTheme.spacing.md,
    backgroundColor: darkTheme.inputBackground,
    borderRadius: darkTheme.borderRadius.md,
    borderWidth: 1,
    borderColor: darkTheme.border,
  },
  resultLabel: {
    fontSize: darkTheme.typography.fontSize.sm,
    fontWeight: darkTheme.typography.fontWeight.semibold,
    color: darkTheme.textSecondary,
    marginBottom: darkTheme.spacing.xs,
  },
  resultValue: {
    fontSize: darkTheme.typography.fontSize.sm,
    color: darkTheme.text,
    fontFamily: 'Menlo',
    lineHeight: 20,
  },
});

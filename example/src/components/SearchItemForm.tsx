import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import type { Theme } from '../types';
import { commonStyles } from '../styles/commonStyles';

interface SearchItemFormProps {
  theme: Theme;
  isLoading: boolean;
  onSearchItem: (key: string) => Promise<string | null>;
}

export function SearchItemForm({
  theme,
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
    <View
      style={[
        commonStyles.section,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text style={[commonStyles.sectionTitle, { color: theme.text }]}>
        🔍 Search Item
      </Text>

      <TextInput
        style={[
          commonStyles.input,
          {
            backgroundColor: theme.inputBackground,
            borderColor: theme.border,
            color: theme.text,
          },
        ]}
        placeholder="Enter key to search"
        placeholderTextColor={theme.textSecondary}
        value={searchKey}
        onChangeText={setSearchKey}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[
          commonStyles.secondaryButton,
          { backgroundColor: theme.accent },
        ]}
        onPress={handleSearch}
        disabled={isLoading || !searchKey.trim()}
      >
        <Text style={commonStyles.secondaryButtonText}>
          {isLoading ? '🔄 Searching...' : '🔍 Search'}
        </Text>
      </TouchableOpacity>

      {searchResult !== null && (
        <View
          style={[
            commonStyles.resultCard,
            {
              backgroundColor: theme.inputBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <Text
            style={[commonStyles.resultLabel, { color: theme.textSecondary }]}
          >
            Result for "{searchKey}":
          </Text>
          <Text
            style={[commonStyles.resultValue, { color: theme.text }]}
            selectable
          >
            {searchResult || 'null (not found)'}
          </Text>
        </View>
      )}
    </View>
  );
}

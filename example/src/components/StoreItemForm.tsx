import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import type { Theme } from '../types';
import { commonStyles } from '../styles/commonStyles';

interface StoreItemFormProps {
  theme: Theme;
  isLoading: boolean;
  onStoreItem: (key: string, value: string) => Promise<boolean>;
}

export function StoreItemForm({
  theme,
  isLoading,
  onStoreItem,
}: StoreItemFormProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleStore = async () => {
    const success = await onStoreItem(newKey, newValue);
    if (success) {
      setNewKey('');
      setNewValue('');
    }
  };

  return (
    <View
      style={[
        commonStyles.section,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text style={[commonStyles.sectionTitle, { color: theme.text }]}>
        💾 Store New Item
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
        placeholder="Enter key (e.g., 'userToken')"
        placeholderTextColor={theme.textSecondary}
        value={newKey}
        onChangeText={setNewKey}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TextInput
        style={[
          commonStyles.input,
          commonStyles.multilineInput,
          {
            backgroundColor: theme.inputBackground,
            borderColor: theme.border,
            color: theme.text,
          },
        ]}
        placeholder="Enter value (e.g., 'eyJhbGciOiJIUzI1NiIs...')"
        placeholderTextColor={theme.textSecondary}
        value={newValue}
        onChangeText={setNewValue}
        multiline
        numberOfLines={3}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[commonStyles.primaryButton, { backgroundColor: theme.primary }]}
        onPress={handleStore}
        disabled={isLoading || !newKey.trim() || !newValue.trim()}
      >
        <Text style={commonStyles.primaryButtonText}>
          {isLoading ? '🔄 Storing...' : '🔒 Store Securely'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

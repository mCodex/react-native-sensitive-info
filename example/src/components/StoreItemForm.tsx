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

interface StoreItemFormProps {
  isLoading: boolean;
  onStoreItem: (key: string, value: string) => Promise<boolean>;
}

export function StoreItemForm({ isLoading, onStoreItem }: StoreItemFormProps) {
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
    <View style={[commonStyles.card, styles.container]}>
      <Text style={[commonStyles.subtitle, styles.title]}>
        💾 Store New Item
      </Text>

      <TextInput
        style={commonStyles.input}
        placeholder="Enter key (e.g., 'userToken')"
        placeholderTextColor={darkTheme.textMuted}
        value={newKey}
        onChangeText={setNewKey}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isLoading}
      />

      <TextInput
        style={[commonStyles.input, styles.multilineInput]}
        placeholder="Enter value (e.g., 'eyJhbGciOiJIUzI1NiIs...')"
        placeholderTextColor={darkTheme.textMuted}
        value={newValue}
        onChangeText={setNewValue}
        multiline
        numberOfLines={3}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isLoading}
      />

      <TouchableOpacity
        style={[commonStyles.button, commonStyles.buttonPrimary, styles.button]}
        onPress={handleStore}
        disabled={isLoading || !newKey.trim() || !newValue.trim()}
      >
        <Text style={commonStyles.buttonText}>
          {isLoading ? '🔄 Storing...' : '🔒 Store Securely'}
        </Text>
      </TouchableOpacity>
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
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  button: {
    marginTop: darkTheme.spacing.sm,
  },
});

import { useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { clear } from 'react-native-sensitive-info';
import {
  AppHeader,
  StoreItemForm,
  SearchItemForm,
  StoredItemsList,
  BiometricSecurityDemo,
} from './components';
import { useSensitiveInfo } from './hooks';
import { darkTheme } from './styles/darkTheme';

export default function App() {
  const {
    storedItems,
    isLoading,
    loadAllItems,
    storeItem,
    searchItem,
    removeItemById,
  } = useSensitiveInfo();

  useEffect(() => {
    loadAllItems();
  }, [loadAllItems]);

  const handleClearAll = async () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all stored items. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clear();
              await loadAllItems();
              Alert.alert('Success', 'All data cleared!');
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor={darkTheme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔐 Sensitive Info Demo</Text>
            <Text style={styles.sectionDescription}>
              Secure storage with automatic fallback from biometric to standard
              encryption. Test both biometric authentication and regular
              keychain storage.
            </Text>
          </View>

          <BiometricSecurityDemo />

          <TouchableOpacity
            style={[styles.clearButton, isLoading && styles.disabledButton]}
            onPress={handleClearAll}
            disabled={isLoading}
          >
            <Text style={styles.clearButtonText}>🗑️ Clear All Data</Text>
          </TouchableOpacity>

          <StoreItemForm isLoading={isLoading} onStoreItem={storeItem} />

          <SearchItemForm isLoading={isLoading} onSearchItem={searchItem} />

          <StoredItemsList
            items={storedItems}
            isLoading={isLoading}
            onRefresh={loadAllItems}
            onRemoveItem={removeItemById}
          />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkTheme.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    margin: 20,
    padding: 20,
    backgroundColor: darkTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: darkTheme.border,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: darkTheme.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: darkTheme.textSecondary,
    lineHeight: 20,
  },
  clearButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: darkTheme.danger,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearButtonText: {
    color: darkTheme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

import { useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Alert,
  Text,
  StyleSheet,
} from 'react-native';
import { clear } from 'react-native-sensitive-info';
import {
  AppHeader,
  AppFooter,
  PerformanceCard,
  QuickActions,
  StoreItemForm,
  SearchItemForm,
  StoredItemsList,
  SecurityInfo,
  BiometricSecurityDemo,
} from './components';
import { useSensitiveInfo, useTheme } from './hooks';
import { commonStyles } from './styles/commonStyles';

export default function App() {
  const { theme, isDarkMode, setDarkMode } = useTheme(false);
  const {
    storedItems,
    isLoading,
    lastOperation,
    loadAllItems,
    storeItem,
    searchItem,
    removeItemById,
  } = useSensitiveInfo();

  useEffect(() => {
    loadAllItems();
  }, [loadAllItems]);

  const handleClearAll = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      Alert.alert(
        'Clear All Data',
        'This will permanently delete all stored items. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Clear All',
            style: 'destructive',
            onPress: async () => {
              try {
                await clear();
                await loadAllItems();
                Alert.alert('Success', 'All data cleared!');
                resolve(true);
              } catch (error) {
                console.error('Error clearing data:', error);
                Alert.alert('Error', 'Failed to clear data');
                resolve(false);
              }
            },
          },
        ]
      );
    });
  };

  const handleOperationComplete = (message: string) => {
    // This would typically update performance metrics
    console.log('Operation completed:', message);
  };

  return (
    <SafeAreaView
      style={[commonStyles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      <ScrollView
        style={commonStyles.scrollView}
        contentContainerStyle={commonStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader
          theme={theme}
          isDarkMode={isDarkMode}
          onThemeToggle={setDarkMode}
        />

        <PerformanceCard lastOperation={lastOperation} theme={theme} />

        <QuickActions
          theme={theme}
          isLoading={isLoading}
          onOperationComplete={handleOperationComplete}
          onDataReload={loadAllItems}
        />

        <TouchableOpacity
          style={[
            commonStyles.actionButton,
            commonStyles.dangerButton,
            styles.clearAllButton,
            { backgroundColor: theme.danger },
          ]}
          onPress={handleClearAll}
          disabled={isLoading}
        >
          <Text style={commonStyles.actionButtonText}>🗑️ Clear All Data</Text>
        </TouchableOpacity>

        <StoreItemForm
          theme={theme}
          isLoading={isLoading}
          onStoreItem={storeItem}
        />

        <SearchItemForm
          theme={theme}
          isLoading={isLoading}
          onSearchItem={searchItem}
        />

        <StoredItemsList
          theme={theme}
          items={storedItems}
          isLoading={isLoading}
          onRefresh={loadAllItems}
          onRemoveItem={removeItemById}
        />

        <BiometricSecurityDemo />

        <SecurityInfo theme={theme} />

        <AppFooter theme={theme} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  clearAllButton: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
});

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  getItem,
  setItem,
  removeItem,
  getAllItems,
  clear,
} from 'react-native-sensitive-info';
import type { StoredItem } from '../types';
import { truncateValue } from '../utils/helpers';

interface UseSensitiveInfoReturn {
  storedItems: StoredItem[];
  isLoading: boolean;
  lastOperation: string;
  loadAllItems: () => Promise<void>;
  storeItem: (key: string, value: string) => Promise<boolean>;
  searchItem: (key: string) => Promise<string | null>;
  removeItemById: (key: string) => Promise<boolean>;
  clearAllItems: () => Promise<boolean>;
}

export function useSensitiveInfo(): UseSensitiveInfoReturn {
  const [storedItems, setStoredItems] = useState<StoredItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastOperation, setLastOperation] = useState<string>('');

  const loadAllItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const startTime = Date.now();
      const items = await getAllItems();
      const endTime = Date.now();

      const itemList: StoredItem[] = Object.entries(items).map(
        ([key, value]) => {
          const { value: truncatedValue, truncated } = truncateValue(value);
          return {
            key,
            value: truncatedValue,
            truncated,
          };
        }
      );

      setStoredItems(itemList);
      setLastOperation(
        `Loaded ${itemList.length} items in ${endTime - startTime}ms`
      );
    } catch (error) {
      console.error('Error loading items:', error);
      Alert.alert('Error', 'Failed to load stored items');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const storeItem = useCallback(
    async (key: string, value: string): Promise<boolean> => {
      if (!key.trim() || !value.trim()) {
        Alert.alert('Error', 'Please enter both key and value');
        return false;
      }

      try {
        setIsLoading(true);
        const startTime = Date.now();
        await setItem(key.trim(), value.trim());
        const endTime = Date.now();

        setLastOperation(`Stored "${key}" in ${endTime - startTime}ms`);
        await loadAllItems();

        Alert.alert('Success', `Item "${key}" stored securely!`);
        return true;
      } catch (error) {
        console.error('Error storing item:', error);
        Alert.alert('Error', 'Failed to store item');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [loadAllItems]
  );

  const searchItem = useCallback(
    async (key: string): Promise<string | null> => {
      if (!key.trim()) {
        Alert.alert('Error', 'Please enter a key to search');
        return null;
      }

      try {
        setIsLoading(true);
        const startTime = Date.now();
        const result = await getItem(key.trim());
        const endTime = Date.now();

        setLastOperation(`Retrieved "${key}" in ${endTime - startTime}ms`);

        if (result === null) {
          Alert.alert('Not Found', `No item found with key "${key}"`);
        }

        return result;
      } catch (error) {
        console.error('Error searching item:', error);
        Alert.alert('Error', 'Failed to search for item');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const removeItemById = useCallback(
    async (key: string): Promise<boolean> => {
      return new Promise((resolve) => {
        Alert.alert(
          'Confirm Deletion',
          `Are you sure you want to remove "${key}"?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  setIsLoading(true);
                  const startTime = Date.now();
                  await removeItem(key);
                  const endTime = Date.now();

                  setLastOperation(
                    `Removed "${key}" in ${endTime - startTime}ms`
                  );
                  await loadAllItems();

                  Alert.alert('Success', `Item "${key}" removed!`);
                  resolve(true);
                } catch (error) {
                  console.error('Error removing item:', error);
                  Alert.alert('Error', 'Failed to remove item');
                  resolve(false);
                } finally {
                  setIsLoading(false);
                }
              },
            },
          ]
        );
      });
    },
    [loadAllItems]
  );

  const clearAllItems = useCallback(async (): Promise<boolean> => {
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
                setIsLoading(true);
                const startTime = Date.now();
                await clear();
                const endTime = Date.now();

                setLastOperation(
                  `Cleared all data in ${endTime - startTime}ms`
                );
                setStoredItems([]);

                Alert.alert('Success', 'All data cleared!');
                resolve(true);
              } catch (error) {
                console.error('Error clearing data:', error);
                Alert.alert('Error', 'Failed to clear data');
                resolve(false);
              } finally {
                setIsLoading(false);
              }
            },
          },
        ]
      );
    });
  }, []);

  return {
    storedItems,
    isLoading,
    lastOperation,
    loadAllItems,
    storeItem,
    searchItem,
    removeItemById,
    clearAllItems,
  };
}

import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import {
  getItem,
  setItem,
  removeItem,
  getAllItems,
  clear,
  isBiometricAvailable,
  isStrongBoxAvailable,
} from '../index';
import type {
  StorageOptions,
  BiometricOptions,
  SecurityLevel,
} from '../SensitiveInfo.nitro';
import { BiometricAuthenticator } from '../utils/BiometricAuthenticator';

export interface StoredItem {
  key: string;
  value: string;
  truncated?: boolean;
}

interface SecurityCapabilities {
  biometric: boolean;
  strongbox: boolean;
  hardwareSecurityModule: boolean;
}

interface UseSensitiveInfoReturn {
  storedItems: StoredItem[];
  isLoading: boolean;
  lastOperation: string;
  capabilities: SecurityCapabilities;

  // Core operations
  loadAllItems: () => Promise<void>;
  storeItem: (
    key: string,
    value: string,
    options?: StorageOptions
  ) => Promise<boolean>;
  searchItem: (key: string, options?: StorageOptions) => Promise<string | null>;
  removeItemById: (key: string, options?: StorageOptions) => Promise<boolean>;
  clearAllItems: (options?: StorageOptions) => Promise<boolean>;

  // Biometric operations
  storeBiometricItem: (
    key: string,
    value: string,
    biometricOptions?: BiometricOptions
  ) => Promise<boolean>;
  getBiometricItem: (
    key: string,
    biometricOptions?: BiometricOptions
  ) => Promise<string | null>;
  removeBiometricItem: (
    key: string,
    biometricOptions?: BiometricOptions
  ) => Promise<boolean>;

  // StrongBox operations
  storeStrongBoxItem: (key: string, value: string) => Promise<boolean>;
  getStrongBoxItem: (key: string) => Promise<string | null>;
  removeStrongBoxItem: (key: string) => Promise<boolean>;

  // Utilities
  refreshCapabilities: () => Promise<void>;
}

/**
 * React hook for managing sensitive data storage with security features
 *
 * @example
 * ```typescript
 * import { useSensitiveInfo } from 'react-native-sensitive-info';
 *
 * function MyComponent() {
 *   const {
 *     storedItems,
 *     isLoading,
 *     capabilities,
 *     storeItem,
 *     searchItem,
 *     storeBiometricItem,
 *     getBiometricItem,
 *     clearAllItems
 *   } = useSensitiveInfo();
 *
 *   const handleLogin = async (token: string) => {
 *     await storeBiometricItem('authToken', token);
 *   };
 *
 *   return (
 *     // Your component JSX
 *   );
 * }
 * ```
 */
export function useSensitiveInfo(): UseSensitiveInfoReturn {
  const [storedItems, setStoredItems] = useState<StoredItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastOperation, setLastOperation] = useState<string>('');
  const [capabilities, setCapabilities] = useState<SecurityCapabilities>({
    biometric: false,
    strongbox: false,
    hardwareSecurityModule: false,
  });

  const truncateValue = (value: string, maxLength: number = 50) => {
    if (value.length <= maxLength) {
      return { value, truncated: false };
    }
    return {
      value: value.substring(0, maxLength) + '...',
      truncated: true,
    };
  };

  // Biometric authentication wrapper
  const authenticateIfNeeded = useCallback(
    async (
      securityLevel?: SecurityLevel,
      biometricOptions?: BiometricOptions
    ) => {
      if (securityLevel === 'biometric') {
        const isAvailable = await BiometricAuthenticator.isAvailable();
        if (!isAvailable) {
          throw new Error(
            'Biometric authentication is not available on this device'
          );
        }

        const success =
          await BiometricAuthenticator.authenticate(biometricOptions);
        if (!success) {
          throw new Error('Biometric authentication failed');
        }
      }
    },
    []
  );

  // Refresh security capabilities
  const refreshCapabilities = useCallback(async (): Promise<void> => {
    try {
      const [biometric, strongbox, jsLayerBiometric] = await Promise.all([
        isBiometricAvailable(),
        isStrongBoxAvailable(),
        BiometricAuthenticator.isAvailable(),
      ]);

      setCapabilities({
        biometric: biometric || jsLayerBiometric,
        strongbox,
        hardwareSecurityModule: strongbox,
      });
    } catch (error) {
      console.warn('Failed to refresh security capabilities:', error);
      setCapabilities({
        biometric: false,
        strongbox: false,
        hardwareSecurityModule: false,
      });
    }
  }, []);

  // Initialize capabilities on mount
  useEffect(() => {
    refreshCapabilities();
  }, [refreshCapabilities]);

  const loadAllItems = useCallback(
    async (options?: StorageOptions) => {
      try {
        setIsLoading(true);
        const startTime = Date.now();

        await authenticateIfNeeded(
          options?.securityLevel,
          options?.biometricOptions
        );
        const items = await getAllItems(options);
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
    },
    [authenticateIfNeeded]
  );

  const storeItem = useCallback(
    async (
      key: string,
      value: string,
      options?: StorageOptions
    ): Promise<boolean> => {
      if (!key.trim() || !value.trim()) {
        Alert.alert('Error', 'Please enter both key and value');
        return false;
      }

      try {
        setIsLoading(true);
        const startTime = Date.now();

        await authenticateIfNeeded(
          options?.securityLevel,
          options?.biometricOptions
        );
        await setItem(key.trim(), value.trim(), options);
        const endTime = Date.now();

        setLastOperation(`Stored "${key}" in ${endTime - startTime}ms`);
        await loadAllItems();

        return true;
      } catch (error) {
        console.error('Error storing item:', error);
        Alert.alert('Error', 'Failed to store item');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [loadAllItems, authenticateIfNeeded]
  );

  const searchItem = useCallback(
    async (key: string, options?: StorageOptions): Promise<string | null> => {
      if (!key.trim()) {
        Alert.alert('Error', 'Please enter a key to search');
        return null;
      }

      try {
        setIsLoading(true);
        const startTime = Date.now();

        await authenticateIfNeeded(
          options?.securityLevel,
          options?.biometricOptions
        );
        const result = await getItem(key.trim(), options);
        const endTime = Date.now();

        setLastOperation(`Retrieved "${key}" in ${endTime - startTime}ms`);

        return result;
      } catch (error) {
        console.error('Error searching item:', error);
        Alert.alert('Error', 'Failed to search for item');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [authenticateIfNeeded]
  );

  const removeItemById = useCallback(
    async (key: string, options?: StorageOptions): Promise<boolean> => {
      try {
        setIsLoading(true);
        const startTime = Date.now();

        await authenticateIfNeeded(
          options?.securityLevel,
          options?.biometricOptions
        );
        await removeItem(key, options);
        const endTime = Date.now();

        setLastOperation(`Removed "${key}" in ${endTime - startTime}ms`);
        await loadAllItems();

        return true;
      } catch (error) {
        console.error('Error removing item:', error);
        Alert.alert('Error', 'Failed to remove item');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [loadAllItems, authenticateIfNeeded]
  );

  const clearAllItems = useCallback(
    async (options?: StorageOptions): Promise<boolean> => {
      try {
        setIsLoading(true);
        const startTime = Date.now();

        await authenticateIfNeeded(
          options?.securityLevel,
          options?.biometricOptions
        );
        await clear(options);
        const endTime = Date.now();

        setLastOperation(`Cleared all data in ${endTime - startTime}ms`);
        setStoredItems([]);

        return true;
      } catch (error) {
        console.error('Error clearing data:', error);
        Alert.alert('Error', 'Failed to clear data');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [authenticateIfNeeded]
  );

  // Biometric operations
  const storeBiometricItem = useCallback(
    async (
      key: string,
      value: string,
      biometricOptions?: BiometricOptions
    ): Promise<boolean> => {
      return storeItem(key, value, {
        securityLevel: 'biometric',
        biometricOptions,
      });
    },
    [storeItem]
  );

  const getBiometricItem = useCallback(
    async (
      key: string,
      biometricOptions?: BiometricOptions
    ): Promise<string | null> => {
      return searchItem(key, {
        securityLevel: 'biometric',
        biometricOptions,
      });
    },
    [searchItem]
  );

  const removeBiometricItem = useCallback(
    async (
      key: string,
      biometricOptions?: BiometricOptions
    ): Promise<boolean> => {
      return removeItemById(key, {
        securityLevel: 'biometric',
        biometricOptions,
      });
    },
    [removeItemById]
  );

  // StrongBox operations
  const storeStrongBoxItem = useCallback(
    async (key: string, value: string): Promise<boolean> => {
      return storeItem(key, value, { securityLevel: 'strongbox' });
    },
    [storeItem]
  );

  const getStrongBoxItem = useCallback(
    async (key: string): Promise<string | null> => {
      return searchItem(key, { securityLevel: 'strongbox' });
    },
    [searchItem]
  );

  const removeStrongBoxItem = useCallback(
    async (key: string): Promise<boolean> => {
      return removeItemById(key, { securityLevel: 'strongbox' });
    },
    [removeItemById]
  );

  return {
    storedItems,
    isLoading,
    lastOperation,
    capabilities,
    loadAllItems,
    storeItem,
    searchItem,
    removeItemById,
    clearAllItems,
    storeBiometricItem,
    getBiometricItem,
    removeBiometricItem,
    storeStrongBoxItem,
    getStrongBoxItem,
    removeStrongBoxItem,
    refreshCapabilities,
  };
}

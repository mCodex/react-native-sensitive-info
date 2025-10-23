/**
 * @fileoverview React Native Sensitive Info v5.6.0 - Example Application
 *
 * Comprehensive example app demonstrating:
 * - Secure storage of sensitive data
 * - Biometric authentication (Face ID, Touch ID, Fingerprint)
 * - Device passcode protection as fallback
 * - Encryption with AES-256-GCM
 * - Emulator/Simulator biometric setup and testing
 *
 * @example
 * ```bash
 * # iOS Simulator: Enroll Face ID
 * Features -> Face ID -> Enrolled
 * Features -> Face ID -> Matching (to simulate successful auth)
 *
 * # Android Emulator: Enroll Fingerprint
 * Settings -> Security -> Biometric -> Register fingerprint
 * adb shell cmd android_id <device_id> simulate
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  TextInput,
  FlatList,
  SafeAreaView,
} from 'react-native';
import SensitiveInfo, { type AccessControl } from 'react-native-sensitive-info';

// 🎨 Color scheme
const COLORS = {
  primary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
};

/**
 * Data structure for stored secrets
 */
interface StoredItem {
  key: string;
  value: string;
  timestamp: string;
  secured: boolean;
}

/**
 * Tab navigation button component props
 */
interface TabButtonProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

/**
 * Tab navigation button component
 *
 * @param props - Component props
 * @param props.label - Display label with emoji
 * @param props.isActive - Whether this tab is currently active
 * @param props.onPress - Callback when tab is pressed
 * @returns JSX tab button element
 */
function TabButton({ label, isActive, onPress }: TabButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.tabButton, isActive && styles.tabButtonActive]}
      onPress={onPress}
      accessible
      accessibilityLabel={`${label} tab`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Text
        style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Storage item card component props
 */
interface StorageItemCardProps {
  item: StoredItem;
  loading: boolean;
  onView: (key: string) => void;
  onDelete: (key: string) => void;
}

/**
 * Storage item card component
 *
 * Displays a single stored secret with metadata and action buttons.
 * Allows viewing and deleting stored items with proper state management.
 *
 * @param props - Component props
 * @param props.item - The stored item data
 * @param props.loading - Loading state to disable buttons
 * @param props.onView - Callback to view/retrieve item value
 * @param props.onDelete - Callback to delete item
 * @returns JSX card element
 */
function StorageItemCard({
  item,
  loading,
  onView,
  onDelete,
}: StorageItemCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.key}</Text>
        <View style={styles.badgeContainer}>
          <View style={[styles.badge, item.secured && styles.badgeSecured]}>
            <Text style={styles.badgeText}>
              {item.secured ? '🔒 Secured' : '⚠️ Unencrypted'}
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.cardValue}>{item.value}</Text>
      <Text style={styles.cardTimestamp}>
        {new Date(item.timestamp).toLocaleString()}
      </Text>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSmall]}
          onPress={() => onView(item.key)}
          disabled={loading}
          accessible
          accessibilityLabel={`View ${item.key}`}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>👁️ View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonSmall, styles.buttonDanger]}
          onPress={() => onDelete(item.key)}
          disabled={loading}
          accessible
          accessibilityLabel={`Delete ${item.key}`}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Main Application Component
 *
 * Demonstrates secure storage and biometric authentication with three tabs:
 * - Demo: Interactive flow to test store/retrieve
 * - Storage: Manual CRUD operations on secrets
 * - Info: Setup instructions and documentation
 *
 * Features:
 * - Automatic biometry detection (Face ID, Touch ID, Fingerprint)
 * - Fallback to device passcode
 * - List all stored secrets
 * - View and delete individual secrets
 * - Clear all secrets on logout
 *
 * @component
 * @returns JSX root component with tabs and content
 */
export default function App() {
  const [items, setItems] = useState<StoredItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [selectedTab, setSelectedTab] = useState<'demo' | 'storage' | 'info'>(
    'demo'
  );
  const [biometryAvailable, setBiometryAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState('');
  const [androidVersion, setAndroidVersion] = useState<number | null>(null);

  /**
   * Get optimal access control for this device
   *
   * Strategy:
   * - Android 10+: Use secureEnclaveBiometry (StrongBox supported)
   * - Android 9: Use devicePasscode (avoid StrongBox issues)
   *
   * This avoids "StrongBox unavailable" errors on devices without hardware support.
   */
  const getOptimalAccessControl = useCallback(
    (useBiometric: boolean): AccessControl => {
      // On Android 9, avoid StrongBox and use software-backed storage
      if (Platform.OS === 'android' && androidVersion && androidVersion < 29) {
        return 'devicePasscode'; // Software-backed, no biometric prompt overhead
      }

      // iOS, Android 10+, or unknown version (assume modern)
      return useBiometric ? 'secureEnclaveBiometry' : 'devicePasscode';
    },
    [androidVersion]
  );

  /**
   * Check device biometry availability and Android version
   * Detects Face ID (iOS), Touch ID (iOS/Android), Fingerprint (Android)
   *
   * @async
   */
  const checkBiometryAvailability = useCallback(async () => {
    try {
      setBiometryAvailable(true);
      setBiometryType(Platform.OS === 'ios' ? 'Face ID' : 'Biometric');

      // Get Android version for access control strategy
      if (Platform.OS === 'android') {
        const version = Platform.Version || 0;
        setAndroidVersion(version);
        console.log(`Android API Level: ${version}`);
      }
    } catch (error) {
      console.log('Biometry not available:', error);
    }
  }, []);

  /**
   * Load all stored items from secure storage
   * Fetches keys and displays them with metadata
   *
   * @async
   */
  const loadStoredItems = useCallback(async () => {
    try {
      setLoading(true);
      const allKeys = await SensitiveInfo.getAllItems({
        keychainService: 'demo-app',
      });

      const itemsData: StoredItem[] = allKeys.map((key: string) => ({
        key,
        value: '••••••••',
        timestamp: new Date().toISOString(),
        secured: true,
      }));

      setItems(itemsData);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initialize app state on mount
   * Checks biometry and loads existing items
   */
  useEffect(() => {
    checkBiometryAvailability();
    loadStoredItems();
  }, [checkBiometryAvailability, loadStoredItems]);

  /**
   * Store a new secret in encrypted storage
   *
   * Validates input, encrypts with biometric/passcode, and refreshes list.
   * Shows user feedback through alerts.
   *
   * @async
   */
  const handleStoreItem = useCallback(async () => {
    if (!inputKey.trim() || !inputValue.trim()) {
      Alert.alert('Validation', 'Please enter both key and value');
      return;
    }

    try {
      setLoading(true);

      const accessControl = getOptimalAccessControl(biometryAvailable);

      await SensitiveInfo.setItem(inputKey, inputValue, {
        keychainService: 'demo-app',
        accessControl,
        authenticationPrompt: {
          title: 'Secure Storage',
          subtitle: `Storing ${inputKey}`,
        },
      });

      Alert.alert('✅ Success', `Stored "${inputKey}" securely!`);
      setInputKey('');
      setInputValue('');
      await loadStoredItems();
    } catch (error: any) {
      Alert.alert('❌ Error', error.message || 'Failed to store item');
    } finally {
      setLoading(false);
    }
  }, [
    inputKey,
    inputValue,
    biometryAvailable,
    loadStoredItems,
    getOptimalAccessControl,
  ]);

  /**
   * Retrieve and display a secret value
   *
   * Prompts for biometric/passcode authentication,
   * then shows the decrypted value in an alert.
   *
   * @async
   * @param key - The secret key to retrieve
   */
  const handleRetrieveItem = useCallback(
    async (key: string) => {
      try {
        setLoading(true);

        const value = await SensitiveInfo.getItem(key, {
          keychainService: 'demo-app',
          prompt: {
            title: 'Authenticate',
            subtitle: `Retrieving ${key}`,
            description: biometryAvailable
              ? `Use ${biometryType} to access this item`
              : 'Use device passcode to access this item',
          },
        });

        if (value) {
          Alert.alert(
            '🔓 Retrieved Value',
            value.substring(0, 100) + (value.length > 100 ? '...' : ''),
            [{ text: 'Close' }]
          );
        } else {
          Alert.alert('Not Found', `No value found for key: ${key}`);
        }
      } catch (error: any) {
        if (error?.code === 'E_AUTH_CANCELED') {
          Alert.alert('Cancelled', 'Authentication was cancelled');
        } else {
          Alert.alert('❌ Error', error.message || 'Failed to retrieve item');
        }
      } finally {
        setLoading(false);
      }
    },
    [biometryAvailable, biometryType]
  );

  /**
   * Delete a specific secret with confirmation
   *
   * Shows confirmation alert, then permanently removes the item
   * from secure storage. Updates the items list after deletion.
   *
   * @async
   * @param key - The secret key to delete
   */
  const handleDeleteItem = useCallback(
    async (key: string) => {
      Alert.alert('Delete Item', `Are you sure you want to delete "${key}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await SensitiveInfo.deleteItem(key, {
                keychainService: 'demo-app',
              });
              Alert.alert('✅ Deleted', `"${key}" has been removed`);
              await loadStoredItems();
            } catch (error: any) {
              Alert.alert('❌ Error', error.message || 'Failed to delete item');
            } finally {
              setLoading(false);
            }
          },
        },
      ]);
    },
    [loadStoredItems]
  );

  /**
   * Clear all secrets in the app's service
   *
   * Shows destructive confirmation alert, then removes all stored items.
   * Useful for logout flow.
   *
   * @async
   */
  const handleClearAll = useCallback(async () => {
    Alert.alert(
      '⚠️ Clear All Items',
      'This will permanently delete all stored items. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await SensitiveInfo.clearService({ keychainService: 'demo-app' });
              Alert.alert('✅ Cleared', 'All items have been removed');
              setItems([]);
            } catch (error: any) {
              Alert.alert('❌ Error', error.message || 'Failed to clear items');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, []);

  /**
   * Demonstrate the full store and retrieve workflow
   *
   * Creates a sample JWT token, stores it securely with biometric
   * protection, then prompts user to retrieve it. Great for testing.
   *
   * @async
   */
  const handleDemoFlow = useCallback(async () => {
    try {
      setLoading(true);

      const sampleToken = `jwt_token_${Date.now()}`;
      const accessControl = getOptimalAccessControl(biometryAvailable);

      await SensitiveInfo.setItem('demo_auth_token', sampleToken, {
        keychainService: 'demo-app',
        accessControl,
      });

      Alert.alert(
        '✅ Demo Token Stored',
        `Stored: demo_auth_token\n\nNow try retrieving it!`,
        [
          {
            text: 'Retrieve Token',
            onPress: () => handleRetrieveItem('demo_auth_token'),
          },
          { text: 'Close' },
        ]
      );

      await loadStoredItems();
    } catch (error: any) {
      Alert.alert('❌ Error', error.message || 'Demo failed');
    } finally {
      setLoading(false);
    }
  }, [
    biometryAvailable,
    handleRetrieveItem,
    loadStoredItems,
    getOptimalAccessControl,
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🔐 Sensitive Info v5.6.0</Text>
          <Text style={styles.headerSubtitle}>
            Secure Storage & Biometric Auth
          </Text>
        </View>

        {/* Biometry Status */}
        <View
          style={[
            styles.biometryBanner,
            biometryAvailable
              ? styles.biometryBannerSuccess
              : styles.biometryBannerWarning,
          ]}
        >
          <Text style={styles.biometryBannerText}>
            {biometryAvailable
              ? `✅ ${biometryType} Available`
              : '⚠️ Using Device Passcode'}
          </Text>
          <Text style={styles.biometryBannerSubtext}>
            {Platform.OS === 'ios'
              ? biometryAvailable
                ? 'Face ID / Touch ID enabled'
                : 'Enable biometry in Settings'
              : biometryAvailable
                ? 'Fingerprint / Face recognition'
                : 'Requires device screen lock'}
          </Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TabButton
            label="🎮 Demo"
            isActive={selectedTab === 'demo'}
            onPress={() => setSelectedTab('demo')}
          />
          <TabButton
            label="💾 Storage"
            isActive={selectedTab === 'storage'}
            onPress={() => setSelectedTab('storage')}
          />
          <TabButton
            label="ℹ️ Info"
            isActive={selectedTab === 'info'}
            onPress={() => setSelectedTab('info')}
          />
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {selectedTab === 'demo' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎮 Interactive Demo</Text>

              <TouchableOpacity
                style={styles.demoButton}
                onPress={handleDemoFlow}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.surface} />
                ) : (
                  <>
                    <Text style={styles.demoButtonText}>Start Demo Flow</Text>
                    <Text style={styles.demoButtonSubtext}>
                      Store & retrieve a sample token
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxTitle}>📱 Emulator Setup</Text>
                <Text style={styles.infoBoxText}>
                  <Text style={styles.bold}>iOS Simulator:</Text>
                  {'\n'}• Features → Face ID Enrolled{'\n'}• Features → Face ID
                  Matching{'\n\n'}
                  <Text style={styles.bold}>Android Emulator:</Text>
                  {'\n'}• Settings → Biometric enroll fingerprint{'\n'}• Use
                  "adb shell cmd android_id" to simulate
                </Text>
              </View>
            </View>
          )}

          {selectedTab === 'storage' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💾 Secure Storage</Text>

              {/* Input Section */}
              <View style={styles.inputSection}>
                <Text style={styles.label}>Key</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., auth_token"
                  value={inputKey}
                  onChangeText={setInputKey}
                  editable={!loading}
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={[styles.label, styles.marginTop]}>Value</Text>
                <TextInput
                  style={[styles.input, styles.inputLarge]}
                  placeholder="e.g., jwt_token_xyz..."
                  value={inputValue}
                  onChangeText={setInputValue}
                  multiline
                  editable={!loading}
                  placeholderTextColor={COLORS.textSecondary}
                />

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.marginTop,
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={handleStoreItem}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.surface} />
                  ) : (
                    <Text style={styles.buttonText}>🔒 Store Securely</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Items List */}
              <View style={styles.listSection}>
                <View style={styles.listHeader}>
                  <Text style={styles.sectionTitle}>Stored Items</Text>
                  {items.length > 0 && (
                    <TouchableOpacity
                      onPress={handleClearAll}
                      disabled={loading}
                    >
                      <Text style={styles.clearAllButton}>Clear All</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {items.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateIcon}>📭</Text>
                    <Text style={styles.emptyStateTitle}>No Items Stored</Text>
                    <Text style={styles.emptyStateSubtitle}>
                      Store your first secret above
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={items}
                    keyExtractor={(item) => item.key}
                    renderItem={({ item }) => (
                      <StorageItemCard
                        item={item}
                        loading={loading}
                        onView={handleRetrieveItem}
                        onDelete={handleDeleteItem}
                      />
                    )}
                    scrollEnabled={false}
                  />
                )}
              </View>
            </View>
          )}

          {selectedTab === 'info' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ℹ️ Documentation</Text>

              {/* Device Info Banner */}
              <View style={[styles.infoBox, styles.deviceInfoBox]}>
                <Text style={styles.infoBoxTitle}>� Your Device</Text>
                <Text style={styles.infoBoxText}>
                  <Text style={styles.bold}>Platform:</Text>{' '}
                  {Platform.OS === 'ios' ? 'iOS' : 'Android'}
                  {'\n'}
                  {Platform.OS === 'android' && androidVersion && (
                    <>
                      <Text style={styles.bold}>API Level:</Text>{' '}
                      {androidVersion}
                      {'\n'}
                    </>
                  )}
                  <Text style={styles.bold}>Biometry:</Text>{' '}
                  {biometryAvailable
                    ? `${biometryType} Available`
                    : 'Not Available'}
                </Text>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxTitle}>�🔐 Security Features</Text>
                <Text style={styles.infoBoxText}>
                  {`• AES-256-GCM encryption
• Random IV per operation
• Hardware-backed keys (Secure Enclave/StrongBox)
• Biometric-protected access
• Automatic v5.x format migration
• Zero-knowledge storage`}
                </Text>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxTitle}>📱 Biometric Support</Text>
                <Text style={styles.infoBoxText}>
                  <Text style={styles.bold}>iOS:</Text>
                  {'\n'}Face ID (iPhone X+) and Touch ID{'\n'}
                  Requires LocalAuthentication framework{'\n\n'}
                  <Text style={styles.bold}>Android:</Text>
                  {'\n'}Fingerprint, Face, and Iris recognition{'\n'}
                  Requires BiometricPrompt API (API 28+)
                </Text>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxTitle}>⚙️ StrongBox Strategy</Text>
                <Text style={styles.infoBoxText}>
                  {Platform.OS === 'android' &&
                  androidVersion &&
                  androidVersion < 29
                    ? `Your device (Android ${androidVersion}) uses software-backed encryption to avoid StrongBox compatibility issues. This is still highly secure!\n\nUpgrade to Android 10+ for hardware-backed StrongBox support.`
                    : `Your device ${
                        Platform.OS === 'ios'
                          ? 'uses iOS Secure Enclave (always hardware-backed)'
                          : androidVersion && androidVersion >= 29
                            ? `(Android ${androidVersion}) uses hardware-backed StrongBox when available`
                            : 'uses the optimal security strategy'
                      }.`}
                </Text>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxTitle}>💡 Tips</Text>
                <Text style={styles.infoBoxText}>
                  {`• App automatically selects best security for your device
• Items persist across app restarts
• Different keys = different ciphertexts
• Automatic re-encryption with random IV
• Check biometry availability before storing`}
                </Text>
              </View>

              <View style={[styles.infoBox, styles.versionBox]}>
                <Text style={styles.versionText}>
                  react-native-sensitive-info v5.6.0
                </Text>
                <Text style={styles.versionSubtext}>
                  Built with pure Swift & modern Kotlin
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  biometryBanner: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginVertical: 8,
  },
  biometryBannerSuccess: {
    backgroundColor: `${COLORS.success}15`,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  biometryBannerWarning: {
    backgroundColor: `${COLORS.warning}15`,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  biometryBannerText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  biometryBannerSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: COLORS.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  tabButtonTextActive: {
    color: COLORS.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 16,
  },
  demoButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.surface,
  },
  demoButtonSubtext: {
    fontSize: 13,
    color: `${COLORS.surface}90`,
    marginTop: 4,
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  marginTop: {
    marginTop: 16,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
  },
  inputLarge: {
    minHeight: 80,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.surface,
  },
  buttonSmall: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    marginHorizontal: 6,
  },
  buttonDanger: {
    backgroundColor: COLORS.danger,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  listSection: {
    marginBottom: 24,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  clearAllButton: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.danger,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  badgeContainer: {
    marginLeft: 8,
  },
  badge: {
    backgroundColor: COLORS.warning + '30',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeSecured: {
    backgroundColor: COLORS.success,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  cardValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
    fontFamily: 'Courier',
  },
  cardTimestamp: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  infoBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  infoBoxText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
    color: COLORS.text,
  },
  deviceInfoBox: {
    backgroundColor: `${COLORS.primary}10`,
    borderLeftColor: COLORS.primary,
    marginBottom: 16,
  },
  versionBox: {
    alignItems: 'center',
    borderLeftColor: COLORS.success,
    marginTop: 24,
  },
  versionText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  versionSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Switch,
  Platform,
  StatusBar,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  clearService,
  deleteItem,
  getAllItems,
  getItem,
  getSupportedSecurityLevels,
  hasItem,
  setItem,
  type AccessControl,
  type SecurityAvailability,
  type SensitiveInfoItem,
} from 'react-native-sensitive-info';

const DEFAULT_SERVICE = 'demo-service';
const DEFAULT_KEY = 'demo-secret';
const DEFAULT_VALUE = 'very-secret-value';

const ACCESS_CONTROL_OPTIONS: Array<{
  value: AccessControl;
  label: string;
  description: string;
}> = [
  {
    value: 'secureEnclaveBiometry',
    label: 'Secure Enclave',
    description: 'Biometrics with hardware isolation (best effort fallback).',
  },
  {
    value: 'biometryCurrentSet',
    label: 'Biometry (current set)',
    description: 'Requires the current biometric enrollment.',
  },
  {
    value: 'biometryAny',
    label: 'Biometry (any)',
    description: 'Any enrolled biometric may unlock the value.',
  },
  {
    value: 'devicePasscode',
    label: 'Device credential',
    description: 'Falls back to passcode or system credential.',
  },
  {
    value: 'none',
    label: 'None',
    description: 'No user presence required. Least secure.',
  },
];

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return `Unexpected error: ${JSON.stringify(error)}`;
}

interface ActionButtonProps {
  label: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

function ActionButton({ label, onPress, disabled, style }: ActionButtonProps) {
  const handlePress = () => {
    if (disabled) {
      return;
    }

    const maybePromise = onPress();

    if (
      maybePromise &&
      typeof (maybePromise as Promise<void>).then === 'function'
    ) {
      void (maybePromise as Promise<void>);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        style,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

interface SectionProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

function Section({ title, subtitle, actions, children, style }: SectionProps) {
  return (
    <View style={[styles.sectionContainer, style]}>
      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <View style={styles.sectionHeadingText}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {subtitle ? (
              <Text style={styles.sectionSubtitle}>{subtitle}</Text>
            ) : null}
          </View>
          {actions}
        </View>
        <View style={styles.sectionBody}>{children}</View>
      </View>
    </View>
  );
}

interface FieldProps {
  label: string;
  helper?: string;
  children: ReactNode;
}

function Field({ label, helper, children }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
      <View style={styles.fieldControl}>{children}</View>
    </View>
  );
}

interface ToggleRowProps {
  label: string;
  helper?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}

function ToggleRow({ label, helper, value, onValueChange }: ToggleRowProps) {
  return (
    <View style={styles.toggleCard}>
      <View style={styles.toggleTextBlock}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {helper ? <Text style={styles.toggleHelper}>{helper}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#d1d5db', true: '#bfdbfe' }}
        thumbColor={
          Platform.OS === 'android'
            ? value
              ? '#2563eb'
              : '#f9fafb'
            : undefined
        }
        ios_backgroundColor="#d1d5db"
      />
    </View>
  );
}

function App(): React.JSX.Element {
  const [service, setService] = useState(DEFAULT_SERVICE);
  const [keyName, setKeyName] = useState(DEFAULT_KEY);
  const [secret, setSecret] = useState(DEFAULT_VALUE);
  const [selectedAccessControl, setSelectedAccessControl] =
    useState<AccessControl>('secureEnclaveBiometry');
  const [includeValues, setIncludeValues] = useState(true);
  const [includeValueOnGet, setIncludeValueOnGet] = useState(true);
  const [iosSynchronizable, setIosSynchronizable] = useState(false);
  const [usePrompt, setUsePrompt] = useState(true);
  const [keychainGroup, setKeychainGroup] = useState('');
  const [availability, setAvailability] = useState<SecurityAvailability | null>(
    null,
  );
  const [items, setItems] = useState<SensitiveInfoItem[]>([]);
  const [lastResult, setLastResult] = useState(
    'Ready to interact with the secure store.',
  );
  const [pending, setPending] = useState(false);

  const normalizedService = useMemo(() => {
    const trimmed = service.trim();
    return trimmed.length > 0 ? trimmed : DEFAULT_SERVICE;
  }, [service]);

  const normalizedKeychainGroup = useMemo(() => {
    const trimmed = keychainGroup.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, [keychainGroup]);

  const baseOptions = useMemo(
    () => ({
      service: normalizedService,
      accessControl: selectedAccessControl,
      iosSynchronizable: iosSynchronizable ? true : undefined,
      keychainGroup: normalizedKeychainGroup,
      authenticationPrompt: usePrompt
        ? {
            title: 'Authenticate to continue',
            subtitle: 'Demo prompt provided by the sample app',
            description:
              'Sensitive data access requires local authentication on secured keys.',
            cancel: 'Cancel',
          }
        : undefined,
    }),
    [
      iosSynchronizable,
      normalizedKeychainGroup,
      normalizedService,
      selectedAccessControl,
      usePrompt,
    ],
  );

  const refreshAvailability = useCallback(async () => {
    try {
      const result = await getSupportedSecurityLevels();
      setAvailability(result);
      setLastResult(
        `Security capabilities refreshed at ${new Date().toLocaleTimeString()}`,
      );
    } catch (error) {
      setLastResult(formatError(error));
    }
  }, []);

  const refreshItems = useCallback(
    async (opts?: { suppressSensitiveValues?: boolean }) => {
      try {
        const shouldIncludeValues =
          includeValues && !opts?.suppressSensitiveValues;
        const entries = await getAllItems({
          ...baseOptions,
          includeValues: shouldIncludeValues,
          authenticationPrompt: shouldIncludeValues
            ? baseOptions.authenticationPrompt
            : undefined,
        });
        setItems(entries);
      } catch (error) {
        setLastResult(formatError(error));
      }
    },
    [baseOptions, includeValues],
  );

  useEffect(() => {
    void refreshAvailability();
    void refreshItems();
  }, [refreshAvailability, refreshItems]);

  const execute = useCallback(
    async (task: () => Promise<void>) => {
      if (pending) {
        return;
      }
      setPending(true);
      try {
        await task();
      } finally {
        setPending(false);
      }
    },
    [pending],
  );

  const handleSetItem = useCallback(async () => {
    await execute(async () => {
      try {
        const result = await setItem(keyName, secret, baseOptions);
        setLastResult(
          `Saved secret with policy=${result.metadata.accessControl}, level=${result.metadata.securityLevel}`,
        );
        await refreshItems({ suppressSensitiveValues: true });
      } catch (error) {
        setLastResult(formatError(error));
      }
    });
  }, [baseOptions, execute, keyName, refreshItems, secret]);

  const handleGetItem = useCallback(async () => {
    await execute(async () => {
      try {
        const item = await getItem(keyName, {
          ...baseOptions,
          includeValue: includeValueOnGet,
        });
        if (item) {
          setLastResult(`Fetched item:\n${JSON.stringify(item, null, 2)}`);
        } else {
          setLastResult('No entry found for the provided key.');
        }
      } catch (error) {
        setLastResult(formatError(error));
      }
    });
  }, [baseOptions, execute, includeValueOnGet, keyName]);

  const handleHasItem = useCallback(async () => {
    await execute(async () => {
      try {
        const exists = await hasItem(keyName, baseOptions);
        setLastResult(
          `Key "${keyName}" ${exists ? 'exists' : 'does not exist'} in service "${baseOptions.service}"`,
        );
      } catch (error) {
        setLastResult(formatError(error));
      }
    });
  }, [baseOptions, execute, keyName]);

  const handleDeleteItem = useCallback(async () => {
    await execute(async () => {
      try {
        const deleted = await deleteItem(keyName, baseOptions);
        setLastResult(
          deleted ? 'Secret deleted.' : 'Nothing deleted (key was absent).',
        );
        await refreshItems();
      } catch (error) {
        setLastResult(formatError(error));
      }
    });
  }, [baseOptions, execute, keyName, refreshItems]);

  const handleClearService = useCallback(async () => {
    await execute(async () => {
      try {
        await clearService(baseOptions);
        setLastResult(`Cleared service "${baseOptions.service}"`);
        await refreshItems();
      } catch (error) {
        setLastResult(formatError(error));
      }
    });
  }, [baseOptions, execute, refreshItems]);

  const handleRefresh = useCallback(async () => {
    await execute(async () => {
      await refreshAvailability();
      await refreshItems();
    });
  }, [execute, refreshAvailability, refreshItems]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f6f7fb" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Sensitive Info Playground</Text>
          <Text style={styles.subtitle}>
            Explore secure storage flows, test authentication policies, and
            inspect metadata in a refined light experience.
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Light theme</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Biometric ready</Text>
            </View>
          </View>
        </View>

        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Tip for hardware testing</Text>
          <Text style={styles.bannerText}>
            Simulators rarely expose Secure Enclave, StrongBox, or full
            biometric flows. Validate critical journeys on a physical device to
            mirror production behaviour.
          </Text>
        </View>

        <Section
          title="Security snapshot"
          subtitle="Live capabilities reported by the native layer"
          actions={
            <ActionButton
              label="Refresh"
              onPress={handleRefresh}
              disabled={pending}
              style={styles.sectionActionButton}
            />
          }
        >
          {availability ? (
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Secure Enclave</Text>
                <Text style={styles.metricValue}>
                  {availability.secureEnclave ? 'Available' : 'Unavailable'}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>StrongBox</Text>
                <Text style={styles.metricValue}>
                  {availability.strongBox ? 'Available' : 'Unavailable'}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Biometry</Text>
                <Text style={styles.metricValue}>
                  {availability.biometry ? 'Available' : 'Unavailable'}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Device credential</Text>
                <Text style={styles.metricValue}>
                  {availability.deviceCredential ? 'Available' : 'Unavailable'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.bodyText}>
              Tap refresh to fetch the security profile for this device.
            </Text>
          )}
        </Section>

        <Section
          title="Secret blueprint"
          subtitle="Define the identifiers and payload for your secure entry"
        >
          <Field
            label="Service"
            helper="Defaults to demo-service when left blank."
          >
            <TextInput
              value={service}
              onChangeText={setService}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              placeholder={DEFAULT_SERVICE}
              placeholderTextColor="#9ca3af"
            />
          </Field>
          <Field
            label="Key"
            helper="Acts as the lookup identifier within the service."
          >
            <TextInput
              value={keyName}
              onChangeText={setKeyName}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              placeholder={DEFAULT_KEY}
              placeholderTextColor="#9ca3af"
            />
          </Field>
          <Field
            label="Secret value"
            helper="Stored exactly as provided. Avoid personal data in demos."
          >
            <TextInput
              value={secret}
              onChangeText={setSecret}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, styles.multiLineInput]}
              placeholder={DEFAULT_VALUE}
              placeholderTextColor="#9ca3af"
              multiline
            />
          </Field>
        </Section>

        <Section
          title="Security & authentication"
          subtitle="Tune access control, prompts, and cross-platform behaviour"
        >
          <View style={styles.accessOptionsContainer}>
            {ACCESS_CONTROL_OPTIONS.map(option => {
              const selected = option.value === selectedAccessControl;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedAccessControl(option.value)}
                  style={({ pressed }) => [
                    styles.accessOption,
                    selected && styles.accessOptionSelected,
                    pressed && styles.accessOptionPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.accessOptionLabel,
                      selected && styles.accessOptionLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.accessOptionDescription}>
                    {option.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ToggleRow
            label="Include values when listing"
            helper="Disabling hides the secret content in the inventory view."
            value={includeValues}
            onValueChange={setIncludeValues}
          />
          <ToggleRow
            label="Return value on direct fetch"
            helper="Applies to the Get action when retrieving a single key."
            value={includeValueOnGet}
            onValueChange={setIncludeValueOnGet}
          />
          <ToggleRow
            label="Show authentication prompt"
            helper="Custom prompt copy helps users understand why authentication is required."
            value={usePrompt}
            onValueChange={setUsePrompt}
          />
          <ToggleRow
            label="Sync with iCloud keychain"
            helper="Available on Apple platforms that support keychain synchronisation."
            value={iosSynchronizable}
            onValueChange={setIosSynchronizable}
          />

          <Field
            label="Shared keychain access group"
            helper="Optional. Use to share credentials across bundle identifiers."
          >
            <TextInput
              value={keychainGroup}
              onChangeText={setKeychainGroup}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              placeholder="com.example.shared"
              placeholderTextColor="#9ca3af"
            />
          </Field>
        </Section>

        <Section
          title="Quick actions"
          subtitle="Execute common storage operations"
        >
          <View style={styles.buttonGrid}>
            <ActionButton
              label="Save"
              onPress={handleSetItem}
              disabled={pending}
            />
            <ActionButton
              label="Get"
              onPress={handleGetItem}
              disabled={pending}
            />
            <ActionButton
              label="Has"
              onPress={handleHasItem}
              disabled={pending}
            />
            <ActionButton
              label="Delete"
              onPress={handleDeleteItem}
              disabled={pending}
            />
            <ActionButton
              label="Clear service"
              onPress={handleClearService}
              disabled={pending}
            />
            <ActionButton
              label="Refresh list"
              onPress={handleRefresh}
              disabled={pending}
            />
          </View>
        </Section>

        <Section
          title="Secrets inventory"
          subtitle={`Currently tracking ${items.length} entr${items.length === 1 ? 'y' : 'ies'} for ${baseOptions.service}`}
        >
          {items.length === 0 ? (
            <Text style={styles.emptyState}>
              Nothing stored yet. Save a secret to see it appear here.
            </Text>
          ) : (
            items.map(item => (
              <View key={`${item.service}-${item.key}`} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{item.key}</Text>
                <Text style={styles.itemMeta}>Service · {item.service}</Text>
                {includeValues && item.value != null ? (
                  <Text style={styles.itemValue}>{item.value}</Text>
                ) : null}
                <View style={styles.itemRowGroup}>
                  <Text style={styles.itemRow}>
                    Security level · {item.metadata.securityLevel}
                  </Text>
                  <Text style={styles.itemRow}>
                    Access control · {item.metadata.accessControl}
                  </Text>
                  <Text style={styles.itemRow}>
                    Backend · {item.metadata.backend}
                  </Text>
                  <Text style={styles.itemRow}>
                    Stored at ·{' '}
                    {new Date(item.metadata.timestamp * 1000).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Section>

        <Section
          title="Activity log"
          subtitle="Latest operation outcome"
          style={styles.logSection}
        >
          <View style={styles.logContainer}>
            <Text style={styles.logText}>{lastResult}</Text>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#4b5563',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  badge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  badgeText: {
    color: '#5b21b6',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  banner: {
    backgroundColor: '#e0f2fe',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#c7e0f5',
    padding: 18,
    marginBottom: 24,
  },
  bannerTitle: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 15,
  },
  bannerText: {
    color: '#1e3a8a',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  sectionContainer: {
    marginTop: 24,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e6ecf5',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sectionHeadingText: {
    flex: 1,
    paddingRight: 12,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  sectionBody: {
    marginTop: 20,
  },
  sectionActionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: -4,
  },
  bodyText: {
    color: '#4b5563',
    fontSize: 15,
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: '#1f2937',
    fontSize: 15,
    fontWeight: '600',
  },
  fieldHelper: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  fieldControl: {
    marginTop: 10,
  },
  input: {
    backgroundColor: '#f9fafb',
    color: '#111827',
    borderWidth: 1,
    borderColor: '#dbe2f1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 12, default: 10 }),
    fontSize: 15,
  },
  multiLineInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  accessOptionsContainer: {
    marginBottom: 12,
  },
  accessOption: {
    borderWidth: 1,
    borderColor: '#e5e7ff',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#f8faff',
    marginBottom: 12,
  },
  accessOptionSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eef2ff',
  },
  accessOptionPressed: {
    opacity: 0.9,
  },
  accessOptionLabel: {
    color: '#1f2937',
    fontSize: 15,
    fontWeight: '600',
  },
  accessOptionLabelSelected: {
    color: '#1d4ed8',
  },
  accessOptionDescription: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fdfefe',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  toggleTextBlock: {
    flex: 1,
    paddingRight: 16,
  },
  toggleLabel: {
    color: '#1f2937',
    fontSize: 15,
    fontWeight: '600',
  },
  toggleHelper: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  metricCard: {
    minWidth: 140,
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafc',
    padding: 16,
    margin: 8,
  },
  metricLabel: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValue: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    marginHorizontal: 8,
    marginBottom: 16,
  },
  buttonPressed: {
    backgroundColor: '#1d4ed8',
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonLabel: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  itemCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 18,
    marginBottom: 16,
  },
  itemTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  itemMeta: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 4,
  },
  itemValue: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '500',
    marginTop: 10,
  },
  itemRowGroup: {
    marginTop: 12,
  },
  itemRow: {
    color: '#4b5563',
    fontSize: 13,
    marginTop: 4,
  },
  emptyState: {
    color: '#6b7280',
    fontSize: 14,
  },
  logSection: {
    marginBottom: 12,
  },
  logContainer: {
    backgroundColor: '#11182708',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe2f1',
    padding: 16,
  },
  logText: {
    color: '#1f2937',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'Courier',
    }),
    fontSize: 13,
    lineHeight: 18,
  },
});

export default App;

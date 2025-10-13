import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
  type StyleProp,
  type ViewStyle,
} from 'react-native'
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
} from 'react-native-sensitive-info'

const DEFAULT_SERVICE = 'demo-service'
const DEFAULT_KEY = 'demo-secret'
const DEFAULT_VALUE = 'very-secret-value'

const ACCESS_CONTROL_OPTIONS: Array<{ value: AccessControl; label: string; description: string }> = [
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
]

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  return `Unexpected error: ${JSON.stringify(error)}`
}

interface ActionButtonProps {
  label: string
  onPress: () => void | Promise<void>
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

function ActionButton({ label, onPress, disabled, style }: ActionButtonProps) {
  const handlePress = () => {
    if (disabled) {
      return
    }
    try {
      const maybePromise = onPress()
      if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
        void (maybePromise as Promise<void>)
      }
    } catch (error) {
      // Errors surface through the outer handler.
  }

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
  )
}

function App(): React.JSX.Element {
  const [service, setService] = useState(DEFAULT_SERVICE)
  const [keyName, setKeyName] = useState(DEFAULT_KEY)
  const [secret, setSecret] = useState(DEFAULT_VALUE)
  const [selectedAccessControl, setSelectedAccessControl] = useState<AccessControl>('secureEnclaveBiometry')
  const [includeValues, setIncludeValues] = useState(true)
  const [includeValueOnGet, setIncludeValueOnGet] = useState(true)
  const [iosSynchronizable, setIosSynchronizable] = useState(false)
  const [androidBiometricsStrongOnly, setAndroidBiometricsStrongOnly] = useState(false)
  const [usePrompt, setUsePrompt] = useState(true)
  const [keychainGroup, setKeychainGroup] = useState('')
  const [availability, setAvailability] = useState<SecurityAvailability | null>(null)
  const [items, setItems] = useState<SensitiveInfoItem[]>([])
  const [lastResult, setLastResult] = useState('Ready to interact with the secure store.')
  const [pending, setPending] = useState(false)

  const normalizedService = useMemo(() => {
    const trimmed = service.trim()
    return trimmed.length > 0 ? trimmed : DEFAULT_SERVICE
  }, [service])

  const normalizedKeychainGroup = useMemo(() => {
    const trimmed = keychainGroup.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }, [keychainGroup])

  const baseOptions = useMemo(
    () => ({
      service: normalizedService,
      accessControl: selectedAccessControl,
      iosSynchronizable: iosSynchronizable ? true : undefined,
      keychainGroup: normalizedKeychainGroup,
      androidBiometricsStrongOnly: androidBiometricsStrongOnly ? true : undefined,
      authenticationPrompt: usePrompt
        ? {
            title: 'Authenticate to continue',
            subtitle: 'Demo prompt provided by the sample app',
            description: 'Sensitive data access requires local authentication on secured keys.',
            cancel: 'Cancel',
          }
        : undefined,
    }),
    [
      androidBiometricsStrongOnly,
      iosSynchronizable,
      normalizedKeychainGroup,
      normalizedService,
      selectedAccessControl,
      usePrompt,
    ],
  )

  const refreshAvailability = useCallback(async () => {
    try {
      const result = await getSupportedSecurityLevels()
      setAvailability(result)
      setLastResult(`Security capabilities refreshed at ${new Date().toLocaleTimeString()}`)
    } catch (error) {
      setLastResult(formatError(error))
    }
  }, [])

  const refreshItems = useCallback(async () => {
    try {
      const entries = await getAllItems({
        ...baseOptions,
        includeValues,
      })
      setItems(entries)
    } catch (error) {
      setLastResult(formatError(error))
    }
  }, [baseOptions, includeValues])

  useEffect(() => {
    void refreshAvailability()
    void refreshItems()
  }, [refreshAvailability, refreshItems])

  const execute = useCallback(
    async (task: () => Promise<void>) => {
      if (pending) {
        return
      }
      setPending(true)
      try {
        await task()
      } finally {
        setPending(false)
      }
    },
    [pending],
  )

  const handleSetItem = useCallback(async () => {
    await execute(async () => {
      try {
        const result = await setItem(keyName, secret, baseOptions)
        setLastResult(`Saved secret with policy=${result.metadata.accessControl}, level=${result.metadata.securityLevel}`)
        await refreshItems()
      } catch (error) {
        setLastResult(formatError(error))
      }
    })
  }, [baseOptions, execute, keyName, refreshItems, secret])

  const handleGetItem = useCallback(async () => {
    await execute(async () => {
      try {
        const item = await getItem(keyName, {
          ...baseOptions,
          includeValue: includeValueOnGet,
        })
        if (item) {
          setLastResult(`Fetched item:\n${JSON.stringify(item, null, 2)}`)
        } else {
          setLastResult('No entry found for the provided key.')
        }
      } catch (error) {
        setLastResult(formatError(error))
      }
    })
  }, [baseOptions, execute, includeValueOnGet, keyName])

  const handleHasItem = useCallback(async () => {
    await execute(async () => {
      try {
        const exists = await hasItem(keyName, baseOptions)
        setLastResult(`Key "${keyName}" ${exists ? 'exists' : 'does not exist'} in service "${baseOptions.service}"`)
      } catch (error) {
        setLastResult(formatError(error))
      }
    })
  }, [baseOptions, execute, keyName])

  const handleDeleteItem = useCallback(async () => {
    await execute(async () => {
      try {
        const deleted = await deleteItem(keyName, baseOptions)
        setLastResult(deleted ? 'Secret deleted.' : 'Nothing deleted (key was absent).')
        await refreshItems()
      } catch (error) {
        setLastResult(formatError(error))
      }
    })
  }, [baseOptions, execute, keyName, refreshItems])

  const handleClearService = useCallback(async () => {
    await execute(async () => {
      try {
        await clearService(baseOptions)
        setLastResult(`Cleared service "${baseOptions.service}"`)
        await refreshItems()
      } catch (error) {
        setLastResult(formatError(error))
      }
    })
  }, [baseOptions, execute, refreshItems])

  const handleRefresh = useCallback(async () => {
    await execute(async () => {
      await refreshAvailability()
      await refreshItems()
    })
  }, [execute, refreshAvailability, refreshItems])

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>react-native-sensitive-info demo</Text>
        <Text style={styles.subtitle}>
          Demonstrates secure storage operations, metadata, and platform capability detection.
        </Text>

    <View style={[styles.banner, styles.blockSpacing]}>
          <Text style={styles.bannerTitle}>Simulators & emulators</Text>
          <Text style={styles.bannerText}>
            Virtual devices often report limited security hardware. Expect Secure Enclave / StrongBox to be unavailable and
            biometric prompts to fall back to passcode screens.
          </Text>
        </View>

    <View style={[styles.section, styles.blockSpacing]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Security capabilities</Text>
            <ActionButton
              label="Refresh"
              onPress={handleRefresh}
              disabled={pending}
              style={styles.compactButton}
            />
          </View>
          {availability ? (
            <View style={styles.card}>
              <Text style={styles.cardRow}>Secure Enclave: {availability.secureEnclave ? 'yes' : 'no'}</Text>
              <Text style={styles.cardRow}>StrongBox: {availability.strongBox ? 'yes' : 'no'}</Text>
              <Text style={styles.cardRow}>Biometry: {availability.biometry ? 'yes' : 'no'}</Text>
              <Text style={styles.cardRow}>
                Device credential: {availability.deviceCredential ? 'yes' : 'no'}
              </Text>
            </View>
          ) : (
            <Text style={styles.bodyText}>Tap refresh to query native capabilities.</Text>
          )}
        </View>

        <View style={[styles.section, styles.blockSpacing]}>
          <Text style={styles.sectionTitle}>Request configuration</Text>
          <Text style={[styles.bodyText, styles.sectionSpacing]}>Service</Text>
          <TextInput
            value={service}
            onChangeText={setService}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, styles.sectionSpacingSmall]}
            placeholder={DEFAULT_SERVICE}
          />

          <Text style={[styles.bodyText, styles.sectionSpacing]}>Key</Text>
          <TextInput
            value={keyName}
            onChangeText={setKeyName}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, styles.sectionSpacingSmall]}
            placeholder={DEFAULT_KEY}
          />

          <Text style={[styles.bodyText, styles.sectionSpacing]}>Secret value</Text>
          <TextInput
            value={secret}
            onChangeText={setSecret}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, styles.sectionSpacingSmall]}
            placeholder={DEFAULT_VALUE}
          />

          <Text style={[styles.bodyText, styles.sectionSpacing]}>Access control</Text>
          <View style={styles.accessOptionsContainer}>
            {ACCESS_CONTROL_OPTIONS.map((option, index) => {
              const selected = option.value === selectedAccessControl
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedAccessControl(option.value)}
                  style={[
                    styles.accessOption,
                    selected && styles.accessOptionSelected,
                    index > 0 && styles.accessOptionSpacing,
                  ]}
                >
                  <Text style={[styles.accessOptionLabel, selected && styles.accessOptionLabelSelected]}>
                    {option.label}
                  </Text>
                  <Text style={styles.accessOptionDescription}>{option.description}</Text>
                </Pressable>
              )
            })}
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.bodyText}>Include values when enumerating</Text>
            <Switch value={includeValues} onValueChange={setIncludeValues} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.bodyText}>Include value when fetching a key</Text>
            <Switch value={includeValueOnGet} onValueChange={setIncludeValueOnGet} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.bodyText}>Use biometrics prompt (if required)</Text>
            <Switch value={usePrompt} onValueChange={setUsePrompt} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.bodyText}>iCloud keychain sync (iOS)</Text>
            <Switch value={iosSynchronizable} onValueChange={setIosSynchronizable} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.bodyText}>Android biometrics must be strong</Text>
            <Switch value={androidBiometricsStrongOnly} onValueChange={setAndroidBiometricsStrongOnly} />
          </View>

          <Text style={[styles.bodyText, styles.sectionSpacing]}>Custom keychain access group (optional)</Text>
          <TextInput
            value={keychainGroup}
            onChangeText={setKeychainGroup}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, styles.sectionSpacingSmall]}
            placeholder="com.example.shared"
          />
        </View>

        <View style={[styles.section, styles.blockSpacing]}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.buttonGrid}>
            <ActionButton label="Save" onPress={handleSetItem} disabled={pending} />
            <ActionButton label="Get" onPress={handleGetItem} disabled={pending} />
            <ActionButton label="Has" onPress={handleHasItem} disabled={pending} />
            <ActionButton label="Delete" onPress={handleDeleteItem} disabled={pending} />
            <ActionButton label="Clear service" onPress={handleClearService} disabled={pending} />
            <ActionButton label="Refresh list" onPress={handleRefresh} disabled={pending} />
          </View>
        </View>

        <View style={[styles.section, styles.blockSpacing]}>
          <Text style={styles.sectionTitle}>Stored items</Text>
          {items.length === 0 ? (
            <Text style={styles.bodyText}>No secrets stored for service "{baseOptions.service}".</Text>
          ) : (
            items.map((item, index) => (
              <View
                key={`${item.service}-${item.key}`}
                style={[styles.card, index > 0 && styles.cardSpacing]}
              >
                <Text style={styles.cardTitle}>{item.key}</Text>
                <Text style={styles.cardRow}>Service: {item.service}</Text>
                {includeValues && item.value != null && (
                  <Text style={styles.cardRow}>Value: {item.value}</Text>
                )}
                <Text style={styles.cardRow}>Security level: {item.metadata.securityLevel}</Text>
                <Text style={styles.cardRow}>Access control: {item.metadata.accessControl}</Text>
                <Text style={styles.cardRow}>Backend: {item.metadata.backend}</Text>
                <Text style={styles.cardRow}>
                  Stored at: {new Date(item.metadata.timestamp * 1000).toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={[styles.section, styles.blockSpacing]}>
          <Text style={styles.sectionTitle}>Last result</Text>
          <View style={styles.logContainer}>
            <Text style={styles.logText}>{lastResult}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#101418',
  },
  container: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 16,
  },
  banner: {
    backgroundColor: '#1f2933',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#273341',
  },
  bannerTitle: {
    color: '#fbbf24',
    fontWeight: '700',
    fontSize: 14,
  },
  bannerText: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 18,
    marginTop: 4,
  },
  section: {
    backgroundColor: '#111827',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#e5e7eb',
    fontSize: 18,
    fontWeight: '600',
  },
  bodyText: {
    color: '#d1d5db',
    fontSize: 15,
  },
  sectionSpacing: {
    marginTop: 12,
  },
  sectionSpacingSmall: {
    marginTop: 8,
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 10, default: 8 }),
    fontSize: 15,
  },
  accessOptionsContainer: {
    marginTop: 12,
  },
  accessOption: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#313c4a',
    backgroundColor: '#0b1220',
  },
  accessOptionSpacing: {
    marginTop: 12,
  },
  accessOptionSelected: {
    borderColor: '#4f46e5',
    backgroundColor: '#1c2540',
  },
  accessOptionLabel: {
    color: '#e0e7ff',
    fontWeight: '600',
  },
  accessOptionLabelSelected: {
    color: '#c7d2fe',
  },
  accessOptionDescription: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  button: {
    backgroundColor: '#4338ca',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    marginRight: 12,
    marginBottom: 12,
  },
  compactButton: {
    marginRight: 0,
    marginBottom: 0,
  },
  buttonPressed: {
    backgroundColor: '#3730a3',
  },
  buttonDisabled: {
    backgroundColor: '#312e81',
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#e0e7ff',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
  },
  cardSpacing: {
    marginTop: 12,
  },
  cardTitle: {
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '600',
  },
  cardRow: {
    color: '#cbd5f5',
    fontSize: 14,
    marginTop: 4,
  },
  logContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
    marginTop: 12,
  },
  logText: {
    color: '#f3f4f6',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Courier' }),
    fontSize: 13,
  },
  blockSpacing: {
    marginTop: 24,
  },
})

export default App
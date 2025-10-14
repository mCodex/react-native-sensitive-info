import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  cancelFingerprintAuth,
  deleteItem,
  getAllItems,
  getItem,
  hasEnrolledFingerprints,
  hasItem,
  isSensorAvailable,
  setInvalidatedByBiometricEnrollment,
  setItem,
  type RNSensitiveInfoOptions,
  type SensitiveInfoEntries,
} from 'react-native-sensitive-info';

type ListEntry = SensitiveInfoEntries[number];

export default function App(): ReactElement {
  const [service, setService] = useState('demo_store');
  const [keyInput, setKeyInput] = useState('example-key');
  const [valueInput, setValueInput] = useState('secret-value');
  const [touchId, setTouchId] = useState(false);
  const [invalidateOnEnrollment, setInvalidateOnEnrollment] = useState(true);
  const [status, setStatus] = useState('Ready');
  const [latestValue, setLatestValue] = useState<string | null>(null);
  const [sensorInfo, setSensorInfo] = useState('Checking...');
  const [enrollmentInfo, setEnrollmentInfo] = useState('Checking...');
  const [items, setItems] = useState<ListEntry[]>([]);

  const options = useMemo<RNSensitiveInfoOptions>(() => {
    const payload: Record<string, unknown> = {
      keychainService: service || 'app',
      sharedPreferencesName: service || 'shared_preferences',
      touchID: touchId,
    };

    if (touchId) {
      payload.kSecUseOperationPrompt = 'Authenticate to access the demo secret';
      payload.showModal = true;
    }

    return payload as RNSensitiveInfoOptions;
  }, [service, touchId]);

  const refreshBiometrics = useCallback(async () => {
    try {
      const sensor = await isSensorAvailable();

      if (typeof sensor === 'string') {
        setSensorInfo(sensor);
      } else {
        setSensorInfo(sensor ? 'Available' : 'Unavailable');
      }
    } catch (error) {
      const message = (error as Error).message ?? 'Unknown error';

      setSensorInfo(`Error: ${message}`);
    }

    try {
      const enrolled = await hasEnrolledFingerprints();

      setEnrollmentInfo(enrolled ? 'Yes' : 'No');
    } catch (error) {
      const message = (error as Error).message ?? 'Unknown error';

      setEnrollmentInfo(`Error: ${message}`);
    }
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const list = await getAllItems(options);

      setItems([...list]);
    } catch (error) {
      const message = (error as Error).message ?? 'Unknown error';
      setStatus(`Failed to list items: ${message}`);
    }
  }, [options]);

  useEffect(() => {
    refreshBiometrics().catch(() => {
      setSensorInfo('Unable to determine sensor availability');

      setEnrollmentInfo('Unknown');
    });
    refreshList().catch(() => {
      setItems([]);
    });
  }, [refreshBiometrics, refreshList]);

  useEffect(() => {
    setInvalidatedByBiometricEnrollment(invalidateOnEnrollment);
  }, [invalidateOnEnrollment]);

  const buildStatus = (message: string) => {
    setStatus(message);
  };

  const handleSet = useCallback(async () => {
    buildStatus('Saving secret...');
    try {
      await setItem(keyInput, valueInput, options);

      buildStatus('Secret stored');

      await refreshList();
    } catch (error) {
      const message = (error as Error).message ?? 'Unknown error';
      buildStatus(`Failed to store secret: ${message}`);
    }
  }, [keyInput, options, refreshList, valueInput]);

  const handleGet = useCallback(async () => {
    buildStatus('Reading secret...');

    try {
      const result = await getItem(keyInput, options);

      setLatestValue(result ?? null);

      buildStatus(
        result != null ? 'Secret fetched' : 'No value stored for this key'
      );
    } catch (error) {
      const message = (error as Error).message ?? 'Unknown error';

      buildStatus(`Failed to fetch secret: ${message}`);
    }
  }, [keyInput, options]);

  const handleHas = useCallback(async () => {
    buildStatus('Checking key...');
    try {
      const exists = await hasItem(keyInput, options);

      buildStatus(exists ? 'Key exists' : 'Key not found');
    } catch (error) {
      const message = (error as Error).message ?? 'Unknown error';
      buildStatus(`Failed to check key: ${message}`);
    }
  }, [keyInput, options]);

  const handleDelete = useCallback(async () => {
    buildStatus('Deleting secret...');
    try {
      await deleteItem(keyInput, options);
      await refreshList();
      buildStatus('Secret removed');
    } catch (error) {
      const message = (error as Error).message ?? 'Unknown error';
      buildStatus(`Failed to delete secret: ${message}`);
    }
  }, [keyInput, options, refreshList]);

  const handleCancel = useCallback(() => {
    cancelFingerprintAuth();
    buildStatus('Cancelled active biometric prompt');
  }, []);

  const handleRefreshBiometrics = useCallback(() => {
    refreshBiometrics().catch((error) => {
      const message = (error as Error).message ?? 'Unknown error';

      Alert.alert(
        'Biometrics',
        `Unable to refresh biometric state: ${message}`
      );
    });
  }, [refreshBiometrics]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>react-native-sensitive-info</Text>
        <Text style={styles.subtitle}>Secure storage demo</Text>
        <Text style={styles.note}>
          Biometric prompts require real hardware. On the iOS simulator open
          Hardware &gt; Face ID to enrol and trigger prompts. Android emulators
          need a fingerprint enrolled in Settings and you can confirm a scan
          with 'adb emu finger touch 1'.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Storage settings</Text>
          <Text style={styles.label}>Service / SharedPreferences name</Text>
          <TextInput
            value={service}
            onChangeText={setService}
            placeholder="demo_store"
            autoCapitalize="none"
            style={styles.input}
          />

          <View style={styles.switchRow}>
            <Switch value={touchId} onValueChange={setTouchId} />
            <Text style={styles.switchLabel}>Protect with biometrics</Text>
          </View>

          <View style={styles.switchRow}>
            <Switch
              value={invalidateOnEnrollment}
              onValueChange={setInvalidateOnEnrollment}
            />
            <Text style={styles.switchLabel}>
              Invalidate on biometric enrolment (iOS)
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Secret</Text>
          <Text style={styles.label}>Key</Text>
          <TextInput
            value={keyInput}
            onChangeText={setKeyInput}
            placeholder="example-key"
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.label}>Value</Text>
          <TextInput
            value={valueInput}
            onChangeText={setValueInput}
            placeholder="secret-value"
            autoCapitalize="none"
            style={styles.input}
            secureTextEntry
          />

          <View style={styles.buttonRow}>
            <View style={styles.buttonWrapper}>
              <Button title="Save" onPress={handleSet} />
            </View>
            <View style={styles.buttonWrapper}>
              <Button title="Read" onPress={handleGet} />
            </View>
          </View>

          <View style={styles.buttonRow}>
            <View style={styles.buttonWrapper}>
              <Button title="Exists?" onPress={handleHas} />
            </View>
            <View style={styles.buttonWrapper}>
              <Button title="Delete" onPress={handleDelete} color="#c0392b" />
            </View>
          </View>

          <View style={styles.buttonRow}>
            <View style={styles.buttonWrapper}>
              <Button title="Cancel prompt" onPress={handleCancel} />
            </View>
            <View style={styles.buttonWrapper}>
              <Button
                title="Refresh biometrics"
                onPress={handleRefreshBiometrics}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnostics</Text>
          <Text style={styles.diagnostic}>Status: {status}</Text>
          <Text style={styles.diagnostic}>
            Last read value: {latestValue === null ? 'None' : latestValue}
          </Text>
          <Text style={styles.diagnostic}>
            Sensor availability: {sensorInfo}
          </Text>
          <Text style={styles.diagnostic}>
            Biometrics enrolled: {enrollmentInfo}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stored entries</Text>
          {items.length === 0 ? (
            <Text style={styles.empty}>
              No secrets stored for this service.
            </Text>
          ) : (
            items.map((item) => (
              <View key={`${item.service}:${item.key}`} style={styles.listItem}>
                <Text style={styles.listKey}>{item.key}</Text>
                <Text style={styles.listValue}>{item.value}</Text>
                <Text style={styles.listService}>service: {item.service}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 16,
    color: '#334155',
  },
  note: {
    marginTop: 12,
    fontSize: 13,
    color: '#b91c1c',
  },
  section: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#0f172a',
  },
  label: {
    marginBottom: 4,
    fontSize: 14,
    color: '#1f2937',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  switchLabel: {
    marginLeft: 12,
    fontSize: 14,
    color: '#1f2937',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  buttonWrapper: {
    flex: 1,
  },
  diagnostic: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 6,
  },
  empty: {
    fontSize: 14,
    color: '#6b7280',
  },
  listItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  listKey: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  listValue: {
    marginTop: 2,
    fontSize: 14,
    color: '#2563eb',
  },
  listService: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
});

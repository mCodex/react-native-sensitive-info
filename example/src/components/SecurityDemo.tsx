import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import {
  setItem,
  getItem,
  removeItem,
  getSecurityCapabilities,
} from 'react-native-sensitive-info';

type StoreKind = 'standard' | 'biometric' | 'strongbox' | '—';

export const SecurityDemo: React.FC = () => {
  const [status, setStatus] = useState<string>('Idle');
  const [value, setValue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [usedStore, setUsedStore] = useState<StoreKind>('—');
  const [caps, setCaps] = useState({
    biometric: false,
    strongbox: false,
    recommendedLevel: 'standard' as 'standard' | 'biometric' | 'strongbox',
  });

  useEffect(() => {
    (async () => {
      try {
        const c = await getSecurityCapabilities();
        setCaps(c);
      } catch {
        // keep defaults
      }
    })();
  }, []);

  // Auto store uses standard by default
  const expectedAutoStore: StoreKind = 'standard';
  const expectedBiometricStore = useMemo<Exclude<StoreKind, '—'>>(() => {
    if (caps.biometric) return 'biometric';

    // On Android, our implementation falls back to StrongBox if available
    if (Platform.OS === 'android' && caps.strongbox) return 'strongbox';
    // On iOS/macOS, biometric falls back to standard
    return 'standard';
  }, [caps.biometric, caps.strongbox]);

  const withUi = async (label: string, fn: () => Promise<void>) => {
    try {
      setIsLoading(true);
      setStatus(label);
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Error: ${msg}`);
      Alert.alert('Error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Quick Demo</Text>
      <Text style={styles.subtitle}>
        Minimal example storing/reading/removing with smart fallback.
      </Text>

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, styles.primary, isLoading && styles.disabled]}
          disabled={isLoading}
          onPress={() =>
            withUi('Storing (auto)', async () => {
              setUsedStore(expectedAutoStore);
              await setItem('demo:key', 'hello-world');
              setStatus('Stored');
            })
          }
        >
          <Text style={styles.btnText}>Store (auto)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.secondary, isLoading && styles.disabled]}
          disabled={isLoading}
          onPress={() =>
            withUi('Reading (auto)', async () => {
              setUsedStore(expectedAutoStore);
              const v = await getItem('demo:key');
              setValue(v);
              setStatus(`Read: ${v ?? 'null'}`);
            })
          }
        >
          <Text style={styles.btnText}>Read (auto)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, styles.orange, isLoading && styles.disabled]}
          disabled={isLoading}
          onPress={() =>
            withUi('Store (biometric)', async () => {
              setUsedStore(expectedBiometricStore);
              const opts = {
                securityLevel: 'biometric',
                biometricOptions: {
                  promptTitle: 'Authenticate',
                  promptDescription: 'Access secure storage',
                  cancelButtonText: 'Cancel',
                  allowDeviceCredential: true,
                },
              } as const;

              // Automatic native prompt will be shown by the library
              await setItem('demo:bio', 'biometric-secret', opts);
              setStatus('Stored (biometric)');
            })
          }
        >
          <Text style={styles.btnText}>Store Biometric</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.orange, isLoading && styles.disabled]}
          disabled={isLoading}
          onPress={() =>
            withUi('Read (biometric)', async () => {
              setUsedStore(expectedBiometricStore);
              const opts = {
                securityLevel: 'biometric',
                biometricOptions: {
                  promptTitle: 'Authenticate',
                  promptDescription: 'Access secure storage',
                  cancelButtonText: 'Cancel',
                  allowDeviceCredential: true,
                },
              } as const;

              // Automatic native prompt will be shown by the library
              const v = await getItem('demo:bio', opts);
              setValue(v);
              setStatus(`Read (bio): ${v ?? 'null'}`);
            })
          }
        >
          <Text style={styles.btnText}>Read Biometric</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, styles.gray, isLoading && styles.disabled]}
          disabled={isLoading}
          onPress={() =>
            withUi('Remove keys', async () => {
              await removeItem('demo:key');
              await removeItem('demo:bio', { securityLevel: 'biometric' });
              setValue(null);
              setStatus('Removed');
            })
          }
        >
          <Text style={styles.btnText}>Remove</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusBox}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text style={styles.statusText}>{status}</Text>
        <Text style={styles.statusSub}>Value: {value ?? '—'}</Text>
        <Text style={styles.statusSub}>Expected store used: {usedStore}</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Device capabilities</Text>
        <Text style={styles.infoText}>
          • Biometric: {caps.biometric ? 'Yes' : 'No'} | StrongBox/Secure
          Enclave: {caps.strongbox ? 'Yes' : 'No'}
        </Text>
        <Text style={styles.infoText}>
          • Recommended level: {caps.recommendedLevel}
        </Text>

        <View style={styles.spacer} />

        <Text style={styles.infoTitle}>How storage is chosen</Text>
        <Text style={styles.infoText}>
          • If you don't pass a securityLevel, data is stored with the standard
          keychain/keystore.
        </Text>

        <Text style={styles.infoText}>
          • When requesting biometric/strongbox, the library attempts that
          level.
        </Text>

        <Text style={styles.infoText}>
          • If unavailable, it falls back to what's available.
        </Text>

        <Text style={styles.infoText}>
          • Actual fallback behavior may differ between iOS and Android. The
          "Expected store used" value above is based on detected capabilities
          and may differ from the exact platform behavior.
        </Text>
      </View>
      {/* No explicit prompt component needed — the library will show native prompts automatically */}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 6 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  primary: { backgroundColor: '#4F46E5' },
  secondary: { backgroundColor: '#06B6D4' },
  orange: { backgroundColor: '#F59E0B' },
  gray: { backgroundColor: '#6B7280' },
  disabled: { opacity: 0.6 },
  btnText: { color: 'white', fontWeight: '600' },
  statusBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#eee',
  },
  statusLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  statusText: { fontSize: 14, color: '#111' },
  statusSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  infoBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  infoText: { fontSize: 12, color: '#111', lineHeight: 18 },
  spacer: { height: 8 },
});

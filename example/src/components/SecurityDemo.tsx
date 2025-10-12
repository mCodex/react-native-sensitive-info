import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import {
  setItem,
  getItem,
  removeItem,
} from '@velocitycareerlabs/react-native-sensitive-info';

export const SecurityDemo: React.FC = () => {
  const [status, setStatus] = useState<string>('Idle');
  const [value, setValue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
              await setItem('demo:bio', 'biometric-secret', {
                securityLevel: 'biometric',
                biometricOptions: {
                  promptTitle: 'Authenticate',
                  promptDescription: 'Access secure storage',
                  cancelButtonText: 'Cancel',
                  allowDeviceCredential: true,
                },
              });
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
              const v = await getItem('demo:bio', {
                securityLevel: 'biometric',
                biometricOptions: {
                  promptTitle: 'Authenticate',
                  promptDescription: 'Access secure storage',
                  cancelButtonText: 'Cancel',
                  allowDeviceCredential: true,
                },
              });
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
      </View>
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
});

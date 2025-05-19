import { useState } from 'react';
import { Button, TextInput, Text, View, StyleSheet, Alert } from 'react-native';
import * as SensitiveInfo from 'react-native-sensitive-info';

const TEST_KEY = 'demo_key';

export default function App() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState<boolean | null>(
    null
  );
  const [biometricResult, setBiometricResult] = useState<string | null>(null);

  // Check biometric availability
  const checkBiometric = async () => {
    try {
      const available = await SensitiveInfo.isBiometricAvailable();
      setBiometricAvailable(available);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  // Set value
  const handleSet = async () => {
    setError(null);
    try {
      const result = await SensitiveInfo.setItem(TEST_KEY, input);
      if (result.error) {
        setError(result.error.message);
      } else {
        Alert.alert('Success', 'Value set securely!');
      }
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  // Get value
  const handleGet = async () => {
    setError(null);
    try {
      const result = await SensitiveInfo.getItem(TEST_KEY);
      if (result.error) {
        setError(result.error.message);
        setOutput(null);
      } else {
        setOutput(result.value ?? null);
      }
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  // Delete value
  const handleDelete = async () => {
    setError(null);
    try {
      const result = await SensitiveInfo.deleteItem(TEST_KEY);
      if (result.error) {
        setError(result.error.message);
      } else {
        setOutput(null);
        Alert.alert('Deleted', 'Value deleted securely!');
      }
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  // Set value with biometric
  const handleSetBiometric = async () => {
    setError(null);
    try {
      const result = await SensitiveInfo.setItem(TEST_KEY, input, true);
      if (result.error) {
        setError(result.error.message);
      } else {
        Alert.alert('Success', 'Value set with biometric!');
      }
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  // Authenticate with biometric
  const handleBiometricAuth = async () => {
    setError(null);
    try {
      const result = await SensitiveInfo.authenticate('Authenticate');

      if (result.error) {
        setError(result.error.message);
        setBiometricResult('Failed or cancelled');
      } else {
        setBiometricResult(
          result.value?.success ? 'Authenticated!' : 'Failed or cancelled'
        );
      }
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>react-native-sensitive-info Example</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter value to store"
        value={input}
        onChangeText={setInput}
      />
      <View style={styles.buttonRow}>
        <Button title="Set" onPress={handleSet} />
        <Button title="Get" onPress={handleGet} />
        <Button title="Delete" onPress={handleDelete} />
      </View>
      <Button title="Set with Biometric" onPress={handleSetBiometric} />
      <Button title="Check Biometric Available" onPress={checkBiometric} />
      <Button title="Biometric Authenticate" onPress={handleBiometricAuth} />
      {output !== null && (
        <Text style={styles.result}>Stored Value: {output}</Text>
      )}
      {biometricAvailable !== null && (
        <Text style={styles.result}>
          Biometric Available: {biometricAvailable ? 'Yes' : 'No'}
        </Text>
      )}
      {biometricResult && <Text style={styles.result}>{biometricResult}</Text>}
      {error && <Text style={styles.error}>Error: {error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    width: '100%',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  result: {
    marginTop: 12,
    fontSize: 16,
    color: '#333',
  },
  error: {
    marginTop: 12,
    color: 'red',
  },
});

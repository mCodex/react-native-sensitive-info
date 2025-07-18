import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useSensitiveInfo } from 'react-native-sensitive-info';

interface BiometricDemoState {
  lastOperation: string;
  isLoading: boolean;
}

export const BiometricSecurityDemo: React.FC = () => {
  const [state, setState] = useState<BiometricDemoState>({
    lastOperation: 'None',
    isLoading: false,
  });

  const { storeItem, searchItem, removeItemById } = useSensitiveInfo();

  const updateState = (updates: Partial<BiometricDemoState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const handleBiometricStore = async () => {
    try {
      updateState({
        isLoading: true,
        lastOperation: 'Storing with biometric auth...',
      });

      await storeItem(
        'biometric_secret',
        'This is a biometric protected secret!',
        {
          securityLevel: 'biometric',
          biometricOptions: {
            promptTitle: 'Store Biometric Data',
            promptSubtitle: 'Authenticate to store sensitive information',
            promptDescription: 'Use your fingerprint or face to unlock',
            cancelButtonText: 'Cancel',
          },
        }
      );

      updateState({
        lastOperation: 'Successfully stored biometric protected data',
        isLoading: false,
      });
      Alert.alert('Success', 'Data stored with biometric protection!');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      updateState({
        lastOperation: `Failed to store biometric data: ${errorMessage}`,
        isLoading: false,
      });
      Alert.alert('Error', errorMessage);
    }
  };

  const handleBiometricRetrieve = async () => {
    try {
      updateState({
        isLoading: true,
        lastOperation: 'Retrieving with biometric auth...',
      });

      const data = await searchItem('biometric_secret', {
        securityLevel: 'biometric',
        biometricOptions: {
          promptTitle: 'Access Biometric Data',
          promptSubtitle: 'Authenticate to view your secure data',
          promptDescription: 'Use your fingerprint or face to unlock',
          cancelButtonText: 'Cancel',
        },
      });

      updateState({
        lastOperation: `Retrieved: ${data || 'No data found'}`,
        isLoading: false,
      });
      Alert.alert('Retrieved Data', data || 'No data found');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      updateState({
        lastOperation: `Failed to retrieve biometric data: ${errorMessage}`,
        isLoading: false,
      });
      Alert.alert('Error', errorMessage);
    }
  };

  const handleBiometricDelete = async () => {
    try {
      updateState({
        isLoading: true,
        lastOperation: 'Deleting with biometric auth...',
      });

      await removeItemById('biometric_secret', {
        securityLevel: 'biometric',
        biometricOptions: {
          promptTitle: 'Delete Biometric Data',
          promptSubtitle: 'Authenticate to delete your secure data',
          promptDescription: 'Use your fingerprint or face to confirm deletion',
          cancelButtonText: 'Cancel',
        },
      });

      updateState({
        lastOperation: 'Successfully deleted biometric protected data',
        isLoading: false,
      });
      Alert.alert('Success', 'Biometric protected data deleted!');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      updateState({
        lastOperation: `Failed to delete biometric data: ${errorMessage}`,
        isLoading: false,
      });
      Alert.alert('Error', errorMessage);
    }
  };

  const handleStrongBoxStore = async () => {
    try {
      updateState({
        isLoading: true,
        lastOperation: 'Storing with StrongBox...',
      });

      await storeItem('strongbox_secret', 'This is hardware-protected data!', {
        securityLevel: 'strongbox',
      });

      updateState({
        lastOperation: 'Successfully stored StrongBox protected data',
        isLoading: false,
      });
      Alert.alert('Success', 'Data stored in hardware security module!');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      updateState({
        lastOperation: `Failed to store StrongBox data: ${errorMessage}`,
        isLoading: false,
      });
      Alert.alert('Error', errorMessage);
    }
  };

  const handleStrongBoxRetrieve = async () => {
    try {
      updateState({
        isLoading: true,
        lastOperation: 'Retrieving from StrongBox...',
      });

      const data = await searchItem('strongbox_secret', {
        securityLevel: 'strongbox',
      });

      updateState({
        lastOperation: `Retrieved from StrongBox: ${data || 'No data found'}`,
        isLoading: false,
      });
      Alert.alert('Retrieved Data', data || 'No data found');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      updateState({
        lastOperation: `Failed to retrieve StrongBox data: ${errorMessage}`,
        isLoading: false,
      });
      Alert.alert('Error', errorMessage);
    }
  };

  const handleStrongBoxDelete = async () => {
    try {
      updateState({
        isLoading: true,
        lastOperation: 'Deleting from StrongBox...',
      });

      await removeItemById('strongbox_secret', {
        securityLevel: 'strongbox',
      });

      updateState({
        lastOperation: 'Successfully deleted StrongBox protected data',
        isLoading: false,
      });
      Alert.alert('Success', 'StrongBox protected data deleted!');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      updateState({
        lastOperation: `Failed to delete StrongBox data: ${errorMessage}`,
        isLoading: false,
      });
      Alert.alert('Error', errorMessage);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔐 Security Demo</Text>

      {/* Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Operation Status</Text>
        <Text style={styles.status}>Last Operation: {state.lastOperation}</Text>
        {state.isLoading && (
          <Text style={styles.loading}>⏳ Processing...</Text>
        )}
      </View>

      {/* Biometric Operations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔐 Biometric Authentication</Text>
        <Text style={styles.description}>
          Store and retrieve data with biometric authentication
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.storeButton,
              state.isLoading && styles.disabledButton,
            ]}
            onPress={handleBiometricStore}
            disabled={state.isLoading}
          >
            <Text style={styles.buttonText}>Store with Biometric</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.retrieveButton,
              state.isLoading && styles.disabledButton,
            ]}
            onPress={handleBiometricRetrieve}
            disabled={state.isLoading}
          >
            <Text style={styles.buttonText}>Retrieve with Biometric</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            styles.deleteButton,
            state.isLoading && styles.disabledButton,
          ]}
          onPress={handleBiometricDelete}
          disabled={state.isLoading}
        >
          <Text style={styles.buttonText}>Delete Biometric Data</Text>
        </TouchableOpacity>
      </View>

      {/* StrongBox Operations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          🛡️ Hardware Security (StrongBox)
        </Text>
        <Text style={styles.description}>
          Store data in hardware security module for maximum protection
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.storeButton,
              state.isLoading && styles.disabledButton,
            ]}
            onPress={handleStrongBoxStore}
            disabled={state.isLoading}
          >
            <Text style={styles.buttonText}>Store in StrongBox</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.retrieveButton,
              state.isLoading && styles.disabledButton,
            ]}
            onPress={handleStrongBoxRetrieve}
            disabled={state.isLoading}
          >
            <Text style={styles.buttonText}>Retrieve from StrongBox</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            styles.deleteButton,
            state.isLoading && styles.disabledButton,
          ]}
          onPress={handleStrongBoxDelete}
          disabled={state.isLoading}
        >
          <Text style={styles.buttonText}>Delete StrongBox Data</Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📝 Instructions</Text>
        <Text style={styles.instruction}>
          • Biometric operations will prompt for fingerprint/face authentication
        </Text>
        <Text style={styles.instruction}>
          • StrongBox uses hardware security modules when available
        </Text>
        <Text style={styles.instruction}>
          • Data is automatically encrypted and stored securely
        </Text>
        <Text style={styles.instruction}>
          • All operations include error handling and user feedback
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  status: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  loading: {
    fontSize: 14,
    color: '#2196F3',
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  storeButton: {
    backgroundColor: '#4CAF50',
  },
  retrieveButton: {
    backgroundColor: '#2196F3',
  },
  deleteButton: {
    backgroundColor: '#f44336',
    marginTop: 5,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  instruction: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    lineHeight: 18,
  },
});

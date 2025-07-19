import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import {
  getSecurityCapabilities,
  setItem,
  getItem,
  removeItem,
} from 'react-native-sensitive-info';

interface SecurityCapabilities {
  biometric: boolean;
  strongbox: boolean;
  recommendedLevel: 'standard' | 'biometric' | 'strongbox';
}

export const SecurityCapabilitiesDemo: React.FC = () => {
  const [capabilities, setCapabilities] = useState<SecurityCapabilities | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [lastOperation, setLastOperation] = useState<string>('None');

  useEffect(() => {
    loadCapabilities();
  }, []);

  const loadCapabilities = async () => {
    try {
      const caps = await getSecurityCapabilities();
      setCapabilities(caps);
    } catch (error) {
      console.error('Failed to load security capabilities:', error);
    }
  };

  const testSmartFallback = async (
    requestedLevel: 'biometric' | 'strongbox'
  ) => {
    if (!capabilities) return;

    setIsLoading(true);
    setLastOperation(`Testing ${requestedLevel} with smart fallback...`);

    try {
      // Store data with the requested security level
      await setItem('fallback_test', `Stored with ${requestedLevel} security`, {
        securityLevel: requestedLevel,
      });

      // Retrieve the data to confirm it worked
      const retrievedData = await getItem('fallback_test', {
        securityLevel: requestedLevel,
      });

      if (retrievedData) {
        const actuallyUsedLevel = getActualSecurityLevel(
          requestedLevel,
          capabilities
        );
        setLastOperation(
          `✅ Success! Requested: ${requestedLevel}, Actually used: ${actuallyUsedLevel}`
        );
        Alert.alert(
          'Smart Fallback Success!',
          `Requested: ${requestedLevel}\nActually used: ${actuallyUsedLevel}\nData: ${retrievedData}`,
          [
            {
              text: 'Clean Up',
              onPress: async () => {
                await removeItem('fallback_test', {
                  securityLevel: requestedLevel,
                });
                setLastOperation('Test data cleaned up');
              },
            },
            { text: 'OK', style: 'default' },
          ]
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setLastOperation(`❌ Failed: ${errorMessage}`);
      Alert.alert('Test Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getActualSecurityLevel = (
    requested: string,
    caps: SecurityCapabilities
  ): string => {
    if (requested === 'biometric' && !caps.biometric) {
      return caps.strongbox ? 'strongbox (fallback)' : 'standard (fallback)';
    }
    if (requested === 'strongbox' && !caps.strongbox) {
      return caps.biometric ? 'biometric (fallback)' : 'standard (fallback)';
    }
    return requested;
  };

  const getStatusIcon = (available: boolean): string => {
    return available ? '✅' : '❌';
  };

  const getRecommendationColor = (level: string): string => {
    switch (level) {
      case 'strongbox':
        return '#4CAF50'; // Green
      case 'biometric':
        return '#FF9800'; // Orange
      default:
        return '#2196F3'; // Blue
    }
  };

  if (!capabilities) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🔍 Loading Security Capabilities...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🛡️ Security Capabilities</Text>

      {/* Current Capabilities */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device Capabilities</Text>

        <View style={styles.capabilityRow}>
          <Text style={styles.capabilityText}>
            {getStatusIcon(capabilities.biometric)} Biometric Authentication
          </Text>
          <Text style={styles.capabilityStatus}>
            {capabilities.biometric ? 'Available' : 'Not Available'}
          </Text>
        </View>

        <View style={styles.capabilityRow}>
          <Text style={styles.capabilityText}>
            {getStatusIcon(capabilities.strongbox)} Hardware Security
            (StrongBox)
          </Text>
          <Text style={styles.capabilityStatus}>
            {capabilities.strongbox ? 'Available' : 'Not Available'}
          </Text>
        </View>

        <View
          style={[
            styles.recommendationBox,
            {
              borderColor: getRecommendationColor(
                capabilities.recommendedLevel
              ),
            },
          ]}
        >
          <Text style={styles.recommendationTitle}>
            Recommended Security Level
          </Text>
          <Text
            style={[
              styles.recommendationLevel,
              { color: getRecommendationColor(capabilities.recommendedLevel) },
            ]}
          >
            {capabilities.recommendedLevel.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Smart Fallback Tests */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Smart Fallback Tests</Text>
        <Text style={styles.description}>
          These tests demonstrate how the library automatically falls back to
          available security levels.
        </Text>

        <TouchableOpacity
          style={[
            styles.testButton,
            styles.biometricButton,
            isLoading && styles.disabledButton,
          ]}
          onPress={() => testSmartFallback('biometric')}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            Test Biometric Security
            {!capabilities.biometric && ' (Will Fallback)'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.testButton,
            styles.strongboxButton,
            isLoading && styles.disabledButton,
          ]}
          onPress={() => testSmartFallback('strongbox')}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            Test StrongBox Security
            {!capabilities.strongbox && ' (Will Fallback)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Status</Text>
        <Text style={styles.status}>{lastOperation}</Text>
        {isLoading && <Text style={styles.loading}>⏳ Processing...</Text>}
      </View>

      {/* Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📖 How Smart Fallback Works</Text>
        <Text style={styles.instruction}>
          🎯 <Text style={styles.bold}>Request biometric security:</Text>
        </Text>
        <Text style={styles.subInstruction}>
          • If biometric available → Uses biometric protection
        </Text>
        <Text style={styles.subInstruction}>
          • If not available but StrongBox is → Falls back to StrongBox
        </Text>
        <Text style={styles.subInstruction}>
          • Otherwise → Falls back to standard encryption
        </Text>

        <Text style={styles.instruction}>
          🛡️ <Text style={styles.bold}>Request StrongBox security:</Text>
        </Text>
        <Text style={styles.subInstruction}>
          • If StrongBox available → Uses hardware security
        </Text>
        <Text style={styles.subInstruction}>
          • If not available but biometric is → Falls back to biometric
        </Text>
        <Text style={styles.subInstruction}>
          • Otherwise → Falls back to standard encryption
        </Text>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>💡 Pro Tip</Text>
          <Text style={styles.noteText}>
            Use getSecurityCapabilities() to check what's available before
            storing sensitive data. The library will automatically use the best
            available security level.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
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
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  capabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  capabilityText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  capabilityStatus: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  recommendationBox: {
    marginTop: 15,
    padding: 12,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  recommendationTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  recommendationLevel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  testButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  biometricButton: {
    backgroundColor: '#FF9800',
  },
  strongboxButton: {
    backgroundColor: '#4CAF50',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    lineHeight: 22,
  },
  loading: {
    fontSize: 14,
    color: '#2196F3',
    fontStyle: 'italic',
  },
  instruction: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  subInstruction: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    marginLeft: 16,
    lineHeight: 18,
  },
  bold: {
    fontWeight: 'bold',
  },
  noteBox: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: '#1565c0',
    lineHeight: 18,
  },
});

import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { setItem, getItem, removeItem } from 'react-native-sensitive-info';
import type { Theme } from '../types';
import { DEMO_DATA } from '../utils/helpers';
import { commonStyles } from '../styles/commonStyles';

interface QuickActionsProps {
  theme: Theme;
  isLoading: boolean;
  onOperationComplete: (message: string) => void;
  onDataReload: () => Promise<void>;
}

export function QuickActions({
  theme,
  isLoading,
  onOperationComplete,
  onDataReload,
}: QuickActionsProps) {
  const handleLoadDemoData = () => {
    Alert.alert(
      'Load Demo Data',
      'This will add sample secure data to demonstrate the library features.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load Demo',
          onPress: async () => {
            try {
              const startTime = Date.now();

              for (const [key, value] of Object.entries(DEMO_DATA)) {
                await setItem(key, value);
              }

              const endTime = Date.now();
              onOperationComplete(
                `Loaded ${Object.keys(DEMO_DATA).length} demo items in ${
                  endTime - startTime
                }ms`
              );
              await onDataReload();

              Alert.alert('Success', 'Demo data loaded!');
            } catch (error) {
              console.error('Error loading demo data:', error);
              Alert.alert('Error', 'Failed to load demo data');
            }
          },
        },
      ]
    );
  };

  const handlePerformanceTest = () => {
    Alert.alert(
      'Performance Test',
      'This will perform 100 write/read operations to test performance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Test',
          onPress: async () => {
            try {
              const iterations = 100;

              // Write test
              const writeStart = Date.now();
              for (let i = 0; i < iterations; i++) {
                await setItem(`test_${i}`, `value_${i}_${Date.now()}`);
              }
              const writeEnd = Date.now();

              // Read test
              const readStart = Date.now();
              for (let i = 0; i < iterations; i++) {
                await getItem(`test_${i}`);
              }
              const readEnd = Date.now();

              // Cleanup
              const cleanupStart = Date.now();
              for (let i = 0; i < iterations; i++) {
                await removeItem(`test_${i}`);
              }
              const cleanupEnd = Date.now();

              const writeTime = writeEnd - writeStart;
              const readTime = readEnd - readStart;
              const cleanupTime = cleanupEnd - cleanupStart;

              onOperationComplete(
                `Performance: ${iterations} ops - Write: ${writeTime}ms, Read: ${readTime}ms, Cleanup: ${cleanupTime}ms`
              );
              await onDataReload();

              Alert.alert(
                'Performance Results',
                `${iterations} operations completed:\n\n` +
                  `Write: ${writeTime}ms (${(writeTime / iterations).toFixed(
                    2
                  )}ms avg)\n` +
                  `Read: ${readTime}ms (${(readTime / iterations).toFixed(
                    2
                  )}ms avg)\n` +
                  `Cleanup: ${cleanupTime}ms (${(
                    cleanupTime / iterations
                  ).toFixed(2)}ms avg)`
              );
            } catch (error) {
              console.error('Error in performance test:', error);
              Alert.alert('Error', 'Performance test failed');
            }
          },
        },
      ]
    );
  };

  return (
    <View
      style={[
        commonStyles.section,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text style={[commonStyles.sectionTitle, { color: theme.text }]}>
        🚀 Quick Actions
      </Text>

      <View style={commonStyles.buttonRow}>
        <TouchableOpacity
          style={[
            commonStyles.actionButton,
            { backgroundColor: theme.success },
          ]}
          onPress={handleLoadDemoData}
          disabled={isLoading}
        >
          <Text style={commonStyles.actionButtonText}>📦 Load Demo Data</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[commonStyles.actionButton, { backgroundColor: theme.accent }]}
          onPress={handlePerformanceTest}
          disabled={isLoading}
        >
          <Text style={commonStyles.actionButtonText}>⚡ Performance Test</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

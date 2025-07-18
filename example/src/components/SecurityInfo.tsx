import { View, Text, StyleSheet } from 'react-native';
import type { Theme } from '../types';
import { commonStyles } from '../styles/commonStyles';

interface SecurityInfoProps {
  theme: Theme;
}

export function SecurityInfo({ theme }: SecurityInfoProps) {
  return (
    <View
      style={[
        commonStyles.section,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text style={[commonStyles.sectionTitle, { color: theme.text }]}>
        🛡️ Security Features
      </Text>

      <View style={styles.securityGrid}>
        <View
          style={[
            styles.securityCard,
            { backgroundColor: theme.inputBackground },
          ]}
        >
          <Text style={styles.securityIcon}>🍎</Text>
          <Text style={[styles.securityTitle, { color: theme.text }]}>
            iOS Keychain
          </Text>
          <Text style={[styles.securityDesc, { color: theme.textSecondary }]}>
            Hardware-backed encryption
          </Text>
        </View>

        <View
          style={[
            styles.securityCard,
            { backgroundColor: theme.inputBackground },
          ]}
        >
          <Text style={styles.securityIcon}>🤖</Text>
          <Text style={[styles.securityTitle, { color: theme.text }]}>
            Android StrongBox
          </Text>
          <Text style={[styles.securityDesc, { color: theme.textSecondary }]}>
            Hardware Security Module
          </Text>
        </View>

        <View
          style={[
            styles.securityCard,
            { backgroundColor: theme.inputBackground },
          ]}
        >
          <Text style={styles.securityIcon}>⚡</Text>
          <Text style={[styles.securityTitle, { color: theme.text }]}>
            Nitro Modules
          </Text>
          <Text style={[styles.securityDesc, { color: theme.textSecondary }]}>
            Direct JSI, zero bridge
          </Text>
        </View>

        <View
          style={[
            styles.securityCard,
            { backgroundColor: theme.inputBackground },
          ]}
        >
          <Text style={styles.securityIcon}>🔐</Text>
          <Text style={[styles.securityTitle, { color: theme.text }]}>
            AES-256
          </Text>
          <Text style={[styles.securityDesc, { color: theme.textSecondary }]}>
            Military-grade encryption
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  securityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  securityCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  securityIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  securityTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  securityDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});

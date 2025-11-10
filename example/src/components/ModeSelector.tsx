import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SecurityAvailability } from 'react-native-sensitive-info';
import Card from './Card';
import type { AccessMode, ModeKey } from '../constants';

interface ModeSelectorProps {
  readonly modes: AccessMode[];
  readonly selectedKey: ModeKey;
  readonly onSelect: (key: ModeKey) => void;
  readonly availability?: SecurityAvailability | null;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({
  modes,
  selectedKey,
  onSelect,
  availability,
}) => {
  const biometricAvailable = availability?.biometry ?? false;

  return (
    <Card title="Guard it your way">
      <View style={styles.modeColumn}>
        {modes.map(option => {
          const disabled = option.key === 'biometric' && !biometricAvailable;
          const active = option.key === selectedKey;

          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled }}
              onPress={() => {
                if (!disabled) {
                  onSelect(option.key);
                }
              }}
              style={({ pressed }) => [
                styles.tile,
                active && styles.tileActive,
                disabled && styles.tileDisabled,
                pressed && !disabled && styles.tilePressed,
              ]}
            >
              <Text
                style={[
                  styles.tileLabel,
                  active && styles.tileLabelActive,
                  disabled && styles.tileLabelDisabled,
                ]}
              >
                {option.label}
              </Text>
              <Text
                style={[
                  styles.tileDescription,
                  disabled && styles.tileLabelDisabled,
                ]}
              >
                {option.description}
              </Text>
              {disabled ? (
                <Text style={styles.tileBadge}>Biometry unavailable</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {availability ? (
        <Text style={styles.availability}>
          Biometry • {availability.biometry ? 'Ready' : 'Unavailable'} · Secure
          Enclave • {availability.secureEnclave ? 'Ready' : 'Unavailable'}
        </Text>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  modeColumn: {
    flexDirection: 'column',
    gap: 12,
  },
  tile: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
  },
  tileActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  tileDisabled: {
    borderColor: '#e5e7eb',
    backgroundColor: '#f3f4f6',
  },
  tilePressed: {
    opacity: 0.9,
  },
  tileLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  tileLabelActive: {
    color: '#1d4ed8',
  },
  tileLabelDisabled: {
    color: '#9ca3af',
  },
  tileDescription: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#4b5563',
  },
  tileBadge: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  availability: {
    marginTop: 14,
    fontSize: 12,
    letterSpacing: 0.6,
    color: '#475569',
    textTransform: 'uppercase',
  },
});

export default ModeSelector;

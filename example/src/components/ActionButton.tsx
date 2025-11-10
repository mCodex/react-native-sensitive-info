import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

export interface ActionButtonProps {
  readonly label: string;
  readonly onPress: () => void | Promise<void>;
  readonly loading?: boolean;
  readonly primary?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  onPress,
  loading = false,
  primary = false,
}) => {
  const [busy, setBusy] = useState(false);

  const handlePress = useCallback(() => {
    if (busy || loading) {
      return;
    }

    const result = onPress();
    if (result && typeof (result as Promise<void>).then === 'function') {
      setBusy(true);
      void (result as Promise<void>).finally(() => setBusy(false));
    }
  }, [busy, loading, onPress]);

  const disabled = busy || loading;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        primary && styles.primary,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, primary && styles.primaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  primary: {
    backgroundColor: '#2563eb',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    backgroundColor: '#cbd5f5',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  primaryLabel: {
    color: '#ffffff',
  },
});

export default ActionButton;

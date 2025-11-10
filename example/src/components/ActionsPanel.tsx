import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from './Card';
import ActionButton from './ActionButton';

interface ActionsPanelProps {
  readonly onSave: () => Promise<void> | void;
  readonly onReveal: () => Promise<void> | void;
  readonly onRemove: () => Promise<void> | void;
  readonly onClear: () => Promise<void> | void;
  readonly onRefresh: () => Promise<void> | void;
  readonly pending: boolean;
  readonly status: string;
  readonly errorMessage?: string | null;
}

const ActionsPanel: React.FC<ActionsPanelProps> = ({
  onSave,
  onReveal,
  onRemove,
  onClear,
  onRefresh,
  pending,
  status,
  errorMessage,
}) => (
  <Card title="Actions">
    <View style={styles.buttonRow}>
      <ActionButton label="Save" onPress={onSave} loading={pending} primary />
      <ActionButton label="Reveal" onPress={onReveal} loading={pending} />
      <ActionButton label="Delete" onPress={onRemove} loading={pending} />
      <ActionButton label="Clear service" onPress={onClear} loading={pending} />
      <ActionButton label="Refresh" onPress={onRefresh} loading={pending} />
    </View>
    {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    <View style={styles.statusBubble}>
      <Text style={styles.statusText}>{status}</Text>
    </View>
  </Card>
);

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  errorText: {
    marginTop: 12,
    color: '#dc2626',
    fontSize: 13,
  },
  statusBubble: {
    marginTop: 14,
    backgroundColor: '#0f172a0d',
    borderRadius: 14,
    padding: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#0f172a',
  },
});

export default ActionsPanel;

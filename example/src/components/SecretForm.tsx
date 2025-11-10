import React from 'react';
import { Platform, StyleSheet, Text, TextInput } from 'react-native';
import Card from './Card';

interface SecretFormProps {
  readonly service: string;
  readonly onServiceChange: (value: string) => void;
  readonly keyName: string;
  readonly onKeyNameChange: (value: string) => void;
  readonly secret: string;
  readonly onSecretChange: (value: string) => void;
  readonly servicePlaceholder: string;
  readonly keyPlaceholder: string;
  readonly secretPlaceholder: string;
}

const SecretForm: React.FC<SecretFormProps> = ({
  service,
  onServiceChange,
  keyName,
  onKeyNameChange,
  secret,
  onSecretChange,
  servicePlaceholder,
  keyPlaceholder,
  secretPlaceholder,
}) => (
  <Card title="Secret details">
    <TextInput
      value={service}
      onChangeText={onServiceChange}
      placeholder={servicePlaceholder}
      autoCapitalize="none"
      style={styles.input}
    />
    <Text style={styles.label}>Service name</Text>

    <TextInput
      value={keyName}
      onChangeText={onKeyNameChange}
      placeholder={keyPlaceholder}
      autoCapitalize="none"
      style={styles.input}
    />
    <Text style={styles.label}>Key</Text>

    <TextInput
      value={secret}
      onChangeText={onSecretChange}
      placeholder={secretPlaceholder}
      autoCapitalize="none"
      style={[styles.input, styles.secretInput]}
      multiline
    />
    <Text style={styles.label}>Secret value</Text>
  </Card>
);

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 12, default: 10 }),
    fontSize: 15,
    color: '#111827',
  },
  secretInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
});

export default SecretForm;

import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import {
  getItem,
  useSecureStorage,
  useSecurityAvailability,
} from 'react-native-sensitive-info';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from './components/Header';
import SecretForm from './components/SecretForm';
import ModeSelector from './components/ModeSelector';
import ActionsPanel from './components/ActionsPanel';
import KeyRotationPanel from './components/KeyRotationPanel';
import SecretsList from './components/SecretsList';
import {
  ACCESS_MODES,
  DEFAULT_KEY,
  DEFAULT_SECRET,
  DEFAULT_SERVICE,
  INITIAL_STATUS,
  type ModeKey,
} from './constants';
import { formatError } from './utils/formatError';

const App: React.FC = () => {
  const [service, setService] = useState(DEFAULT_SERVICE);
  const [keyName, setKeyName] = useState(DEFAULT_KEY);
  const [secret, setSecret] = useState(DEFAULT_SECRET);
  const [mode, setMode] = useState<ModeKey>('open');
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [pending, setPending] = useState(false);

  const trimmedService = useMemo(() => {
    const next = service.trim();
    return next.length > 0 ? next : DEFAULT_SERVICE;
  }, [service]);

  const selectedMode = useMemo(() => {
    const fallback = ACCESS_MODES[0];
    return ACCESS_MODES.find(candidate => candidate.key === mode) ?? fallback;
  }, [mode]);

  const authenticationPrompt = useMemo(() => {
    if (selectedMode.key !== 'biometric') {
      return undefined;
    }

    return {
      title: 'Unlock your secret',
      subtitle: 'Biometric authentication is required to continue',
      description: 'This demo stores data behind your biometric enrollment.',
      cancel: 'Cancel',
    } as const;
  }, [selectedMode.key]);

  const secureOptions = useMemo(
    () => ({
      service: trimmedService,
      accessControl: selectedMode.accessControl,
      authenticationPrompt,
      includeValues: true,
    }),
    [authenticationPrompt, selectedMode.accessControl, trimmedService]
  );

  const {
    items,
    isLoading,
    error,
    saveSecret,
    removeSecret,
    clearAll,
    refreshItems,
  } = useSecureStorage(secureOptions);

  const { data: availability } = useSecurityAvailability();

  const handleSave = useCallback(async () => {
    const normalizedKey = keyName.trim();
    if (normalizedKey.length === 0) {
      setStatus('Please provide a key before saving.');
      return;
    }

    setPending(true);
    try {
      const result = await saveSecret(normalizedKey, secret);
      if (result.success) {
        setStatus('Secret saved securely.');
      } else {
        setStatus(result.error?.message ?? 'Unable to save the secret.');
      }
    } catch (err) {
      setStatus(formatError(err));
    } finally {
      setPending(false);
    }
  }, [keyName, saveSecret, secret]);

  const handleReveal = useCallback(async () => {
    const normalizedKey = keyName.trim();
    if (normalizedKey.length === 0) {
      setStatus('Provide the key you would like to reveal.');
      return;
    }

    setPending(true);
    try {
      const item = await getItem(normalizedKey, {
        service: trimmedService,
        accessControl: selectedMode.accessControl,
        authenticationPrompt,
        includeValue: true,
      });

      if (item?.value) {
        setStatus(`Secret for "${normalizedKey}" → ${item.value}`);
      } else {
        setStatus('That key has no stored value yet.');
      }
    } catch (err) {
      setStatus(formatError(err));
    } finally {
      setPending(false);
    }
  }, [
    authenticationPrompt,
    keyName,
    selectedMode.accessControl,
    trimmedService,
  ]);

  const handleRemove = useCallback(async () => {
    const normalizedKey = keyName.trim();
    if (normalizedKey.length === 0) {
      setStatus('Provide the key you would like to forget.');
      return;
    }

    setPending(true);
    try {
      const result = await removeSecret(normalizedKey);
      setStatus(
        result.success ? 'Secret deleted.' : 'Secret could not be deleted.'
      );
    } catch (err) {
      setStatus(formatError(err));
    } finally {
      setPending(false);
    }
  }, [keyName, removeSecret]);

  const handleClear = useCallback(async () => {
    setPending(true);
    try {
      const result = await clearAll();
      setStatus(
        result.success
          ? 'All secrets cleared for this service.'
          : 'Nothing to clear.'
      );
    } catch (err) {
      setStatus(formatError(err));
    } finally {
      setPending(false);
    }
  }, [clearAll]);

  const handleRefresh = useCallback(async () => {
    setPending(true);
    try {
      await refreshItems();
      setStatus('Inventory refreshed.');
    } catch (err) {
      setStatus(formatError(err));
    } finally {
      setPending(false);
    }
  }, [refreshItems]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <Header
          title="Sensitive Info Playground"
          subtitle="Store a small secret, lock it with biometrics if you like, and review the inventory below."
        />

        <SecretForm
          service={service}
          onServiceChange={setService}
          keyName={keyName}
          onKeyNameChange={setKeyName}
          secret={secret}
          onSecretChange={setSecret}
          servicePlaceholder={DEFAULT_SERVICE}
          keyPlaceholder={DEFAULT_KEY}
          secretPlaceholder={DEFAULT_SECRET}
        />

        <ModeSelector
          modes={ACCESS_MODES}
          selectedKey={selectedMode.key}
          onSelect={setMode}
          availability={availability ?? null}
        />

        <ActionsPanel
          onSave={handleSave}
          onReveal={handleReveal}
          onRemove={handleRemove}
          onClear={handleClear}
          onRefresh={handleRefresh}
          pending={pending}
          status={status}
          errorMessage={error?.message}
        />

        <KeyRotationPanel service={trimmedService} />

        <SecretsList
          items={items}
          isLoading={isLoading}
          service={trimmedService}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f8fb',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
});

export default App;

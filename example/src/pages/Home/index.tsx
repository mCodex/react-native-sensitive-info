import React, { useCallback } from 'react';
import { View, Button, Alert } from 'react-native';
import SInfo from 'react-native-sensitive-info';

const Home: React.FC = () => {
  const handleAddUsingSetItemOnPress = useCallback(() => {
    SInfo.setItem('key1', 'value1', {
      sharedPreferencesName: 'exampleApp',
      keychainService: 'exampleApp',
    });
  }, []);

  const handleReadingDataWithoutFingerprint = useCallback(async () => {
    const data = await SInfo.getItem('key1', {
      sharedPreferencesName: 'exampleApp',
      keychainService: 'exampleApp',
    });

    Alert.alert('Data stored:', data);
  }, []);

  const handleSetItemUsingTouchIDOnPress = useCallback(async () => {
    try {
      const deviceHasSensor = await SInfo.isSensorAvailable();

      if (!deviceHasSensor) {
        return Alert.alert('No sensor found');
      }

      const data = await SInfo.setItem(
        'touchIdItem',
        new Date().toISOString(),
        {
          sharedPreferencesName: 'exampleApp',
          keychainService: 'exampleApp',
          kSecAccessControl: 'kSecAccessControlBiometryAny', // Enabling FaceID
          touchID: true,
          showModal: true,
        },
      );

      Alert.alert('data successfully stored', data || '');
    } catch (ex) {
      Alert.alert('Error', ex.message);
    }
  }, []);

  const getTouchIDItem = useCallback(async () => {
    const deviceHasSensor = await SInfo.isSensorAvailable();

    if (!deviceHasSensor) {
      return Alert.alert('No sensor found');
    }

    try {
      const data = await SInfo.getItem('touchIdItem', {
        sharedPreferencesName: 'exampleApp',
        keychainService: 'exampleApp',
        touchID: true,
        showModal: true,
        strings: {
          description: 'Custom Title ',
          header: 'Custom Description',
        },
        kSecUseOperationPrompt:
          'We need your permission to retrieve encrypted data',
      });

      Alert.alert('Data stored', data);
    } catch (ex) {
      Alert.alert('Error', ex.message);
    }
  }, []);

  return (
    <View>
      <Button
        title="Add item using setItem"
        onPress={handleAddUsingSetItemOnPress}
      />
      <Button
        title="Read data without fingerprint"
        onPress={handleReadingDataWithoutFingerprint}
      />
      <Button
        title="Add item using TouchID"
        onPress={handleSetItemUsingTouchIDOnPress}
      />

      <Button title="Get TouchID Data" onPress={getTouchIDItem} />
    </View>
  );
};
export default Home;

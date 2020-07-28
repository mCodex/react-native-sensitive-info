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

  const handleSetItemUsingTouchIDOnPress = useCallback(async () => {
    try {
      // const deviceHasSensor = await SInfo.isSensorAvailable();

      // if (!deviceHasSensor) {
      //   return Alert.alert('No sensor found');
      // }

      await SInfo.setItem('touchIdItem', new Date().toISOString(), {
        kSecAccessControl: 'kSecAccessControlBiometryAny',
        touchID: true,
      });

      Alert.alert('data successfully stored');
    } catch (ex) {
      console.log(ex.message);
    }
  }, []);

  const getTouchIDItem = useCallback(async () => {
    const deviceHasSensor = await SInfo.isSensorAvailable();

    // if (!deviceHasSensor) {
    //   return Alert.alert('No sensor found');
    // }

    try {
      const data = await SInfo.getItem('touchIdItem', {
        touchID: true,
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
        title="Add item using TouchID"
        onPress={handleSetItemUsingTouchIDOnPress}
      />

      <Button title="Get TouchID Data" onPress={getTouchIDItem} />
    </View>
  );
};
export default Home;

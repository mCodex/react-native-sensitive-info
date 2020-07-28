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
      const deviceHasSensor = await SInfo.isSensorAvailable();

      if (!deviceHasSensor) {
        return Alert.alert('No sensor found');
      }

      SInfo.setItem('touchIdItem', 'dataStoredUsingTouchId', {
        // touchID: true,
        showModal: true
      });
    } catch (ex) {
      console.log(ex.message);
    }
  }, []);

  /**
   * @BUG when triggering this function iOS emulator crashes. Need to investigate
   */
  const getTouchIDItem = useCallback(async () => {
    const deviceHasSensor = await SInfo.isSensorAvailable();

    if (!deviceHasSensor) {
      return Alert.alert('No sensor found');
    }

    SInfo.getItem('touchIdItem', {
      touchID: true,
      showModal: true
    });
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

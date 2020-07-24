import React, { useCallback } from 'react'
import {View, Button} from 'react-native'
import SInfo from 'react-native-sensitive-info'

const Home: React.FC = () => {
    const handleAddItemOnPress = useCallback(() => {
        SInfo.setItem('key1', 'value1', {
            sharedPreferencesName: 'exampleApp',
            keychainService: 'exampleApp'
        })
    },[])

    return (
      <View>
        <Button title="Add Item" onPress={handleAddItemOnPress} />
      </View>
    );
}
export default Home;

import React, { useEffect,useCallback } from 'react';
import { View, Text,  Button } from 'react-native';

import SInfo from 'react-native-sensitive-info';

const Home: React.FC = () => {
    useEffect(() => {
        SInfo.setInvalidatedByBiometricEnrollment(false)
    },[])

    const handleSetItem = useCallback((key,value) => {
        SInfo.setItem(key,value, {
            sharedPreferencesName: 'myapp',
            keychainService: 'myapp'
        })
    },[])

    return (
      <View>
        <Text>Hello World</Text>

        <Button onPress={() => handleSetItem('key1', 'value1')} title="Insert First Item" />
      </View>
    );
}

export default Home;
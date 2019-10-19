/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import React, { Component } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Alert,
  TouchableOpacity,
  Platform,
  AppState,
  DeviceEventEmitter,
} from 'react-native';

import SInfo from 'react-native-sensitive-info';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
  button: {
    backgroundColor: 'lightskyblue',
    padding: 10,
    borderRadius: 3,
    margin: 5,
  },
});

export default class App extends Component {
  constructor(props) {
    super(props);
    this.handleStateChange = this.handleStateChange.bind(this);
    this.handleAuthFeedback = this.handleAuthFeedback.bind(this);
    this.state = {
      helpText: '',
    };
  }

  componentDidMount() {
    SInfo.setItem('key1', 'value1', {
      sharedPreferencesName: 'mySharedPrefs',
      keychainService: 'myKeychain',
    });

    SInfo.setItem('key2', 'value2', {}).then(test => {
      console.log('My test', test); //Value 2
    });

    SInfo.setItem('key3', 'value3', {
      keychainService: 'myKeychain',
      kSecAccessControl: 'kSecAccessControlTouchIDCurrentSet',
      touchID: true,
    });

    SInfo.setItem('key5', 'kSecAttrAccessibleValue', {
      keychainService: 'myKeychain',
      kSecAttrAccessible: 'kSecAttrAccessibleAlways',
    });

    SInfo.getItem('key1', {
      sharedPreferencesName: 'mySharedPrefs',
      keychainService: 'myKeychain',
    }).then(value => {
      console.log(value); //value1
    });

    SInfo.getItem('key2', {}).then(value => {
      console.log(value); //value2
    });

    SInfo.getItem('key3', {}).then(value => {
      console.log(value); //value3
    });

    SInfo.getAllItems({
      sharedPreferencesName: 'mySharedPrefs',
      keychainService: 'myKeychain',
    }).then(values => {
      console.log(values); //value1, value2
    });

    SInfo.getAllItems({}).then(values => {
      console.log(values); //value3, value2
    });

    SInfo.deleteItem('key1', {
      sharedPreferencesName: 'mySharedPrefs',
      keychainService: 'myKeychain',
    }).then(values => {
      console.log(values);
      console.log('deleted');
    });

    AppState.addEventListener('change', this.handleStateChange);
    DeviceEventEmitter.addListener(
      'FINGERPRINT_AUTHENTICATION_HELP',
      this.handleAuthFeedback,
    );
  }

  componentWillUnmount() {
    AppState.removeEventListener('change', this.handleStateChange);
    SInfo.cancelFingerprintAuth();
    DeviceEventEmitter.removeListener(
      'FINGERPRINT_AUTHENTICATION_HELP',
      this.handleAuthFeedback,
    );
  }

  async setTouchIDItem() {
    if (!(await SInfo.isSensorAvailable())) {
      Alert.alert('Touch Sensor not found');
      return;
    }
    if (Platform.OS === 'android') {
      this.setState({
        helpText: 'Scan your fingerprint set the item.',
      });
    }
    try {
      await SInfo.setItem('touchItem', new Date().toISOString(), {
        kSecAccessControl: 'kSecAccessControlBiometryAny'
      });
    } catch (err) {
      Alert.alert(err.message);
    } finally {
      if (Platform.OS === 'android') {
        this.setState({
          helpText: '',
        });
      }
    }
  }

  async getTouchIDItem() {
    if (!(await SInfo.isSensorAvailable())) {
      Alert.alert('Touch Sensor not found');
      return;
    }
    if (Platform.OS === 'android') {
      this.setState({
        helpText: 'Scan your fingerprint to get the item.',
      });
    }
    try {
      const result = await SInfo.getItem('touchItem', {
        touchID: true,
        kSecUseOperationPrompt: 'Scan your fingerprint to get the item.', // this is for iOS
      });
      if (result) {
        Alert.alert('Touch ID item', result);
      }
    } catch (err) {
      Alert.alert(err.message);
    } finally {
      if (Platform.OS === 'android') {
        this.setState({
          helpText: '',
        });
      }
    }
  }

  handleStateChange(appState) {
    switch (appState) {
      case 'background':
        this.setState({
          helpText: '',
        });
        SInfo.cancelFingerprintAuth();
        break;
      default:
    }
  }

  handleAuthFeedback(helpText) {
    this.setState({ helpText });
  }

  render() {
    return (
      <View style={styles.container}>
        <Text>{this.state.helpText}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => this.setTouchIDItem()}
          accessibilityLabel="set touchID item">
          <Text>set touchID item</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => this.getTouchIDItem()}
          accessibilityLabel="get touchID item">
          <Text>get touchID item</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 */

import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View
} from 'react-native';

import RNSensitiveInfo from 'react-native-sensitive-info'; //<-- Add this line

class example extends Component {
  render() {

    RNSensitiveInfo.setPrefs('key1', 'value1');
    RNSensitiveInfo.setPrefs('key2', 'value2');
    RNSensitiveInfo.setPrefs('key3', 'value3');
    RNSensitiveInfo.setPrefs('key4', 'value4');
    RNSensitiveInfo.setPrefs('key5', 'value5');

    RNSensitiveInfo.getPrefs('key1').then(function(data) {
        console.log(data);
    });

    RNSensitiveInfo.getAllPrefs(function(result){
      console.log(result.key1);
    });

    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>
          Welcome to React Native!
        </Text>
        <Text style={styles.instructions}>
          To get started, edit index.android.js
        </Text>
        <Text style={styles.instructions}>
          Shake or press menu button for dev menu
        </Text>
      </View>
    );
  }
}

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
});

AppRegistry.registerComponent('example', () => example);

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

    RNSensitiveInfo.setItemForService('key1', 'value1');
    /*RNSensitiveInfo.setItem('key2', 'value2');
    RNSensitiveInfo.setItem('key3', 'value3');
    RNSensitiveInfo.setItem('key4', 'value4');
    RNSensitiveInfo.setItem('key5', 'value5');

    RNSensitiveInfo.setItem('key1').then(function(data) {
        console.log(data);
    });*/

    /*RNSensitiveInfo.getAllPrefs(function(result){
      console.log(result.key1);
    });*/

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

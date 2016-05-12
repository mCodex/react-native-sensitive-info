/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 * Using this library you will only need to call:
    1 - import SharedPrefsGetter from './SharedPrefsGet';
    2 - SharedPrefsGetter.getSharedPrefs(function(data){
          alert(data);
        }
 });
 */

import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View
} from 'react-native';

import SharedPrefsGetter from './SharedPrefsGet';

class SharedGetter extends Component {
  render() {
    SharedPrefsGetter.getSharedPrefs(function(data){
      alert(data);
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

AppRegistry.registerComponent('SharedGetter', () => SharedGetter);

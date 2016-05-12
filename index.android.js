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

'use strict';

import { NativeModules } from 'react-native';

module.exports = NativeModules.SharedPrefsGetter;

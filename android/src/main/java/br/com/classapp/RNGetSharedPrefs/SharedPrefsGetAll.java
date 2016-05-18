package br.com.classapp.RNGetSharedPrefs;

import android.content.Context;
import android.content.SharedPreferences;
import android.preference.PreferenceManager;

import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;

import java.util.Map;

public class SharedPrefsGetAll {
    public static WritableMap getAllPrefs(Context context){
        SharedPreferences prefs = PreferenceManager.getDefaultSharedPreferences(context);

        Map<String, ?> allEntries = prefs.getAll();
        WritableMap resultData = new WritableNativeMap();

        for (Map.Entry<String, ?> entry : allEntries.entrySet()) {
            resultData.putString(entry.getKey(), entry.getValue().toString());
        }
        return (resultData);
    }
}
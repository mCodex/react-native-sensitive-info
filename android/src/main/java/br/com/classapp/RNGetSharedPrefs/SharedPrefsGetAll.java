package br.com.classapp.RNGetSharedPrefs;

import android.content.Context;
import android.content.SharedPreferences;
import android.preference.PreferenceManager;

import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;

import java.util.Map;

public class SharedPrefsGetAll {
    private static final String SHARED_NAME = "shared_preferences";

    public static WritableMap getAllPrefs(Context context){
        SharedPreferences prefs = context.getSharedPreferences(SHARED_NAME, Context.MODE_PRIVATE);
        Map<String, ?> allEntries = prefs.getAll();
        WritableMap resultData = new WritableNativeMap();

        for (Map.Entry<String, ?> entry : allEntries.entrySet()) {
            resultData.putString(entry.getKey(), entry.getValue().toString());
        }
        return (resultData);
    }
}
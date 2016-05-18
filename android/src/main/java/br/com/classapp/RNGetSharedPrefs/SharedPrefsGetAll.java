package br.com.classapp.RNGetSharedPrefs;

import android.content.Context;
import android.content.SharedPreferences;
import android.preference.PreferenceManager;

import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.uimanager.IllegalViewOperationException;

import java.util.Map;

public class SharedPrefsGetAll {

    private Context mContext;

    public SharedPrefsGetAll(Context context) {
        mContext = context;
    }

    public WritableMap getAllPrefs(){
        SharedPreferences prefs = PreferenceManager.getDefaultSharedPreferences(mContext);

        Map<String, ?> allEntries = prefs.getAll();
        WritableMap resultData = new WritableNativeMap();

        for (Map.Entry<String, ?> entry : allEntries.entrySet()) {
            resultData.putString(entry.getKey(), entry.getValue().toString());
        }
        return (resultData);

    }
}
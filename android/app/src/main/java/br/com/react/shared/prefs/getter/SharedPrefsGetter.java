package br.com.react.shared.prefs.getter;

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

/**
 * Created by classapp on 5/10/16.
 */
public class SharedPrefsGetter extends ReactContextBaseJavaModule {

    public SharedPrefsGetter(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "SharedPrefsGetter";
    }

    @ReactMethod
    public void getSharedPrefs(Callback cb) {
        try {
            SharedPreferences prefs = PreferenceManager.getDefaultSharedPreferences(getReactApplicationContext());

            Map<String, ?> allEntries = prefs.getAll();
            WritableMap resultData = new WritableNativeMap();

            for (Map.Entry<String, ?> entry : allEntries.entrySet()) {
                resultData.putString(entry.getKey(), entry.getValue().toString());
            }
            cb.invoke(resultData);
        } catch (IllegalViewOperationException e) {
            cb.invoke(e.getMessage());
        }
    }
}

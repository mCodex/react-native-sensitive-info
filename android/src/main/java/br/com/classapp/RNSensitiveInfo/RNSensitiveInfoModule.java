package br.com.classapp.RNSensitiveInfo;

import android.content.Context;
import android.content.SharedPreferences;
import android.hardware.fingerprint.FingerprintManager;
import android.os.Build;
import android.support.annotation.NonNull;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;

import java.util.Map;

public class RNSensitiveInfoModule extends ReactContextBaseJavaModule {

    private FingerprintManager mFingerprintManager;

    public RNSensitiveInfoModule(ReactApplicationContext reactContext) {
        super(reactContext);
        mFingerprintManager = (FingerprintManager) reactContext.getSystemService(Context.FINGERPRINT_SERVICE);
    }

    @Override
    public String getName() {
        return "RNSensitiveInfo";
    }

    /**
     * Checks whether the device supports fingerprint authentication and if the user has
     * enrolled at least one fingerprint.
     *
     * @return true if the user has a fingerprint capable device and has enrolled
     * one or more fingerprints
     */
    private boolean hasSetupFingerprint() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (!mFingerprintManager.isHardwareDetected()) {
                    return false;
                } else if (!mFingerprintManager.hasEnrolledFingerprints()) {
                    return false;
                }
                return true;
            } else {
                return false;
            }
        } catch (SecurityException e) {
            // Should never be thrown since we have declared the USE_FINGERPRINT permission
            // in the manifest file
            return false;
        }
    }

    @ReactMethod
    public void isSensorAvailable(final Promise promise) {
        promise.resolve(hasSetupFingerprint());
    }

    @ReactMethod
    public void getItem(String key, ReadableMap options, Promise pm) {

        String name = sharedPreferences(options);

        String value = prefs(name).getString(key, null);

        pm.resolve(value);
    }

    @ReactMethod
    public void setItem(String key, String value, ReadableMap options, Promise pm) {

        String name = sharedPreferences(options);

        try {
            putExtra(key, value, prefs(name));
            pm.resolve(value);
        } catch (Exception e) {
            Log.d("RNSensitiveInfo", e.getCause().getMessage());
            pm.reject(e);
        }
    }


    @ReactMethod
    public void deleteItem(String key, ReadableMap options, Promise pm) {

        String name = sharedPreferences(options);

        SharedPreferences.Editor editor = prefs(name).edit();

        editor.remove(key).apply();

        pm.resolve(null);
    }


    @ReactMethod
    public void getAllItems(ReadableMap options, Promise pm) {

        String name = sharedPreferences(options);

        Map<String, ?> allEntries = prefs(name).getAll();
        WritableMap resultData = new WritableNativeMap();

        for (Map.Entry<String, ?> entry : allEntries.entrySet()) {
            String value = entry.getValue().toString();
            resultData.putString(entry.getKey(), value);
        }
        pm.resolve(resultData);
    }

    private SharedPreferences prefs(String name) {
        return getReactApplicationContext().getSharedPreferences(name, Context.MODE_PRIVATE);
    }

    @NonNull
    private String sharedPreferences(ReadableMap options) {
        String name = options.hasKey("sharedPreferencesName") ? options.getString("sharedPreferencesName") : "shared_preferences";
        if (name == null) {
            name = "shared_preferences";
        }
        return name;
    }


    private void putExtra(String key, Object value, SharedPreferences mSharedPreferences) {
        SharedPreferences.Editor editor = mSharedPreferences.edit();
        if (value instanceof String) {
            editor.putString(key, (String) value).apply();
        } else if (value instanceof Boolean) {
            editor.putBoolean(key, (Boolean) value).apply();
        } else if (value instanceof Integer) {
            editor.putInt(key, (Integer) value).apply();
        } else if (value instanceof Long) {
            editor.putLong(key, (Long) value).apply();
        } else if (value instanceof Float) {
            editor.putFloat(key, (Float) value).apply();
        }
    }
}

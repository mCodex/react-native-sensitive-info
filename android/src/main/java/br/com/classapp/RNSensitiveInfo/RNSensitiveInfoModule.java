package br.com.classapp.RNSensitiveInfo;

import android.content.Context;
import android.content.SharedPreferences;

import com.facebook.react.bridge.*;

import java.util.Map;

public class RNSensitiveInfoModule extends ReactContextBaseJavaModule {

  private SharedPreferences mSharedPreferences;

  public RNSensitiveInfoModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "RNSensitiveInfo";
  }

  @ReactMethod
  public void getItem(String key, ReadableMap options, Promise pm) {

    String name = options.getString("sharedPreferencesName");
    if (name == null) {
      name = "app";
    }

    mSharedPreferences = getReactApplicationContext().getSharedPreferences(name, Context.MODE_PRIVATE);
    String value = mSharedPreferences.getString(key, null);
    pm.resolve(value);

  }

  @ReactMethod
  public void setItem(String key, String value, ReadableMap options) {

    String name = options.getString("sharedPreferencesName");
    if (name == null) {
      name = "app";
    }

    mSharedPreferences = getReactApplicationContext().getSharedPreferences(name, Context.MODE_PRIVATE);

    putExtra(key, value, mSharedPreferences );
  }


  @ReactMethod
  public void deleteItem(String key, ReadableMap options) {

    String name = options.getString("sharedPreferencesName");
    if (name == null) {
      name = "app";
    }

    mSharedPreferences = getReactApplicationContext().getSharedPreferences(name, Context.MODE_PRIVATE);

    SharedPreferences.Editor editor = mSharedPreferences.edit();

    editor.remove(key);
  }



  @ReactMethod
  public void getAllItems(ReadableMap options, Promise pm) {

    String name = options.getString("sharedPreferencesName");
    if (name == null) {
      name = "app";
    }

    mSharedPreferences = getReactApplicationContext().getSharedPreferences(name, Context.MODE_PRIVATE);

    Map<String, ?> allEntries = mSharedPreferences.getAll();
    WritableMap resultData = new WritableNativeMap();

    for (Map.Entry<String, ?> entry : allEntries.entrySet()) {
      resultData.putString(entry.getKey(), entry.getValue().toString());
    }
    pm.resolve(resultData);
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

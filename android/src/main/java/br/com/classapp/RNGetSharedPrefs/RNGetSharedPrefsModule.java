package br.com.classapp.RNGetSharedPrefs;

import android.bluetooth.BluetoothAdapter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings.Secure;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import javax.annotation.Nullable;

public class RNGetSharedPrefsModule extends ReactContextBaseJavaModule {

  public RNGetSharedPrefsModule(ReactApplicationContext reactContext) {
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

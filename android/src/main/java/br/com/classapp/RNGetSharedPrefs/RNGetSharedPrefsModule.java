package br.com.classapp.RNGetSharedPrefs;

import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class RNGetSharedPrefsModule extends ReactContextBaseJavaModule {

  public RNGetSharedPrefsModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "RNGetSharedPrefs";
  }

  @ReactMethod
  public void getPrefs(String key, Callback cb) {

    SharedPrefsHandler.init(getReactApplicationContext());
    String value = SharedDataProvider.getSharedValue(key);
    cb.invoke(value);

  }

  @ReactMethod
  public void setPrefs(String key, String value) {

    SharedPrefsHandler.init(getReactApplicationContext());
    SharedDataProvider.putSharedValue(key,value);

  }

  @ReactMethod
  public void getAllPrefs(Callback cb) {

  }
}

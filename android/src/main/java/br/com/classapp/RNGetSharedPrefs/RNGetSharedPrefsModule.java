package br.com.classapp.RNGetSharedPrefs;

import com.facebook.react.bridge.*;

public class RNGetSharedPrefsModule extends ReactContextBaseJavaModule {

  public RNGetSharedPrefsModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "RNGetSharedPrefs";
  }

  @ReactMethod
  public void getPrefs(String key, Promise pm) {

    SharedPrefsHandler.init(getReactApplicationContext());
    String value = SharedDataProvider.getSharedValue(key);
    pm.resolve(value);

  }

  @ReactMethod
  public void setPrefs(String key, String value) {

    SharedPrefsHandler.init(getReactApplicationContext());
    SharedDataProvider.putSharedValue(key, value);

  }

  @ReactMethod
  public void getAllPrefs(Callback cb) {
    WritableMap data;
    new WritableNativeMap();
    data = SharedPrefsGetAll.getAllPrefs(getReactApplicationContext());
    cb.invoke(data);
  }
}
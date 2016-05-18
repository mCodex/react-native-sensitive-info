package br.com.classapp.RNSensitiveInfo;

import com.facebook.react.bridge.*;

public class RNSensitiveInfoModule extends ReactContextBaseJavaModule {

  public RNSensitiveInfoModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "RNSensitiveInfo";
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
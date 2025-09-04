package br.com.classapp.RNSensitiveInfo;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.turbomodule.core.interfaces.TurboModule;

import javax.annotation.Nonnull;

public abstract class NativeSensitiveInfoSpec extends ReactContextBaseJavaModule implements TurboModule {

    public NativeSensitiveInfoSpec(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @ReactMethod
    public abstract void setItem(String key, String value, ReadableMap options, Promise promise);

    @ReactMethod
    public abstract void getItem(String key, ReadableMap options, Promise promise);

    @ReactMethod
    public abstract void getAllItems(ReadableMap options, Promise promise);

    @ReactMethod
    public abstract void deleteItem(String key, ReadableMap options, Promise promise);

    @ReactMethod
    public abstract void isSensorAvailable(Promise promise);


}
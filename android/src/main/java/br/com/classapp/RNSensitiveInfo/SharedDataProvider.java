package br.com.classapp.RNSensitiveInfo;

import br.com.classapp.RNSensitiveInfo.SharedPrefsHandler;

public class SharedDataProvider {

    private static final String TAG = "SharedDataProvider";


    public static String[] getMultiSharedValues(String[] keys) {
        SharedPrefsHandler sharedHandler = SharedPrefsHandler.getInstance();
        String[] results = new String[keys.length];
        for (int i = 0; i < keys.length; i++) {
            results[i] = sharedHandler.getString(keys[i]);
        }
        return results;
    }

    public static String getSharedValue(String key) {
        return SharedPrefsHandler.getInstance().getString(key);
    }

    public static void putSharedValue(String key, String value) {
        SharedPrefsHandler.getInstance().putExtra(key, value);
    }

    public static void clear() {
        SharedPrefsHandler.getInstance().clear();
    }

}
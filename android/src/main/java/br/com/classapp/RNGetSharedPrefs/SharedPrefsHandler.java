package br.com.classapp.RNGetSharedPrefs;


import android.content.Context;
import android.content.SharedPreferences;

public class SharedPrefsHandler {

    private static final String SHARED_NAME = "shared_preferences";

    private SharedPreferences mSharedPreferences;

    private static SharedPrefsHandler sSharedHandler;

    public SharedPrefsHandler(Context context) {
        mSharedPreferences = context.getSharedPreferences(SHARED_NAME, Context.MODE_PRIVATE);
    }

    public static SharedPrefsHandler getInstance() {
        return sSharedHandler;
    }

    public static void init(Context context) {
        sSharedHandler = new SharedPrefsHandler(context);
    }

    public void putExtra(String key, Object value) {
        SharedPreferences.Editor editor = mSharedPreferences.edit();
        if (value instanceof String) {
            editor.putString(key, (String) value).commit();
        } else if (value instanceof Boolean) {
            editor.putBoolean(key, (Boolean) value).commit();
        } else if (value instanceof Integer) {
            editor.putInt(key, (Integer) value).commit();
        } else if (value instanceof Long) {
            editor.putLong(key, (Long) value).commit();
        } else if (value instanceof Float) {
            editor.putFloat(key, (Float) value).commit();
        }
    }

    public String getString(String key) {
        return mSharedPreferences.getString(key, null);
    }

    public Float getFloat(String key) {
        return mSharedPreferences.getFloat(key, 0f);
    }

    public Long getLong(String key) {
        return mSharedPreferences.getLong(key, 0);
    }

    public Boolean getBoolean(String key) {
        return mSharedPreferences.getBoolean(key, false);
    }

    public Integer getInt(String key) {
        return mSharedPreferences.getInt(key, 0);
    }

    public void clear() {
        mSharedPreferences.edit().clear().commit();
    }

}
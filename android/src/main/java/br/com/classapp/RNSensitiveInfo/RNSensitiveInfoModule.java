package br.com.classapp.RNSensitiveInfo;

import android.content.Context;
import android.content.SharedPreferences;
import android.hardware.fingerprint.FingerprintManager;
import android.os.Build;
import android.os.CancellationSignal;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.support.annotation.NonNull;
import android.util.Base64;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.security.KeyStore;
import java.util.HashMap;
import java.util.Map;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.IvParameterSpec;

import br.com.classapp.RNSensitiveInfo.utils.AppConstants;
import br.com.classapp.RNSensitiveInfo.view.Fragments.FingerprintAuthenticationDialogFragment;
import br.com.classapp.RNSensitiveInfo.view.Fragments.FingerprintUiHelper;

public class RNSensitiveInfoModule extends ReactContextBaseJavaModule {

    // This must have 'AndroidKeyStore' as value. Unfortunately there is no predefined constant.
    private static final String ANDROID_KEYSTORE_PROVIDER = "AndroidKeyStore";

    // This is the default transformation used throughout this sample project.
    private static final String AES_DEFAULT_TRANSFORMATION =
            KeyProperties.KEY_ALGORITHM_AES + "/" +
                    KeyProperties.BLOCK_MODE_CBC + "/" +
                    KeyProperties.ENCRYPTION_PADDING_PKCS7;

    private static final String KEY_ALIAS_AES = "MyAesKeyAlias";
    private static final String DELIMITER = "]";

    private FingerprintManager mFingerprintManager;
    private KeyStore mKeyStore;
    private CancellationSignal mCancellationSignal;

    public RNSensitiveInfoModule(ReactApplicationContext reactContext) {
        super(reactContext);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            mFingerprintManager = (FingerprintManager) reactContext.getSystemService(Context.FINGERPRINT_SERVICE);
            initKeyStore();
        }
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
    public void isHardwareDetected(final Promise pm) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pm.resolve(mFingerprintManager.isHardwareDetected());
        } else {
            pm.resolve(false);
        }
    }

    @ReactMethod
    public void hasEnrolledFingerprints(final Promise pm) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pm.resolve(mFingerprintManager.hasEnrolledFingerprints());
        } else {
            pm.resolve(false);
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

        if (value != null && options.hasKey("touchID") && options.getBoolean("touchID")) {
            boolean showModal = options.hasKey("showModal") && options.getBoolean("showModal");
            HashMap strings = options.getMap("strings").toHashMap();

            decryptWithAes(value, showModal, strings, pm, null);
        } else {
            pm.resolve(value);
        }
    }

    @ReactMethod
    public void setItem(String key, String value, ReadableMap options, Promise pm) {

        String name = sharedPreferences(options);

        if (options.hasKey("touchID") && options.getBoolean("touchID")) {
            boolean showModal = options.hasKey("showModal") && options.getBoolean("showModal");
            HashMap strings = options.hasKey("strings") ? options.getMap("strings").toHashMap() : new HashMap();

            putExtraWithAES(key, value, prefs(name), showModal, strings, pm, null);
        } else {
            try {
                putExtra(key, value, prefs(name));
                pm.resolve(value);
            } catch (Exception e) {
                Log.d("RNSensitiveInfo", e.getCause().getMessage());
                pm.reject(e);
            }
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

    @ReactMethod
    public void cancelFingerprintAuth() {
        if(mCancellationSignal != null && !mCancellationSignal.isCanceled()) {
            mCancellationSignal.cancel();
        }
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

    /**
     * Generates a new AES key and stores it under the { @code KEY_ALIAS_AES } in the
     * Android Keystore.
     */
    private void initKeyStore() {
        try {
            mKeyStore = KeyStore.getInstance(ANDROID_KEYSTORE_PROVIDER);
            mKeyStore.load(null);

            // Check if a generated key exists under the KEY_ALIAS_AES .
            if (!mKeyStore.containsAlias(KEY_ALIAS_AES)) {
                prepareKey();
            }
        } catch (Exception e) {
        }
    }

    private void prepareKey() throws Exception {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.M) {
            return;
        }
        KeyGenerator keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE_PROVIDER);

        KeyGenParameterSpec.Builder builder = null;
        builder = new KeyGenParameterSpec.Builder(
                KEY_ALIAS_AES,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT);

        builder.setBlockModes(KeyProperties.BLOCK_MODE_CBC)
                .setKeySize(256)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_PKCS7)
                // forces user authentication with fingerprint
                .setUserAuthenticationRequired(true);

        keyGenerator.init(builder.build());
        keyGenerator.generateKey();
    }

    private void putExtraWithAES(final String key, final String value, final SharedPreferences mSharedPreferences, final boolean showModal, final HashMap strings, final Promise pm, Cipher cipher) {

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M && hasSetupFingerprint()) {
            try {
                if (cipher == null) {
                    SecretKey secretKey = (SecretKey) mKeyStore.getKey(KEY_ALIAS_AES, null);
                    cipher = Cipher.getInstance(AES_DEFAULT_TRANSFORMATION);
                    cipher.init(Cipher.ENCRYPT_MODE, secretKey);


                    // Retrieve information about the SecretKey from the KeyStore.
                    SecretKeyFactory factory = SecretKeyFactory.getInstance(
                            secretKey.getAlgorithm(), ANDROID_KEYSTORE_PROVIDER);
                    KeyInfo info = (KeyInfo) factory.getKeySpec(secretKey, KeyInfo.class);

                    if (info.isUserAuthenticationRequired() &&
                            info.getUserAuthenticationValidityDurationSeconds() == -1) {

                        if (showModal) {

                            // define class as a callback
                            class PutExtraWithAESCallback implements FingerprintUiHelper.Callback {
                                @Override
                                public void onAuthenticated(FingerprintManager.AuthenticationResult result) {
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                        putExtraWithAES(key, value, mSharedPreferences, showModal, strings, pm, result.getCryptoObject().getCipher());
                                    }
                                }

                                @Override
                                public void onError(String errorCode, CharSequence errString) {
                                    pm.reject(String.valueOf(errorCode), errString.toString());
                                }
                            }

                            // Show the fingerprint dialog
                            FingerprintAuthenticationDialogFragment fragment
                                    = FingerprintAuthenticationDialogFragment.newInstance(strings);
                            fragment.setCryptoObject(new FingerprintManager.CryptoObject(cipher));
                            fragment.setCallback(new PutExtraWithAESCallback());

                            fragment.show(getCurrentActivity().getFragmentManager(), AppConstants.DIALOG_FRAGMENT_TAG);

                        } else {
                            mCancellationSignal = new CancellationSignal();
                            mFingerprintManager.authenticate(new FingerprintManager.CryptoObject(cipher), mCancellationSignal,
                                    0, new FingerprintManager.AuthenticationCallback() {

                                        @Override
                                        public void onAuthenticationFailed() {
                                            super.onAuthenticationFailed();
                                            getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                                    .emit("FINGERPRINT_AUTHENTICATION_HELP", "Fingerprint not recognized.");
                                        }

                                        @Override
                                        public void onAuthenticationError(int errorCode, CharSequence errString) {
                                            super.onAuthenticationError(errorCode, errString);
                                            pm.reject(String.valueOf(errorCode), errString.toString());
                                        }

                                        @Override
                                        public void onAuthenticationHelp(int helpCode, CharSequence helpString) {
                                            super.onAuthenticationHelp(helpCode, helpString);
                                            getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                                    .emit("FINGERPRINT_AUTHENTICATION_HELP", helpString.toString());
                                        }

                                        @Override
                                        public void onAuthenticationSucceeded(FingerprintManager.AuthenticationResult result) {
                                            super.onAuthenticationSucceeded(result);
                                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                                putExtraWithAES(key, value, mSharedPreferences, showModal, strings, pm, result.getCryptoObject().getCipher());
                                            }
                                        }
                                    }, null);
                        }
                    }
                    return;
                }
                byte[] encryptedBytes = cipher.doFinal(value.getBytes());

                // Encode the initialization vector (IV) and encryptedBytes to Base64.
                String base64IV = Base64.encodeToString(cipher.getIV(), Base64.DEFAULT);
                String base64Cipher = Base64.encodeToString(encryptedBytes, Base64.DEFAULT);

                String result = base64IV + DELIMITER + base64Cipher;

                putExtra(key, result, mSharedPreferences);
                pm.resolve(value);
            } catch (KeyPermanentlyInvalidatedException e) {
                try {
                    mKeyStore.deleteEntry(KEY_ALIAS_AES);
                    prepareKey();
                } catch (Exception keyResetError) {
                    pm.reject(keyResetError);
                }
                pm.reject(e);
            } catch (SecurityException e) {
                pm.reject(e);
            } catch (Exception e) {
                pm.reject(e);
            }
        } else {
            pm.reject("Fingerprint not supported", "Fingerprint not supported");
        }
    }

    private void decryptWithAes(final String encrypted, final boolean showModal, final HashMap strings, final Promise pm, Cipher cipher) {

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M
                && hasSetupFingerprint()) {

            String[] inputs = encrypted.split(DELIMITER);
            if (inputs.length < 2) {
                pm.reject("DecryptionFailed", "DecryptionFailed");
            }

            try {
                byte[] iv = Base64.decode(inputs[0], Base64.DEFAULT);
                byte[] cipherBytes = Base64.decode(inputs[1], Base64.DEFAULT);

                if(cipher == null){
                    SecretKey secretKey = (SecretKey) mKeyStore.getKey(KEY_ALIAS_AES, null);
                    cipher = Cipher.getInstance(AES_DEFAULT_TRANSFORMATION);
                    cipher.init(Cipher.DECRYPT_MODE, secretKey, new IvParameterSpec(iv));

                    SecretKeyFactory factory = SecretKeyFactory.getInstance(
                            secretKey.getAlgorithm(), ANDROID_KEYSTORE_PROVIDER);
                    KeyInfo info = (KeyInfo) factory.getKeySpec(secretKey, KeyInfo.class);

                    if (info.isUserAuthenticationRequired() &&
                            info.getUserAuthenticationValidityDurationSeconds() == -1) {

                        if (showModal) {

                            // define class as a callback
                            class DecryptWithAesCallback implements FingerprintUiHelper.Callback {
                                @Override
                                public void onAuthenticated(FingerprintManager.AuthenticationResult result) {
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                        decryptWithAes(encrypted, showModal, strings, pm, result.getCryptoObject().getCipher());
                                    }
                                }

                                @Override
                                public void onError(String errorCode, CharSequence errString) {
                                    pm.reject(String.valueOf(errorCode), errString.toString());
                                }
                            }

                            // Show the fingerprint dialog
                            FingerprintAuthenticationDialogFragment fragment
                                    = FingerprintAuthenticationDialogFragment.newInstance(strings);
                            fragment.setCryptoObject(new FingerprintManager.CryptoObject(cipher));
                            fragment.setCallback(new DecryptWithAesCallback());

                            fragment.show(getCurrentActivity().getFragmentManager(), AppConstants.DIALOG_FRAGMENT_TAG);

                        } else {
                            mCancellationSignal = new CancellationSignal();
                            mFingerprintManager.authenticate(new FingerprintManager.CryptoObject(cipher), mCancellationSignal,
                                    0, new FingerprintManager.AuthenticationCallback() {

                                        @Override
                                        public void onAuthenticationFailed() {
                                            super.onAuthenticationFailed();
                                            getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                                    .emit("FINGERPRINT_AUTHENTICATION_HELP", "Fingerprint not recognized.");
                                        }

                                        @Override
                                        public void onAuthenticationError(int errorCode, CharSequence errString) {
                                            super.onAuthenticationError(errorCode, errString);
                                            pm.reject(String.valueOf(errorCode), errString.toString());
                                        }

                                        @Override
                                        public void onAuthenticationHelp(int helpCode, CharSequence helpString) {
                                            super.onAuthenticationHelp(helpCode, helpString);
                                            getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                                    .emit("FINGERPRINT_AUTHENTICATION_HELP", helpString.toString());
                                        }

                                        @Override
                                        public void onAuthenticationSucceeded(FingerprintManager.AuthenticationResult result) {
                                            super.onAuthenticationSucceeded(result);
                                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                                decryptWithAes(encrypted, showModal, strings, pm, result.getCryptoObject().getCipher());
                                            }
                                        }
                                    }, null);
                        }
                    }
                    return;
                }
                byte[] decryptedBytes = cipher.doFinal(cipherBytes);
                pm.resolve(new String(decryptedBytes));
            } catch (KeyPermanentlyInvalidatedException e) {
                try {
                    mKeyStore.deleteEntry(KEY_ALIAS_AES);
                    prepareKey();
                } catch (Exception keyResetError) {
                    pm.reject(keyResetError);
                }
                pm.reject(e);
            } catch (SecurityException e) {
                pm.reject(e);
            } catch (Exception e) {
                pm.reject(e);
            }
        } else {
            pm.reject("Fingerprint not supported", "Fingerprint not supported");
        }
    }
}
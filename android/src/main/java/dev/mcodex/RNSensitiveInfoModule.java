package dev.mcodex.RNSensitiveInfo;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.hardware.fingerprint.FingerprintManager;
import android.os.Build;
import android.os.CancellationSignal;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;

import java.security.InvalidKeyException;

import android.security.KeyPairGeneratorSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricConstants;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.math.BigInteger;
import java.security.Key;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.InvalidKeyException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.Calendar;
import java.security.UnrecoverableKeyException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.IvParameterSpec;

import androidx.fragment.app.FragmentActivity;
import javax.security.auth.x500.X500Principal;

import dev.mcodex.RNSensitiveInfo.utils.AppConstants;

public class RNSensitiveInfoModule extends ReactContextBaseJavaModule {

    // This must have 'AndroidKeyStore' as value. Unfortunately there is no predefined constant.
    private static final String ANDROID_KEYSTORE_PROVIDER = "AndroidKeyStore";

    // This is the default transformation used throughout this sample project.
    private static final String AES_DEFAULT_TRANSFORMATION =
            KeyProperties.KEY_ALGORITHM_AES + "/" +
                    KeyProperties.BLOCK_MODE_CBC + "/" +
                    KeyProperties.ENCRYPTION_PADDING_PKCS7;

    private static final String AES_GCM = "AES/GCM/NoPadding";
    private static final String RSA_ECB = "RSA/ECB/PKCS1Padding";
    private static final String DELIMITER = "]";
    private static final byte[] FIXED_IV = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1};
    private static final String KEY_ALIAS = "MySharedPreferenceKeyAlias";
    private static final String KEY_ALIAS_AES = "MyAesKeyAlias";

    private FingerprintManager mFingerprintManager;
    private KeyStore mKeyStore;
    private CancellationSignal mCancellationSignal;

    // Keep it true by default to maintain backwards compatibility with existing users.
    private boolean invalidateEnrollment = true;

    public RNSensitiveInfoModule(ReactApplicationContext reactContext) {
        super(reactContext);
        
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.JELLY_BEAN_MR2) {
            Exception cause = new RuntimeException("Keystore is not supported!");
            throw new RuntimeException("Android version is too low", cause);
        }
        
        try {
            mKeyStore = KeyStore.getInstance(ANDROID_KEYSTORE_PROVIDER);
            mKeyStore.load(null);
        } catch (Exception e) {
            e.printStackTrace();
        }
        
        initKeyStore();
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                mFingerprintManager = (FingerprintManager) reactContext.getSystemService(Context.FINGERPRINT_SERVICE);
                initFingerprintKeyStore();
            } catch (Exception e) {
                Log.d("RNSensitiveInfo", "Fingerprint not supported");
            }
        }
    }

    @Override
    public String getName() {
        return "RNSensitiveInfo";
    }

    /**
     * Checks whether the device supports Biometric authentication and if the user has
     * enrolled at least one credential.
     *
     * @return true if the user has a biometric capable device and has enrolled
     * one or more credentials
     */
    private boolean hasSetupBiometricCredential() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                ReactApplicationContext reactApplicationContext = getReactApplicationContext();
                BiometricManager biometricManager = BiometricManager.from(reactApplicationContext);
                int canAuthenticate = biometricManager.canAuthenticate();

                return canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS;
            } else {
                return false;
            }
        } catch (Exception e) {
            return false;
        }
    }

    @ReactMethod
    public void setInvalidatedByBiometricEnrollment(final boolean invalidatedByBiometricEnrollment, final Promise pm) {
        this.invalidateEnrollment = invalidatedByBiometricEnrollment;
        try {
            prepareKey();
        } catch (Exception e) {
            pm.reject(e);
        }
    }

    // @ReactMethod
    // public void isHardwareDetected(final Promise pm) {
    //     if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
    //         ReactApplicationContext reactApplicationContext = getReactApplicationContext();
    //         BiometricManager biometricManager = BiometricManager.from(reactApplicationContext);
    //         int canAuthenticate = biometricManager.canAuthenticate();

    //         pm.resolve(canAuthenticate != BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE);
    //     } else {
    //         pm.resolve(false);
    //     }
    // }

    @ReactMethod
    public void hasEnrolledFingerprints(final Promise pm) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && mFingerprintManager != null) {
            pm.resolve(mFingerprintManager.hasEnrolledFingerprints());
        } else {
            pm.resolve(false);
        }
    }

    @ReactMethod
    public void isSensorAvailable(final Promise promise) {
        promise.resolve(hasSetupBiometricCredential());
    }

    @ReactMethod
    public void getItem(String key, ReadableMap options, Promise pm) {

        String name = sharedPreferences(options);

        String value = prefs(name).getString(key, null);

        if (value != null && options.hasKey("touchID") && options.getBoolean("touchID")) {
            boolean showModal = options.hasKey("showModal") && options.getBoolean("showModal");
            HashMap strings = options.hasKey("strings") ? options.getMap("strings").toHashMap() : new HashMap();

            decryptWithAes(value, showModal, strings, pm, null);
        } else if (value != null) {
            try {
                pm.resolve(decrypt(value));
            } catch (Exception e) {
                pm.reject(e);
            }
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
                putExtra(key, encrypt(value), prefs(name));
                pm.resolve(value);
            } catch (Exception e) {
                e.printStackTrace();
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
            try {
                value = decrypt(value);
            } catch (Exception e) {
                Log.d("RNSensitiveInfo", Log.getStackTraceString(e));
            }
            resultData.putString(entry.getKey(), value);
        }
        pm.resolve(resultData);
    }

    @ReactMethod
    public void cancelFingerprintAuth() {
        if (mCancellationSignal != null && !mCancellationSignal.isCanceled()) {
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


    private void putExtra(String key, String value, SharedPreferences mSharedPreferences) {
        SharedPreferences.Editor editor = mSharedPreferences.edit();
        editor.putString(key, value).apply();
    }
    
    /**
     * Generates a new RSA key and stores it under the { @code KEY_ALIAS } in the
     * Android Keystore.
     */
    private void initKeyStore() {
        try {
            if (!mKeyStore.containsAlias(KEY_ALIAS)) {
                if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE_PROVIDER);
                    keyGenerator.init(
                            new KeyGenParameterSpec.Builder(KEY_ALIAS,
                                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                                    .setRandomizedEncryptionRequired(false)
                                    .build());
                    keyGenerator.generateKey();
                } else {
                    Calendar notBefore = Calendar.getInstance();
                    Calendar notAfter = Calendar.getInstance();
                    notAfter.add(Calendar.YEAR, 10);
                    KeyPairGeneratorSpec spec = new KeyPairGeneratorSpec.Builder(getReactApplicationContext())
                    .setAlias(KEY_ALIAS)
                    .setSubject(new X500Principal("CN=" + KEY_ALIAS))
                    .setSerialNumber(BigInteger.valueOf(1337))
                    .setStartDate(notBefore.getTime())
                    .setEndDate(notAfter.getTime())
                    .build();
                    KeyPairGenerator kpGenerator = KeyPairGenerator.getInstance("RSA", ANDROID_KEYSTORE_PROVIDER);   
                    kpGenerator.initialize(spec);
                    kpGenerator.generateKeyPair();
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void showDialog(final HashMap strings, final BiometricPrompt.CryptoObject cryptoObject, final BiometricPrompt.AuthenticationCallback callback) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {

            UiThreadUtil.runOnUiThread(
                    new Runnable() {
                        @Override
                        public void run() {
                            try {
                                Activity activity = getCurrentActivity();
                                if (activity == null) {
                                    callback.onAuthenticationError(BiometricConstants.ERROR_CANCELED,
                                            strings.containsKey("cancelled") ? strings.get("cancelled").toString() : "Authentication was cancelled");
                                    return;
                                }

                                FragmentActivity fragmentActivity = (FragmentActivity) getCurrentActivity();
                                Executor executor = Executors.newSingleThreadExecutor();
                                BiometricPrompt biometricPrompt = new BiometricPrompt(fragmentActivity, executor, callback);

                                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                                        .setDeviceCredentialAllowed(false)
                                        .setNegativeButtonText(strings.containsKey("cancel") ? strings.get("cancel").toString() : "Cancel")
                                        .setDescription(strings.containsKey("description") ? strings.get("description").toString() : null)
                                        .setTitle(strings.containsKey("header") ? strings.get("header").toString() : "Unlock with your fingerprint")
                                        .build();
                                biometricPrompt.authenticate(promptInfo, cryptoObject);
                            } catch (Exception e) {
                                throw e;
                            }
                        }
                    }
            );
        }
    }

    /**
     * Generates a new AES key and stores it under the { @code KEY_ALIAS_AES } in the
     * Android Keystore.
     */
    private void initFingerprintKeyStore() {
        try {
            // Check if a generated key exists under the KEY_ALIAS_AES .
            if (!mKeyStore.containsAlias(KEY_ALIAS_AES)) {
                prepareKey();
            }
        } catch (Exception e) {
            //
        }
    }

    private void prepareKey() throws Exception {
        
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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                builder.setInvalidatedByBiometricEnrollment(invalidateEnrollment);
            } catch (Exception e) {
                Log.d("RNSensitiveInfo", "Error setting setInvalidatedByBiometricEnrollment: " + e.getMessage());
            }
        }

        keyGenerator.init(builder.build());
        keyGenerator.generateKey();
    }

    private void putExtraWithAES(final String key, final String value, final SharedPreferences mSharedPreferences, final boolean showModal, final HashMap strings, final Promise pm, Cipher cipher) {

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M && hasSetupBiometricCredential()) {
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
                            class PutExtraWithAESCallback extends BiometricPrompt.AuthenticationCallback {
                                @Override
                                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                        putExtraWithAES(key, value, mSharedPreferences, true, strings, pm, result.getCryptoObject().getCipher());
                                    }
                                }

                                @Override
                                public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                                    pm.reject(String.valueOf(errorCode), errString.toString());
                                }

                                @Override
                                public void onAuthenticationFailed() {
                                    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                            .emit(AppConstants.E_AUTHENTICATION_NOT_RECOGNIZED, "Authentication not recognized.");
                                }
                            }

                            showDialog(strings, new BiometricPrompt.CryptoObject(cipher), new PutExtraWithAESCallback());
                        } else {
                            mCancellationSignal = new CancellationSignal();
                            mFingerprintManager.authenticate(new FingerprintManager.CryptoObject(cipher), mCancellationSignal,
                                    0, new FingerprintManager.AuthenticationCallback() {

                                        @Override
                                        public void onAuthenticationFailed() {
                                            super.onAuthenticationFailed();
                                            getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                                    .emit(AppConstants.E_AUTHENTICATION_NOT_RECOGNIZED, "Fingerprint not recognized.");
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
                                                    .emit(AppConstants.FINGERPRINT_AUTHENTICATION_HELP, helpString.toString());
                                        }

                                        @Override
                                        public void onAuthenticationSucceeded(FingerprintManager.AuthenticationResult result) {
                                            super.onAuthenticationSucceeded(result);
                                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                                putExtraWithAES(key, value, mSharedPreferences, false, strings, pm, result.getCryptoObject().getCipher());
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
            } catch (InvalidKeyException | UnrecoverableKeyException e) {
                try {
                    mKeyStore.deleteEntry(KEY_ALIAS_AES);
                    prepareKey();
                } catch (Exception keyResetError) {
                    pm.reject(keyResetError);
                }
                pm.reject(e);
            } catch (IllegalBlockSizeException e){
                if(e.getCause() != null && e.getCause().getMessage().contains("Key user not authenticated")) {
                    try {
                        mKeyStore.deleteEntry(KEY_ALIAS_AES);
                        prepareKey();
                        pm.reject(AppConstants.KM_ERROR_KEY_USER_NOT_AUTHENTICATED, e.getCause().getMessage());
                    } catch (Exception keyResetError) {
                        pm.reject(keyResetError);
                    }
                } else {
                    pm.reject(e);
                }
            } catch (SecurityException e) {
                pm.reject(e);
            } catch (Exception e) {
                pm.reject(e);
            }
        } else {
            pm.reject(AppConstants.E_BIOMETRIC_NOT_SUPPORTED, "Biometrics not supported");
        }
    }

    private void decryptWithAes(final String encrypted, final boolean showModal, final HashMap strings, final Promise pm, Cipher cipher) {

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M
                && hasSetupBiometricCredential()) {

            String[] inputs = encrypted.split(DELIMITER);
            if (inputs.length < 2) {
                pm.reject("DecryptionFailed", "DecryptionFailed");
            }

            try {
                byte[] iv = Base64.decode(inputs[0], Base64.DEFAULT);
                byte[] cipherBytes = Base64.decode(inputs[1], Base64.DEFAULT);

                if (cipher == null) {
                    SecretKey secretKey = (SecretKey) mKeyStore.getKey(KEY_ALIAS_AES, null);
                    cipher = Cipher.getInstance(AES_DEFAULT_TRANSFORMATION);
                    cipher.init(Cipher.DECRYPT_MODE, secretKey, new IvParameterSpec(iv));

                    SecretKeyFactory factory = SecretKeyFactory.getInstance(
                            secretKey.getAlgorithm(), ANDROID_KEYSTORE_PROVIDER);
                    KeyInfo info = (KeyInfo) factory.getKeySpec(secretKey, KeyInfo.class);

                    if (info.isUserAuthenticationRequired() &&
                            info.getUserAuthenticationValidityDurationSeconds() == -1) {

                        if (showModal) {
                            class DecryptWithAesCallback extends BiometricPrompt.AuthenticationCallback {
                                @Override
                                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                        decryptWithAes(encrypted, true, strings, pm, result.getCryptoObject().getCipher());
                                    }
                                }

                                @Override
                                public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                                    pm.reject(String.valueOf(errorCode), errString.toString());
                                }

                                @Override
                                public void onAuthenticationFailed() {
                                    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                            .emit(AppConstants.E_AUTHENTICATION_NOT_RECOGNIZED, "Authentication not recognized.");
                                }
                            }

                            showDialog(strings, new BiometricPrompt.CryptoObject(cipher), new DecryptWithAesCallback());
                        } else {
                            mCancellationSignal = new CancellationSignal();
                            mFingerprintManager.authenticate(new FingerprintManager.CryptoObject(cipher), mCancellationSignal,
                                    0, new FingerprintManager.AuthenticationCallback() {

                                        @Override
                                        public void onAuthenticationFailed() {
                                            super.onAuthenticationFailed();
                                            getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                                    .emit(AppConstants.E_AUTHENTICATION_NOT_RECOGNIZED, "Fingerprint not recognized.");
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
                                                    .emit(AppConstants.FINGERPRINT_AUTHENTICATION_HELP, helpString.toString());
                                        }

                                        @Override
                                        public void onAuthenticationSucceeded(FingerprintManager.AuthenticationResult result) {
                                            super.onAuthenticationSucceeded(result);
                                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                                decryptWithAes(encrypted, false, strings, pm, result.getCryptoObject().getCipher());
                                            }
                                        }
                                    }, null);
                        }
                    }
                    return;
                }
                byte[] decryptedBytes = cipher.doFinal(cipherBytes);
                pm.resolve(new String(decryptedBytes));
            } catch (InvalidKeyException | UnrecoverableKeyException e) {
                try {
                    mKeyStore.deleteEntry(KEY_ALIAS_AES);
                    prepareKey();
                } catch (Exception keyResetError) {
                    pm.reject(keyResetError);
                }
                pm.reject(e);
            } catch (IllegalBlockSizeException e){
                if(e.getCause() != null && e.getCause().getMessage().contains("Key user not authenticated")) {
                    try {
                        mKeyStore.deleteEntry(KEY_ALIAS_AES);
                        prepareKey();
                        pm.reject(AppConstants.KM_ERROR_KEY_USER_NOT_AUTHENTICATED, e.getCause().getMessage());
                    } catch (Exception keyResetError) {
                        pm.reject(keyResetError);
                    }
                } else {
                    pm.reject(e);
                }
            } catch (SecurityException e) {
                pm.reject(e);
            } catch (Exception e) {
                pm.reject(e);
            }
        } else {
            pm.reject(AppConstants.E_BIOMETRIC_NOT_SUPPORTED, "Biometrics not supported");
        }
    }
    
    public String encrypt(String input) throws Exception {
        byte[] bytes = input.getBytes();
        Cipher c;
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Key secretKey = ((KeyStore.SecretKeyEntry) mKeyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
            c = Cipher.getInstance(AES_GCM);
            c.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(128, FIXED_IV));
        } else {
            PublicKey publicKey = ((KeyStore.PrivateKeyEntry)mKeyStore.getEntry(KEY_ALIAS, null)).getCertificate().getPublicKey();
            c = Cipher.getInstance(RSA_ECB);
            c.init(Cipher.ENCRYPT_MODE, publicKey);
        }
        byte[] encodedBytes = c.doFinal(bytes);
        String encryptedBase64Encoded = Base64.encodeToString(encodedBytes, Base64.DEFAULT);
        return encryptedBase64Encoded;
    }


    public String decrypt(String encrypted) throws Exception {
        if (encrypted == null) {
            Exception cause = new RuntimeException("Invalid argument at decrypt function");
            throw new RuntimeException("encrypted argument can't be null", cause);
        }

        Cipher c;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Key secretKey = ((KeyStore.SecretKeyEntry) mKeyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
            c = Cipher.getInstance(AES_GCM);
            c.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(128, FIXED_IV));
        } else {
            PrivateKey privateKey = ((KeyStore.PrivateKeyEntry)mKeyStore.getEntry(KEY_ALIAS, null)).getPrivateKey();
            c = Cipher.getInstance(RSA_ECB);
            c.init(Cipher.DECRYPT_MODE, privateKey);
        }
        byte[] decodedBytes = c.doFinal(Base64.decode(encrypted, Base64.DEFAULT));
        return new String(decodedBytes);
    }
}

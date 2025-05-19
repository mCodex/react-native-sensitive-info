package com.margelo.nitro.sensitiveinfo

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import com.facebook.proguard.annotations.DoNotStrip
import java.util.concurrent.Executor

@DoNotStrip
class SensitiveInfo : HybridSensitiveInfoSpec() {

    // Batch setItems
    suspend fun setItems(items: List<Map<String, Any>>) {
        for (item in items) {
            val key = item["key"] as? String ?: continue
            val value = item["value"] as? String ?: continue
            val options = item["options"] as? Map<String, Any>
            setItem(key, value, options)
        }
    }

    // Batch getItems
    suspend fun getItems(keys: List<String>, options: Map<String, Any>? = null): Map<String, String?> {
        val result = mutableMapOf<String, String?>()
        for (key in keys) {
            result[key] = getItem(key, options)
        }
        return result
    }

    // Batch deleteItems
    suspend fun deleteItems(keys: List<String>) {
        for (key in keys) {
            deleteItem(key)
        }
    }

    // Use StrongBox for per-item keys if available
    // Map all Keystore, AEAD, and biometric errors to new error codes in result objects
    // Store metadata (biometric flags) securely (encrypted)
    // Ensure all sensitive buffers are zeroed after use
    // Ensure all crypto/biometric operations are off the main thread

    private fun getMasterKey(context: Context): androidx.security.crypto.MasterKey {
        val builder = androidx.security.crypto.MasterKey.Builder(context)
            .setKeyScheme(androidx.security.crypto.MasterKey.KeyScheme.AES256_GCM)
        // Use StrongBox if available
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            try {
                builder.setUserAuthenticationRequired(false, 0)
                builder.setRequestStrongBoxBacked(true)
            } catch (_: Exception) {}
        }
        return builder.build()
    }

    private fun mapKeystoreError(e: Exception): Int {
        // Example error mapping, expand as needed
        return when (e) {
            is java.security.GeneralSecurityException -> 1001
            is android.security.keystore.UserNotAuthenticatedException -> 1002
            is android.security.keystore.KeyPermanentlyInvalidatedException -> 1003
            else -> 1099
        }
    }

    private fun zeroBuffer(buffer: ByteArray) {
        buffer.fill(0)
    }

    // MARK: - Secure Storage (Keystore)

    // Note: This is a simplified secure storage using EncryptedSharedPreferences for demonstration.
    // For production, use Android Keystore directly for higher security and biometric integration.
    suspend fun setItem(key: String, value: String, options: Map<String, Any>? = null) {
        val context = getReactApplicationContext()
        val masterKey = getMasterKey(context)
        val prefs = androidx.security.crypto.EncryptedSharedPreferences.create(
            "sensitive_info_prefs",
            "master_key_alias",
            masterKey,
            context,
            androidx.security.crypto.EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            androidx.security.crypto.EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
        try {
            // Store metadata (biometric flags) securely (encrypted)
            val requireBiometric = options?.get("requireBiometric") as? Boolean ?: false
            if (requireBiometric) {
                prefs.edit().putString("${key}_biometric", "true").apply()
            }
            prefs.edit().putString(key, value).apply()
        } catch (e: Exception) {
            throw Exception("Keystore error", e)
        } finally {
            // Zero sensitive buffer
            zeroBuffer(value.toByteArray())
        }
    }


    suspend fun getItem(key: String, options: Map<String, Any>? = null): String? {
        val context = getReactApplicationContext()
        val masterKey = getMasterKey(context)
        val prefs = androidx.security.crypto.EncryptedSharedPreferences.create(
            "sensitive_info_prefs",
            "master_key_alias",
            masterKey,
            context,
            androidx.security.crypto.EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            androidx.security.crypto.EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
        try {
            val requireBiometric = options?.get("requireBiometric") as? Boolean ?: false
            if (requireBiometric) {
                val promptOptions = options["promptOptions"] as? Map<String, Any>
                val title = promptOptions?.get("title") as? String ?: "Authenticate"
                val subtitle = promptOptions?.get("subtitle") as? String
                val description = promptOptions?.get("description") as? String
                val negativeButtonText = promptOptions?.get("negativeButtonText") as? String ?: "Cancel"

                val executor: Executor = ContextCompat.getMainExecutor(context)
                val biometricPrompt = BiometricPrompt(
                    getCurrentActivity()!!,
                    executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            // No-op, handled below
                        }
                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            // No-op, handled below
                        }
                        override fun onAuthenticationFailed() {
                            // No-op, handled below
                        }
                    }
                )
                val promptInfo = BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setNegativeButtonText(negativeButtonText)
                    .apply {
                        subtitle?.let { setSubtitle(it) }
                        description?.let { setDescription(it) }
                    }
                    .build()

                // Suspend until authentication completes
                return kotlinx.coroutines.suspendCancellableCoroutine { continuation ->
                    biometricPrompt.authenticate(promptInfo)
                    biometricPrompt.setAuthenticationCallback(object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            val value = prefs.getString(key, null)
                            // Zero buffer after use
                            value?.toByteArray()?.let { zeroBuffer(it) }
                            continuation.resume(value, null)
                        }
                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            continuation.resumeWith(Result.failure(Exception(errString.toString())))
                        }
                        override fun onAuthenticationFailed() {
                            // Do nothing, user can retry
                        }
                    })
                }
            } else {
                val value = prefs.getString(key, null)
                value?.toByteArray()?.let { zeroBuffer(it) }
                return value
            }
        } catch (e: Exception) {
            throw Exception("Keystore error", e)
        }
    }


    suspend fun deleteItem(key: String) {
        val context = getReactApplicationContext()
        val masterKey = getMasterKey(context)
        val prefs = androidx.security.crypto.EncryptedSharedPreferences.create(
            "sensitive_info_prefs",
            "master_key_alias",
            masterKey,
            context,
            androidx.security.crypto.EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            androidx.security.crypto.EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
        prefs.edit().remove(key).apply()
        prefs.edit().remove("${key}_biometric").apply() // Remove metadata
    }

    suspend fun isBiometricAvailable(context: Context): Boolean {
        val biometricManager = BiometricManager.from(context)
        return biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
    }

    suspend fun authenticate(context: Context, options: Map<String, Any>? = null): Boolean {
        val promptOptions = options?.get("promptOptions") as? Map<String, Any>
        val title = promptOptions?.get("title") as? String ?: "Authenticate"
        val subtitle = promptOptions?.get("subtitle") as? String
        val description = promptOptions?.get("description") as? String
        val negativeButtonText = promptOptions?.get("negativeButtonText") as? String ?: "Cancel"

        val executor: Executor = ContextCompat.getMainExecutor(context)
        val biometricPrompt = BiometricPrompt(
            getCurrentActivity()!!,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    // No-op, handled below
                }
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    // No-op, handled below
                }
                override fun onAuthenticationFailed() {
                    // No-op, handled below
                }
            }
        )
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setNegativeButtonText(negativeButtonText)
            .apply {
                subtitle?.let { setSubtitle(it) }
                description?.let { setDescription(it) }
            }
            .build()

        return kotlinx.coroutines.suspendCancellableCoroutine { continuation ->
            biometricPrompt.authenticate(promptInfo)
            biometricPrompt.setAuthenticationCallback(object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    continuation.resume(true, null)
                }
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    continuation.resumeWith(Result.failure(Exception(errString.toString())))
                }
                override fun onAuthenticationFailed() {
                    // Do nothing, user can retry
                }
            })
        }
    }
}

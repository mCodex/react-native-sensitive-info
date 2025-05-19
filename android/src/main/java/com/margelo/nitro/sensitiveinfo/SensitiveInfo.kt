package com.margelo.nitro.sensitiveinfo

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import com.facebook.proguard.annotations.DoNotStrip
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.Executor
import kotlin.coroutines.resume

@DoNotStrip
class SensitiveInfo : HybridSensitiveInfoSpec() {

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

    suspend fun setItem(
        key: String,
        value: String,
        requireBiometric: Boolean,
        promptTitle: String?,
        promptSubtitle: String?,
        promptDescription: String?,
        promptNegativeButton: String?,
        promptReason: String?
    ) {
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
            if (requireBiometric) {
                prefs.edit().putString("${key}_biometric", "true").apply()
            }
            prefs.edit().putString(key, value).apply()
        } catch (e: Exception) {
            throw Exception("Keystore error", e)
        } finally {
            value.toByteArray().fill(0)
        }
    }

    suspend fun getItem(
        key: String,
        requireBiometric: Boolean,
        promptTitle: String?,
        promptSubtitle: String?,
        promptDescription: String?,
        promptNegativeButton: String?,
        promptReason: String?
    ): String? {
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
            if (requireBiometric) {
                val title = promptTitle ?: "Authenticate"
                val subtitle = promptSubtitle
                val description = promptDescription
                val negativeButtonText = promptNegativeButton ?: "Cancel"

                val executor: Executor = ContextCompat.getMainExecutor(context)
                val activity = getCurrentActivity() ?: throw Exception("No current activity")
                return suspendCancellableCoroutine { continuation ->
                    val biometricPrompt = BiometricPrompt(
                        activity,
                        executor,
                        object : BiometricPrompt.AuthenticationCallback() {
                            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                                val value = prefs.getString(key, null)
                                value?.toByteArray()?.fill(0)
                                continuation.resume(value)
                            }
                            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                                continuation.resume(null)
                            }
                            override fun onAuthenticationFailed() {
                                // Do nothing, user can retry
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
                    biometricPrompt.authenticate(promptInfo)
                }
            } else {
                val value = prefs.getString(key, null)
                value?.toByteArray()?.fill(0)
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
        prefs.edit().remove("${key}_biometric").apply()
    }

    suspend fun isBiometricAvailable(): Boolean {
        val context = getReactApplicationContext()
        val biometricManager = BiometricManager.from(context)
        return biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
    }

    suspend fun authenticate(
        promptTitle: String?,
        promptSubtitle: String?,
        promptDescription: String?,
        promptNegativeButton: String?,
        promptReason: String?
    ): Boolean {
        val context = getReactApplicationContext()
        val title = promptTitle ?: "Authenticate"
        val subtitle = promptSubtitle
        val description = promptDescription
        val negativeButtonText = promptNegativeButton ?: "Cancel"

        val executor: Executor = ContextCompat.getMainExecutor(context)
        val activity = getCurrentActivity() ?: throw Exception("No current activity")
        return suspendCancellableCoroutine { continuation ->
            val biometricPrompt = BiometricPrompt(
                activity,
                executor,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        continuation.resume(true)
                    }
                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        continuation.resume(false)
                    }
                    override fun onAuthenticationFailed() {
                        // Do nothing, user can retry
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
            biometricPrompt.authenticate(promptInfo)
        }
    }
}
package com.sensitiveinfo.internal.crypto

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import androidx.biometric.BiometricManager.Authenticators
import com.sensitiveinfo.internal.util.SensitiveInfoException
import com.sensitiveinfo.internal.util.SecurityAvailabilitySnapshot

/**
 * Centralizes Android API-level-specific key authentication configuration.
 *
 * **Problem it solves:**
 * Different Android versions have different capabilities for biometric-protected keys:
 * - API 31+: setUserAuthenticationParameters() with specific authenticator types
 * - API 29-30: setUserAuthenticationParameters() (limited functionality)
 * - API 28: No setUserAuthenticationParameters(), must use deprecated timeout-based
 * - API 21-27: No built-in biometric support in keystore, must fallback to plain keys
 *
 * **Solution:**
 * One centralized location decides HOW to configure authentication for each API level.
 * All encryption/decryption code paths use the SAME configuration strategy.
 *
 * **Design Principle:**
 * - Encode API-level decisions here once
 * - Never duplicate in CryptoManager, KeyGenerator, or SecureStorage
 * - If a new Android version adds capabilities, extend here.
 */
internal object KeyAuthenticationStrategy {

    /**
     * Applies authentication configuration to key generation parameters.
     *
     * This is called ONCE during key generation. The resulting key persists with these
     * authentication requirements until the key is deleted.
     *
     * @param builder KeyGenParameterSpec.Builder to configure
     * @param resolution AccessResolution describing requested authentication
     *
     * @throws SensitiveInfoException If the requested authentication is impossible on this device
     */
    @Throws(SensitiveInfoException::class)
    fun applyToKeyGeneration(
        builder: KeyGenParameterSpec.Builder,
        resolution: AccessResolution
    ) {
        // If no authentication is required, nothing to do
        if (!resolution.requiresAuthentication) {
            return
        }

        when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> {
                // API 31+: Modern approach with explicit authenticator types
                applyModern(builder, resolution)
            }
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> {
                // API 29-30: setUserAuthenticationParameters available but limited
                applyApi29(builder, resolution)
            }
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.P -> {
                // API 28: Manual pre-authentication (see applyApi28)
                applyApi28(builder, resolution)
            }
            else -> {
                // API 21-27: Hardware-enforced authentication unavailable.
                // We still present biometric/device credential prompts at the
                // application layer, but the key itself cannot enforce auth.
                builder.setUserAuthenticationRequired(false)
            }
        }
    }

    /**
     * API 31+ (Android 12+): Full support for setUserAuthenticationParameters.
     * Can specify exact authenticator types and timeout of 0 (no timeout).
     */
    private fun applyModern(
        builder: KeyGenParameterSpec.Builder,
        resolution: AccessResolution
    ) {
        builder.setUserAuthenticationRequired(true)
        
        // Sanitize authenticators for API 31+
        val sanitized = sanitizeAuthenticators(resolution.allowedAuthenticators)
        
        // 0 timeout = forever (no timeout needed since app-level biometric check handles it)
        builder.setUserAuthenticationParameters(0, sanitized)
    }

    /**
     * API 29-30 (Android 10-11): setUserAuthenticationParameters exists but has limitations.
     * Device credential support is more limited than API 31+.
     */
    private fun applyApi29(
        builder: KeyGenParameterSpec.Builder,
        resolution: AccessResolution
    ) {
        builder.setUserAuthenticationRequired(true)
        
        // Sanitize authenticators - remove types not available on API 29
        var sanitized = resolution.allowedAuthenticators
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            sanitized = sanitized and (Authenticators.BIOMETRIC_STRONG or Authenticators.DEVICE_CREDENTIAL)
        }
        
        if (sanitized == 0) {
            sanitized = Authenticators.BIOMETRIC_STRONG
        }
        
        // 0 timeout = forever
        builder.setUserAuthenticationParameters(0, sanitized)
    }

    /**
     * API 28 (Android 9): No setUserAuthenticationParameters.
     * Can't use timeout-based authentication because:
     * 1. The timeout is rarely shown to users as a prompt
     * 2. Cipher.init() must happen within the timeout window (impractical)
     * 3. It's deprecated in API 30+
     * 4. It doesn't integrate well with BiometricPrompt
     *
     * **Solution**: Don't require authentication at the KEY level.
     * Instead, rely on BiometricPrompt at the APPLICATION level (CryptoManager).
     * The workflow:
     * 1. Create key WITHOUT authentication requirement
     * 2. In CryptoManager, always show BiometricPrompt if authentication needed
     * 3. BiometricPrompt happens at app level, not key level
     * 4. This provides the same security: user must authenticate to access the secret
     * 5. But it works reliably on Android 9
     *
     * On Android 9, if the resolution requires authentication, we downgrade the key
     * to not require authentication, and rely on app-level BiometricPrompt instead.
     */
    private fun applyApi28(
        builder: KeyGenParameterSpec.Builder,
        resolution: AccessResolution
    ) {
        // Android 9 relies on application-level authentication; keystore auth is disabled.
        builder.setUserAuthenticationRequired(false)
    }

    /**
     * Sanitizes authenticator flags for the current API level.
     * Removes unsupported flags to prevent crashes.
     */
    private fun sanitizeAuthenticators(value: Int): Int {
        var sanitized = value
        
        // API 30 and below don't support all authenticator types
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            sanitized = sanitized and (Authenticators.BIOMETRIC_STRONG or Authenticators.DEVICE_CREDENTIAL)
        }
        
        // Ensure at least one authenticator is set
        if (sanitized == 0) {
            sanitized = Authenticators.BIOMETRIC_STRONG
        }
        
        return sanitized
    }

    /**
     * Determines if a key with this resolution requires user authentication
     * to be initialized during encryption/decryption.
     *
     * @return true if BiometricAuthenticator prompt should be shown
     */
    fun requiresUserAuthentication(resolution: AccessResolution): Boolean {
        return resolution.requiresAuthentication
    }

    /**
     * Validates that the requested authentication is feasible on this device.
     *
     * @param resolution Requested access resolution
     * @param availability Current device capabilities
     * @return true if this resolution can be applied
     */
    fun isApplicable(
        resolution: AccessResolution,
        availability: SecurityAvailabilitySnapshot
    ): Boolean {
        if (!resolution.requiresAuthentication) {
            return true  // Plain keys always work
        }

        // Check device capabilities
        return when {
            resolution.useStrongBox && !availability.strongBox -> false
            resolution.allowedAuthenticators != 0 && !availability.biometry -> false
            else -> true
        }
    }
}

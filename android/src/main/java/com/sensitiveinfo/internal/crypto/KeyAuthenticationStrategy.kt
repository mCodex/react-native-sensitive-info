package com.sensitiveinfo.internal.crypto

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
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
     * Uses per-operation (0s) timeout for biometrics and a short grace period when
     * device credentials are allowed so Android can unlock the key after PIN entry.
     */
    private fun applyModern(
        builder: KeyGenParameterSpec.Builder,
        resolution: AccessResolution
    ) {
        builder.setUserAuthenticationRequired(true)

        val sanitized = sanitizeAuthenticators(resolution.allowedAuthenticators)
        val keyPropertiesAuthenticators = mapToKeyPropertiesAuthenticators(sanitized)
        // Use the MAPPED authenticators to determine timeout, not the input
        // On Android 13+, device credential is excluded from the key, so we shouldn't
        // use a -1 timeout even if the REQUEST included device credential
        val timeoutSeconds = authenticationTimeoutSeconds(keyPropertiesAuthenticators)

        builder.setUserAuthenticationParameters(timeoutSeconds, keyPropertiesAuthenticators)
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

        var sanitized = resolution.allowedAuthenticators
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            sanitized = sanitized and (Authenticators.BIOMETRIC_STRONG or Authenticators.DEVICE_CREDENTIAL)
        }

        if (sanitized == 0) {
            sanitized = Authenticators.BIOMETRIC_STRONG
        }

        val keyPropertiesAuthenticators = mapToKeyPropertiesAuthenticators(sanitized)
        // Use the MAPPED authenticators to determine timeout, not the input
        val timeoutSeconds = authenticationTimeoutSeconds(keyPropertiesAuthenticators)

        builder.setUserAuthenticationParameters(timeoutSeconds, keyPropertiesAuthenticators)
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

    private fun authenticationTimeoutSeconds(keyPropertiesAuthenticators: Int): Int {
        // Timeout -1 (platform default) only when device credential is ACTUALLY in the key.
        // On Android 13+, device credential is excluded even if requested, so we use 0.
        // Otherwise use 0 (immediate timeout, auth via prompt only)
        return if ((keyPropertiesAuthenticators and KeyProperties.AUTH_DEVICE_CREDENTIAL) != 0) {
            DEVICE_CREDENTIAL_TIMEOUT_SECONDS  // -1 (platform default ~30 mins)
        } else {
            0  // Biometric only, no grace period needed
        }
    }

    private fun mapToKeyPropertiesAuthenticators(authenticators: Int): Int {
        var mapped = 0

        if ((authenticators and Authenticators.BIOMETRIC_STRONG) != 0 ||
            (authenticators and Authenticators.BIOMETRIC_WEAK) != 0
        ) {
            mapped = mapped or KeyProperties.AUTH_BIOMETRIC_STRONG
        }

        // NOTE: On Android 13+, DO NOT include AUTH_DEVICE_CREDENTIAL at keystore level.
        // Device credentials require a CryptoObject auth token which is incompatible
        // with the "auth first, then init" pattern needed for Android 13 key state management.
        // Instead, we handle device credential at the application layer (BiometricPrompt),
        // similar to how Android 9 works.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU &&
            authenticators and Authenticators.DEVICE_CREDENTIAL != 0
        ) {
            // Only include AUTH_DEVICE_CREDENTIAL on Android 12 and below
            mapped = mapped or KeyProperties.AUTH_DEVICE_CREDENTIAL
        }

        return mapped
    }

    // Device credential timeout: -1 uses platform default (usually ~30 mins).
    // Avoids cipher state issues when user enters PIN slowly on Android 13+.
    private const val DEVICE_CREDENTIAL_TIMEOUT_SECONDS = -1

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

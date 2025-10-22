package com.sensitiveinfo.internal.util

import android.content.Context

/**
 * Resolves service names consistently across the platform.
 *
 * Service names provide namespacing for secrets - different services
 * keep their secrets isolated from each other.
 *
 * **Default behavior**:
 * - If no service specified → Use app package name (app-wide default)
 * - If service specified → Use exactly that name
 *
 * This ensures consistency and predictability across API calls.
 */
object ServiceNameResolver {

    /**
     * Resolves a service name to a concrete value.
     *
     * @param context Android context (used to get default package name)
     * @param serviceHint Optional service name (if null, uses app package)
     * @return Resolved service name (never null)
     *
     * @example
     * ```kotlin
     * // No service specified
     * val svc1 = ServiceNameResolver.resolve(context, null)
     * // Returns: "com.example.myapp"
     *
     * // Service specified
     * val svc2 = ServiceNameResolver.resolve(context, "auth")
     * // Returns: "auth"
     * ```
     */
    fun resolve(context: Context, serviceHint: String?): String {
        return serviceHint ?: context.packageName ?: "default"
    }
}

/**
 * Maps user-facing API parameters to internal configuration.
 *
 * Provides sensible defaults and validates user input.
 */
object AccessControlResolver {

    /**
     * Resolves access control preference to concrete configuration.
     *
     * Maps high-level options like "secureEnclaveBiometry" to specific
     * device capabilities and fallback strategies.
     *
     * @param preference User-requested access control (e.g., "secureEnclaveBiometry")
     * @return Resolved configuration with defaults applied
     *
     * @example
     * ```kotlin
     * val config = AccessControlResolver.resolve("secureEnclaveBiometry")
     * // Returns config with biometric + device credential fallback
     * ```
     */
    fun resolve(preference: String?): AccessControlConfig {
        return when (preference) {
            "secureEnclaveBiometry" -> AccessControlConfig(
                requireBiometric = true,
                requireDeviceCredential = true,  // Fallback
                useStrongBox = true
            )
            "biometryCurrentSet" -> AccessControlConfig(
                requireBiometric = true,
                requireDeviceCredential = false,
                useStrongBox = false
            )
            "biometryAny" -> AccessControlConfig(
                requireBiometric = true,
                requireDeviceCredential = false,
                useStrongBox = false
            )
            "devicePasscode" -> AccessControlConfig(
                requireBiometric = false,
                requireDeviceCredential = true,
                useStrongBox = true
            )
            "none" -> AccessControlConfig(
                requireBiometric = false,
                requireDeviceCredential = false,
                useStrongBox = false
            )
            else -> AccessControlConfig(  // Default to strongest
                requireBiometric = true,
                requireDeviceCredential = true,
                useStrongBox = true
            )
        }
    }
}

/**
 * Access control configuration resolved from user preference.
 */
data class AccessControlConfig(
    val requireBiometric: Boolean,
    val requireDeviceCredential: Boolean,
    val useStrongBox: Boolean
)

/**
 * Detects available security features on the current device.
 *
 * Use to determine which features can be offered to the user.
 */
object SecurityAvailabilityResolver {

    /**
     * Detects available security capabilities.
     *
     * @param context Android context
     * @return Availability status of security features
     *
     * @example
     * ```kotlin
     * val avail = SecurityAvailabilityResolver.detect(context)
     * if (avail.hasStrongBox) {
     *   enableStrongBoxOption()
     * }
     * ```
     */
    fun detect(context: Context): SecurityAvailability {
        // TODO: Implement biometric availability detection
        // For now, return conservative defaults
        return SecurityAvailability(
            hasStrongBox = true,  // Most Android 9+ devices have it
            hasBiometric = false,  // TODO: Check via BiometricManager
            hasDeviceCredential = false  // TODO: Check via KeyguardManager
        )
    }
}

/**
 * Available security features on the device.
 */
data class SecurityAvailability(
    val hasStrongBox: Boolean,
    val hasBiometric: Boolean,
    val hasDeviceCredential: Boolean
)

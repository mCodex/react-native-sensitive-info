package com.sensitiveinfo.internal.crypto

import com.sensitiveinfo.internal.util.AccessControl
import com.sensitiveinfo.internal.util.SecurityLevel

/**
 * Encapsulates all security configuration for a single key.
 *
 * **Purpose:**
 * This is the SINGLE SOURCE OF TRUTH for how a key should be created and used.
 * It includes:
 * - What authentication is required
 * - Which authenticators are allowed
 * - Whether to use StrongBox
 * - Whether to invalidate on biometric enrollment change
 *
 * **Determinism:**
 * When decrypting an entry, AccessResolution is reconstructed from persisted
 * metadata. Using the SAME resolution ensures decryption works identically
 * to encryption.
 *
 * **API Abstraction:**
 * The resolution describes WHAT we want (e.g., "biometric + StrongBox").
 * KeyAuthenticationStrategy describes HOW to achieve it for each API level.
 */
internal data class AccessResolution(
    val accessControl: AccessControl,
    val securityLevel: SecurityLevel,
    val requiresAuthentication: Boolean,
    val allowedAuthenticators: Int,
    val useStrongBox: Boolean,
    val invalidateOnEnrollment: Boolean
) {
    /**
     * Generates unique signature for this resolution.
     *
     * Used as part of the key alias to ensure different access controls
     * use different keys.
     */
    val signature: String
        get() = buildString {
            append(accessControl.name)
            append('_')
            append(if (requiresAuthentication) '1' else '0')
            append('_')
            append(allowedAuthenticators)
            append('_')
            append(if (useStrongBox) '1' else '0')
            append('_')
            append(if (invalidateOnEnrollment) '1' else '0')
        }
}

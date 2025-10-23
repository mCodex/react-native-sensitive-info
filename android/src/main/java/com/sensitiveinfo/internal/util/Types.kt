package com.sensitiveinfo.internal.util

/**
 * Access control policies for stored secrets.
 *
 * Defines the security tier and authentication requirements for a secret.
 */
enum class AccessControl {
    /** Biometric + StrongBox (strongest: requires biometric enrollment + dedicated secure processor) */
    SECUREENCLAVEBIOMETRY,
    
    /** Biometric (current biometric template, invalidated if fingerprints change) */
    BIOMETRYCURRENTSET,
    
    /** Biometric (any method: fingerprint, face, iris, etc.) */
    BIOMETRYANY,
    
    /** Device credential (PIN, pattern, or password) */
    DEVICEPASSCODE,
    
    /** No protection (stored as plaintext) */
    NONE
}

/**
 * The actual security tier that was applied to a stored secret.
 *
 * Reflects what the native storage layer achieved (not just what was requested).
 * For example: Device might not support StrongBox, so "secureEnclaveBiometry" request
 * results in "biometry" security level.
 */
enum class SecurityLevel {
    /** Secure Enclave (iOS) or StrongBox (Android 9+) */
    SECUREENCLAVE,
    
    /** StrongBox (dedicated secure processor) */
    STRONGBOX,
    
    /** Biometric-protected key without StrongBox */
    BIOMETRY,
    
    /** Device credential (PIN/pattern/password) protected */
    DEVICECREDENTIAL,
    
    /** Software-encrypted (no hardware security) */
    SOFTWARE
}

/**
 * Snapshot of device security capabilities.
 *
 * Used to determine which access control policies can be applied.
 */
data class SecurityAvailabilitySnapshot(
    val secureEnclave: Boolean,  // StrongBox on Android, Secure Enclave on iOS
    val strongBox: Boolean,       // Android-specific: dedicated security processor
    val biometry: Boolean,        // Biometric hardware available and enrolled
    val deviceCredential: Boolean // Device has PIN/pattern/password
)

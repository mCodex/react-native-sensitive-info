package com.sensitiveinfo.internal.util

/**
 * Base exception for all SensitiveInfo operations.
 *
 * Maps to JavaScript error codes for consistent error handling across platforms.
 * Each subclass has a specific error code used in native-to-JS communication.
 *
 * @param code Unique error identifier (e.g., "E_ENCRYPTION_FAILED")
 * @param message Human-readable error description
 * @param cause Underlying exception (if wrapping another error)
 *
 * @see ErrorCode for complete list of error codes
 */
sealed class SensitiveInfoException(
    val code: String,
    message: String,
    cause: Throwable? = null
) : Exception(message, cause) {

    /**
     * The requested secret was not found.
     * This is a normal condition, not an error.
     */
    class NotFound(
        keyName: String,
        service: String
    ) : SensitiveInfoException(
        code = "E_NOT_FOUND",
        message = "Secret '$keyName' not found in service '$service'"
    )

    /**
     * The stored key has been invalidated.
     * This happens when biometric enrollment changes on the device.
     */
    class KeyInvalidated(
        keyAlias: String
    ) : SensitiveInfoException(
        code = "E_KEY_INVALIDATED",
        message = "Key '$keyAlias' has been invalidated (biometric enrollment changed?)",
        cause = null
    )

    /**
     * User canceled biometric authentication.
     * This is a normal user action.
     */
    class AuthenticationCanceled : SensitiveInfoException(
        code = "E_AUTH_CANCELED",
        message = "User canceled authentication"
    )

    /**
     * Biometric authentication failed (wrong fingerprint, face not recognized, etc).
     */
    class AuthenticationFailed(
        reason: String
    ) : SensitiveInfoException(
        code = "E_AUTH_FAILED",
        message = "Biometric authentication failed: $reason"
    )

    /**
     * Biometric is locked out after too many failed attempts.
     */
    class BiometryLockout : SensitiveInfoException(
        code = "E_BIOMETRY_LOCKOUT",
        message = "Biometric authentication is locked out. Use device passcode to unlock."
    )

    /**
     * AndroidKeyStore or other key storage is unavailable.
     */
    class KeystoreUnavailable(
        reason: String,
        cause: Throwable? = null
    ) : SensitiveInfoException(
        code = "E_KEYSTORE_UNAVAILABLE",
        message = "Keystore unavailable: $reason",
        cause = cause
    )

    /**
     * Encryption operation failed (possible key corruption or crypto error).
     */
    class EncryptionFailed(
        reason: String,
        cause: Throwable? = null
    ) : SensitiveInfoException(
        code = "E_ENCRYPTION_FAILED",
        message = "Encryption failed: $reason",
        cause = cause
    )

    /**
     * Decryption operation failed (corruption, wrong key, or invalid ciphertext).
     */
    class DecryptionFailed(
        reason: String,
        cause: Throwable? = null
    ) : SensitiveInfoException(
        code = "E_DECRYPTION_FAILED",
        message = "Decryption failed: $reason",
        cause = cause
    )

    /**
     * Invalid configuration or parameter.
     */
    class InvalidConfiguration(
        parameter: String,
        reason: String
    ) : SensitiveInfoException(
        code = "E_INVALID_CONFIGURATION",
        message = "Invalid configuration for '$parameter': $reason"
    )

    /**
     * Biometric authentication is not available on this device.
     */
    class BiometricNotAvailable(
        reason: String,
        cause: Throwable? = null
    ) : SensitiveInfoException(
        code = "E_BIOMETRIC_NOT_AVAILABLE",
        message = "Biometric authentication is not available: $reason",
        cause = cause
    )

    /**
     * Biometric authentication is locked out after too many failed attempts.
     */
    class BiometricLockout(
        reason: String,
        cause: Throwable? = null
    ) : SensitiveInfoException(
        code = "E_BIOMETRIC_LOCKOUT",
        message = "Biometric authentication is locked out: $reason",
        cause = cause
    )

    /**
     * User cancelled biometric authentication.
     */
    class UserCancelled(
        reason: String,
        cause: Throwable? = null
    ) : SensitiveInfoException(
        code = "E_USER_CANCELLED",
        message = "User cancelled authentication: $reason",
        cause = cause
    )

    /**
     * Biometric authentication failed.
     */
    class BiometricFailed(
        reason: String,
        cause: Throwable? = null
    ) : SensitiveInfoException(
        code = "E_BIOMETRIC_FAILED",
        message = "Biometric authentication failed: $reason",
        cause = cause
    )

    /**
     * FragmentActivity is not available (not set in ActivityContextHolder).
     */
    class ActivityUnavailable(
        reason: String,
        cause: Throwable? = null
    ) : SensitiveInfoException(
        code = "E_ACTIVITY_UNAVAILABLE",
        message = "FragmentActivity is unavailable: $reason",
        cause = cause
    )
}

/**
 * Maps SensitiveInfoException error codes to JavaScript/TypeScript errors.
 * Use when converting exceptions for native-to-JS communication.
 */
object ErrorCode {
    const val NOT_FOUND = "E_NOT_FOUND"
    const val KEY_INVALIDATED = "E_KEY_INVALIDATED"
    const val AUTH_CANCELED = "E_AUTH_CANCELED"
    const val AUTH_FAILED = "E_AUTH_FAILED"
    const val BIOMETRY_LOCKOUT = "E_BIOMETRY_LOCKOUT"
    const val KEYSTORE_UNAVAILABLE = "E_KEYSTORE_UNAVAILABLE"
    const val ENCRYPTION_FAILED = "E_ENCRYPTION_FAILED"
    const val DECRYPTION_FAILED = "E_DECRYPTION_FAILED"
    const val INVALID_CONFIGURATION = "E_INVALID_CONFIGURATION"
    const val BIOMETRIC_NOT_AVAILABLE = "E_BIOMETRIC_NOT_AVAILABLE"
    const val BIOMETRIC_LOCKOUT = "E_BIOMETRIC_LOCKOUT"
    const val USER_CANCELLED = "E_USER_CANCELLED"
    const val BIOMETRIC_FAILED = "E_BIOMETRIC_FAILED"
    const val ACTIVITY_UNAVAILABLE = "E_ACTIVITY_UNAVAILABLE"
}

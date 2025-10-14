package com.sensitiveinfo.internal.crypto

import androidx.biometric.BiometricManager.Authenticators
import com.margelo.nitro.sensitiveinfo.AccessControl
import com.margelo.nitro.sensitiveinfo.SecurityLevel

/**
 * Determines which Android security primitives should back a requested access control.
 *
 * The resolver walks through a preference list, discarding options that are unavailable on the
 * current device (e.g. no StrongBox, weak biometrics only). The resulting `AccessResolution`
 * instructs the `CryptoManager` how to create or reopen the matching keystore key.
 */
internal class AccessControlResolver(
  private val availabilityResolver: SecurityAvailabilityResolver
) {
  private val defaultOrder = listOf(
    AccessControl.SECUREENCLAVEBIOMETRY,
    AccessControl.BIOMETRYCURRENTSET,
    AccessControl.BIOMETRYANY,
    AccessControl.DEVICEPASSCODE,
    AccessControl.NONE
  )

  /** Chooses the best available policy given the caller preference and hardware capabilities. */
  fun resolve(preferred: AccessControl?, strongBiometricsOnly: Boolean): AccessResolution {
    val availability = availabilityResolver.resolve()
    val ordered = orderPreferences(preferred)

    for (candidate in ordered) {
      val resolution = tryResolve(candidate, availability, strongBiometricsOnly)
      if (resolution != null) {
        return resolution
      }
    }

    return AccessResolution(
      accessControl = AccessControl.NONE,
      securityLevel = SecurityLevel.SOFTWARE,
      requiresAuthentication = false,
      allowedAuthenticators = 0,
      useStrongBox = false,
      invalidateOnEnrollment = false
    )
  }

  private fun orderPreferences(preferred: AccessControl?): List<AccessControl> {
    if (preferred == null) {
      return defaultOrder
    }
    if (preferred == AccessControl.NONE) {
      return listOf(AccessControl.NONE)
    }
    val remaining = defaultOrder.filter { it != preferred }
    return listOf(preferred) + remaining
  }

  private fun tryResolve(
    accessControl: AccessControl,
    availability: SecurityAvailabilitySnapshot,
    strongBiometricsOnly: Boolean
  ): AccessResolution? {
    return when (accessControl) {
      AccessControl.SECUREENCLAVEBIOMETRY -> {
        if (!availability.biometry || !availability.strongBox) return null
        AccessResolution(
          accessControl = AccessControl.SECUREENCLAVEBIOMETRY,
          securityLevel = SecurityLevel.STRONGBOX,
          requiresAuthentication = true,
          allowedAuthenticators = Authenticators.BIOMETRIC_STRONG,
          useStrongBox = true,
          invalidateOnEnrollment = true
        )
      }
      AccessControl.BIOMETRYCURRENTSET -> {
        if (!availability.biometry) return null
        AccessResolution(
          accessControl = AccessControl.BIOMETRYCURRENTSET,
          securityLevel = SecurityLevel.BIOMETRY,
          requiresAuthentication = true,
          allowedAuthenticators = if (strongBiometricsOnly) {
            Authenticators.BIOMETRIC_STRONG
          } else {
            Authenticators.BIOMETRIC_STRONG or Authenticators.BIOMETRIC_WEAK
          },
          useStrongBox = false,
          invalidateOnEnrollment = true
        )
      }
      AccessControl.BIOMETRYANY -> {
        if (!availability.biometry) return null
        AccessResolution(
          accessControl = AccessControl.BIOMETRYANY,
          securityLevel = SecurityLevel.BIOMETRY,
          requiresAuthentication = true,
          allowedAuthenticators = if (strongBiometricsOnly) {
            Authenticators.BIOMETRIC_STRONG
          } else {
            Authenticators.BIOMETRIC_STRONG or Authenticators.BIOMETRIC_WEAK
          },
          useStrongBox = false,
          invalidateOnEnrollment = false
        )
      }
      AccessControl.DEVICEPASSCODE -> {
        if (!availability.deviceCredential) return null
        AccessResolution(
          accessControl = AccessControl.DEVICEPASSCODE,
          securityLevel = SecurityLevel.DEVICECREDENTIAL,
          requiresAuthentication = true,
          allowedAuthenticators = Authenticators.DEVICE_CREDENTIAL,
          useStrongBox = false,
          invalidateOnEnrollment = false
        )
      }
      AccessControl.NONE -> AccessResolution(
        accessControl = AccessControl.NONE,
        securityLevel = SecurityLevel.SOFTWARE,
        requiresAuthentication = false,
        allowedAuthenticators = 0,
        useStrongBox = false,
        invalidateOnEnrollment = false
      )
    }
  }
}

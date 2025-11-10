package com.sensitiveinfo.internal.crypto

import android.content.Context
import android.os.Build
import androidx.biometric.BiometricManager
import com.margelo.nitro.sensitiveinfo.AccessControl
import com.margelo.nitro.sensitiveinfo.SecurityLevel
import com.margelo.nitro.sensitiveinfo.SecurityAvailability

/**
 * Concrete implementation of AccessControlManager for Android.
 *
 * Resolves access control policies to platform capabilities:
 * - Maps requested policies to available hardware
 * - Handles fallback when hardware not available
 * - Tracks security availability
 *
 * @since 6.0.0
 */
class AndroidAccessControlManager(
  private val securityAvailabilityResolver: SecurityAvailabilityResolver,
  private val context: Context? = null
) : AccessControlManager {
  
  override suspend fun resolveAccessControl(preferred: AccessControl?): ResolvedAccessControl {
    val availability = securityAvailabilityResolver.resolve()

    val resolvedPolicy = mapToAvailablePolicy(preferred, availability)
    val securityLevel = mapToSecurityLevel(resolvedPolicy)
    val requiresAuth = requiresAuthentication(resolvedPolicy)
    val invalidatedByBiometric = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      resolvedPolicy == AccessControl.BIOMETRIC
    } else {
      false
    }

    return ResolvedAccessControl(
      accessControl = resolvedPolicy,
      securityLevel = securityLevel,
      requiresAuthentication = requiresAuth,
      invalidatedByBiometricEnrollment = invalidatedByBiometric
    )
  }

  override suspend fun getSecurityAvailability(): SecurityAvailability {
    val capabilities = securityAvailabilityResolver.resolve()
    return SecurityAvailability(
      secureEnclave = capabilities.secureEnclave,
      strongBox = capabilities.strongBox,
      biometry = capabilities.biometry,
      deviceCredential = capabilities.deviceCredential
    )
  }

  // MARK: - Private Helpers

  private fun mapToAvailablePolicy(
    preferred: AccessControl?,
    availability: SecurityAvailabilityResolver.Capabilities
  ): AccessControl {
    preferred ?: return AccessControl.NONE

    return when (preferred) {
      AccessControl.BIOMETRIC -> {
        if (availability.biometry) AccessControl.BIOMETRIC else AccessControl.DEVICE_CREDENTIAL
      }
      AccessControl.DEVICE_CREDENTIAL -> {
        if (availability.deviceCredential) AccessControl.DEVICE_CREDENTIAL else AccessControl.NONE
      }
      AccessControl.SECURE_ENCLAVE -> {
        if (availability.secureEnclave) AccessControl.SECURE_ENCLAVE else AccessControl.SOFTWARE
      }
      AccessControl.STRONG_BOX -> {
        if (availability.strongBox) AccessControl.STRONG_BOX else AccessControl.SOFTWARE
      }
      AccessControl.SOFTWARE, AccessControl.NONE -> AccessControl.SOFTWARE
      else -> AccessControl.SOFTWARE
    }
  }

  private fun mapToSecurityLevel(policy: AccessControl): SecurityLevel {
    return when (policy) {
      AccessControl.BIOMETRIC -> SecurityLevel.BIOMETRIC
      AccessControl.DEVICE_CREDENTIAL -> SecurityLevel.DEVICE_CREDENTIAL
      AccessControl.SECURE_ENCLAVE, AccessControl.STRONG_BOX -> SecurityLevel.HARDWARE_BACKED
      AccessControl.SOFTWARE, AccessControl.NONE -> SecurityLevel.SOFTWARE
      else -> SecurityLevel.SOFTWARE
    }
  }

  private fun requiresAuthentication(policy: AccessControl): Boolean {
    return policy in listOf(
      AccessControl.BIOMETRIC,
      AccessControl.DEVICE_CREDENTIAL,
      AccessControl.SECURE_ENCLAVE,
      AccessControl.STRONG_BOX
    )
  }
}

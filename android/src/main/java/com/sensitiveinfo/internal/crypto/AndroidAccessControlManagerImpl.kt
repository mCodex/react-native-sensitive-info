package com.sensitiveinfo.internal.crypto

import android.content.Context
import android.os.Build
import androidx.biometric.BiometricManager
import com.margelo.nitro.sensitiveinfo.AccessControl
import com.margelo.nitro.sensitiveinfo.SecurityLevel
import com.margelo.nitro.sensitiveinfo.SecurityAvailability
import com.sensitiveinfo.internal.crypto.SecurityAvailabilityResolver
import com.sensitiveinfo.internal.crypto.SecurityAvailabilitySnapshot

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
internal class AndroidAccessControlManager(
  private val securityAvailabilityResolver: SecurityAvailabilityResolver,
  private val context: Context? = null
) : AccessControlManager {
  
  override suspend fun resolveAccessControl(preferred: AccessControl?): ResolvedAccessControl {
    val availability = securityAvailabilityResolver.resolve()

    val resolvedPolicy = mapToAvailablePolicy(preferred, availability)
    val securityLevel = mapToSecurityLevel(resolvedPolicy)
    val requiresAuth = requiresAuthentication(resolvedPolicy)
    val invalidatedByBiometric = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      resolvedPolicy == AccessControl.BIOMETRYCURRENTSET || resolvedPolicy == AccessControl.BIOMETRYANY
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
    availability: SecurityAvailabilitySnapshot
  ): AccessControl {
    preferred ?: return AccessControl.NONE

    return when (preferred) {
      AccessControl.BIOMETRYCURRENTSET, AccessControl.BIOMETRYANY -> {
        if (availability.biometry) preferred else AccessControl.DEVICEPASSCODE
      }
      AccessControl.DEVICEPASSCODE -> {
        if (availability.deviceCredential) AccessControl.DEVICEPASSCODE else AccessControl.NONE
      }
      AccessControl.SECUREENCLAVEBIOMETRY -> {
        if (availability.secureEnclave) AccessControl.SECUREENCLAVEBIOMETRY else AccessControl.NONE
      }
      AccessControl.NONE -> AccessControl.NONE
      else -> AccessControl.NONE
    }
  }

  private fun mapToSecurityLevel(policy: AccessControl): SecurityLevel {
    return when (policy) {
      AccessControl.BIOMETRYCURRENTSET, AccessControl.BIOMETRYANY -> SecurityLevel.BIOMETRY
      AccessControl.DEVICEPASSCODE -> SecurityLevel.DEVICECREDENTIAL
      AccessControl.SECUREENCLAVEBIOMETRY -> SecurityLevel.SECUREENCLAVE
      AccessControl.NONE -> SecurityLevel.SOFTWARE
      else -> SecurityLevel.SOFTWARE
    }
  }

  private fun requiresAuthentication(policy: AccessControl): Boolean {
    return policy in listOf(
      AccessControl.BIOMETRYCURRENTSET,
      AccessControl.BIOMETRYANY,
      AccessControl.DEVICEPASSCODE,
      AccessControl.SECUREENCLAVEBIOMETRY
    )
  }
}

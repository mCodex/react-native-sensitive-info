package com.sensitiveinfo.internal.crypto

import com.margelo.nitro.sensitiveinfo.AccessControl
import com.margelo.nitro.sensitiveinfo.SecurityLevel
import com.margelo.nitro.sensitiveinfo.SecurityAvailability

/**
 * Represents resolved access control with platform-specific details.
 */
data class ResolvedAccessControl(
  val accessControl: AccessControl,
  val securityLevel: SecurityLevel,
  val requiresAuthentication: Boolean,
  val invalidatedByBiometricEnrollment: Boolean
)

/**
 * Interface for managing access control resolution and operations on Android.
 *
 * Encapsulates all access control policies and their resolution logic.
 * Follows Single Responsibility Principle by focusing on access control.
 *
 * @since 6.0.0
 */
interface AccessControlManager {
  /**
   * Resolve access control to platform-supported policy.
   *
   * @param preferred Preferred access control from request
   * @return Resolved access control with platform support details
   * @throws Exception if resolution fails
   */
  suspend fun resolveAccessControl(preferred: AccessControl?): ResolvedAccessControl

  /**
   * Get current security availability.
   *
   * @return Available security features on this device
   */
  suspend fun getSecurityAvailability(): SecurityAvailability
}

package com.sensitiveinfo.internal.crypto

import com.margelo.nitro.sensitiveinfo.AccessControl
import com.margelo.nitro.sensitiveinfo.SecurityLevel

internal data class AccessResolution(
  val accessControl: AccessControl,
  val securityLevel: SecurityLevel,
  val requiresAuthentication: Boolean,
  val allowedAuthenticators: Int,
  val useStrongBox: Boolean,
  val invalidateOnEnrollment: Boolean
) {
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

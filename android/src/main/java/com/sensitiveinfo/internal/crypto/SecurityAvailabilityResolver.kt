package com.sensitiveinfo.internal.crypto

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators
import androidx.core.content.getSystemService
import com.margelo.nitro.sensitiveinfo.BiometryStatus
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

internal data class SecurityAvailabilitySnapshot(
  val secureEnclave: Boolean,
  val strongBox: Boolean,
  val biometry: Boolean,
  val biometryStatus: BiometryStatus,
  val strongBiometrics: Boolean,
  val deviceCredential: Boolean
)

/**
 * Caches hardware capability checks (StrongBox, biometrics, device credential).
 *
 * The Android system calls here can be relatively expensive, so we memoize the result until the
 * process restarts. JS can always request a fresh snapshot by calling
 * `getSupportedSecurityLevels()`.
 */
internal class SecurityAvailabilityResolver(private val context: Context) {
  private val lock = ReentrantLock()
  private var cached: SecurityAvailabilitySnapshot? = null

  fun resolve(): SecurityAvailabilitySnapshot {
    lock.withLock {
      val cachedSnapshot = cached
      if (cachedSnapshot != null) {
        return cachedSnapshot
      }

      val biometricManager = BiometricManager.from(context)
      val strongResult = biometricManager.canAuthenticate(Authenticators.BIOMETRIC_STRONG)
      val weakResult = biometricManager.canAuthenticate(Authenticators.BIOMETRIC_WEAK)
      val hasStrongBiometrics = strongResult == BiometricManager.BIOMETRIC_SUCCESS
      val hasWeakBiometrics = weakResult == BiometricManager.BIOMETRIC_SUCCESS
      val hasBiometry = hasStrongBiometrics || hasWeakBiometrics

      // Combine the strong/weak probe results so that the most informative reason wins.
      // Order of precedence: SUCCESS > NONE_ENROLLED > NO_HARDWARE/HW_UNAVAILABLE/SECURITY_UPDATE_REQUIRED > UNKNOWN/UNSUPPORTED.
      val biometryStatus = classifyBiometryStatus(strongResult, weakResult)

      val keyguard = context.getSystemService<KeyguardManager>()
      val deviceCredential = keyguard?.isDeviceSecure == true

      val hasStrongBox = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
        context.packageManager.hasSystemFeature("android.hardware.strongbox_keystore")

      val snapshot = SecurityAvailabilitySnapshot(
        secureEnclave = hasStrongBox,
        strongBox = hasStrongBox,
        biometry = hasBiometry,
        biometryStatus = biometryStatus,
        strongBiometrics = hasStrongBiometrics,
        deviceCredential = deviceCredential
      )
      cached = snapshot
      return snapshot
    }
  }

  private fun classifyBiometryStatus(strongResult: Int, weakResult: Int): BiometryStatus {
    // SUCCESS on either tier means we can authenticate now.
    if (strongResult == BiometricManager.BIOMETRIC_SUCCESS ||
      weakResult == BiometricManager.BIOMETRIC_SUCCESS
    ) {
      return BiometryStatus.AVAILABLE
    }

    // Hardware exists but no fingerprint/face is enrolled.
    if (strongResult == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ||
      weakResult == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED
    ) {
      return BiometryStatus.NOTENROLLED
    }

    // Permanently or contextually unavailable.
    val unavailableCodes = setOf(
      BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE,
      BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE,
      BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED
    )
    if (strongResult in unavailableCodes || weakResult in unavailableCodes) {
      return BiometryStatus.NOTAVAILABLE
    }

    return BiometryStatus.UNKNOWN
  }
}

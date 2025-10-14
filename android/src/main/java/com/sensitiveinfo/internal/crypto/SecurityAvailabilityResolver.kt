package com.sensitiveinfo.internal.crypto

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators
import androidx.core.content.getSystemService
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

internal data class SecurityAvailabilitySnapshot(
  val secureEnclave: Boolean,
  val strongBox: Boolean,
  val biometry: Boolean,
  val deviceCredential: Boolean
)

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
      val hasBiometry = when (biometricManager.canAuthenticate(Authenticators.BIOMETRIC_STRONG)) {
        BiometricManager.BIOMETRIC_SUCCESS -> true
        else -> biometricManager.canAuthenticate(Authenticators.BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS
      }

      val keyguard = context.getSystemService<KeyguardManager>()
      val deviceCredential = keyguard?.isDeviceSecure == true

      val hasStrongBox = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
        context.packageManager.hasSystemFeature("android.hardware.strongbox_keystore")

      val snapshot = SecurityAvailabilitySnapshot(
        secureEnclave = hasStrongBox,
        strongBox = hasStrongBox,
        biometry = hasBiometry,
        deviceCredential = deviceCredential
      )
      cached = snapshot
      return snapshot
    }
  }
}

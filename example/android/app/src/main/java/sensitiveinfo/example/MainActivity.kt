package sensitiveinfo.example

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.sensitiveinfo.internal.util.ActivityContextHolder

/**
 * MainActivity.kt
 *
 * Main activity for the SensitiveInfo example application.
 *
 * **Biometric Support**:
 * Captures the activity reference in ActivityContextHolder so that:
 * 1. BiometricAuthenticator can access the FragmentActivity
 * 2. BiometricPrompt can show UI properly
 * 3. Example app can demonstrate full biometric flow
 *
 * **Lifecycle**:
 * - onCreate(): Register this activity in ActivityContextHolder
 * - onDestroy(): Clear the activity reference from ActivityContextHolder
 */
class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript.
   * This is used to schedule rendering of the component.
   */
  override fun getMainComponentName(): String = "SensitiveInfoExample"

  /**
   * Returns the instance of the [ReactActivityDelegate].
   * We use [DefaultReactActivityDelegate] which allows you to enable New Architecture
   * with a single boolean flag [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * Called when the activity is created.
   *
   * Captures this activity reference for BiometricAuthenticator to use later.
   * This is necessary because BiometricPrompt requires a FragmentActivity context.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Register this activity for BiometricAuthenticator
    ActivityContextHolder.setActivity(this)
  }

  /**
   * Called when the activity is destroyed.
   *
   * Clears the activity reference from ActivityContextHolder to prevent memory leaks.
   */
  override fun onDestroy() {
    super.onDestroy()
    // Clear the activity reference when activity is destroyed
    ActivityContextHolder.clear()
  }
}

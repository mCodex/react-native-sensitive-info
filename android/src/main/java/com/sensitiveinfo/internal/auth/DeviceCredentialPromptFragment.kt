package com.sensitiveinfo.internal.auth

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import com.margelo.nitro.sensitiveinfo.AuthenticationPrompt
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * Headless fragment that shows the legacy confirm-device-credential prompt for Android 9 and older.
 * The fragment is added only for the lifetime of the authentication flow and removes itself once
 * the user completes or cancels the dialog.
 */
internal class DeviceCredentialPromptFragment : Fragment() {
  private var continuation: CancellableContinuation<Boolean>? = null

  fun launch(prompt: AuthenticationPrompt, cont: CancellableContinuation<Boolean>) {
    continuation = cont

    val keyguard = requireContext().getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
    if (keyguard == null || !keyguard.isDeviceSecure) {
      continuation?.resumeWithException(IllegalStateException("Device credential is not configured."))
      cleanup()
      return
    }

    val intent = keyguard.createConfirmDeviceCredentialIntent(prompt.title, prompt.description)
    if (intent == null) {
      continuation?.resumeWithException(IllegalStateException("Unable to present device credential prompt."))
      cleanup()
      return
    }

    try {
      startActivityForResult(intent, REQUEST_CODE)
    } catch (error: Throwable) {
      continuation?.resumeWithException(IllegalStateException(error.message ?: "Device credential prompt failed to launch."))
      cleanup()
    }
  }

  @Suppress("OVERRIDE_DEPRECATION")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != REQUEST_CODE) return

    val cont = continuation ?: return
    continuation = null

    if (resultCode == Activity.RESULT_OK) {
      cont.resume(true)
    } else {
      cont.cancel()
    }
    cleanup()
  }

  private fun cleanup() {
    continuation = null
    if (isAdded) {
      parentFragmentManager.beginTransaction().remove(this).commitAllowingStateLoss()
    }
  }

  companion object {
    private const val TAG = "DeviceCredentialPrompt"
    private const val REQUEST_CODE = 0xDCE

    suspend fun authenticate(activity: FragmentActivity, prompt: AuthenticationPrompt): Boolean {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        return true
      }

      return suspendCancellableCoroutine { continuation ->
        val manager = activity.supportFragmentManager
        val fragment = (manager.findFragmentByTag(TAG) as? DeviceCredentialPromptFragment)
          ?: DeviceCredentialPromptFragment().also {
            manager.beginTransaction().add(it, TAG).commitNowAllowingStateLoss()
          }

        fragment.launch(prompt, continuation)

        continuation.invokeOnCancellation {
          fragment.continuation = null
          if (fragment.isAdded) {
            manager.beginTransaction().remove(fragment).commitAllowingStateLoss()
          }
        }
      }
    }
  }
}

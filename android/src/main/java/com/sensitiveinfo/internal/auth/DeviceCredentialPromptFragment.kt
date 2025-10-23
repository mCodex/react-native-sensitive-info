package com.sensitiveinfo.internal.auth

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import com.sensitiveinfo.internal.util.SensitiveInfoException
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Headless fragment that launches the legacy Confirm Device Credential prompt
 * on Android 9 (API 28) and below.
 */
internal class DeviceCredentialPromptFragment : Fragment() {
    private var continuation: CancellableContinuation<Boolean>? = null

    @Suppress("DEPRECATION")
    fun launch(prompt: AuthenticationPrompt, cont: CancellableContinuation<Boolean>) {
        continuation = cont

        val keyguard = requireContext().getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        if (keyguard == null || !keyguard.isDeviceSecure) {
            continuation?.resumeWithException(SensitiveInfoException.AuthenticationFailed("Device credential not set"))
            continuation = null
            return
        }

        val intent = keyguard.createConfirmDeviceCredentialIntent(prompt.title, prompt.description)
        if (intent == null) {
            continuation?.resumeWithException(SensitiveInfoException.AuthenticationFailed("Device credential prompt unavailable"))
            continuation = null
            return
        }

        try {
            startActivityForResult(intent, REQUEST_CODE)
        } catch (throwable: Throwable) {
            continuation?.resumeWithException(SensitiveInfoException.AuthenticationFailed(throwable.message ?: "Unable to launch device credential prompt"))
            continuation = null
        }
    }

    @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_CODE) return

        val cont = continuation ?: return
        continuation = null

        if (resultCode == Activity.RESULT_OK) {
            cont.resume(true)
        } else {
            cont.resumeWithException(SensitiveInfoException.AuthenticationCanceled())
        }
    }

    companion object {
        private const val REQUEST_CODE = 0xDCE
        private const val TAG = "DeviceCredentialPrompt"

        suspend fun authenticate(activity: FragmentActivity, prompt: AuthenticationPrompt): Boolean {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                return true
            }

            return suspendCancellableCoroutine { continuation ->
                val manager = activity.supportFragmentManager
                var fragment = manager.findFragmentByTag(TAG) as? DeviceCredentialPromptFragment
                if (fragment == null) {
                    fragment = DeviceCredentialPromptFragment()
                    manager.beginTransaction().add(fragment, TAG).commitNowAllowingStateLoss()
                }

                fragment.launch(prompt, continuation)

                continuation.invokeOnCancellation {
                    fragment.continuation = null
                    manager.beginTransaction().remove(fragment).commitAllowingStateLoss()
                }
            }
        }
    }
}

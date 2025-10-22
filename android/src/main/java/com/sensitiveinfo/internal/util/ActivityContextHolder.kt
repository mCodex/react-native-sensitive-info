package com.sensitiveinfo.internal.util

import androidx.fragment.app.FragmentActivity
import java.lang.ref.WeakReference

/**
 * ActivityContextHolder.kt
 *
 * Singleton holder for the current FragmentActivity reference.
 *
 * **Purpose**:
 * - Provides BiometricAuthenticator with access to FragmentActivity
 * - Required for BiometricPrompt API (needs Activity context)
 * - Used for authentication UI rendering
 *
 * **Design**:
 * - Singleton pattern for global access
 * - WeakReference to prevent memory leaks
 * - Thread-safe lazy initialization
 * - Automatically cleared when activity is destroyed
 *
 * **Usage**:
 * ```kotlin
 * // In MainActivity.onCreate():
 * ActivityContextHolder.setActivity(this)
 *
 * // In BiometricAuthenticator or other components:
 * val activity = ActivityContextHolder.getActivity()
 * if (activity != null && !activity.isDestroyed) {
 *     // Use activity for BiometricPrompt
 * }
 * ```
 *
 * **Why WeakReference**:
 * - Prevents memory leaks if holder outlives activity
 * - Activity can be garbage collected normally
 * - Automatic cleanup when activity is destroyed
 *
 * @see BiometricAuthenticator
 * @see ReactApplicationContext
 */
object ActivityContextHolder {
    private var activityReference: WeakReference<FragmentActivity?> = WeakReference(null)

    /**
     * Sets the current FragmentActivity.
     *
     * Should be called from MainActivity.onCreate() or similar initialization point.
     *
     * @param activity The current FragmentActivity (usually MainActivity)
     */
    fun setActivity(activity: FragmentActivity?) {
        activityReference = WeakReference(activity)
    }

    /**
     * Gets the current FragmentActivity if available and not destroyed.
     *
     * @return The FragmentActivity or null if not set or has been destroyed
     */
    fun getActivity(): FragmentActivity? {
        val activity = activityReference.get()
        return if (activity != null && !activity.isDestroyed) {
            activity
        } else {
            null
        }
    }

    /**
     * Clears the activity reference.
     *
     * Should be called from MainActivity.onDestroy() to ensure cleanup.
     */
    fun clear() {
        activityReference.clear()
    }
}

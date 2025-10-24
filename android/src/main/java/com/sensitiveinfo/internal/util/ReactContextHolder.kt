package com.sensitiveinfo.internal.util

import android.app.Activity
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.LifecycleEventListener
import androidx.fragment.app.FragmentActivity
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicReference

/**
 * Stores a reference to the current [ReactApplicationContext] so HybridObjects created via
 * [DefaultConstructableObject] can lazily access it without requiring constructor parameters.
 *
 * Nitro instantiates the bridge in native code, so we cannot rely on constructor DI. This helper is
 * the canonical way for internal classes to reach the context or the current activity when they
 * need to launch a biometric prompt.
 */
internal object ReactContextHolder {
  // Keep only a weak reference so the React instance can be GC'd after teardown.
  private val contextRef = AtomicReference<WeakReference<ReactApplicationContext>?>(null)
  private val activityRef = AtomicReference<WeakReference<FragmentActivity>?>(null)
  private val lifecycleListener = object : LifecycleEventListener {
    override fun onHostResume() {
      captureActivity(contextRef.get()?.get()?.currentActivity)
    }

    override fun onHostPause() {
      // No-op. We keep the last resumed activity to support prompts during pauses triggered by UI overlays.
    }

    override fun onHostDestroy() {
      clearActivity()
    }
  }

  fun install(context: ReactApplicationContext) {
    val current = contextRef.get()?.get()
    if (current === context) {
      return
    }
    current?.removeLifecycleEventListener(lifecycleListener)
    context.addLifecycleEventListener(lifecycleListener)
    contextRef.set(WeakReference(context))
    captureActivity(context.currentActivity)
  }

  fun clear() {
    contextRef.getAndSet(null)?.get()?.removeLifecycleEventListener(lifecycleListener)
    clearActivity()
  }

  fun requireContext(): ReactApplicationContext {
    return contextRef.get()?.get()
      ?: throw IllegalStateException("ReactApplicationContext not yet available for SensitiveInfo.")
  }

  fun currentActivity(): FragmentActivity? {
    val active = activityRef.get()?.get()
    if (active != null && !active.isFinishing && !active.isDestroyed) {
      return active
    }

    val contextActivity = contextRef.get()?.get()?.currentActivity as? FragmentActivity
    captureActivity(contextActivity)
    return contextActivity
  }

  private fun captureActivity(activity: Activity?) {
    val fragmentActivity = activity as? FragmentActivity ?: return
    activityRef.set(WeakReference(fragmentActivity))
  }

  private fun clearActivity() {
    activityRef.getAndSet(null)?.clear()
  }
}

package com.sensitiveinfo.internal.util

import android.app.Activity
import com.facebook.react.bridge.ReactApplicationContext
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

  fun install(context: ReactApplicationContext) {
    val current = contextRef.get()?.get()
    if (current === context) {
      return
    }
    contextRef.set(WeakReference(context))
  }

  fun clear() {
    contextRef.set(null)
  }

  fun requireContext(): ReactApplicationContext {
    return contextRef.get()?.get()
      ?: throw IllegalStateException("ReactApplicationContext not yet available for SensitiveInfo.")
  }

  fun currentActivity(): Activity? = contextRef.get()?.get()?.currentActivity
}

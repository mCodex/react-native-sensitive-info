package com.sensitiveinfo.internal.util

import android.app.Activity
import com.facebook.react.bridge.ReactApplicationContext
import java.util.concurrent.atomic.AtomicReference

/**
 * Stores a reference to the current [ReactApplicationContext] so HybridObjects created via
 * [DefaultConstructableObject] can lazily access it without requiring constructor parameters.
 */
internal object ReactContextHolder {
  private val contextRef = AtomicReference<ReactApplicationContext?>()

  fun install(context: ReactApplicationContext) {
    contextRef.set(context)
  }

  fun clear() {
    contextRef.set(null)
  }

  fun requireContext(): ReactApplicationContext {
    return contextRef.get()
      ?: throw IllegalStateException("ReactApplicationContext not yet available for SensitiveInfo.")
  }

  fun currentActivity(): Activity? = contextRef.get()?.currentActivity
}

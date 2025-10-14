package com.sensitiveinfo

import com.facebook.react.bridge.ReactApplicationContext

/**
 * Bridges the generated Java spec so Kotlin modules can share the same base type
 * across both old and new React Native architectures.
 */
abstract class NativeSensitiveInfoSpec internal constructor(
  reactContext: ReactApplicationContext
) : NativeSensitiveInfoSpecSpec(reactContext)

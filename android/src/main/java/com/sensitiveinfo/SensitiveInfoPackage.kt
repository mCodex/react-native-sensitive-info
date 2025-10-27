package com.sensitiveinfo

import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.ReactPackage
import com.facebook.react.uimanager.ViewManager
import com.margelo.nitro.sensitiveinfo.SensitiveInfoOnLoad
import com.sensitiveinfo.internal.util.ReactContextHolder

class SensitiveInfoPackage : ReactPackage {
  @Deprecated("React Native's legacy package hook; kept for backwards compatibility.")
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    ReactContextHolder.install(reactContext)
    return emptyList()
  }

  @Deprecated("React Native's legacy package hook; kept for backwards compatibility.")
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    ReactContextHolder.install(reactContext)
    return emptyList()
  }

  companion object {
    init {
      SensitiveInfoOnLoad.initializeNative()
    }
  }
}


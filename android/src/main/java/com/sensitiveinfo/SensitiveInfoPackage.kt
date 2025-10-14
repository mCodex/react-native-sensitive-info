package com.sensitiveinfo

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager
import com.margelo.nitro.sensitiveinfo.SensitiveInfoOnLoad
import com.sensitiveinfo.internal.util.ReactContextHolder

class SensitiveInfoPackage : TurboReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    ReactContextHolder.install(reactContext)
    return null
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider { emptyMap() }

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


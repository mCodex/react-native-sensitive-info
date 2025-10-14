package com.sensitiveinfo

import com.facebook.react.ReactPackage
import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

class SensitiveInfoPackage : TurboReactPackage(), ReactPackage {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == SensitiveInfoModule.NAME) SensitiveInfoModule(reactContext) else null

  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(SensitiveInfoModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      SensitiveInfoModule.NAME to ReactModuleInfo(
        SensitiveInfoModule.NAME,
        SensitiveInfoModule.NAME,
        false,
        false,
        true,
        false,
        true
      )
    )
  }
}

package com.margelo.nitro.sensitiveinfo

import androidx.annotation.NonNull
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SensitiveInfoPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = listOf(
        AndroidBiometricModule(reactContext)
    )

    override fun createViewManagers(@NonNull reactContext: ReactApplicationContext): List<ViewManager<*, *>> = listOf(
        HybridBiometricPromptViewManager.create()
    )

    companion object {
        init {
            sensitiveinfoOnLoad.initializeNative()
        }
    }
}

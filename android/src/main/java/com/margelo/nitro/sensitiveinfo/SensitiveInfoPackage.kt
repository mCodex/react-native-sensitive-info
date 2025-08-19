package com.margelo.nitro.sensitiveinfo

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager
import androidx.annotation.NonNull

class SensitiveInfoPackage : TurboReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = when (name) {
        "AndroidBiometric" -> AndroidBiometricModule(reactContext)
        else -> null
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider { HashMap() }
    }

    override fun createViewManagers(@NonNull reactContext: ReactApplicationContext): MutableList<ViewManager<*, *>> {
        val list = mutableListOf<ViewManager<*, *>>()
        list.add(HybridBiometricPromptViewManager.create())
        return list
    }

    companion object {
        init {
            System.loadLibrary("sensitiveinfo")
        }
    }
}

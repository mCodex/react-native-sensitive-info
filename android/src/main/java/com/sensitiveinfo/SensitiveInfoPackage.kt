package com.sensitiveinfo

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import java.util.ArrayList

/**
 * SensitiveInfoPackage.kt
 *
 * React Native package that registers:
 * 1. SensitiveInfoModule - Native module for JS bridge
 * 2. SensitiveInfoViewManager - UI component manager
 *
 * **Registration**:
 * This package is auto-registered via React Native's autolinking.
 * Ensure react-native.config.js includes this package.
 *
 * @see SensitiveInfoModule for API methods
 * @see SensitiveInfoViewManager for UI components
 */
open class SensitiveInfoPackage : ReactPackage {

    /**
     * Creates native modules for JavaScript access.
     *
     * Registered modules:
     * - SensitiveInfoModule: Main API (setItem, getItem, deleteItem, etc)
     *
     * @param reactContext The React application context
     * @return List of native modules
     */
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            SensitiveInfoModule(reactContext)
        )
    }

    /**
     * Creates view managers for UI components.
     *
     * Registered view managers:
     * - SensitiveInfoViewManager: UI component manager
     *
     * @param reactContext The React application context
     * @return List of view managers
     */
    @Suppress("DEPRECATION")
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return listOf(
            SensitiveInfoViewManager()
        )
    }
}

/**
 * Alias for backwards compatibility with React Native autolinking.
 *
 * React Native's autolinking may look for SensitiveInfoViewPackage
 * (old naming convention). This alias ensures compatibility.
 */
@Suppress("DEPRECATION")
class SensitiveInfoViewPackage : SensitiveInfoPackage()

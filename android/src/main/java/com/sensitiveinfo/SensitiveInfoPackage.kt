package com.sensitiveinfo

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import java.util.ArrayList

/**
 * SensitiveInfoPackage.kt
 *
 * React Native package that registers secure storage functionality.
 *
 * This package provides a native TurboModule for programmatic access,
 * fully compatible with React Native's new Fabric architecture.
 *
 * **Components Registered**:
 * - SensitiveInfoModule: TurboModule for secure storage operations
 *
 * **Architecture**:
 * - Uses AndroidKeyStore for hardware-backed encryption
 * - Supports biometric authentication via BiometricPrompt
 * - Fallback to device credentials when biometric unavailable
 * - Graceful degradation when StrongBox not available
 *
 * **Registration**:
 * This package is auto-registered via React Native's autolinking.
 * Ensure react-native.config.js includes this package.
 *
 * @see SensitiveInfoModule for API methods
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
     * Since this library only provides storage functionality via TurboModule,
     * no UI view managers are required.
     *
     * @param reactContext The React application context
     * @return Empty list (no UI components)
     */
    @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}

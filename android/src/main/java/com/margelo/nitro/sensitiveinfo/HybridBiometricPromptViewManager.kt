package com.margelo.nitro.sensitiveinfo

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.margelo.nitro.sensitiveinfo.views.HybridBiometricPromptViewManager as GeneratedManager

/**
 * Thin wrapper to expose a generated manager instance to RN.
 * The generated manager is final, so we provide a factory function instead of subclassing it.
 */
class HybridBiometricPromptViewManager private constructor() {
		companion object {
			fun create(): ViewManager<*, *> {
				return GeneratedManager()
			}
		}
}

package com.margelo.nitro.sensitiveinfo
  
import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class SensitiveInfo : HybridSensitiveInfoSpec() {
  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }
}

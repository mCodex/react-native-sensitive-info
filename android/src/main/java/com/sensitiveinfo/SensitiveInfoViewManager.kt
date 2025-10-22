package com.sensitiveinfo

import android.graphics.Color
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.SensitiveInfoViewManagerInterface
import com.facebook.react.viewmanagers.SensitiveInfoViewManagerDelegate

@ReactModule(name = SensitiveInfoViewManager.NAME)
class SensitiveInfoViewManager : SimpleViewManager<SensitiveInfoView>(),
  SensitiveInfoViewManagerInterface<SensitiveInfoView> {
  private val mDelegate: ViewManagerDelegate<SensitiveInfoView>

  init {
    mDelegate = SensitiveInfoViewManagerDelegate(this)
  }

  override fun getDelegate(): ViewManagerDelegate<SensitiveInfoView>? {
    return mDelegate
  }

  override fun getName(): String {
    return NAME
  }

  public override fun createViewInstance(context: ThemedReactContext): SensitiveInfoView {
    return SensitiveInfoView(context)
  }

  @ReactProp(name = "color")
  override fun setColor(view: SensitiveInfoView?, color: String?) {
    view?.setBackgroundColor(Color.parseColor(color))
  }

  companion object {
    const val NAME = "SensitiveInfoView"
  }
}

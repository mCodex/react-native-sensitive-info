#pragma once

#include "pch.h"
#include "NativeModules.h"

using namespace winrt::Microsoft::ReactNative;

#ifdef RNW61
#define JSVALUEOBJECTPARAMETER
#else
#define JSVALUEOBJECTPARAMETER const &
#endif

namespace winrt::RNSensitiveInfoCPP {
  REACT_MODULE(RNSensitiveInfo);
  struct RNSensitiveInfo {
    const std::string Name = "RNSensitiveInfo";
    
    REACT_METHOD(getItem);
    void getItem(std::string key,
                 winrt::Microsoft::ReactNative::JSValueObject JSVALUEOBJECTPARAMETER options,
                 winrt::Microsoft::ReactNative::ReactPromise<std::string> const& promise) noexcept;
    
    REACT_METHOD(setItem);
    void setItem(std::string key,
                 std::string value,
                 winrt::Microsoft::ReactNative::JSValueObject JSVALUEOBJECTPARAMETER options,
                 winrt::Microsoft::ReactNative::ReactPromise<std::string> const& promise) noexcept;
    
    REACT_METHOD(deleteItem);
    void deleteItem(std::string key,
                    winrt::Microsoft::ReactNative::JSValueObject JSVALUEOBJECTPARAMETER options,
                    winrt::Microsoft::ReactNative::ReactPromise<std::string> const& promise) noexcept;

    REACT_METHOD(getAllItems);
    void getAllItems(winrt::Microsoft::ReactNative::JSValueObject JSVALUEOBJECTPARAMETER options,
                     winrt::Microsoft::ReactNative::ReactPromise<winrt::Microsoft::ReactNative::JSValueObject> const& promise) noexcept;

    REACT_METHOD(isSensorAvailable)
    void isSensorAvailable(winrt::Microsoft::ReactNative::ReactPromise<bool> const& promise) noexcept;
    REACT_METHOD(hasEnrolledFingerprints)
    void hasEnrolledFingerprints(winrt::Microsoft::ReactNative::ReactPromise<bool> const& promise) noexcept;
  };
}

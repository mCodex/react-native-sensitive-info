#include "pch.h"
#include "RNSensitiveInfoCPP.h"

using namespace winrt::Windows::Security::Credentials;

namespace winrt::RNSensitiveInfoCPP {
  static std::string getSharedPreferences(winrt::Microsoft::ReactNative::JSValueObject const & options) {
    auto search = options.find("sharedPreferencesName");
    if (search != options.end()) {
      return search->second.AsString();
    } else {
      return "shared_preferences";
    }
  }

  void RNSensitiveInfo::getItem(std::string key,
                                winrt::Microsoft::ReactNative::JSValueObject JSVALUEOBJECTPARAMETER options,
                                winrt::Microsoft::ReactNative::ReactPromise<std::string> const& promise) noexcept {
    if (key.empty()) {
      promise.Reject("key is empty");
      return;
    }
    try {
      auto name = getSharedPreferences(options);
      auto vault = PasswordVault();
      auto data = vault.Retrieve(winrt::to_hstring(name), winrt::to_hstring(key));
      if (!data) {
        promise.Reject("key not found");
      } else {
        promise.Resolve(winrt::to_string(data.Password()));
      }
    } catch (...) {
      promise.Reject("cannot access datastore");
    }
  }
    
  void RNSensitiveInfo::setItem(std::string key,
                                std::string value,
                                winrt::Microsoft::ReactNative::JSValueObject JSVALUEOBJECTPARAMETER options,
                                winrt::Microsoft::ReactNative::ReactPromise<std::string> const& promise) noexcept {
    if (key.empty()) {
      promise.Reject("key is empty");
      return;
    }
    try {
      auto name = getSharedPreferences(options);
      auto vault = PasswordVault();
      PasswordCredential creds(winrt::to_hstring(name),
                               winrt::to_hstring(key),
                               winrt::to_hstring(value));
      vault.Add(creds);
      promise.Resolve(value);
    } catch (...) {
      promise.Reject("cannot access datastore");
    }
  }

  void RNSensitiveInfo::deleteItem(std::string key,
                                   winrt::Microsoft::ReactNative::JSValueObject JSVALUEOBJECTPARAMETER options,
                                   winrt::Microsoft::ReactNative::ReactPromise<std::string> const& promise) noexcept {
    if (key.empty()) {
      promise.Reject("key is empty");
      return;
    }
    try {
      auto name = getSharedPreferences(options);
      auto vault = PasswordVault();
      auto data = vault.Retrieve(winrt::to_hstring(name), winrt::to_hstring(key));
      if (!data) {
        promise.Reject("key not found");
      } else {
        vault.Remove(data);
        promise.Resolve(key);
      }
    } catch (...) {
      promise.Reject("cannot access datastore");
    }
  }

  void RNSensitiveInfo::getAllItems(winrt::Microsoft::ReactNative::JSValueObject JSVALUEOBJECTPARAMETER options,
                                    winrt::Microsoft::ReactNative::ReactPromise<winrt::Microsoft::ReactNative::JSValueObject> const& promise) noexcept {
    try {
      auto name = getSharedPreferences(options);
      auto vault = PasswordVault();
      auto allKeys = vault.FindAllByResource(winrt::to_hstring(name));
      winrt::Microsoft::ReactNative::JSValueObject returnValue;
      for (auto const& key : allKeys) {
        auto data = vault.Retrieve(winrt::to_hstring(name), key.UserName());
        returnValue[winrt::to_string(key.UserName())] = winrt::to_string(data.Password());
      }
      promise.Resolve(returnValue);
    } catch (...) {
      promise.Reject("cannot access datastore");
    }
  }

  void RNSensitiveInfo::isSensorAvailable(winrt::Microsoft::ReactNative::ReactPromise<bool> const& promise) noexcept {
    promise.Resolve(false);
  }

  void RNSensitiveInfo::hasEnrolledFingerprints(winrt::Microsoft::ReactNative::ReactPromise<bool> const& promise) noexcept {
    promise.Resolve(false);
  }
}

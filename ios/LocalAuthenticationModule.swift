import Foundation
import LocalAuthentication
import React

@objc(RNLocalAuthentication)
class RNLocalAuthentication: NSObject, RCTBridgeModule {
  static func moduleName() -> String! { "LocalAuthentication" }
  static func requiresMainQueueSetup() -> Bool { true }

  @objc(isAvailable:rejecter:)
  func isAvailable(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let context = LAContext()
    var error: NSError?
    let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    resolve(available)
  }

  @objc(authenticate:resolver:rejecter:)
  func authenticate(_ options: NSDictionary?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let context = LAContext()
    let reason = (options?["reason"] as? String) ?? "Authenticate to continue"
    let allowDeviceCredential = (options?["allowDeviceCredential"] as? Bool) ?? false
    let policy: LAPolicy = allowDeviceCredential ? .deviceOwnerAuthentication : .deviceOwnerAuthenticationWithBiometrics

    var authError: NSError?
    guard context.canEvaluatePolicy(policy, error: &authError) else {
      reject("UNAVAILABLE", authError?.localizedDescription ?? "Biometrics unavailable", authError)
      return
    }

    context.evaluatePolicy(policy, localizedReason: reason) { success, error in
    DispatchQueue.main.async {
      if success {
        resolve(true)
      } else {
        if let err = error as NSError? {
          reject("AUTH_ERROR", err.localizedDescription, err)
        } else {
          resolve(false)
        }
      }
    }
    }
  }
}

import Foundation
import LocalAuthentication
import UIKit
import NitroModules

class HybridBiometricPromptView: HybridBiometricPromptViewSpec {
  // Props (updated from JS)
  var promptTitle: String? = nil
  var promptSubtitle: String? = nil
  var promptDescription: String? = nil
  var cancelButtonText: String? = nil
  // Optional, matches generated protocol
  var allowDeviceCredential: Bool? = nil

  // HybridObject memory size (required by Nitro's HybridObject)
  var memorySize: Int { MemoryLayout<HybridBiometricPromptView>.size }

  // Backing view (not visible)
  var view: UIView = UIView()

  // Methods
  func show() throws -> Promise<Bool> {
    // Wrap LocalAuthentication in a Nitro Promise to match generated spec
    return Promise.async { [weak self] in
      guard let self = self else { return false }

      let context = LAContext()
      var error: NSError?

      let allowCredential = self.allowDeviceCredential ?? false
      let policy: LAPolicy = allowCredential ? .deviceOwnerAuthentication : .deviceOwnerAuthenticationWithBiometrics

      guard context.canEvaluatePolicy(policy, error: &error) else {
        // If not available, just return false
        return false
      }

      // Title/Subtitle/Description are controlled by iOS system UI. We can only set reason.
      let reason = self.promptDescription ?? "Authenticate"

      // Evaluate synchronously via semaphore since we're already off the main thread in Promise.async
  var success = false
  var authError: Error? = nil
  let semaphore = DispatchSemaphore(value: 0)
      context.evaluatePolicy(policy, localizedReason: reason) { ok, err in
        success = ok
        authError = err
        semaphore.signal()
      }
  semaphore.wait()
      if let authError = authError {
        throw authError
      }
      return success
    }
  }
}

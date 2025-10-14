import Foundation
import LocalAuthentication

/// Aggregates the current device's authentication capabilities (biometrics, passcode, secure enclave).
final class SecurityAvailabilityResolver {
  private let lock = NSLock()
  private var cached: (secureEnclave: Bool, strongBox: Bool, biometry: Bool, deviceCredential: Bool)?

  /**
   Detects which secure hardware features are currently available.
   Simulators typically report limited support (for example, no Secure Enclave), so callers should
   always rely on this method rather than assuming capabilities.
   */
  func resolve() -> (secureEnclave: Bool, strongBox: Bool, biometry: Bool, deviceCredential: Bool) {
    lock.lock()
    defer { lock.unlock() }

    if let cachedValue = cached {
      return cachedValue
    }

    let context = LAContext()
    var error: NSError?

    let supportsBiometry = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) && context.biometryType != .none
    error = nil
    let supportsDeviceCredential = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)

    let snapshot = (
      secureEnclave: supportsBiometry,
      strongBox: false,
      biometry: supportsBiometry,
      deviceCredential: supportsDeviceCredential
    )
    cached = snapshot
    return snapshot
  }
}

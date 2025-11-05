import Foundation
import LocalAuthentication

/// Aggregates the current device's authentication capabilities (biometrics, passcode, secure enclave).
final class SecurityAvailabilityResolver {
  private let lock = NSLock()
  private var cached: (secureEnclave: Bool, strongBox: Bool, biometry: Bool, deviceCredential: Bool)?

  /**
   Detects which secure hardware features are currently available.
   Simulators typically report limited support (for example, no Secure Enclave), so callers should
   always rely on this method rather than assuming capabilities. The snapshot is reused across
   Apple platforms (iOS, macOS, visionOS, watchOS).
   */
  func resolve() -> (secureEnclave: Bool, strongBox: Bool, biometry: Bool, deviceCredential: Bool) {
    lock.lock()
    defer { lock.unlock() }

    if let cachedValue = cached {
      return cachedValue
    }

    let snapshot = resolveOnMainThread()
    cached = snapshot
    return snapshot
  }

  private func resolveOnMainThread() -> (secureEnclave: Bool, strongBox: Bool, biometry: Bool, deviceCredential: Bool) {
    if Thread.isMainThread {
      return performCapabilityProbe()
    }

    var snapshot: (secureEnclave: Bool, strongBox: Bool, biometry: Bool, deviceCredential: Bool) = (
      secureEnclave: false,
      strongBox: false,
      biometry: false,
      deviceCredential: false
    )

    DispatchQueue.main.sync {
      snapshot = performCapabilityProbe()
    }

    return snapshot
  }

  private func performCapabilityProbe() -> (secureEnclave: Bool, strongBox: Bool, biometry: Bool, deviceCredential: Bool) {
    let context = LAContext()
    var error: NSError?

    let supportsBiometry = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    #if targetEnvironment(simulator)
    let biometryAvailable = supportsBiometry
    let secureEnclaveAvailable = supportsBiometry
    #else
    let biometryAvailable = supportsBiometry && context.biometryType != .none
    let secureEnclaveAvailable = biometryAvailable
    #endif
    error = nil
    let supportsDeviceCredential = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)

    return (
      secureEnclave: secureEnclaveAvailable,
      strongBox: false,
      biometry: biometryAvailable,
      deviceCredential: supportsDeviceCredential
    )
  }
}

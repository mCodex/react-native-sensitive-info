import Foundation
import LocalAuthentication

/// Detailed biometric availability state mirroring the JS `BiometryStatus` union.
///
/// String-backed so the value can be passed straight across the Nitro bridge without an extra
/// mapping table. Keep the raw values in sync with `BiometryStatus` in
/// `src/sensitive-info.nitro.ts`.
enum BiometryStatusNative: String {
  case available
  case notEnrolled
  case notAvailable
  case lockedOut
  case unknown
}

/// Aggregates the current device's authentication capabilities (biometrics, passcode, secure enclave).
final class SecurityAvailabilityResolver {
  struct Snapshot {
    let secureEnclave: Bool
    let strongBox: Bool
    let biometry: Bool
    let biometryStatus: BiometryStatusNative
    let deviceCredential: Bool
  }

  private let lock = NSLock()
  private var cached: Snapshot?

  /**
   Detects which secure hardware features are currently available.
   Simulators typically report limited support (for example, no Secure Enclave), so callers should
   always rely on this method rather than assuming capabilities. The snapshot is reused across
   Apple platforms (iOS, macOS, visionOS, watchOS).
   */
  func resolve() -> Snapshot {
    lock.lock()
    defer { lock.unlock() }

    if let cachedValue = cached {
      return cachedValue
    }

    let snapshot = resolveOnMainThread()
    cached = snapshot
    return snapshot
  }

  private func resolveOnMainThread() -> Snapshot {
    if Thread.isMainThread {
      return performCapabilityProbe()
    }

    var snapshot = Snapshot(
      secureEnclave: false,
      strongBox: false,
      biometry: false,
      biometryStatus: .unknown,
      deviceCredential: false
    )

    DispatchQueue.main.sync {
      snapshot = performCapabilityProbe()
    }

    return snapshot
  }

  private func performCapabilityProbe() -> Snapshot {
    let context = LAContext()
    var biometryError: NSError?

    let supportsBiometry = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &biometryError)
    #if targetEnvironment(simulator)
    let biometryAvailable = supportsBiometry
    let secureEnclaveAvailable = supportsBiometry
    #else
    let biometryAvailable = supportsBiometry && context.biometryType != .none
    let secureEnclaveAvailable = biometryAvailable
    #endif

    let biometryStatus = classifyBiometryStatus(
      supportsBiometry: supportsBiometry,
      biometryAvailable: biometryAvailable,
      probeError: biometryError
    )

    var credentialError: NSError?
    let supportsDeviceCredential = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &credentialError)

    return Snapshot(
      secureEnclave: secureEnclaveAvailable,
      strongBox: false,
      biometry: biometryAvailable,
      biometryStatus: biometryStatus,
      deviceCredential: supportsDeviceCredential
    )
  }

  private func classifyBiometryStatus(
    supportsBiometry: Bool,
    biometryAvailable: Bool,
    probeError: NSError?
  ) -> BiometryStatusNative {
    if biometryAvailable {
      return .available
    }

    guard let error = probeError else {
      // No error reported but biometry not available — typically "no hardware" on devices
      // (and never reached on simulators since `biometryAvailable == supportsBiometry` there).
      return .notAvailable
    }

    guard error.domain == LAErrorDomain else {
      return .unknown
    }

    switch error.code {
    case LAError.biometryNotEnrolled.rawValue:
      return .notEnrolled
    case LAError.biometryLockout.rawValue:
      return .lockedOut
    case LAError.biometryNotAvailable.rawValue,
         LAError.passcodeNotSet.rawValue:
      return .notAvailable
    default:
      return .unknown
    }
  }
}

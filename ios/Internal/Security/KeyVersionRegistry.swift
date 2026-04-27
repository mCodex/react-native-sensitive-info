import Foundation

/// Tracks the active master-key version for each service on Apple platforms.
///
/// Backed by `UserDefaults` with a dedicated key namespace. The version counter itself is not
/// sensitive — what matters is that the Keychain-stored metadata records which version produced
/// each ciphertext so we can detect (and lazily re-write) stale entries after a rotation.
final class KeyVersionRegistry {
  static let initialVersion: Int = 1

  private let defaults: UserDefaults
  private let prefix = "rnsi.keyVersion."

  init(defaults: UserDefaults = .standard) {
    self.defaults = defaults
  }

  func get(service: String) -> Int {
    let stored = defaults.integer(forKey: key(for: service))
    return stored > 0 ? stored : Self.initialVersion
  }

  @discardableResult
  func bump(service: String) -> Int {
    let next = get(service: service) + 1
    defaults.set(next, forKey: key(for: service))
    return next
  }

  private func key(for service: String) -> String { prefix + service }
}

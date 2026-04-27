import CryptoKit
import Foundation
import Security

/// Computes and verifies an HMAC-SHA256 tag bound to each Keychain entry's `(service, account,
/// keyVersion, accessControl, securityLevel, timestamp, value)` tuple. The Keychain already binds
/// the value to the device, but the metadata blob in `kSecAttrGeneric` is mutable by anyone with
/// Keychain write access, so we cross-check it on every read.
///
/// The HMAC key itself is stored as a separate Keychain item under
/// `<service>.rnsi.hmac` / `metadata` with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.
/// It is generated lazily the first time a service is used and persists for the lifetime of the
/// app installation. Rotating the master key does NOT rotate the HMAC key — they are independent
/// concerns.
struct MetadataIntegrity {
  enum IntegrityError: Error {
    case keyUnavailable(service: String)
  }

  struct Input {
    let service: String
    let account: String
    let keyVersion: Int
    let accessControl: String
    let securityLevel: String
    let timestamp: Double
    let value: Data
  }

  /// Process-local cache so we don't pay a Keychain round-trip on every read. Guarded by a
  /// non-recursive lock — first-touch creation is rare, callers must not re-enter `getOrCreateKey`.
  private static let cacheLock = NSLock()
  private static var keyCache: [String: SymmetricKey] = [:]

  func sign(_ input: Input) throws -> String {
    let key = try getOrCreateKey(service: input.service)
    let signature = HMAC<SHA256>.authenticationCode(for: canonicalPayload(input), using: key)
    return Data(signature).base64EncodedString()
  }

  /// Returns true if `expectedTag` matches a freshly computed tag, or if `expectedTag` is nil
  /// (treated as a legacy entry). Comparison runs in constant time.
  func verify(_ input: Input, expectedTag: String?) throws -> Bool {
    guard let expectedTag, let expected = Data(base64Encoded: expectedTag) else {
      return expectedTag == nil
    }
    let key = try getOrCreateKey(service: input.service)
    let actual = Data(HMAC<SHA256>.authenticationCode(for: canonicalPayload(input), using: key))
    return constantTimeEqual(actual, expected)
  }

  // MARK: - Private

  private func canonicalPayload(_ input: Input) -> Data {
    var data = Data()
    appendField(&data, input.service)
    appendField(&data, input.account)
    appendField(&data, "v\(input.keyVersion)")
    appendField(&data, input.accessControl)
    appendField(&data, input.securityLevel)
    appendField(&data, String(input.timestamp.bitPattern))
    data.append(0x1f)
    data.append(input.value)
    return data
  }

  private func appendField(_ data: inout Data, _ value: String) {
    data.append(Data(value.utf8))
    data.append(0x1f)
  }

  private func constantTimeEqual(_ lhs: Data, _ rhs: Data) -> Bool {
    guard lhs.count == rhs.count else { return false }
    var diff: UInt8 = 0
    for index in 0..<lhs.count {
      diff |= lhs[index] ^ rhs[index]
    }
    return diff == 0
  }

  private func getOrCreateKey(service: String) throws -> SymmetricKey {
    Self.cacheLock.lock()
    defer { Self.cacheLock.unlock() }

    if let cached = Self.keyCache[service] {
      return cached
    }

    let key = try fetchOrGenerateKey(service: service)
    Self.keyCache[service] = key
    return key
  }

  private func fetchOrGenerateKey(service: String) throws -> SymmetricKey {
    let hmacService = "\(service).rnsi.hmac"
    let baseQuery: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: hmacService,
      kSecAttrAccount as String: "metadata"
    ]

    var fetchQuery = baseQuery
    fetchQuery[kSecReturnData as String] = kCFBooleanTrue as Any
    fetchQuery[kSecMatchLimit as String] = kSecMatchLimitOne

    var result: CFTypeRef?
    let status = SecItemCopyMatching(fetchQuery as CFDictionary, &result)
    if status == errSecSuccess, let data = result as? Data {
      return SymmetricKey(data: data)
    }

    var rawKey = Data(count: 32)
    let genStatus = rawKey.withUnsafeMutableBytes { buffer -> Int32 in
      SecRandomCopyBytes(kSecRandomDefault, buffer.count, buffer.baseAddress!)
    }
    guard genStatus == errSecSuccess else {
      throw IntegrityError.keyUnavailable(service: service)
    }

    var addAttributes = baseQuery
    addAttributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    addAttributes[kSecValueData as String] = rawKey
    let addStatus = SecItemAdd(addAttributes as CFDictionary, nil)

    if addStatus == errSecDuplicateItem {
      // Cross-process race: another writer added the key between our lookup and add.
      // Re-fetch the canonical stored key so HMACs stay consistent across producers.
      zeroize(&rawKey)
      var raceResult: CFTypeRef?
      let raceStatus = SecItemCopyMatching(fetchQuery as CFDictionary, &raceResult)
      if raceStatus == errSecSuccess, let data = raceResult as? Data {
        return SymmetricKey(data: data)
      }
      throw IntegrityError.keyUnavailable(service: service)
    }

    let key = SymmetricKey(data: rawKey)
    zeroize(&rawKey)

    if addStatus != errSecSuccess {
      throw IntegrityError.keyUnavailable(service: service)
    }
    return key
  }

  private func zeroize(_ data: inout Data) {
    data.resetBytes(in: 0..<data.count)
  }
}

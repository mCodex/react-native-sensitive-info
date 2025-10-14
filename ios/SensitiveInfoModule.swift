import Foundation
import Security
import React
import os.log
#if canImport(LocalAuthentication)
import LocalAuthentication
#endif

private let keychainQueueLabel = "com.sensitiveinfo.keychain"

/// React Native bridge for the secure storage module.
/// The implementation keeps the public JS API stable while upgrading the underlying security posture.
@objc(SensitiveInfo)
final class SensitiveInfo: NSObject, RCTBridgeModule {
  static func moduleName() -> String! { "SensitiveInfo" }
  static func requiresMainQueueSetup() -> Bool { false }

  private let queue = DispatchQueue(label: keychainQueueLabel, qos: .userInitiated)
  private let migrator = KeychainMigrator()
  private var invalidateBiometricEnrollment = true
  private let log = OSLog(subsystem: "react-native-sensitive-info", category: "SensitiveInfo")

  #if !os(tvOS)
  private var activeContext: LAContext?
  #endif

  @objc
  func constantsToExport() -> [AnyHashable: Any]! {
    [:]
  }

  @objc
  func getConstants() -> [AnyHashable: Any]! {
    constantsToExport()
  }

  // MARK: - Public API

  /// Stores or updates a secret. Duplicate keys are rewritten using the stronger defaults.
  @objc
  func setItem(_ key: String,
               value: String,
               options: NSDictionary,
               resolver resolve: @escaping RCTPromiseResolveBlock,
               rejecter reject: @escaping RCTPromiseRejectBlock) {
    let parsed = KeychainOptions(dictionary: options, invalidateBiometricEnrollment: invalidateBiometricEnrollment)

    queue.async {
      var baseQuery = KeychainQueryBuilder.baseQuery(for: key, options: parsed)
      guard let valueData = value.data(using: .utf8) else {
  self.rejectPromise("E_ENCODING", "Unable to encode value using UTF-8.", reject: reject)
        return
      }

      do {
        var addQuery = baseQuery
        addQuery[kSecValueData as String] = valueData
        try KeychainProtection.apply(to: &addQuery, options: parsed)

        let status = SecItemAdd(addQuery as CFDictionary, nil)
        if status == errSecSuccess {
          resolve(nil)
          return
        }

        if status == errSecDuplicateItem {
          do {
            let attributes = try self.attributesForUpdate(valueData: valueData, options: parsed)
            let updateStatus = SecItemUpdate(baseQuery as CFDictionary, attributes as CFDictionary)
            if updateStatus == errSecSuccess {
              resolve(nil)
              return
            }
            self.rejectKeychainStatus(updateStatus, reject: reject)
          } catch {
            let nsError = error as NSError
            self.rejectPromise("E_SEC_ACCESS", nsError.localizedDescription, error: nsError, reject: reject)
          }
          return
        }

        self.rejectKeychainStatus(status, reject: reject)
      } catch {
        let nsError = error as NSError
        self.rejectPromise("E_SEC_ACCESS", nsError.localizedDescription, error: nsError, reject: reject)
      }
    }
  }

  /// Reads a secret. When legacy accessibility flags are encountered we silently upgrade them.
  @objc
  func getItem(_ key: String,
               options: NSDictionary,
               resolver resolve: @escaping RCTPromiseResolveBlock,
               rejecter reject: @escaping RCTPromiseRejectBlock) {
    let parsed = KeychainOptions(dictionary: options, invalidateBiometricEnrollment: invalidateBiometricEnrollment)
    let baseQuery = KeychainQueryBuilder.baseQuery(for: key, options: parsed)
    var lookupQuery = KeychainQueryBuilder.lookupQuery(from: baseQuery, options: parsed)

    queue.async {
      if !parsed.touchID {
        self.fetchItem(query: lookupQuery, baseQuery: baseQuery, options: parsed, resolve: resolve, reject: reject)
        return
      }

      #if os(tvOS)
    self.rejectPromise("E_UNAVAILABLE", "Biometric authentication is not available on tvOS.", reject: reject)
      #else
      let context = LAContext()
      context.localizedFallbackTitle = parsed.localizedFallbackTitle ?? ""
      context.touchIDAuthenticationAllowableReuseDuration = 1
      lookupQuery[kSecUseAuthenticationContext as String] = context

      let prompt = parsed.operationPrompt ?? "Authenticate to access sensitive information"
      let policy = parsed.policy

      DispatchQueue.main.async {
        self.activeContext = context
        context.evaluatePolicy(policy, localizedReason: prompt) { success, error in
          self.activeContext = nil
          if !success {
            if let error = error as NSError? {
              self.rejectPromise("\(error.code)", error.localizedDescription, error: error, reject: reject)
            } else {
              self.rejectPromise("E_AUTH_FAILED", "Biometric authentication failed.", reject: reject)
            }
            return
          }

          self.queue.async {
            self.fetchItem(query: lookupQuery, baseQuery: baseQuery, options: parsed, resolve: resolve, reject: reject)
          }
        }
      }
      #endif
    }
  }

  @objc
  func hasItem(_ key: String,
               options: NSDictionary,
               resolver resolve: @escaping RCTPromiseResolveBlock,
               rejecter reject: @escaping RCTPromiseRejectBlock) {
    let parsed = KeychainOptions(dictionary: options, invalidateBiometricEnrollment: invalidateBiometricEnrollment)
    queue.async {
      let query = KeychainQueryBuilder.existsQuery(for: key, options: parsed)
      let status = SecItemCopyMatching(query as CFDictionary, nil)
      switch status {
      case errSecSuccess:
        resolve(true)
      case errSecItemNotFound:
        resolve(false)
      default:
        self.rejectKeychainStatus(status, reject: reject)
      }
    }
  }

  /// Returns all stored items for the requested service. Useful for migrations.
  @objc
  func getAllItems(_ options: NSDictionary,
                   resolver resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    let parsed = KeychainOptions(dictionary: options, invalidateBiometricEnrollment: invalidateBiometricEnrollment)
    queue.async {
      var aggregated: [[String: String]] = []
      for secClass in KeychainQueryBuilder.secItemClasses {
        var query = KeychainQueryBuilder.allItemsQuery(options: parsed)
        query[kSecClass as String] = secClass

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let array = result as? [[String: Any]] else {
          continue
        }

        for item in array {
          guard
            let key = item[kSecAttrAccount as String] as? String,
            let data = item[kSecValueData as String] as? Data,
            let value = String(data: data, encoding: .utf8)
          else { continue }

          let service = (item[kSecAttrService as String] as? String) ?? parsed.service
          aggregated.append(["key": key, "value": value, "service": service])
        }
      }

      resolve(aggregated)
    }
  }

  @objc
  func deleteItem(_ key: String,
                  options: NSDictionary,
                  resolver resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    let parsed = KeychainOptions(dictionary: options, invalidateBiometricEnrollment: invalidateBiometricEnrollment)
    queue.async {
      let query = KeychainQueryBuilder.baseQuery(for: key, options: parsed)
      let status = SecItemDelete(query as CFDictionary)
      if status == errSecSuccess || status == errSecItemNotFound {
        resolve(nil)
        return
      }
      self.rejectKeychainStatus(status, reject: reject)
    }
  }

  @objc
  func isSensorAvailable(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    #if os(tvOS)
    resolve(false)
    #else
    let context = LAContext()
    var error: NSError?
    if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
      if #available(iOS 11.0, *), context.biometryType == .faceID {
        resolve("Face ID")
        return
      }
      resolve("Touch ID")
      return
    }

    if let error = error, error.code == LAError.biometryLockout.rawValue {
  self.rejectPromise("E_BIOMETRY_LOCKED", "Biometry is locked", error: error, reject: reject)
      return
    }

    resolve(false)
    #endif
  }

  @objc
  func hasEnrolledFingerprints(_ resolve: @escaping RCTPromiseResolveBlock,
                               rejecter reject: @escaping RCTPromiseRejectBlock) {
    #if os(tvOS)
    resolve(false)
    #else
    let context = LAContext()
    var error: NSError?
    let canEvaluate = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    if canEvaluate {
      resolve(true)
      return
    }

    guard let error = error else {
      resolve(false)
      return
    }

    switch LAError.Code(rawValue: error.code) {
    case .biometryNotEnrolled, .biometryNotAvailable:
      resolve(false)
    case .biometryLockout:
  self.rejectPromise("E_BIOMETRY_LOCKED", "Biometry is locked", error: error, reject: reject)
    default:
      resolve(false)
    }
    #endif
  }

  @objc
  func cancelFingerprintAuth() {
    #if !os(tvOS)
    queue.async {
      self.activeContext?.invalidate()
      self.activeContext = nil
    }
    #endif
  }

  @objc
  func setInvalidatedByBiometricEnrollment(_ value: Bool) {
    invalidateBiometricEnrollment = value
  }

  // MARK: - Helpers

  /// Reads from the Keychain and performs opportunistic migrations when legacy attributes are detected.
  private func fetchItem(query: [String: Any],
                         baseQuery: [String: Any],
                         options: KeychainOptions,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)

    if status == errSecItemNotFound {
      resolve(nil)
      return
    }

    guard status == errSecSuccess, let item = result as? [String: Any] else {
      rejectKeychainStatus(status, reject: reject)
      return
    }

    guard let data = item[kSecValueData as String] as? Data else {
      resolve(nil)
      return
    }

    guard let value = String(data: data, encoding: .utf8) else {
  self.rejectPromise("E_DECODING", "Unable to decode stored value using UTF-8.", reject: reject)
      return
    }

    if migrator.needsMigration(item: item, options: options) {
      migrator.migrate(baseQuery: baseQuery, options: options)
    }

    resolve(value)
  }

  /// Builds the attribute dictionary used when rewriting an existing Keychain entry.
  private func attributesForUpdate(valueData: Data, options: KeychainOptions) throws -> [String: Any] {
    var attributes: [String: Any] = [kSecValueData as String: valueData]
    #if !os(tvOS)
    if options.touchID {
      let accessControl = try KeychainProtection.makeAccessControl(options: options)
      attributes[kSecAttrAccessControl as String] = accessControl
      attributes.removeValue(forKey: kSecAttrAccessible as String)
      return attributes
    }
    #endif
    attributes[kSecAttrAccessible as String] = options.effectiveAccessible.cfValue
    return attributes
  }

  private func rejectKeychainStatus(_ status: OSStatus, reject: @escaping RCTPromiseRejectBlock) {
    let error = NSError(domain: NSOSStatusErrorDomain, code: Int(status), userInfo: nil)
    self.rejectPromise("\(status)", KeychainMessages.message(for: error), error: error, reject: reject)
  }

  /// Logs the failure before propagating it to JavaScript.
  private func rejectPromise(
    _ code: String,
    _ message: String,
    error: NSError? = nil,
    reject: RCTPromiseRejectBlock
  ) {
    if let error = error {
      os_log("[react-native-sensitive-info] %@ (%@): %@", log: log, type: .error, message, code, error.localizedDescription)
    } else {
      os_log("[react-native-sensitive-info] %@ (%@)", log: log, type: .error, message, code)
    }
    reject(code, message, error)
  }
}

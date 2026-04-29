import Foundation
import LocalAuthentication
import NitroModules
import Security

private struct ResolvedAccessControl {
  let accessControl: AccessControl
  let securityLevel: SecurityLevel
  let accessible: CFString
  let accessControlRef: SecAccessControl?
}

/// Apple platforms implementation of the SensitiveInfo Nitro module.
///
/// Consumers interact with the generated JS API:
/// ```ts
/// import { setItem } from 'react-native-sensitive-info'
/// await setItem('session-token', 'secret', { accessControl: 'secureEnclaveBiometry' })
/// ```
///
/// The Swift bridge runs keychain queries on a dedicated queue, encodes consistent metadata, and
/// returns results that mirror the TypeScript types shipped in the package across iOS, macOS,
/// visionOS, and watchOS.
public final class HybridSensitiveInfo: HybridSensitiveInfoSpec {
  private let workQueue = DispatchQueue(label: "com.mcodex.sensitiveinfo.keychain", qos: .userInitiated)
  private let encoder: JSONEncoder = {
    let encoder = JSONEncoder()
    encoder.outputFormatting = []
    return encoder
  }()
  private let decoder = JSONDecoder()
  private let defaultService = Bundle.main.bundleIdentifier ?? "default"
  private let availabilityResolver = SecurityAvailabilityResolver()
  private let keyVersionRegistry = KeyVersionRegistry()
  private let integrity = MetadataIntegrity()
  private lazy var accessControlResolver = AccessControlResolver { [weak self] in
    guard let self else {
      return (secureEnclave: false, strongBox: false, biometry: false, deviceCredential: false)
    }
    let availability = self.resolveAvailability()
    return (
      secureEnclave: availability.secureEnclave,
      strongBox: availability.strongBox,
      biometry: availability.biometry,
      deviceCredential: availability.deviceCredential
    )
  }

  /// Stores or replaces an item in the Keychain, returning metadata describing the applied
  /// security policy. If the requested hardware policy is unavailable (for example, simulators with
  /// no passcode), we fall back to a software-only accessibility to keep the call successful.
  public func setItem(request: SensitiveInfoSetRequest) throws -> Promise<MutationResult> {
    Promise.parallel(workQueue) { [self] in
      let service = normalizedService(request.service)
      let resolved = try resolveAccessControl(preferred: request.accessControl)
      let keyVersion = keyVersionRegistry.get(service: service)

      let timestamp = Date().timeIntervalSince1970
      var valueData = Data(request.value.utf8)
      defer { zeroize(&valueData) }

      let tag = try integrity.sign(
        integrityInput(
          service: service,
          account: request.key,
          keyVersion: keyVersion,
          accessControl: resolved.accessControl,
          securityLevel: resolved.securityLevel,
          timestamp: timestamp,
          value: valueData
        )
      )

      let metadata = buildMetadata(
        securityLevel: resolved.securityLevel,
        accessControl: resolved.accessControl,
        keyVersion: keyVersion,
        timestamp: timestamp,
        integrityTag: tag
      )

      let query = makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable,
        accessGroup: request.keychainGroup
      )

      var attributes = query
      attributes[kSecValueData as String] = valueData
      if let accessControlRef = resolved.accessControlRef {
        attributes[kSecAttrAccessControl as String] = accessControlRef
      } else {
        attributes[kSecAttrAccessible as String] = resolved.accessible
      }
      attributes[kSecAttrGeneric as String] = try encoder.encode(
        PersistedMetadata(metadata: metadata, integrityTag: tag)
      )

      var status = upsertKeychainEntry(baseQuery: query, attributes: attributes)
      if status == errSecSuccess {
        return MutationResult(metadata: metadata)
      }

      if status == errSecParam, resolved.accessControlRef != nil {
        let fallbackTag = try integrity.sign(
          integrityInput(
            service: service,
            account: request.key,
            keyVersion: keyVersion,
            accessControl: .none,
            securityLevel: .software,
            timestamp: timestamp,
            value: valueData
          )
        )
        let fallbackMetadata = buildMetadata(
          securityLevel: .software,
          accessControl: .none,
          keyVersion: keyVersion,
          timestamp: timestamp,
          integrityTag: fallbackTag
        )

        var fallbackAttributes = query
        fallbackAttributes[kSecValueData as String] = valueData
        fallbackAttributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        fallbackAttributes[kSecAttrGeneric as String] = try encoder.encode(
          PersistedMetadata(metadata: fallbackMetadata, integrityTag: fallbackTag)
        )

        status = upsertKeychainEntry(baseQuery: query, attributes: fallbackAttributes)
        if status == errSecSuccess {
          return MutationResult(metadata: fallbackMetadata)
        }
      }

      throw runtimeError(for: status, operation: "set")
    }
  }

  /// Fetches a single item and optionally includes the plaintext value if the client requested it.
  public func getItem(request: SensitiveInfoGetRequest) throws -> Promise<Variant_NullType_SensitiveInfoItem> {
    Promise.parallel(workQueue) { [self] in
      let service = normalizedService(request.service)
      let includeValue = request.includeValue ?? true

      var query = makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable,
        accessGroup: request.keychainGroup
      )
      query[kSecMatchLimit as String] = kSecMatchLimitOne
      query[kSecReturnAttributes as String] = kCFBooleanTrue
      if includeValue {
        query[kSecReturnData as String] = kCFBooleanTrue
      }

      guard let raw = try copyMatching(
        query: query,
        prompt: includeValue ? request.authenticationPrompt : nil,
        allowAuthentication: includeValue
      ) as? NSDictionary else {
        return Variant_NullType_SensitiveInfoItem.first(NullType.null)
      }

      var item = try makeItem(from: raw, includeValue: includeValue)
      if let upgraded = reEncryptIfStale(item: item, request: request) {
        item = upgraded
      }
      return Variant_NullType_SensitiveInfoItem.second(item)
    }
  }

  /// Removes a specific key/service pair from the Keychain.
  public func deleteItem(request: SensitiveInfoDeleteRequest) throws -> Promise<Bool> {
    Promise.parallel(workQueue) { [self] in
      let service = normalizedService(request.service)
      let query = makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable,
        accessGroup: request.keychainGroup
      )

      let status = SecItemDelete(query as CFDictionary)
      switch status {
      case errSecSuccess:
        return true
      case errSecItemNotFound:
        return false
      default:
        throw runtimeError(for: status, operation: "delete")
      }
    }
  }

  /// Checks for existence without allocating an item payload.
  public func hasItem(request: SensitiveInfoHasRequest) throws -> Promise<Bool> {
    Promise.parallel(workQueue) { [self] in
      let service = normalizedService(request.service)
      let query = makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable,
        accessGroup: request.keychainGroup
      )

      return try itemExists(query: query)
    }
  }

  /// Enumerates every item matching the provided service and inclusion options.
  ///
  /// ```ts
  /// const items = await SensitiveInfo.getAllItems({ service: 'vault', includeValues: true })
  /// ```
  public func getAllItems(request: SensitiveInfoEnumerateRequest?) throws -> Promise<[SensitiveInfoItem]> {
    Promise.parallel(workQueue) { [self] in
      let includeValues = request?.includeValues ?? false
      let service = normalizedService(request?.service)

      var query = makeBaseQuery(
        key: nil,
        service: service,
        synchronizable: request?.iosSynchronizable,
        accessGroup: request?.keychainGroup
      )
      query[kSecMatchLimit as String] = kSecMatchLimitAll
      query[kSecReturnAttributes as String] = kCFBooleanTrue
      if includeValues {
        query[kSecReturnData as String] = kCFBooleanTrue
      }

      let result = try copyMatching(
        query: query,
        prompt: includeValues ? request?.authenticationPrompt : nil,
        allowAuthentication: includeValues
      )
      guard let array = result as? [NSDictionary] else {
        return []
      }

      return try array.compactMap { dict in
        try makeItem(from: dict, includeValue: includeValues)
      }
    }
  }

  /// Deletes all items for the requested service.
  public func clearService(request: SensitiveInfoOptions?) throws -> Promise<Void> {
    Promise.parallel(workQueue) { [self] in
      let service = normalizedService(request?.service)
      let query = makeBaseQuery(
        key: nil,
        service: service,
        synchronizable: request?.iosSynchronizable,
        accessGroup: request?.keychainGroup
      )

      let status = SecItemDelete(query as CFDictionary)
      switch status {
      case errSecSuccess, errSecItemNotFound:
        return ()
      default:
        throw runtimeError(for: status, operation: "clearService")
      }
    }
  }

  public func getSupportedSecurityLevels() throws -> Promise<SecurityAvailability> {
    Promise.resolved(withResult: resolveAvailability())
  }

  public func rotateKeys(request: RotateKeysRequest?) throws -> Promise<RotationResult> {
    Promise.parallel(workQueue) { [self] in
      let service = normalizedService(request?.service)
      let previous = keyVersionRegistry.get(service: service)
      let next = keyVersionRegistry.bump(service: service)

      var reEncrypted = 0
      if request?.reEncryptEagerly == true {
        reEncrypted = reEncryptAll(
          service: service,
          request: request,
          targetVersion: next
        )
      }

      return RotationResult(
        previousVersion: Double(previous),
        newVersion: Double(next),
        reEncryptedCount: Double(reEncrypted)
      )
    }
  }

  public func getKeyVersion(request: SensitiveInfoOptions?) throws -> Promise<Double> {
    let service = normalizedService(request?.service)
    return Promise.resolved(withResult: Double(keyVersionRegistry.get(service: service)))
  }

  // MARK: - Keychain helpers

  private func makeBaseQuery(
    key: String?,
    service: String,
    synchronizable: Bool?,
    accessGroup: String?
  ) -> [String: Any] {
    var query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service
    ]

    if let account = key {
      query[kSecAttrAccount as String] = account
    }

    if synchronizable == true {
      query[kSecAttrSynchronizable as String] = kCFBooleanTrue
    }

    if let group = accessGroup {
      query[kSecAttrAccessGroup as String] = group
    }

    return query
  }

  /// Persists `attributes` for the slot identified by `baseQuery`, replacing
  /// any prior entry — including an iCloud-synced sibling that the caller may
  /// not currently be writing.
  ///
  /// Why a dedicated helper instead of a plain `SecItemAdd`?
  /// 1. Keychain queries default to *non-synchronizable items only* when
  ///    `kSecAttrSynchronizable` is omitted. A delete-then-add cycle that uses
  ///    only the caller's `iosSynchronizable` flag can leave a stale entry in
  ///    the opposite state, so the next `SecItemAdd` returns
  ///    `errSecDuplicateItem`. We always force-delete with
  ///    `kSecAttrSynchronizableAny` to avoid that trap.
  /// 2. iCloud Keychain sync can re-insert an entry between our delete and our
  ///    add. We absorb that race with a single bounded retry — `setItem`
  ///    semantically means *"the slot now contains X"*, and the Keychain
  ///    partition is already scoped to bundle ID + access group, so any
  ///    matched entry is provably ours to overwrite.
  private func upsertKeychainEntry(
    baseQuery: [String: Any],
    attributes: [String: Any]
  ) -> OSStatus {
    forceDeleteExisting(query: baseQuery)
    var status = SecItemAdd(attributes as CFDictionary, nil)
    guard status == errSecDuplicateItem else { return status }

    // Race: another process (typically iCloud sync) restored the item between
    // our delete and add. One bounded retry — Keychain calls on this queue are
    // synchronous, so we cannot loop indefinitely.
    forceDeleteExisting(query: baseQuery)
    status = SecItemAdd(attributes as CFDictionary, nil)
    return status
  }

  private func forceDeleteExisting(query: [String: Any]) {
    var deleteQuery = query
    deleteQuery[kSecReturnData as String] = nil
    deleteQuery[kSecReturnAttributes as String] = nil
    // `kSecAttrSynchronizableAny` matches both local-only and iCloud-synced
    // entries; without it the delete would silently miss the opposite-state
    // sibling. `SecItemDelete` ignores `kSecMatchLimit` and removes every
    // matching entry, which is exactly what we want for an upsert.
    deleteQuery[kSecAttrSynchronizable as String] = kSecAttrSynchronizableAny
    SecItemDelete(deleteQuery as CFDictionary)
  }

  private func copyMatching(
    query: [String: Any],
    prompt: AuthenticationPrompt?,
    allowAuthentication: Bool = true
  ) throws -> AnyObject? {
#if targetEnvironment(simulator)
    if allowAuthentication {
      try performSimulatorBiometricPromptIfNeeded(prompt: prompt)
    }
#endif
    var workingQuery = query
    if !allowAuthentication {
      workingQuery[kSecUseAuthenticationUI as String] = kSecUseAuthenticationUIFail
    } else if let prompt {
      workingQuery[kSecUseOperationPrompt as String] = prompt.title
      workingQuery[kSecUseAuthenticationContext as String] = makeLAContext(prompt: prompt)
    }

    var result: CFTypeRef?
    var status = performCopyMatching(workingQuery as CFDictionary, result: &result)

    if allowAuthentication && prompt == nil && (status == errSecInteractionNotAllowed || status == errSecAuthFailed) {
      var authQuery = workingQuery
      authQuery[kSecUseOperationPrompt as String] = "Authenticate to access sensitive data"
      authQuery[kSecUseAuthenticationContext as String] = makeLAContext(prompt: nil)
      status = performCopyMatching(authQuery as CFDictionary, result: &result)
    }

    switch status {
    case errSecSuccess:
      return result as AnyObject?
    case errSecItemNotFound:
      return nil
    case errSecInteractionNotAllowed, errSecAuthFailed:
      throw runtimeError(for: status, operation: "fetch")
    default:
      throw runtimeError(for: status, operation: "fetch")
    }
  }

  private func itemExists(query: [String: Any]) throws -> Bool {
    var existenceQuery = query
    existenceQuery[kSecMatchLimit as String] = kSecMatchLimitOne
    existenceQuery[kSecReturnData as String] = kCFBooleanFalse
    existenceQuery[kSecReturnAttributes as String] = kCFBooleanFalse
    existenceQuery[kSecUseAuthenticationUI as String] = kSecUseAuthenticationUIFail

    var result: CFTypeRef?
    let status = performCopyMatching(existenceQuery as CFDictionary, result: &result)

    switch status {
    case errSecSuccess:
      return true
    case errSecItemNotFound:
      return false
    case errSecInteractionNotAllowed, errSecAuthFailed:
      return true
    default:
      throw runtimeError(for: status, operation: "existence check")
    }
  }

  private func makeItem(from dictionary: NSDictionary, includeValue: Bool) throws -> SensitiveInfoItem {
    guard
      let key = dictionary[kSecAttrAccount as String] as? String,
      let service = dictionary[kSecAttrService as String] as? String
    else {
      throw RuntimeError.error(withMessage: "Unexpected keychain payload shape")
    }

    let metadata = decodeMetadata(from: dictionary) ?? fallbackMetadata()

    var value: String?
    if includeValue {
      if var data = dictionary[kSecValueData as String] as? Data {
        defer { zeroize(&data) }

        // Verify metadata integrity before exposing the plaintext. Legacy entries (no tag) are
        // accepted; a future write or rotation will stamp them on disk.
        if let tag = metadata.integrityTag {
          let keyVersion = metadata.keyVersion.map { Int($0) } ?? KeyVersionRegistry.initialVersion
          let ok = (try? integrity.verify(
            integrityInput(
              service: service,
              account: key,
              keyVersion: keyVersion,
              accessControl: metadata.accessControl,
              securityLevel: metadata.securityLevel,
              timestamp: metadata.timestamp,
              value: data
            ),
            expectedTag: tag
          )) ?? false
          if !ok {
            throw RuntimeError.error(
              withMessage: "[E_INTEGRITY_VIOLATION] Tampering detected for key \"\(key)\" in service \"\(service)\"."
            )
          }
        }

        value = String(data: data, encoding: .utf8)
      }
    }

    return SensitiveInfoItem(key: key, service: service, value: value, metadata: metadata)
  }

  // MARK: - Key rotation helpers

  private func buildMetadata(
    securityLevel: SecurityLevel,
    accessControl: AccessControl,
    keyVersion: Int,
    timestamp: Double = Date().timeIntervalSince1970,
    integrityTag: String? = nil
  ) -> StorageMetadata {
    StorageMetadata(
      securityLevel: securityLevel,
      backend: .keychain,
      accessControl: accessControl,
      timestamp: timestamp,
      keyVersion: Double(keyVersion),
      integrityTag: integrityTag
    )
  }

  private func fallbackMetadata(keyVersion: Int = KeyVersionRegistry.initialVersion) -> StorageMetadata {
    buildMetadata(securityLevel: .software, accessControl: .none, keyVersion: keyVersion)
  }

  private func reEncryptIfStale(
    item: SensitiveInfoItem,
    request: SensitiveInfoGetRequest
  ) -> SensitiveInfoItem? {
    let activeVersion = keyVersionRegistry.get(service: item.service)
    let currentVersion = item.metadata.keyVersion.map { Int($0) } ?? 0
    if currentVersion >= activeVersion { return nil }

    // Skip lazy re-encryption for biometry-protected entries. `SecItemUpdate`
    // against a biometric Keychain item triggers a *second* Face ID / Touch ID
    // prompt to authorize the mutation — even when we only intend to refresh
    // the metadata blob. The user already authenticated for the read; queueing
    // another prompt would be confusing and would also break flows where the
    // caller renders UI between read and the next user gesture.
    //
    // These items are still upgraded by:
    //   - the next explicit `setItem` (a full overwrite the caller initiates), or
    //   - `rotateKeys({ reEncryptEagerly: true })`, where the rotation prompt is
    //     expected by the caller.
    if isBiometricallyProtected(item.metadata.accessControl) { return nil }

    let refreshedMetadata = buildMetadata(
      securityLevel: item.metadata.securityLevel,
      accessControl: item.metadata.accessControl,
      keyVersion: activeVersion
    )
    guard (try? refreshMetadata(
      key: item.key,
      service: item.service,
      metadata: refreshedMetadata,
      synchronizable: request.iosSynchronizable,
      accessGroup: request.keychainGroup
    )) == true else { return nil }

    return SensitiveInfoItem(
      key: item.key,
      service: item.service,
      value: item.value,
      metadata: refreshedMetadata
    )
  }

  /// True for the access-control policies whose Keychain entries require a
  /// biometric (or device-credential fallback) evaluation on every mutation.
  /// `devicePasscode` and `none` writes can be refreshed silently.
  private func isBiometricallyProtected(_ policy: AccessControl) -> Bool {
    switch policy {
    case .secureenclavebiometry, .biometrycurrentset, .biometryany:
      return true
    case .devicepasscode, .none:
      return false
    }
  }

  private func reEncryptAll(
    service: String,
    request: RotateKeysRequest?,
    targetVersion: Int
  ) -> Int {
    var query = makeBaseQuery(
      key: nil,
      service: service,
      synchronizable: request?.iosSynchronizable,
      accessGroup: request?.keychainGroup
    )
    query[kSecMatchLimit as String] = kSecMatchLimitAll
    query[kSecReturnAttributes as String] = kCFBooleanTrue

    let result = (try? copyMatching(query: query, prompt: request?.authenticationPrompt)) ?? nil
    guard let array = result as? [NSDictionary] else { return 0 }

    var count = 0
    for dictionary in array {
      guard let key = dictionary[kSecAttrAccount as String] as? String else { continue }
      let currentMetadata = decodeMetadata(from: dictionary) ?? fallbackMetadata()
      let currentVersion = currentMetadata.keyVersion.map { Int($0) } ?? 0
      if currentVersion >= targetVersion { continue }

      let refreshedMetadata = buildMetadata(
        securityLevel: currentMetadata.securityLevel,
        accessControl: currentMetadata.accessControl,
        keyVersion: targetVersion
      )
      let ok = (try? refreshMetadata(
        key: key,
        service: service,
        metadata: refreshedMetadata,
        synchronizable: request?.iosSynchronizable,
        accessGroup: request?.keychainGroup
      )) ?? false
      if ok { count += 1 }
    }
    return count
  }

  /// Updates only the `kSecAttrGeneric` metadata blob for an existing Keychain item, preserving the
  /// original access-control and accessibility attributes set at creation time.
  private func refreshMetadata(
    key: String,
    service: String,
    metadata: StorageMetadata,
    synchronizable: Bool?,
    accessGroup: String?
  ) throws -> Bool {
    let query = makeBaseQuery(
      key: key,
      service: service,
      synchronizable: synchronizable,
      accessGroup: accessGroup
    )
    let attributes: [String: Any] = [
      kSecAttrGeneric as String: try encoder.encode(PersistedMetadata(metadata: metadata))
    ]
    let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    return status == errSecSuccess
  }

  private func decodeMetadata(from dictionary: NSDictionary) -> StorageMetadata? {
    guard let raw = dictionary[kSecAttrGeneric as String] as? Data else {
      return nil
    }

    do {
      let payload = try decoder.decode(PersistedMetadata.self, from: raw)
      return payload.toStorageMetadata()
    } catch {
      return nil
    }
  }

  // MARK: - Access control resolution

  /// Maps the JS access-control request to the closest policy supported by the current device.
  private func resolveAccessControl(preferred: AccessControl?) throws -> ResolvedAccessControl {
    let preferredPolicy = preferred.flatMap { AccessPolicy(rawValue: $0.stringValue) }
    let context = try accessControlResolver.resolve(preferred: preferredPolicy)
    let accessControl = AccessControl(fromString: context.policy.rawValue) ?? .none
    let securityLevel = SecurityLevel(fromString: context.securityLevel.rawValue) ?? .software

    return ResolvedAccessControl(
      accessControl: accessControl,
      securityLevel: securityLevel,
      accessible: context.accessible,
      accessControlRef: context.accessControlRef
    )
  }

  // MARK: - Availability

  private func resolveAvailability() -> SecurityAvailability {
    let capabilities = availabilityResolver.resolve()
    let status = BiometryStatus(fromString: capabilities.biometryStatus.rawValue) ?? .unknown
    return SecurityAvailability(
      secureEnclave: capabilities.secureEnclave,
      strongBox: capabilities.strongBox,
      biometry: capabilities.biometry,
      biometryStatus: status,
      deviceCredential: capabilities.deviceCredential
    )
  }

  // MARK: - Utilities

  /// Single source of truth for HMAC integrity inputs across set/get/rotate paths.
  private func integrityInput(
    service: String,
    account: String,
    keyVersion: Int,
    accessControl: AccessControl,
    securityLevel: SecurityLevel,
    timestamp: Double,
    value: Data
  ) -> MetadataIntegrity.Input {
    MetadataIntegrity.Input(
      service: service,
      account: account,
      keyVersion: keyVersion,
      accessControl: accessControl.stringValue,
      securityLevel: securityLevel.stringValue,
      timestamp: timestamp,
      value: value
    )
  }

  private func zeroize(_ data: inout Data) {
    data.resetBytes(in: 0..<data.count)
  }

  /// Mirrors Android's namespace resolution so metadata stays comparable across platforms.
  private func normalizedService(_ service: String?) -> String {
    service?.isEmpty == false ? service! : defaultService
  }

  private func makeLAContext(prompt: AuthenticationPrompt?) -> LAContext {
    let context = LAContext()
    if let cancel = prompt?.cancel {
      context.localizedCancelTitle = cancel
    }
    if let description = prompt?.description {
      context.localizedReason = description
    } else if let title = prompt?.title {
      context.localizedReason = title
    }
    if let subtitle = prompt?.subtitle {
      context.localizedFallbackTitle = subtitle
    }
    return context
  }

  private func runtimeError(for status: OSStatus, operation: String) -> RuntimeError {
    if isAuthenticationCanceled(status: status) {
      return RuntimeError.error(withMessage: "[E_AUTH_CANCELED] Authentication prompt canceled by the user.")
    }
    let message = SecCopyErrorMessageString(status, nil) as String? ?? "OSStatus(\(status))"
    return RuntimeError.error(withMessage: "Keychain \(operation) failed: \(message)")
  }

  private func isAuthenticationCanceled(status: OSStatus) -> Bool {
    switch status {
    case errSecUserCanceled:
      return true
    default:
      return false
    }
  }

  private func performCopyMatching(_ query: CFDictionary, result: inout CFTypeRef?) -> OSStatus {
    if Thread.isMainThread {
      return SecItemCopyMatching(query, &result)
    }

    var status: OSStatus = errSecSuccess
    DispatchQueue.main.sync {
      status = SecItemCopyMatching(query, &result)
    }
    return status
  }

#if targetEnvironment(simulator)
  private func performSimulatorBiometricPromptIfNeeded(prompt: AuthenticationPrompt?) throws {
    guard let prompt else { return }

    let context = makeLAContext(prompt: prompt)
    var error: NSError?

    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error),
          context.biometryType != .none else {
      return
    }

    let reason = prompt.description ?? prompt.title ?? "Authenticate to continue"
    let semaphore = DispatchSemaphore(value: 0)
    var evaluationError: Error?

    DispatchQueue.main.async {
      context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, policyError in
        if !success {
          evaluationError = policyError
        }
        semaphore.signal()
      }
    }

    semaphore.wait()

    if let evaluationError {
      if let laError = evaluationError as? LAError {
        switch laError.code {
        case .userCancel, .userFallback, .systemCancel:
          throw RuntimeError.error(withMessage: "[E_AUTH_CANCELED] Authentication prompt canceled by the user.")
        default:
          break
        }
      }

      throw RuntimeError.error(withMessage: "Keychain fetch failed: \(evaluationError.localizedDescription)")
    }
  }
#endif
}

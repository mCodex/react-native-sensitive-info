import Foundation
import Security
import LocalAuthentication
import SwiftUI

#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

// MARK: - Conditional imports and type definitions

#if canImport(NitroModules)
import NitroModules
#endif

// MARK: - Standalone Types (when NitroModules is not available)

#if !canImport(NitroModules)

/// Security levels for storage operations
public enum SecurityLevel: String, CaseIterable {
    case standard = "standard"
    case biometric = "biometric"
    case strongbox = "strongbox"
    
    public var displayName: String {
        switch self {
        case .standard:
            return "Standard Keychain"
        case .biometric:
            return "Biometric Protected"
        case .strongbox:
            return "Secure Enclave"
        }
    }
    
    @available(iOS 13.0, macOS 10.15, *)
    public var color: Color {
        switch self {
        case .standard:
            return .blue
        case .biometric:
            return .orange
        case .strongbox:
            return .green
        }
    }
}

/// Biometric authentication options
public struct BiometricOptions {
    public let promptTitle: String?
    public let promptSubtitle: String?
    public let promptDescription: String?
    public let cancelButtonText: String?
    public let allowDeviceCredential: Bool?
    
    public init(promptTitle: String? = nil, promptSubtitle: String? = nil, promptDescription: String? = nil, cancelButtonText: String? = nil, allowDeviceCredential: Bool? = nil) {
        self.promptTitle = promptTitle
        self.promptSubtitle = promptSubtitle
        self.promptDescription = promptDescription
        self.cancelButtonText = cancelButtonText
        self.allowDeviceCredential = allowDeviceCredential
    }
}

/// Storage options for operations
public struct StorageOptions {
    public let securityLevel: SecurityLevel?
    public let biometricOptions: BiometricOptions?
    
    public init(securityLevel: SecurityLevel? = nil, biometricOptions: BiometricOptions? = nil) {
        self.securityLevel = securityLevel
        self.biometricOptions = biometricOptions
    }
}

#else

// MARK: - Extensions for Nitro-generated types

extension SecurityLevel: CaseIterable {
    public static var allCases: [SecurityLevel] {
        return [.standard, .biometric, .strongbox]
    }
}

public extension SecurityLevel {
    var displayName: String {
        switch self {
        case .standard:
            return "Standard Keychain"
        case .biometric:
            return "Biometric Protected"
        case .strongbox:
            return "Secure Enclave"
        }
    }
    
    @available(iOS 13.0, macOS 10.15, *)
    var color: Color {
        switch self {
        case .standard:
            return .blue
        case .biometric:
            return .orange
        case .strongbox:
            return .green
        }
    }
}

#endif

// MARK: - Error types

/// Error types for SensitiveInfo operations
public enum SensitiveInfoError: Error, LocalizedError {
    case biometricAuthenticationFailed
    case keychainError(OSStatus)
    case invalidSecurityLevel
    case secureEnclaveNotAvailable
    case biometricNotAvailable
    case userCancel
    case invalidData
    case operationFailed(String)
    
    public var errorDescription: String? {
        switch self {
        case .biometricAuthenticationFailed:
            return "Biometric authentication failed"
        case .keychainError(let status):
            return "Keychain error: \(status)"
        case .invalidSecurityLevel:
            return "Invalid security level specified"
        case .secureEnclaveNotAvailable:
            return "Secure Enclave not available on this device"
        case .biometricNotAvailable:
            return "Biometric authentication not available"
        case .userCancel:
            return "Operation cancelled by user"
        case .invalidData:
            return "Invalid data format"
        case .operationFailed(let message):
            return "Operation failed: \(message)"
        }
    }
}

// MARK: - Main Implementation

#if os(iOS) || os(macOS)
@available(iOS 11.0, macOS 10.13, *)
public class SensitiveInfoImpl {
    
    // MARK: - Service Identifiers
    
    private let standardService = "react-native-sensitive-info-standard"
    private let biometricService = "react-native-sensitive-info-biometric"
    private let strongboxService = "react-native-sensitive-info-strongbox"
    
    // MARK: - Initialization
    
    public init() {}
    
    // MARK: - Security Level Detection
    
    /// Get the optimal security level based on device capabilities
    public func getOptimalSecurityLevel() -> SecurityLevel {
        if isSecureEnclaveAvailable() {
            return .strongbox
        } else if isBiometricCapable() {
            return .biometric
        } else {
            return .standard
        }
    }
    
    /// Check if Secure Enclave is available on this device
    public func isSecureEnclaveAvailable() -> Bool {
        #if os(iOS)
        if #available(iOS 9.0, *) {
            let context = LAContext()
            var error: NSError?
            
            guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
                return false
            }
            
            let accessControl = SecAccessControlCreateWithFlags(
                nil,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                [.privateKeyUsage, .biometryAny],
                nil
            )
            
            return accessControl != nil
        }
        return false
        #elseif os(macOS)
        let context = LAContext()
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        #else
        return false
        #endif
    }
    
    /// Check if biometric authentication is available
    public func isBiometricCapable() -> Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }
    
    // MARK: - Service Selection
    
    private func getService(for securityLevel: SecurityLevel?) -> String {
        let level = securityLevel ?? getOptimalSecurityLevel()
        
        switch level {
        case .biometric:
            return biometricService
        case .strongbox:
            return strongboxService
        case .standard:
            return standardService
        }
    }
    
    // MARK: - Keychain Query Construction
    
    private func getKeychainQuery(for key: String, service: String, securityLevel: SecurityLevel?) -> [String: Any] {
        let level = securityLevel ?? getOptimalSecurityLevel()
        
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        switch level {
        case .biometric:
            if let accessControl = SecAccessControlCreateWithFlags(
                nil,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                [.biometryAny],
                nil
            ) {
                query[kSecAttrAccessControl as String] = accessControl
            }
            
        case .strongbox:
            #if os(iOS)
            if #available(iOS 9.0, *), isSecureEnclaveAvailable() {
                query[kSecAttrTokenID as String] = kSecAttrTokenIDSecureEnclave
                
                if let accessControl = SecAccessControlCreateWithFlags(
                    nil,
                    kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                    [.privateKeyUsage, .biometryAny],
                    nil
                ) {
                    query[kSecAttrAccessControl as String] = accessControl
                }
            }
            #elseif os(macOS)
            if let accessControl = SecAccessControlCreateWithFlags(
                nil,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                [.biometryAny],
                nil
            ) {
                query[kSecAttrAccessControl as String] = accessControl
            }
            #endif
            
        case .standard:
            break
        }
        
        return query
    }
    
    // MARK: - Authentication Context Setup
    
    private func setupAuthenticationContext(with options: StorageOptions?, operation: String) -> LAContext? {
        guard let options = options,
              let biometricOptions = options.biometricOptions else {
            return nil
        }
        
        let context = LAContext()
        
        if let promptDescription = biometricOptions.promptDescription {
            context.localizedReason = promptDescription
        } else {
            context.localizedReason = "Authenticate to \(operation)"
        }
        
        if let cancelTitle = biometricOptions.cancelButtonText {
            context.localizedCancelTitle = cancelTitle
        }
        
        #if os(iOS)
        if let allowCredential = biometricOptions.allowDeviceCredential, allowCredential {
            context.localizedFallbackTitle = "Use Passcode"
        } else {
            context.localizedFallbackTitle = ""
        }
        #endif
        
        return context
    }
    
    // MARK: - Error Handling
    
    private func createSensitiveInfoError(from status: OSStatus, operation: String) -> SensitiveInfoError {
        switch status {
        case errSecItemNotFound:
            return .keychainError(status)
        case errSecAuthFailed:
            return .biometricAuthenticationFailed
        case -128: // errSecUserCancel
            return .userCancel
        case errSecInteractionNotAllowed:
            return .biometricNotAvailable
        case errSecDecode:
            return .invalidData
        default:
            return .keychainError(status)
        }
    }
    
    // MARK: - Core Storage Operations
    
    // Base methods that can be overridden
    
    open func getItem(key: String, options: StorageOptions? = nil) async throws -> String? {
        return try await getItemAsync(key: key, options: options)
    }
    
    open func setItem(key: String, value: String, options: StorageOptions? = nil) async throws {
        try await setItemAsync(key: key, value: value, options: options)
    }
    
    open func removeItem(key: String, options: StorageOptions? = nil) async throws {
        try await removeItemAsync(key: key, options: options)
    }
    
    open func getAllItems(options: StorageOptions? = nil) async throws -> [String: String] {
        return try await getAllItemsAsync(options: options)
    }
    
    open func clear(options: StorageOptions? = nil) async throws {
        try await clearAsync(options: options)
    }
    
    open func isBiometricAvailable() async -> Bool {
        return isBiometricCapable()
    }
    
    open func isStrongBoxAvailable() async -> Bool {
        return isSecureEnclaveAvailable()
    }
    
    // MARK: - Internal async implementations
    
    internal func getItemAsync(key: String, options: StorageOptions?) async throws -> String? {
        let securityLevel = options?.securityLevel
        let service = getService(for: securityLevel)
        
        var query = getKeychainQuery(for: key, service: service, securityLevel: securityLevel)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        
        if securityLevel == .biometric || securityLevel == .strongbox,
           let context = setupAuthenticationContext(with: options, operation: "access \(key)") {
            query[kSecUseAuthenticationContext as String] = context
        }
        
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        
        guard status != errSecItemNotFound else { return nil }
        guard status == errSecSuccess else {
            throw createSensitiveInfoError(from: status, operation: "getItem")
        }
        
        guard let data = item as? Data,
              let value = String(data: data, encoding: .utf8) else {
            throw SensitiveInfoError.invalidData
        }
        
        return value
    }
    
    internal func setItemAsync(key: String, value: String, options: StorageOptions?) async throws {
        let securityLevel = options?.securityLevel
        let service = getService(for: securityLevel)
        let data = value.data(using: .utf8)!
        
        var query = getKeychainQuery(for: key, service: service, securityLevel: securityLevel)
        
        if securityLevel == .biometric || securityLevel == .strongbox,
           let context = setupAuthenticationContext(with: options, operation: "store \(key)") {
            query[kSecUseAuthenticationContext as String] = context
        }
        
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        
        if status == errSecSuccess {
            let attributes: [String: Any] = [kSecValueData as String: data]
            let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
            guard updateStatus == errSecSuccess else {
                throw createSensitiveInfoError(from: updateStatus, operation: "setItem (update)")
            }
        } else if status == errSecItemNotFound {
            query[kSecValueData as String] = data
            let addStatus = SecItemAdd(query as CFDictionary, nil)
            guard addStatus == errSecSuccess else {
                throw createSensitiveInfoError(from: addStatus, operation: "setItem (add)")
            }
        } else {
            throw createSensitiveInfoError(from: status, operation: "setItem (check)")
        }
    }
    
    internal func removeItemAsync(key: String, options: StorageOptions?) async throws {
        let securityLevel = options?.securityLevel
        let service = getService(for: securityLevel)
        
        var query = getKeychainQuery(for: key, service: service, securityLevel: securityLevel)
        
        if securityLevel == .biometric || securityLevel == .strongbox,
           let context = setupAuthenticationContext(with: options, operation: "remove \(key)") {
            query[kSecUseAuthenticationContext as String] = context
        }
        
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw createSensitiveInfoError(from: status, operation: "removeItem")
        }
    }
    
    internal func getAllItemsAsync(options: StorageOptions?) async throws -> [String: String] {
        let securityLevel = options?.securityLevel
        let service = getService(for: securityLevel)
        
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecReturnAttributes as String: true,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitAll
        ]
        
        if securityLevel == .biometric || securityLevel == .strongbox,
           let context = setupAuthenticationContext(with: options, operation: "access all items") {
            query[kSecUseAuthenticationContext as String] = context
        }
        
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw createSensitiveInfoError(from: status, operation: "getAllItems")
        }
        
        var dict = [String: String]()
        if let items = result as? [[String: Any]] {
            for item in items {
                if let account = item[kSecAttrAccount as String] as? String,
                   let data = item[kSecValueData as String] as? Data,
                   let value = String(data: data, encoding: .utf8) {
                    dict[account] = value
                }
            }
        }
        return dict
    }
    
    internal func clearAsync(options: StorageOptions?) async throws {
        let securityLevel = options?.securityLevel
        let service = getService(for: securityLevel)
        
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service
        ]
        
        if securityLevel == .biometric || securityLevel == .strongbox,
           let context = setupAuthenticationContext(with: options, operation: "clear all items") {
            query[kSecUseAuthenticationContext as String] = context
        }
        
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw createSensitiveInfoError(from: status, operation: "clear")
        }
    }
}

// MARK: - Conditional class definitions

#if canImport(NitroModules)
@available(iOS 11.0, macOS 10.13, *)
public class HybridSensitiveInfo: HybridSensitiveInfoSpec {
    private let impl = SensitiveInfoImpl()
    
    // Implement HybridSensitiveInfoSpec protocol methods
    
    public func getItem(key: String, options: StorageOptions?) throws -> Promise<String?> {
        return Promise.async { [weak self] in
            return try await self?.impl.getItemAsync(key: key, options: options)
        }
    }
    
    public func setItem(key: String, value: String, options: StorageOptions?) throws -> Promise<Void> {
        return Promise.async { [weak self] in
            try await self?.impl.setItemAsync(key: key, value: value, options: options)
        }
    }
    
    public func removeItem(key: String, options: StorageOptions?) throws -> Promise<Void> {
        return Promise.async { [weak self] in
            try await self?.impl.removeItemAsync(key: key, options: options)
        }
    }
    
    public func getAllItems(options: StorageOptions?) throws -> Promise<Dictionary<String, String>> {
        return Promise.async { [weak self] in
            return try await self?.impl.getAllItemsAsync(options: options) ?? [:]
        }
    }
    
    public func clear(options: StorageOptions?) throws -> Promise<Void> {
        return Promise.async { [weak self] in
            try await self?.impl.clearAsync(options: options)
        }
    }
    
    public func isBiometricAvailable() throws -> Promise<Bool> {
        return Promise.resolved(withResult: impl.isBiometricCapable())
    }
    
    public func isStrongBoxAvailable() throws -> Promise<Bool> {
        return Promise.resolved(withResult: impl.isSecureEnclaveAvailable())
    }
    
    // Forward other methods to the implementation
    public func getOptimalSecurityLevel() -> SecurityLevel {
        return impl.getOptimalSecurityLevel()
    }
    
    public func isSecureEnclaveAvailable() -> Bool {
        return impl.isSecureEnclaveAvailable()
    }
    
    public func isBiometricCapable() -> Bool {
        return impl.isBiometricCapable()
    }
}

public typealias SensitiveInfo = HybridSensitiveInfo
public typealias SensitiveInfoUtility = HybridSensitiveInfo

#else

public typealias SensitiveInfo = SensitiveInfoImpl
public typealias SensitiveInfoUtility = SensitiveInfoImpl

#endif

// MARK: - SwiftUI Components

@available(iOS 13.0, macOS 10.15, *)
public struct SensitiveInfoStatusView: View {
    @State private var sensitiveInfo = SensitiveInfoUtility()
    @State private var securityLevel: SecurityLevel = .standard
    @State private var biometricAvailable = false
    @State private var strongboxAvailable = false
    @State private var isLoading = true
    @State private var statusMessage = ""
    
    public init() {}
    
    private var backgroundColor: Color {
        #if os(iOS)
        return Color(UIColor.systemBackground)
        #else
        return Color(NSColor.controlBackgroundColor)
        #endif
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "shield.checkerboard")
                    .foregroundColor(.blue)
                    .font(.title2)
                
                VStack(alignment: .leading) {
                    Text("SensitiveInfo Security Status")
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    Text("Current device capabilities")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                }
            }
            
            Divider()
            
            VStack(spacing: 12) {
                SecurityFeatureRow(
                    icon: biometricIcon,
                    title: "Biometric Authentication",
                    subtitle: biometricSubtitle,
                    isAvailable: biometricAvailable,
                    isOptimal: securityLevel == .biometric
                )
                
                SecurityFeatureRow(
                    icon: "lock.shield",
                    title: "Secure Enclave",
                    subtitle: "Hardware-backed security",
                    isAvailable: strongboxAvailable,
                    isOptimal: securityLevel == .strongbox
                )
                
                SecurityFeatureRow(
                    icon: "key",
                    title: "Keychain",
                    subtitle: "Standard secure storage",
                    isAvailable: true,
                    isOptimal: securityLevel == .standard
                )
            }
            
            HStack {
                VStack(alignment: .leading) {
                    Text("Active Security Level")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Text(securityLevel.displayName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                SecurityLevelBadge(level: securityLevel)
            }
            .padding(.top, 8)
            
            if !statusMessage.isEmpty {
                Text(statusMessage)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.leading)
            }
        }
        .padding()
        .background(backgroundColor)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 2)
        .task {
            await loadSecurityStatus()
        }
    }
    
    private var biometricIcon: String {
        #if os(iOS)
        return biometricAvailable ? "faceid" : "faceid.slash"
        #elseif os(macOS)
        return biometricAvailable ? "touchid" : "touchid.slash"
        #else
        return "questionmark"
        #endif
    }
    
    private var biometricSubtitle: String {
        #if os(iOS)
        return "Face ID / Touch ID"
        #elseif os(macOS)
        return "Touch ID"
        #else
        return "Biometric authentication"
        #endif
    }
    
    private func loadSecurityStatus() async {
        isLoading = true
        
        #if canImport(NitroModules)
        do {
            // Handle biometric availability
            let biometricPromise = try sensitiveInfo.isBiometricAvailable()
            biometricAvailable = try await withCheckedThrowingContinuation { continuation in
                biometricPromise
                    .then { result in continuation.resume(returning: result) }
                    .catch { error in continuation.resume(returning: false) }
            }
            
            // Handle strongbox availability
            let strongboxPromise = try sensitiveInfo.isStrongBoxAvailable()
            strongboxAvailable = try await withCheckedThrowingContinuation { continuation in
                strongboxPromise
                    .then { result in continuation.resume(returning: result) }
                    .catch { error in continuation.resume(returning: false) }
            }
        } catch {
            biometricAvailable = false
            strongboxAvailable = false
        }
        #else
        biometricAvailable = await sensitiveInfo.isBiometricAvailable()
        strongboxAvailable = await sensitiveInfo.isStrongBoxAvailable()
        #endif
        
        securityLevel = sensitiveInfo.getOptimalSecurityLevel()
        
        switch securityLevel {
        case .strongbox:
            statusMessage = "Maximum security: Secure Enclave protection enabled"
        case .biometric:
            statusMessage = "Enhanced security: Biometric authentication enabled"
        case .standard:
            statusMessage = "Standard security: Keychain protection enabled"
        }
        
        isLoading = false
    }
}

@available(iOS 13.0, macOS 10.15, *)
private struct SecurityFeatureRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let isAvailable: Bool
    let isOptimal: Bool
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(isAvailable ? .green : .gray)
                .font(.title3)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            HStack(spacing: 8) {
                if isOptimal {
                    Image(systemName: "star.fill")
                        .foregroundColor(.orange)
                        .font(.caption)
                }
                
                Image(systemName: isAvailable ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundColor(isAvailable ? .green : .red)
                    .font(.title3)
            }
        }
    }
}

@available(iOS 13.0, macOS 10.15, *)
private struct SecurityLevelBadge: View {
    let level: SecurityLevel
    
    var body: some View {
        Text(level.displayName)
            .font(.caption)
            .fontWeight(.semibold)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(level.color.opacity(0.2))
            .foregroundColor(level.color)
            .cornerRadius(16)
    }
}

@available(iOS 13.0, macOS 10.15, *)
public struct SensitiveInfoDemoView: View {
    @State private var sensitiveInfo = SensitiveInfoUtility()
    @State private var testKey = "demo_key"
    @State private var testValue = "demo_value"
    @State private var storedValue = ""
    @State private var selectedSecurityLevel = SecurityLevel.standard
    @State private var showingAlert = false
    @State private var alertMessage = ""
    
    public init() {}
    
    private var backgroundColor: Color {
        #if os(iOS)
        return Color(UIColor.systemBackground)
        #else
        return Color(NSColor.controlBackgroundColor)
        #endif
    }
    
    public var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                SensitiveInfoStatusView()
                
                VStack(alignment: .leading, spacing: 16) {
                    Text("Demo Operations")
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Security Level")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        Picker("Security Level", selection: $selectedSecurityLevel) {
                            ForEach(SecurityLevel.allCases, id: \.self) { level in
                                Text(level.displayName).tag(level)
                            }
                        }
                        .pickerStyle(SegmentedPickerStyle())
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Test Data")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        HStack {
                            TextField("Key", text: $testKey)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                            
                            TextField("Value", text: $testValue)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                        }
                    }
                    
                    HStack(spacing: 12) {
                        Button("Store") {
                            Task { await storeValue() }
                        }
                        .buttonStyle(.borderedProminent)
                        
                        Button("Retrieve") {
                            Task { await retrieveValue() }
                        }
                        .buttonStyle(.bordered)
                        
                        Button("Remove") {
                            Task { await removeValue() }
                        }
                        .buttonStyle(.bordered)
                        .foregroundColor(.red)
                    }
                    
                    if !storedValue.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Retrieved Value")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            Text(storedValue)
                                .padding()
                                .background(Color.gray.opacity(0.1))
                                .cornerRadius(8)
                        }
                    }
                }
                .padding()
                .background(backgroundColor)
                .cornerRadius(12)
                .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
                
                Spacer()
            }
            .padding()
            .navigationTitle("SensitiveInfo Demo")
            .alert("Operation Result", isPresented: $showingAlert) {
                Button("OK") { }
            } message: {
                Text(alertMessage)
            }
        }
    }
    
    private func storeValue() async {
        do {
            #if canImport(NitroModules)
            let options = StorageOptions(securityLevel: selectedSecurityLevel, biometricOptions: nil)
            let promise = try sensitiveInfo.setItem(key: testKey, value: testValue, options: options)
            try await withCheckedThrowingContinuation { continuation in
                promise
                    .then { _ in continuation.resume() }
                    .catch { error in continuation.resume(throwing: error) }
            }
            #else
            let options = StorageOptions(securityLevel: selectedSecurityLevel, biometricOptions: nil)
            try await sensitiveInfo.setItem(key: testKey, value: testValue, options: options)
            #endif
            alertMessage = "Value stored successfully with \(selectedSecurityLevel.displayName) security"
            showingAlert = true
        } catch {
            alertMessage = "Failed to store value: \(error.localizedDescription)"
            showingAlert = true
        }
    }
    
    private func retrieveValue() async {
        do {
            #if canImport(NitroModules)
            let options = StorageOptions(securityLevel: selectedSecurityLevel, biometricOptions: nil)
            let promise = try sensitiveInfo.getItem(key: testKey, options: options)
            let value: String? = try await withCheckedThrowingContinuation { continuation in
                promise
                    .then { result in continuation.resume(returning: result) }
                    .catch { error in continuation.resume(throwing: error) }
            }
            if let value = value {
                storedValue = value
                alertMessage = "Value retrieved successfully"
                showingAlert = true
            } else {
                storedValue = ""
                alertMessage = "No value found for key '\(testKey)'"
                showingAlert = true
            }
            #else
            let options = StorageOptions(securityLevel: selectedSecurityLevel, biometricOptions: nil)
            if let value = try await sensitiveInfo.getItem(key: testKey, options: options) {
                storedValue = value
                alertMessage = "Value retrieved successfully"
                showingAlert = true
            } else {
                storedValue = ""
                alertMessage = "No value found for key '\(testKey)'"
                showingAlert = true
            }
            #endif
        } catch {
            alertMessage = "Failed to retrieve value: \(error.localizedDescription)"
            showingAlert = true
        }
    }
    
    private func removeValue() async {
        do {
            #if canImport(NitroModules)
            let options = StorageOptions(securityLevel: selectedSecurityLevel, biometricOptions: nil)
            let promise = try sensitiveInfo.removeItem(key: testKey, options: options)
            try await withCheckedThrowingContinuation { continuation in
                promise
                    .then { _ in continuation.resume() }
                    .catch { error in continuation.resume(throwing: error) }
            }
            #else
            let options = StorageOptions(securityLevel: selectedSecurityLevel, biometricOptions: nil)
            try await sensitiveInfo.removeItem(key: testKey, options: options)
            #endif
            storedValue = ""
            alertMessage = "Value removed successfully"
            showingAlert = true
        } catch {
            alertMessage = "Failed to remove value: \(error.localizedDescription)"
            showingAlert = true
        }
    }
}

#endif

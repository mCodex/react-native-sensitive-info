import Foundation
import Security
import CommonCrypto

/// Handles encryption and decryption operations using AES-256 with CommonCrypto.
///
/// This service encapsulates all cryptographic operations, providing:
/// - AES-256-CBC encryption with PKCS7 padding
/// - Secure key generation and storage
/// - Data serialization for transport
/// - Error handling with clear messages
///
/// The service manages encryption keys associated with aliases, storing them
/// in Keychain under appropriate access control policies.
///
/// Example:
/// ```swift
/// let crypto = CryptoService(validator: validator)
/// let encrypted = try crypto.encryptData(plainData, alias: "key-v1")
/// let decrypted = try crypto.decryptData(encrypted, withKey: key)
/// ```
///
/// @since 6.0.0
final class CryptoService {
  private let validator: KeychainValidator
  private let workQueue: DispatchQueue

  /// Initialize the crypto service.
  ///
  /// - Parameters:
  ///   - validator: Validates encryption parameters
  ///   - workQueue: Dispatch queue for crypto operations
  init(validator: KeychainValidator, workQueue: DispatchQueue? = nil) {
    self.validator = validator
    self.workQueue = workQueue ?? DispatchQueue(label: "com.mcodex.sensitiveinfo.crypto", qos: .userInitiated)
  }

  /// Encrypt data using AES-256-CBC with PKCS7 padding.
  ///
  /// Process:
  /// 1. Generate or retrieve encryption key for alias
  /// 2. Perform AES-256 encryption
  /// 3. Return encrypted data with key metadata
  ///
  /// - Parameters:
  ///   - data: Plaintext data to encrypt
  ///   - alias: Unique identifier for the encryption key
  ///   - accessControl: Access control for storing the key
  /// - Returns: Encrypted data
  /// - Throws: CryptoError or RuntimeError
  func encryptData(
    _ data: Data,
    alias: String,
    accessControl: SecAccessControl? = nil
  ) throws -> Data {
    let keyData = try createOrRetrieveEncryptionKey(alias: alias, accessControl: accessControl)
    return try encryptData(data, withKey: keyData)
  }

  /// Encrypt data with a provided key.
  ///
  /// Uses CommonCrypto to perform AES-256-CBC encryption with PKCS7 padding.
  ///
  /// - Parameters:
  ///   - data: Plaintext data to encrypt
  ///   - keyData: 32-byte AES-256 key
  /// - Returns: Encrypted data
  /// - Throws: RuntimeError if encryption fails
  func encryptData(_ data: Data, withKey keyData: Data) throws -> Data {
    let keyLength = kCCKeySizeAES256
    let dataLength = data.count
    let bufferSize = dataLength + kCCBlockSizeAES128
    var buffer = Data(count: bufferSize)
    var numBytesEncrypted: size_t = 0

    let cryptStatus = keyData.withUnsafeBytes { keyBytes in
      data.withUnsafeBytes { dataBytes in
        buffer.withUnsafeMutableBytes { bufferBytes in
          CCCrypt(
            CCOperation(kCCEncrypt),
            CCAlgorithm(kCCAlgorithmAES),
            CCOptions(kCCOptionPKCS7Padding),
            keyBytes.baseAddress,
            keyLength,
            nil,
            dataBytes.baseAddress,
            dataLength,
            bufferBytes.baseAddress,
            bufferSize,
            &numBytesEncrypted
          )
        }
      }
    }

    guard cryptStatus == kCCSuccess else {
      throw RuntimeError.error(withMessage: "Encryption failed: \(cryptStatus)")
    }

    buffer.removeSubrange(numBytesEncrypted..<buffer.count)
    return buffer
  }

  /// Decrypt data using AES-256-CBC with PKCS7 padding.
  ///
  /// - Parameters:
  ///   - data: Encrypted data
  ///   - keyData: 32-byte AES-256 key
  /// - Returns: Decrypted plaintext data
  /// - Throws: RuntimeError if decryption fails
  func decryptData(_ data: Data, withKey keyData: Data) throws -> Data {
    let keyLength = kCCKeySizeAES256
    let dataLength = data.count
    let bufferSize = dataLength + kCCBlockSizeAES128
    var buffer = Data(count: bufferSize)
    var numBytesDecrypted: size_t = 0

    let cryptStatus = keyData.withUnsafeBytes { keyBytes in
      data.withUnsafeBytes { dataBytes in
        buffer.withUnsafeMutableBytes { bufferBytes in
          CCCrypt(
            CCOperation(kCCDecrypt),
            CCAlgorithm(kCCAlgorithmAES),
            CCOptions(kCCOptionPKCS7Padding),
            keyBytes.baseAddress,
            keyLength,
            nil,
            dataBytes.baseAddress,
            dataLength,
            bufferBytes.baseAddress,
            bufferSize,
            &numBytesDecrypted
          )
        }
      }
    }

    guard cryptStatus == kCCSuccess else {
      throw RuntimeError.error(withMessage: "Decryption failed: \(cryptStatus)")
    }

    buffer.removeSubrange(numBytesDecrypted..<buffer.count)
    return buffer
  }

  /// Retrieve encryption key for the given alias from Keychain.
  ///
  /// - Parameter alias: Unique identifier for the encryption key
  /// - Returns: 32-byte AES-256 key data
  /// - Throws: RuntimeError if key not found or retrieval fails
  func retrieveEncryptionKey(alias: String) throws -> Data {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: alias,
      kSecAttrService as String: "com.mcodex.sensitiveinfo.keys",
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]

    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)

    guard status == errSecSuccess, let keyData = result as? Data else {
      throw RuntimeError.error(withMessage: "Failed to retrieve encryption key: \(status)")
    }

    return keyData
  }

  /// Create or retrieve a 32-byte AES-256 encryption key.
  ///
  /// Process:
  /// 1. Try to retrieve existing key by alias
  /// 2. If not found, generate new random key
  /// 3. Store key in Keychain
  /// 4. Return key data
  ///
  /// - Parameters:
  ///   - alias: Unique identifier for the key
  ///   - accessControl: Access control policy for key storage
  /// - Returns: 32-byte key data
  /// - Throws: RuntimeError if generation or storage fails
  private func createOrRetrieveEncryptionKey(
    alias: String,
    accessControl: SecAccessControl?
  ) throws -> Data {
    // Try to retrieve existing key
    if let existing = try? retrieveEncryptionKey(alias: alias) {
      return existing
    }

    // Generate new key
    var keyBytes = [UInt8](repeating: 0, count: kCCKeySizeAES256)
    let status = SecRandomCopyBytes(kSecRandomDefault, keyBytes.count, &keyBytes)

    guard status == errSecSuccess else {
      throw RuntimeError.error(withMessage: "Failed to generate encryption key: \(status)")
    }

    let keyData = Data(keyBytes)

    // Store in Keychain
    var query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: alias,
      kSecAttrService as String: "com.mcodex.sensitiveinfo.keys",
      kSecValueData as String: keyData,
    ]

    if let accessControl = accessControl {
      query[kSecAttrAccessControl as String] = accessControl
    } else {
      query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlocked
    }

    SecItemDelete(query as CFDictionary)
    let addStatus = SecItemAdd(query as CFDictionary, nil)

    guard addStatus == errSecSuccess || addStatus == errSecDuplicateItem else {
      throw RuntimeError.error(withMessage: "Failed to store encryption key: \(addStatus)")
    }

    return keyData
  }
}

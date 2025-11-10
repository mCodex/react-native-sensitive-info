import Foundation
import Security

/**
 * Validates Keychain operations before execution.
 *
 * Responsibilities:
 * - Validate key format and length
 * - Validate value size constraints
 * - Validate access control compatibility
 * - Provide actionable error messages
 *
 * By validating early, we can provide clear error messages to the caller
 * before attempting operations that would fail cryptically.
 *
 * @since 6.0.0
 */
struct KeychainValidator {
  private static let maxKeyLength = 255
  private static let maxValueSizeBytes = 100 * 1024 * 1024  // 100 MB
  private static let maxServiceLength = 512

  /**
   * Validates a Keychain key.
   *
   * @param key The key to validate
   * @throws KeychainValidationError if validation fails
   *
   * @example
   * ```swift
   * let validator = KeychainValidator()
   * try validator.validateKey("myToken")
   * ```
   */
  func validateKey(_ key: String) throws {
    guard !key.isEmpty else {
      throw KeychainValidationError.invalidKey("Key must not be empty")
    }
    guard key.count <= Self.maxKeyLength else {
      throw KeychainValidationError.invalidKey(
        "Key must not exceed \(Self.maxKeyLength) characters, got \(key.count)"
      )
    }
  }

  /**
   * Validates a value for storage.
   *
   * @param value The value to validate
   * @throws KeychainValidationError if validation fails
   *
   * @example
   * ```swift
   * try validator.validateValue("secret-token")
   * ```
   */
  func validateValue(_ value: String) throws {
    let dataSize = value.utf8.count
    guard dataSize <= Self.maxValueSizeBytes else {
      throw KeychainValidationError.valueTooLarge(
        "Value must not exceed \(Self.maxValueSizeBytes / 1024 / 1024)MB, " +
        "got \(dataSize / 1024)KB"
      )
    }
  }

  /**
   * Validates a service identifier.
   *
   * @param service The service to validate (nil is acceptable, will use default)
   * @throws KeychainValidationError if validation fails
   */
  func validateService(_ service: String?) throws {
    guard let service = service else {
      return  // nil is acceptable
    }
    guard !service.isEmpty else {
      throw KeychainValidationError.invalidService("Service must not be empty")
    }
    guard service.count <= Self.maxServiceLength else {
      throw KeychainValidationError.invalidService(
        "Service must not exceed \(Self.maxServiceLength) characters, got \(service.count)"
      )
    }
  }

  /**
   * Validates that access control is appropriate for the device.
   *
   * @param accessControl The requested access control
   * @param availability Current device capabilities
   * @throws KeychainValidationError if incompatible
   */
  func validateAccessControl(
    _ accessControl: AccessControl,
    against availability: SecurityAvailability
  ) throws {
    switch accessControl {
    case .secureEnclaveBiometry:
      guard availability.secureEnclave && availability.biometry else {
        throw KeychainValidationError.unavailableFeature(
          "Secure Enclave with biometry not available on this device"
        )
      }
    case .biometry:
      guard availability.biometry else {
        throw KeychainValidationError.unavailableFeature(
          "Biometry not available on this device"
        )
      }
    case .hardwareBackedBiometry:
      guard availability.biometry else {
        throw KeychainValidationError.unavailableFeature(
          "Hardware-backed biometry not available on this device"
        )
      }
    default:
      break  // Other access controls always available
    }
  }
}

/**
 * Errors that can occur during Keychain validation.
 *
 * @since 6.0.0
 */
enum KeychainValidationError: LocalizedError, Equatable {
  case invalidKey(String)
  case valueTooLarge(String)
  case invalidService(String)
  case unavailableFeature(String)

  var errorDescription: String? {
    switch self {
    case .invalidKey(let msg), .valueTooLarge(let msg),
         .invalidService(let msg), .unavailableFeature(let msg):
      return msg
    }
  }

  var failureReason: String? {
    switch self {
    case .invalidKey:
      return "The provided key does not meet length requirements"
    case .valueTooLarge:
      return "The value exceeds the maximum allowed size"
    case .invalidService:
      return "The provided service identifier is invalid"
    case .unavailableFeature:
      return "The requested security feature is not available on this device"
    }
  }

  var recoverySuggestion: String? {
    switch self {
    case .invalidKey(let msg):
      return "Use a key between 1 and 255 characters: \(msg)"
    case .valueTooLarge(let msg):
      return "Reduce the value size: \(msg)"
    case .invalidService(let msg):
      return "Provide a valid service identifier: \(msg)"
    case .unavailableFeature(let msg):
      return "Use a different access control level: \(msg)"
    }
  }

  static func == (lhs: KeychainValidationError, rhs: KeychainValidationError) -> Bool {
    switch (lhs, rhs) {
    case (.invalidKey(let a), .invalidKey(let b)):
      return a == b
    case (.valueTooLarge(let a), .valueTooLarge(let b)):
      return a == b
    case (.invalidService(let a), .invalidService(let b)):
      return a == b
    case (.unavailableFeature(let a), .unavailableFeature(let b)):
      return a == b
    default:
      return false
    }
  }
}

import Foundation
import NitroModules

/// Protocol for managing key rotation operations.
///
/// Encapsulates key rotation lifecycle, re-encryption, and event handling
/// following Separation of Concerns and Single Responsibility principles.
///
/// @since 6.0.0
protocol RotationManager {
  /// Initialize the key rotation system.
  ///
  /// - Parameters:
  ///   - request: Rotation configuration
  /// - Returns: Promise resolving to void
  func initializeKeyRotation(request: InitializeKeyRotationRequest) -> Promise<Void>

  /// Perform a key rotation operation.
  ///
  /// - Parameters:
  ///   - request: Rotation parameters
  /// - Returns: Promise resolving to rotation result with metadata
  func rotateKeys(request: RotateKeysRequest) -> Promise<RotationResult>

  /// Get current rotation status.
  ///
  /// - Returns: Promise resolving to rotation status
  func getRotationStatus() -> Promise<RotationStatus>

  /// Subscribe to rotation events.
  ///
  /// - Parameters:
  ///   - callback: Callback function for rotation events
  /// - Returns: Cleanup function to unsubscribe
  func onRotationEvent(callback: @escaping (RotationEvent) -> Void) -> () -> Void

  /// Re-encrypt all items with current key version.
  ///
  /// - Parameters:
  ///   - request: Re-encryption parameters
  /// - Returns: Promise resolving to re-encryption result
  func reEncryptAllItems(request: ReEncryptAllItemsRequest) -> Promise<ReEncryptAllItemsResponse>
}

import Foundation
import NitroModules

/// Protocol for managing sensitive item storage operations.
///
/// Separates item CRUD operations from the main HybridSensitiveInfo module,
/// enabling better testability and following Single Responsibility Principle.
///
/// @since 6.0.0
protocol ItemManager {
  /// Retrieve a single item from storage.
  ///
  /// - Parameters:
  ///   - request: Get request with key and authentication options
  /// - Returns: Promise resolving to item or nil if not found
  func getItem(request: SensitiveInfoGetRequest) -> Promise<SensitiveInfoItem?>

  /// Store or replace an item in storage.
  ///
  /// - Parameters:
  ///   - request: Set request with key, value, and security options
  /// - Returns: Promise resolving to mutation result with metadata
  func setItem(request: SensitiveInfoSetRequest) -> Promise<MutationResult>

  /// Delete a specific item from storage.
  ///
  /// - Parameters:
  ///   - request: Delete request with key
  /// - Returns: Promise resolving to boolean success status
  func deleteItem(request: SensitiveInfoDeleteRequest) -> Promise<Bool>

  /// Check if an item exists without fetching its value.
  ///
  /// - Parameters:
  ///   - request: Has request with key
  /// - Returns: Promise resolving to boolean existence status
  func hasItem(request: SensitiveInfoHasRequest) -> Promise<Bool>

  /// Retrieve all items matching criteria.
  ///
  /// - Parameters:
  ///   - request: Optional enumerate request with filters
  /// - Returns: Promise resolving to array of items
  func getAllItems(request: SensitiveInfoEnumerateRequest?) -> Promise<[SensitiveInfoItem]>

  /// Delete all items in a service.
  ///
  /// - Parameters:
  ///   - request: Optional service options
  /// - Returns: Promise resolving to void
  func clearService(request: SensitiveInfoOptions?) -> Promise<Void>
}

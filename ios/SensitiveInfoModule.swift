import Foundation
import LocalAuthentication
import React

@objc(SensitiveInfo)
class SensitiveInfo: NSObject {
    private let implementation = HybridSensitiveInfo()

    @objc
    static func requiresMainQueueSetup() -> Bool {
        false
    }

    @objc(setItem:value:options:resolver:rejecter:)
    func setItem(
        _ key: String,
        value: String,
        options: NSDictionary,
        resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        performAsync(resolver: resolver, rejecter: rejecter) {
            let service = self.resolveService(from: options)
            let accessControl = options["accessControl"] as? String
            let prompt = self.parsePrompt(from: options["authenticationPrompt"])

            let result = try await self.implementation.setItem(
                key: key,
                value: value,
                service: service,
                accessControl: accessControl,
                authenticationPrompt: prompt
            )

            return [
                "metadata": self.serialize(metadata: result.metadata)
            ]
        }
    }

    @objc(getItem:options:resolver:rejecter:)
    func getItem(
        _ key: String,
        options: NSDictionary,
        resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        performAsync(resolver: resolver, rejecter: rejecter) {
            let service = self.resolveService(from: options)
            let prompt = self.parsePrompt(from: options["prompt"])

            if let item = try await self.implementation.getItem(
                key: key,
                service: service,
                authenticationPrompt: prompt
            ) {
                return self.serialize(item: item)
            }

            return NSNull()
        }
    }

    @objc(hasItem:options:resolver:rejecter:)
    func hasItem(
        _ key: String,
        options: NSDictionary,
        resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        performAsync(resolver: resolver, rejecter: rejecter) {
            let service = self.resolveService(from: options)
            let exists = await self.implementation.hasItem(
                key: key,
                service: service
            )
            return exists
        }
    }

    @objc(deleteItem:options:resolver:rejecter:)
    func deleteItem(
        _ key: String,
        options: NSDictionary,
        resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        performAsync(resolver: resolver, rejecter: rejecter) {
            let service = self.resolveService(from: options)
            try await self.implementation.deleteItem(
                key: key,
                service: service
            )
            return NSNull()
        }
    }

    @objc(getAllItems:resolver:rejecter:)
    func getAllItems(
        _ options: NSDictionary,
        resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        performAsync(resolver: resolver, rejecter: rejecter) {
            let service = self.resolveService(from: options)
            let items = try await self.implementation.getAllItems(
                service: service
            )
            return items
        }
    }

    @objc(clearService:resolver:rejecter:)
    func clearService(
        _ options: NSDictionary,
        resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        performAsync(resolver: resolver, rejecter: rejecter) {
            let service = self.resolveService(from: options)
            try await self.implementation.clearService(
                service: service
            )
            return NSNull()
        }
    }

    @objc(getSupportedSecurityLevels:rejecter:)
    func getSupportedSecurityLevels(
        _ resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        performAsync(resolver: resolver, rejecter: rejecter) {
            let availability = try await self.implementation.getSupportedSecurityLevels()
            return self.serialize(availability: availability)
        }
    }

    // MARK: - Helpers

    private func performAsync(
        resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock,
        operation: @escaping () async throws -> Any
    ) {
        Task {
            do {
                let result = try await operation()
                DispatchQueue.main.async {
                    resolver(result)
                }
            } catch {
                self.reject(error, rejecter: rejecter)
            }
        }
    }

    private func reject(
        _ error: Error,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        let mapped = mapError(error)
        DispatchQueue.main.async {
            rejecter(mapped.code, mapped.message, mapped.error)
        }
    }

    private func mapError(_ error: Error) -> (code: String, message: String, error: NSError) {
        if let exception = error as? SensitiveInfoException {
            let nsError = NSError(
                domain: "RNSensitiveInfo",
                code: 0,
                userInfo: [NSLocalizedDescriptionKey: exception.message]
            )
            return (exception.code, exception.message, nsError)
        }

        if let keychainError = error as? KeychainError {
            let message = keychainError.localizedDescription
            let nsError = NSError(
                domain: "RNSensitiveInfo.Keychain",
                code: 0,
                userInfo: [NSLocalizedDescriptionKey: message]
            )
            return ("E_KEYSTORE_UNAVAILABLE", message, nsError)
        }

        if let laError = error as? LAError {
            let message = laError.friendlyMessage
            let nsError = laError as NSError
            return (laError.sensitiveInfoCode, message, nsError)
        }

        let nsError = error as NSError
        let message = nsError.localizedDescription
        return ("E_KEYSTORE_UNAVAILABLE", message, nsError)
    }

    private func resolveService(from options: NSDictionary?) -> String? {
        guard let options = options as? [String: Any] else {
            return nil
        }

        if let service = options["service"] as? String, !service.isEmpty {
            return service
        }

        if let service = options["keychainService"] as? String, !service.isEmpty {
            return service
        }

        return nil
    }

    private func parsePrompt(from value: Any?) -> AuthenticationPrompt? {
        guard let dictionary = value as? [String: Any] else {
            return nil
        }

        guard let title = (dictionary["title"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty else {
            return nil
        }

        return AuthenticationPrompt(
            title: title,
            subtitle: dictionary["subtitle"] as? String,
            description: dictionary["description"] as? String,
            cancel: (dictionary["negativeButtonText"] as? String) ?? (dictionary["cancel"] as? String)
        )
    }

    private func serialize(metadata: StorageMetadata) -> [String: Any] {
        [
            "securityLevel": metadata.securityLevel,
            "accessControl": metadata.accessControl,
            "backend": metadata.backend,
            "timestamp": metadata.timestamp
        ]
    }

    private func serialize(item: SensitiveInfoItem) -> [String: Any] {
        [
            "key": item.key,
            "service": item.service,
            "value": item.value,
            "metadata": serialize(metadata: item.metadata)
        ]
    }

    private func serialize(availability: SecurityAvailability) -> [String: Any] {
        [
            "secureEnclave": availability.secureEnclave,
            "strongBox": false,
            "biometry": availability.biometry,
            "deviceCredential": availability.deviceCredential,
            "iCloudSync": false
        ]
    }
}

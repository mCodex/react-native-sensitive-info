import Foundation

/**
 * Data+Encoding.swift
 *
 * Helper extensions for Data encoding/decoding.
 *
 * Provides convenient methods for converting between hex and Base64 formats.
 * Used throughout for storing binary data in text-safe formats.
 */

extension Data {
    
    /// Encodes data as hexadecimal string.
    ///
    /// Useful for debugging and logging binary data.
    ///
    /// - Returns: Hex string (lowercase)
    ///
    /// # Example
    /// ```swift
    /// let data = Data([0x48, 0x65, 0x6C, 0x6C, 0x6F])
    /// print(data.hexEncoded)  // "48656c6c6f"
    /// ```
    var hexEncoded: String {
        map { String(format: "%02x", $0) }.joined()
    }
    
    /// Decodes hexadecimal string to Data.
    ///
    /// - Parameter hex: Hex string (case-insensitive)
    /// - Returns: Decoded Data, or nil if invalid
    static func fromHex(_ hex: String) -> Data? {
        var data = Data()
        var index = hex.startIndex
        
        while index < hex.endIndex {
            let nextIndex = hex.index(index, offsetBy: 2, limitedBy: hex.endIndex) ?? hex.endIndex
            let byteString = String(hex[index..<nextIndex])
            
            guard let byte = UInt8(byteString, radix: 16) else {
                return nil
            }
            
            data.append(byte)
            index = nextIndex
        }
        
        return data
    }
    
    /// Encodes data as Base64 string.
    ///
    /// Standard Base64 encoding without line breaks.
    ///
    /// - Returns: Base64 string
    func base64Encoded() -> String {
        base64EncodedString(options: [])
    }
    
    /// Decodes Base64 string to Data.
    ///
    /// - Parameter base64: Base64 string
    /// - Returns: Decoded Data, or nil if invalid
    static func fromBase64(_ base64: String) -> Data? {
        Data(base64Encoded: base64, options: .ignoreUnknownCharacters)
    }
}

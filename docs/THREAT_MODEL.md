# Threat model

## What the library protects

- Android values are stored as AES-GCM ciphertext in app-private preferences. Encryption keys
  live in Android Keystore. The actual protection level depends on the device and selected
  policy; inspect the returned `securityLevel` instead of assuming a TEE or StrongBox.
- iOS values are stored in Keychain with the resolved accessibility and access-control policy.
  A Keychain item is not necessarily a Secure Enclave key.
- New records carry an HMAC-SHA256 integrity tag. Verified mismatches raise
  `IntegrityViolationError` before decryption. Entries written before tags were introduced remain
  readable without a tag for compatibility. Metadata-only queries omit plaintext but do not verify
  its integrity tag; use a value read when that verification is required.
- Biometric enrollment changes can invalidate keys for policies that request the current
  biometric set. The OS reports those invalidations to the library.
- TypeScript validation rejects malformed public inputs before native calls. Native validation
  remains necessary wherever the bridge can be called directly.

## Known integrity limits

The current HMAC serialization separates some fields with delimiter bytes, but accepted strings
can contain those delimiters. Distinct service/key or metadata inputs can therefore produce the
same serialized bytes. A versioned, length-prefixed encoding and collision regression vectors are
still needed before integrity can be claimed for every accepted input.

Untagged legacy entries are accepted. HMAC tags also do not provide rollback protection: a
previously valid ciphertext and tag can be replayed unless the application maintains trusted
freshness state outside the editable record. Do not treat an integrity tag as proof that a record
is the newest value.

## What it does not protect

- A compromised JavaScript runtime can call the library and request plaintext.
- Plaintext passes through JavaScript strings and native memory. The library does not zeroize the
  JavaScript heap or claim to prevent memory inspection while the app is running.
- Backup behavior belongs to the consuming application and OS settings. The example disables
  Android backup, but the library cannot enforce that for host apps. Restored Android ciphertext
  may not have its Keystore key.
- The library does not prevent OS compromise, supply-chain compromise, screen capture, phishing,
  or side-channel attacks. It has not received an independent cryptographic audit.
- The `securityLevel` value reports the tier resolved by the implementation. It is not hardware
  attestation and does not prove a secure element actually protected a key.

## Resolved security tiers

| Tier | iOS | Android |
| --- | --- | --- |
| `secureEnclave` | Keychain item using the resolved Secure Enclave-oriented policy | Not used |
| `strongBox` | Not used | Key protected by StrongBox when available and requested |
| `biometry` | Keychain item with a biometric access-control policy | Keystore key requiring authentication |
| `deviceCredential` | Keychain item with a device-passcode policy | Keystore key requiring device credentials |
| `software` | Keychain item using the software access policy | Keystore key reported at the software tier |

The tier describes the library's resolution, not a platform attestation. Applications with
compliance requirements should reject writes whose returned tier does not satisfy their policy.

## Practical guidance

1. Request the access-control policy that matches the secret's use.
2. Check the returned `securityLevel` after writing; do not infer hardware protection from the
   requested policy alone.
3. Handle `KeyInvalidatedError` and `IntegrityViolationError` separately.
4. Define backup, restore, and key-rotation behavior in the consuming application.
5. Avoid fetching secrets in background work unless the user interaction and authentication
   policy are explicit.

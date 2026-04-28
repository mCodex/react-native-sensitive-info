# Threat Model

## What `react-native-sensitive-info` defends against

- **Casual filesystem access on a rooted/jailbroken device.** Values are encrypted at rest with
  hardware-backed keys when the platform supports it; an attacker with shell access cannot
  recover plaintext without unlocking the master key.
- **Cold-storage exfiltration of app data.** Keychain / Keystore entries are bound to the device
  and (when applicable) to a biometric or device passcode. Backups exclude protected entries.
- **Process-internal tampering.** Each entry carries an HMAC-SHA256 `integrityTag` over its
  metadata + ciphertext. Reads validate the tag and surface `IntegrityViolationError` on
  mismatch.
- **Biometric re-enrollment / "stolen device" reset.** Entries written with
  `secureEnclaveBiometry` or `biometryCurrentSet` are invalidated by the OS when the user
  enrolls or removes a biometric. Reads then surface `KeyInvalidatedError`, prompting the app
  to re-onboard.
- **Programmer error.** TS-side validation (`InvalidArgumentError`) rejects empty keys,
  oversized values, and non-string inputs **before** any native call is made.

## What it explicitly does **not** defend against

- **Compromised JavaScript runtime.** If an attacker can run arbitrary JS in your app, they can
  call `getItem` directly. Use additional defense-in-depth (e.g. SSL pinning, RASP) for
  high-value targets.
- **Forensic memory dump while the app is unlocked.** Decrypted values transit through
  React Native's JSI as standard JS strings; we do not zeroize the heap.
- **OS-level exploits / supply-chain compromise of the OEM.** Hardware-backed protection is
  only as strong as the chain of trust ending at the secure element vendor.
- **Side-channel timing attacks against the native crypto.** We rely on platform primitives
  (CryptoKit, AndroidX Security). These have not been audited for timing in this codebase.
- **Screenshots, accessibility services, and screen recording.** Values rendered to the UI
  are visible to anything that can read the screen.
- **Phishing/social engineering.** Biometric prompts cannot tell who is actually pressing the
  finger.

## Fallback ladder

The native layer continuously downgrades to the strongest scheme the device supports. Always
inspect `StorageMetadata.securityLevel` after writing to confirm what the platform applied.

```
secureEnclave  →  strongBox  →  biometry  →  deviceCredential  →  software
       (best)                                                       (worst)
```

| Tier               | iOS                                             | Android                                                     |
| ------------------ | ----------------------------------------------- | ----------------------------------------------------------- |
| `secureEnclave`    | Keys generated/used inside the Secure Enclave   | —                                                           |
| `strongBox`        | —                                               | Tamper-resistant secure element (Android 9+ where present)   |
| `biometry`         | Hardware-backed Keychain + biometric ACL        | Keystore key with `setUserAuthenticationRequired(true)`      |
| `deviceCredential` | Hardware-backed Keychain + device passcode ACL  | Keystore key with passcode-only auth                         |
| `software`         | Software fallback (simulators, very old devices)| `EncryptedSharedPreferences` fallback                        |

If you hold compliance constraints (e.g. PCI/HIPAA), refuse to write secrets when
`metadata.securityLevel === 'software'`. Reading the level requires no biometric prompt
(`includeValues: false` is enough).

## Recommended posture for high-value secrets

1. Request `accessControl: 'secureEnclaveBiometry'`.
2. Verify `metadata.securityLevel ∈ {'secureEnclave', 'strongBox'}` after write — refuse
   otherwise.
3. Rotate keys (`rotateKeys`) on a calendar (e.g. quarterly) or on suspicious-activity
   signals.
4. Catch `KeyInvalidatedError` and `IntegrityViolationError` separately — they imply different
   user-facing flows (re-onboard vs. force re-auth + telemetry).
5. Don't call `getItem` from background tasks unless you also pass `authenticationPrompt`. iOS
   silently fails biometric reads outside foreground.

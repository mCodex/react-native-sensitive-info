# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| 6.x | ✅ Supported
| 5.6.x | ✅ Supported
| < 5.6.0 | ❌ Not supported

We ship security fixes for the current v6 line and the latest v5 maintenance branch (≥ 5.6.0). Releases prior to 5.6.0 no longer receive patches—upgrade as soon as possible to stay protected.

## Reporting a Vulnerability

1. **Contact**: Email security reports to <mtw.andrade@gmail.com>.
2. **Disclosure Window**: We aim to acknowledge reports within 3 business days and provide a remediation plan within 10 business days.
3. **Coordinated Disclosure**: Please refrain from publicly disclosing the issue until a fix is available or 30 days have passed since acknowledgement.

## Patch Process

- Critical fixes ship in a point release for the supported branches (6.x and ≥ 5.6.0).
- Vulnerability advisories are published on the GitHub release page and npm once patches are available.
- We credit reporters who follow coordinated disclosure and wish to be acknowledged.

## Hardening Recommendations

- Stay on the latest minor release within your major version to receive defense-in-depth updates.
- Review the [Access control & metadata](README.md#-access-control--metadata) section for guidance on choosing the strongest policies.
- Test secure storage flows on physical hardware before shipping; emulators often omit secure elements.

Thank you for helping us keep `react-native-sensitive-info` secure.

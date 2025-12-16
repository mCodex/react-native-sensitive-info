## [6.0.0-rc.12](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.11...v6.0.0-rc.12) (2025-12-16)

### Features

* restructure app components and implement secure storage functionality ([b84ec82](https://github.com/mcodex/react-native-sensitive-info/commit/b84ec82e175eb0b7f951c08c5156a7931457c092))

### Bug Fixes

* add tokenRef for npm access verification in release-it configuration ([9e39622](https://github.com/mcodex/react-native-sensitive-info/commit/9e39622beac9c69d7a66dccd402c814764ab8dcc))
* update repository field format in package.json ([eeadcb8](https://github.com/mcodex/react-native-sensitive-info/commit/eeadcb890a4d30cefdb3f6ee2fba8ef2d4da6912))
## [6.0.0-rc.11](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.10...v6.0.0-rc.11) (2025-11-05)

### Bug Fixes

* **ios:** prompt simulator biometric auth before keychain fetch and probe security on main thread ([240bc60](https://github.com/mcodex/react-native-sensitive-info/commit/240bc609521d3d3d19e7e25b319bab2e8fb236d4))
## [6.0.0-rc.10](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.9...v6.0.0-rc.10) (2025-11-05)

### Bug Fixes

* **ios:** run SecItemCopyMatching on main thread and refine auth cancel handling ([c6cbfe3](https://github.com/mcodex/react-native-sensitive-info/commit/c6cbfe37c266cdaf32ddc65875142ba27c2df439))
## [6.0.0-rc.9](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.8...v6.0.0-rc.9) (2025-11-03)

### Bug Fixes

* **auth:** treat authentication cancellations as soft-failures and map native cancel codes ([4454883](https://github.com/mcodex/react-native-sensitive-info/commit/44548839c4755d1067c3246c1dab5e049ad44963))
## [6.0.0-rc.8](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.7...v6.0.0-rc.8) (2025-10-27)
## [6.0.0-rc.7](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.6...v6.0.0-rc.7) (2025-10-27)
## [6.0.0-rc.6](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.5...v6.0.0-rc.6) (2025-10-27)
## [6.0.0-rc.5](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.4...v6.0.0-rc.5) (2025-10-27)
## [6.0.0-rc.4](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.3...v6.0.0-rc.4) (2025-10-25)
## [6.0.0-rc.3](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.1...v6.0.0-rc.3) (2025-10-24)

### Features

* Add biometric authentication support for Android and iOS ([0310140](https://github.com/mcodex/react-native-sensitive-info/commit/0310140ce970195918973dfd256a4b10a035f89d))
* Add biometric security demo component and integrate biometric storage options ([1f7e3ac](https://github.com/mcodex/react-native-sensitive-info/commit/1f7e3acd6a794f42d363b2606b02a2756138208f))
* Add SecurityCapabilitiesDemo component and integrate security capabilities checks ([7f942a0](https://github.com/mcodex/react-native-sensitive-info/commit/7f942a041782d1ba6b40e15e2f74f8ab2afa6c55))
* Adding a hasItem method ([#259](https://github.com/mcodex/react-native-sensitive-info/issues/259)) ([1dc4825](https://github.com/mcodex/react-native-sensitive-info/commit/1dc48251fb4afc777351d6feb87d1c6cf2fe2d3b))
* Enhance security options with biometric and strongbox support in storage functions ([f554332](https://github.com/mcodex/react-native-sensitive-info/commit/f5543325c043ebb5bd5bc04a701b5c17c3a6fc8d))
* Implement secure storage using EncryptedSharedPreferences for Android ([5671fcd](https://github.com/mcodex/react-native-sensitive-info/commit/5671fcd1748915bdb3bd4d73f12437e0fdff873e))

### Bug Fixes

* **android:** Error is null on invalidateEnrollment set to false ([#258](https://github.com/mcodex/react-native-sensitive-info/issues/258)) ([4f9af66](https://github.com/mcodex/react-native-sensitive-info/commit/4f9af66a5df6ee8cc9f72bb25596fbdcbc16288c))
## [6.0.0-alpha9](https://github.com/mcodex/react-native-sensitive-info/compare/5.5.0...v6.0.0-alpha9) (2020-12-17)

### Features

* **android:** biometric api implementation ([9b608cf](https://github.com/mcodex/react-native-sensitive-info/commit/9b608cf7b98a39f27e632efef2ac2b68f7eb4104))

### Bug Fixes

* **android:** Android 11 auth required check ([#238](https://github.com/mcodex/react-native-sensitive-info/issues/238)) ([89dab84](https://github.com/mcodex/react-native-sensitive-info/commit/89dab8495821fb8d0a6169639fb068d81283c4a4))
* **android:** handle UnrecoverableKeyException ([79c8197](https://github.com/mcodex/react-native-sensitive-info/commit/79c81973f28f70d72216f8155b47b2c897358c38))
* **android:** key user not authenticated ([#224](https://github.com/mcodex/react-native-sensitive-info/issues/224)) ([bb9ef04](https://github.com/mcodex/react-native-sensitive-info/commit/bb9ef047d2bb16bdfe784d56e7f205d2059b15f7))
* **android:** normalize error codes ([#225](https://github.com/mcodex/react-native-sensitive-info/issues/225)) ([6937221](https://github.com/mcodex/react-native-sensitive-info/commit/6937221b5768ed082832245b3f43dfb365679658))
* **android:** remove unused code ([595e955](https://github.com/mcodex/react-native-sensitive-info/commit/595e955e2415df88ac8dec9d0bce6d2117b346a4))
* **android:** same callback logic between showModal options ([#220](https://github.com/mcodex/react-native-sensitive-info/issues/220)) ([7eef64a](https://github.com/mcodex/react-native-sensitive-info/commit/7eef64a75a0c43e18545eab5fad108d905cc7a3f))
* updated react dependency in podspec to enable build in Xcode 12 (for iOS >= 12) ([#246](https://github.com/mcodex/react-native-sensitive-info/issues/246)) ([a1b7e88](https://github.com/mcodex/react-native-sensitive-info/commit/a1b7e88240bb6bfa43baf3f006d029e4f9fd700b))
## [5.5.0](https://github.com/mcodex/react-native-sensitive-info/compare/5.4.0...5.5.0) (2019-07-31)

### Reverts

* Revert "Add config on android to controlled setInvalidatedByBiometricEnrollment property" ([8a01182](https://github.com/mcodex/react-native-sensitive-info/commit/8a0118270352400b9d54d94e9ba6d21976d2a2d5))
## [5.2.5](https://github.com/mcodex/react-native-sensitive-info/compare/5.2.4...5.2.5) (2018-08-07)
## [5.2.4](https://github.com/mcodex/react-native-sensitive-info/compare/5.2.3...5.2.4) (2018-07-27)
## [5.2.2](https://github.com/mcodex/react-native-sensitive-info/compare/5.2.1...5.2.2) (2018-07-26)

### Features

* adding TypeScript typings ([5a10dce](https://github.com/mcodex/react-native-sensitive-info/commit/5a10dce8a8277b495a0959a537ab4c8b2711e3bf))
## [5.2.1](https://github.com/mcodex/react-native-sensitive-info/compare/5.2.0...5.2.1) (2018-06-14)

### Features

* add more methods ([792de81](https://github.com/mcodex/react-native-sensitive-info/commit/792de819f2dda225bd99a8ab1ecce68d307426ab))
* handle exception by re-initialize key ([2144bfc](https://github.com/mcodex/react-native-sensitive-info/commit/2144bfc976025f3672b95e78ad56cac49b3f428f))
## [5.2.0](https://github.com/mcodex/react-native-sensitive-info/compare/5.1.0...5.2.0) (2017-10-10)
## [5.1.0](https://github.com/mcodex/react-native-sensitive-info/compare/5.0.1...5.1.0) (2017-05-25)
## [5.0.1](https://github.com/mcodex/react-native-sensitive-info/compare/3.0.1...5.0.1) (2017-05-16)
## [3.0.1](https://github.com/mcodex/react-native-sensitive-info/compare/3.0.0...3.0.1) (2016-06-20)
## [3.0.0](https://github.com/mcodex/react-native-sensitive-info/compare/2.2.0...3.0.0) (2016-06-14)
## [2.2.0](https://github.com/mcodex/react-native-sensitive-info/compare/2.1.0...2.2.0) (2016-06-11)
## [2.1.0](https://github.com/mcodex/react-native-sensitive-info/compare/f4de6a4559db2ffe9a0f49c08def24a04ac0b5e9...2.1.0) (2016-06-07)

### Reverts

* Revert "adding more items into .gitignore" ([f4de6a4](https://github.com/mcodex/react-native-sensitive-info/commit/f4de6a4559db2ffe9a0f49c08def24a04ac0b5e9))

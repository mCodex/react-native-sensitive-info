package com.sensitiveinfo.core

/**
 * Central dependency configuration for SensitiveInfo.
 *
 * This module would use Hilt for dependency injection in a production setup.
 * For now, it provides factory methods for creating core components.
 *
 * To enable Hilt integration:
 * 1. Add Hilt dependency: implementation 'com.google.dagger:hilt-android:VERSION'
 * 2. Uncomment @Module, @InstallIn, @Provides annotations below
 * 3. Add @Inject to constructors of components
 */

// Uncomment for Hilt DI setup:
// import dagger.Module
// import dagger.Provides
// import dagger.hilt.InstallIn
// import dagger.hilt.components.SingletonComponent
// import javax.inject.Singleton

// @Module
// @InstallIn(SingletonComponent::class)
// object SensitiveInfoModule {
//   @Singleton
//   @Provides
//   fun provideStorageValidator(): StorageValidator = StorageValidator()
// }

/**
 * Storage validation rules (internal use only).
 */
internal class StorageValidator {
  internal fun validateKey(key: String): Boolean = isValidStorageKey(key)
  internal fun validateValue(value: String): Boolean = isValidStorageValue(value)
  internal fun validateService(service: String): Boolean = isValidService(service)
}

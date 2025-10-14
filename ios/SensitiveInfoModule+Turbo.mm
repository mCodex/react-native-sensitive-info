#import <Foundation/Foundation.h>
#ifdef RCT_NEW_ARCH_ENABLED
#import <ReactCommon/RCTTurboModule.h>
#endif
#if __has_include(<SensitiveInfo/SensitiveInfo-Swift.h>)
#import <SensitiveInfo/SensitiveInfo-Swift.h>
#elif __has_include("SensitiveInfo-Swift.h")
#import "SensitiveInfo-Swift.h"
#endif

#ifdef RCT_NEW_ARCH_ENABLED
#import "NativeSensitiveInfoSpec.h"
#import <optional>
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wprotocol"
@protocol NativeSensitiveInfoSpec <NativeSensitiveInfoSpecSpec>
@end
#pragma clang diagnostic pop
#endif

#ifdef RCT_NEW_ARCH_ENABLED
@interface SensitiveInfo : NSObject <NativeSensitiveInfoSpec>
#else
@interface SensitiveInfo : NSObject
#endif
@end

@interface SensitiveInfo ()
@end

#ifdef RCT_NEW_ARCH_ENABLED
@interface SensitiveInfo (SwiftBridge)
- (void)setItemWithDictionary:(NSString *)key
                         value:(NSString *)value
                       options:(NSDictionary *)options
                        resolve:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject;
- (void)getItemWithDictionary:(NSString *)key
                       options:(NSDictionary *)options
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject;
- (void)hasItemWithDictionary:(NSString *)key
                       options:(NSDictionary *)options
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject;
- (void)getAllItemsWithDictionary:(NSDictionary *)options
                           resolve:(RCTPromiseResolveBlock)resolve
                            reject:(RCTPromiseRejectBlock)reject;
- (void)deleteItemWithDictionary:(NSString *)key
                          options:(NSDictionary *)options
                          resolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject;
- (void)isSensorAvailableBridge:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject;
- (void)hasEnrolledFingerprintsBridge:(RCTPromiseResolveBlock)resolve
                               reject:(RCTPromiseRejectBlock)reject;
@end
#endif

@implementation SensitiveInfo (TurboModule)

#ifdef RCT_NEW_ARCH_ENABLED
- (NSDictionary *)dictionaryFromPromptStrings:(JS::NativeSensitiveInfoSpec::AndroidPromptStrings)strings
{
  NSMutableDictionary *result = [NSMutableDictionary dictionary];
  if (auto value = strings.header()) {
    result[@"header"] = value;
  }
  if (auto value = strings.description()) {
    result[@"description"] = value;
  }
  if (auto value = strings.hint()) {
    result[@"hint"] = value;
  }
  if (auto value = strings.cancel()) {
    result[@"cancel"] = value;
  }
  if (auto value = strings.notRecognized()) {
    result[@"notRecognized"] = value;
  }
  if (auto value = strings.success()) {
    result[@"success"] = value;
  }
  if (auto value = strings.cancelled()) {
    result[@"cancelled"] = value;
  }
  return result.count > 0 ? [result copy] : @{};
}

- (NSDictionary *)dictionaryFromOptions:(JS::NativeSensitiveInfoSpec::SensitiveInfoOptions &)options
{
  NSMutableDictionary *result = [NSMutableDictionary dictionary];

  if (auto value = options.keychainService()) {
    result[@"keychainService"] = value;
  }
  if (auto value = options.sharedPreferencesName()) {
    result[@"sharedPreferencesName"] = value;
  }

  if (auto touchID = options.touchID()) {
    result[@"touchID"] = @(*touchID);
  }
  if (auto showModal = options.showModal()) {
    result[@"showModal"] = @(*showModal);
  }

  if (auto strings = options.strings()) {
    NSDictionary *stringsDictionary = [self dictionaryFromPromptStrings:*strings];
    if (stringsDictionary.count > 0) {
      result[@"strings"] = stringsDictionary;
    }
  }

  if (auto value = options.kSecAttrAccessible()) {
    result[@"kSecAttrAccessible"] = value;
  }
  if (auto value = options.kSecAccessControl()) {
    result[@"kSecAccessControl"] = value;
  }
  if (auto value = options.kSecUseOperationPrompt()) {
    result[@"kSecUseOperationPrompt"] = value;
  }
  if (auto value = options.kLocalizedFallbackTitle()) {
    result[@"kLocalizedFallbackTitle"] = value;
  }
  if (auto value = options.kSecAttrSynchronizable()) {
    result[@"kSecAttrSynchronizable"] = value;
  }

  return [result copy];
}

- (void)setItem:(NSString *)key
          value:(NSString *)value
        options:(JS::NativeSensitiveInfoSpec::SensitiveInfoOptions &)options
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  [self setItemWithDictionary:key
                         value:value
                       options:[self dictionaryFromOptions:options]
                        resolve:resolve
                         reject:reject];
}

- (void)getItem:(NSString *)key
        options:(JS::NativeSensitiveInfoSpec::SensitiveInfoOptions &)options
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  [self getItemWithDictionary:key
                       options:[self dictionaryFromOptions:options]
                       resolve:resolve
                        reject:reject];
}

- (void)hasItem:(NSString *)key
        options:(JS::NativeSensitiveInfoSpec::SensitiveInfoOptions &)options
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  [self hasItemWithDictionary:key
                       options:[self dictionaryFromOptions:options]
                       resolve:resolve
                        reject:reject];
}

- (void)getAllItems:(JS::NativeSensitiveInfoSpec::SensitiveInfoOptions &)options
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  [self getAllItemsWithDictionary:[self dictionaryFromOptions:options]
                           resolve:resolve
                            reject:reject];
}

- (void)deleteItem:(NSString *)key
           options:(JS::NativeSensitiveInfoSpec::SensitiveInfoOptions &)options
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [self deleteItemWithDictionary:key
                          options:[self dictionaryFromOptions:options]
                          resolve:resolve
                           reject:reject];
}

- (void)isSensorAvailable:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  [self isSensorAvailableBridge:resolve reject:reject];
}

- (void)hasEnrolledFingerprints:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject
{
  [self hasEnrolledFingerprintsBridge:resolve reject:reject];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeSensitiveInfoSpecSpecJSI>(params);
}
#endif

@end

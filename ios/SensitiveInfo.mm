#import "SensitiveInfo.h"

#import <Security/Security.h>
#import <React/RCTConvert.h>
#import <React/RCTUtils.h>

#if !TARGET_OS_TV
#import <LocalAuthentication/LocalAuthentication.h>
#endif

static NSString *const kDefaultKeychainService = @"app";

static CFStringRef ConvertAttrAccessible(NSString *key) {
  if ([key isEqualToString:@"kSecAttrAccessibleAfterFirstUnlock"]) {
    return kSecAttrAccessibleAfterFirstUnlock;
  }
  if ([key isEqualToString:@"kSecAttrAccessibleAlways"]) {
    return kSecAttrAccessibleAlways;
  }
  if ([key isEqualToString:@"kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly"]) {
    return kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly;
  }
  if ([key isEqualToString:@"kSecAttrAccessibleWhenUnlockedThisDeviceOnly"]) {
    return kSecAttrAccessibleWhenUnlockedThisDeviceOnly;
  }
  if ([key isEqualToString:@"kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly"]) {
    return kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly;
  }
  if ([key isEqualToString:@"kSecAttrAccessibleAlwaysThisDeviceOnly"]) {
    return kSecAttrAccessibleAlwaysThisDeviceOnly;
  }
  return kSecAttrAccessibleWhenUnlocked;
}

static CFOptionFlags ConvertAccessControl(NSString *key) {
  if ([key isEqualToString:@"kSecAccessControlApplicationPassword"]) {
    return kSecAccessControlApplicationPassword;
  }
  if ([key isEqualToString:@"kSecAccessControlPrivateKeyUsage"]) {
    return kSecAccessControlPrivateKeyUsage;
  }
  if ([key isEqualToString:@"kSecAccessControlDevicePasscode"]) {
    return kSecAccessControlDevicePasscode;
  }
  if ([key isEqualToString:@"kSecAccessControlTouchIDAny"]) {
    return kSecAccessControlTouchIDAny;
  }
  if ([key isEqualToString:@"kSecAccessControlTouchIDCurrentSet"]) {
    return kSecAccessControlTouchIDCurrentSet;
  }
  if ([key isEqualToString:@"kSecAccessControlBiometryAny"]) {
    return kSecAccessControlBiometryAny;
  }
  if ([key isEqualToString:@"kSecAccessControlBiometryCurrentSet"]) {
    return kSecAccessControlBiometryCurrentSet;
  }
  return kSecAccessControlUserPresence;
}

static NSString *StringFromStatus(OSStatus status) {
  return [NSString stringWithFormat:@"%ld", (long)status];
}

@interface SensitiveInfo ()
#if !TARGET_OS_TV
@property(nonatomic, strong, nullable) LAContext *activeContext;
#endif
@property(nonatomic, assign) BOOL invalidateBiometricEnrollment;
@end

@implementation SensitiveInfo

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (instancetype)init {
  if ((self = [super init])) {
    _invalidateBiometricEnrollment = YES;
  }
  return self;
}

- (NSDictionary *)constantsToExport {
  return @{};
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getConstants) {
  return [self constantsToExport];
}

- (NSMutableDictionary *)baseQueryForKey:(NSString *)key options:(NSDictionary *)options {
  NSString *service = [RCTConvert NSString:options[@"keychainService"]];
  if (service == nil) {
    service = kDefaultKeychainService;
  }

  id synchronizable = options[@"kSecAttrSynchronizable"];
  if (synchronizable == nil) {
    synchronizable = (__bridge id)kSecAttrSynchronizableAny;
  } else {
    synchronizable = [RCTConvert BOOL:synchronizable] ? @YES : @NO;
  }

  NSMutableDictionary *query = [@{
    (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
    (__bridge id)kSecAttrAccount: key,
    (__bridge id)kSecAttrService: service,
    (__bridge id)kSecAttrSynchronizable: synchronizable
  } mutableCopy];

  return query;
}

- (NSString *)messageForError:(NSError *)error {
  switch (error.code) {
    case errSecUnimplemented:
      return @"Function or operation not implemented.";
    case errSecIO:
      return @"I/O error.";
    case errSecOpWr:
      return @"File already open with with write permission.";
    case errSecParam:
      return @"One or more parameters passed to a function where not valid.";
    case errSecAllocate:
      return @"Failed to allocate memory.";
    case errSecUserCanceled:
      return @"User canceled the operation.";
    case errSecBadReq:
      return @"Bad parameter or invalid state for operation.";
    case errSecNotAvailable:
      return @"No keychain is available. You may need to restart your device.";
    case errSecDuplicateItem:
      return @"The specified item already exists in the keychain.";
    case errSecItemNotFound:
      return @"The specified item could not be found in the keychain.";
    case errSecInteractionNotAllowed:
      return @"User interaction is not allowed.";
    case errSecDecode:
      return @"Unable to decode the provided data.";
    case errSecAuthFailed:
      return @"The user name or passphrase you entered is not correct.";
    default:
      return error.localizedDescription ?: @"Unknown keychain error.";
  }
}

- (void)rejectStatus:(OSStatus)status block:(RCTPromiseRejectBlock)reject {
  NSError *error = [NSError errorWithDomain:NSOSStatusErrorDomain code:status userInfo:nil];
  reject(StringFromStatus(status), [self messageForError:error], error);
}

- (BOOL)applyProtection:(NSMutableDictionary *)query options:(NSDictionary *)options error:(NSError **)error {
  BOOL useTouchID = [RCTConvert BOOL:options[@"touchID"]];
  if (!useTouchID) {
    NSString *accessibleString = [RCTConvert NSString:options[@"kSecAttrAccessible"]];
    if (accessibleString != nil) {
      query[(__bridge id)kSecAttrAccessible] = (__bridge id)ConvertAttrAccessible(accessibleString);
    }
    return YES;
  }

#if TARGET_OS_TV
  if (error != NULL) {
    *error = [NSError errorWithDomain:@"SensitiveInfo" code:-1 userInfo:@{NSLocalizedDescriptionKey: @"Biometric storage is not supported on tvOS."}];
  }
  return NO;
#else
  NSString *accessibleString = [RCTConvert NSString:options[@"kSecAttrAccessible"]];
  CFStringRef accessible = accessibleString != nil ? ConvertAttrAccessible(accessibleString) : kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly;

  NSString *accessControlString = [RCTConvert NSString:options[@"kSecAccessControl"]];
  CFOptionFlags accessControlFlags;
  if (accessControlString != nil) {
    accessControlFlags = ConvertAccessControl(accessControlString);
  } else {
    accessControlFlags = self.invalidateBiometricEnrollment ? kSecAccessControlBiometryCurrentSet : kSecAccessControlBiometryAny;
  }

  CFErrorRef creationError = NULL;
  SecAccessControlRef accessControl = SecAccessControlCreateWithFlags(NULL, accessible, accessControlFlags, &creationError);
  if (accessControl == NULL) {
    if (error != NULL) {
      *error = CFBridgingRelease(creationError);
    } else if (creationError != NULL) {
      CFRelease(creationError);
    }
    return NO;
  }

  query[(__bridge id)kSecAttrAccessControl] = (__bridge_transfer id)accessControl;
  return YES;
#endif
}

- (NSMutableDictionary *)queryForGet:(NSString *)key options:(NSDictionary *)options {
  NSMutableDictionary *query = [self baseQueryForKey:key options:options];
  query[(__bridge id)kSecReturnAttributes] = (__bridge id)kCFBooleanTrue;
  query[(__bridge id)kSecReturnData] = (__bridge id)kCFBooleanTrue;
  query[(__bridge id)kSecMatchLimit] = (__bridge id)kSecMatchLimitOne;

  NSString *prompt = [RCTConvert NSString:options[@"kSecUseOperationPrompt"]];
  if (prompt != nil) {
    query[(__bridge id)kSecUseOperationPrompt] = prompt;
  }

  BOOL useTouchID = [RCTConvert BOOL:options[@"touchID"]];
  if (!useTouchID) {
    NSString *accessibleString = [RCTConvert NSString:options[@"kSecAttrAccessible"]];
    if (accessibleString != nil) {
      query[(__bridge id)kSecAttrAccessible] = (__bridge id)ConvertAttrAccessible(accessibleString);
    }
  }

  return query;
}

- (NSString *)promptFromOptions:(NSDictionary *)options {
  NSString *prompt = [RCTConvert NSString:options[@"kSecUseOperationPrompt"]];
  if (prompt.length == 0) {
    return @"Authenticate to access stored information";
  }
  return prompt;
}

#if !TARGET_OS_TV
- (LAPolicy)policyForOptions:(NSDictionary *)options fallbackTitle:(NSString *)fallbackTitle {
  if (fallbackTitle.length > 0) {
    return LAPolicyDeviceOwnerAuthentication;
  }
  return LAPolicyDeviceOwnerAuthenticationWithBiometrics;
}
#endif

- (void)fetchItemWithQuery:(NSDictionary *)query resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    CFTypeRef resultRef = NULL;
    OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &resultRef);

    if (status == errSecItemNotFound) {
      resolve(nil);
      return;
    }

    if (status != errSecSuccess) {
      [self rejectStatus:status block:reject];
      return;
    }

    NSDictionary *item = (__bridge_transfer NSDictionary *)resultRef;
    NSData *valueData = item[(__bridge id)kSecValueData];
    if (![valueData isKindOfClass:[NSData class]]) {
      resolve(nil);
      return;
    }

    NSString *value = [[NSString alloc] initWithData:valueData encoding:NSUTF8StringEncoding];
    resolve(value);
  });
}

- (NSArray<NSDictionary *> *)resultsFromQuery:(NSDictionary *)query {
  CFTypeRef resultRef = NULL;
  OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &resultRef);
  if (status != errSecSuccess || resultRef == NULL) {
    return @[];
  }

  NSArray *items = (__bridge_transfer NSArray *)resultRef;
  if (![items isKindOfClass:[NSArray class]]) {
    return @[];
  }

  NSMutableArray<NSDictionary *> *finalResults = [NSMutableArray arrayWithCapacity:items.count];
  for (NSDictionary *item in items) {
    if (![item isKindOfClass:[NSDictionary class]]) {
      continue;
    }
    NSString *service = item[(__bridge id)kSecAttrService];
    NSString *key = item[(__bridge id)kSecAttrAccount];
    NSData *valueData = item[(__bridge id)kSecValueData];
    if (key.length == 0 || ![valueData isKindOfClass:[NSData class]]) {
      continue;
    }
    NSString *value = [[NSString alloc] initWithData:valueData encoding:NSUTF8StringEncoding];
    if (value == nil) {
      continue;
    }
    [finalResults addObject:@{
      @"key": key,
      @"value": value,
      @"service": service ?: kDefaultKeychainService
    }];
  }

  return finalResults;
}

RCT_EXPORT_METHOD(setItem:(NSString *)key
                  value:(NSString *)value
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSMutableDictionary *query = [self baseQueryForKey:key options:options];
    NSData *valueData = [value dataUsingEncoding:NSUTF8StringEncoding];
    query[(__bridge id)kSecValueData] = valueData;

    NSError *protectionError = nil;
    if (![self applyProtection:query options:options error:&protectionError]) {
      reject(@"E_SEC_ACCESS", protectionError.localizedDescription ?: @"Failed to configure keychain item", protectionError);
      return;
    }

    OSStatus status = SecItemAdd((__bridge CFDictionaryRef)query, NULL);
    if (status == errSecSuccess) {
      resolve(nil);
      return;
    }

    if (status == errSecDuplicateItem) {
      NSMutableDictionary *updateQuery = [self baseQueryForKey:key options:options];
      NSDictionary *attributesToUpdate = @{ (__bridge id)kSecValueData: valueData };
      status = SecItemUpdate((__bridge CFDictionaryRef)updateQuery, (__bridge CFDictionaryRef)attributesToUpdate);
    }

    if (status != errSecSuccess) {
      [self rejectStatus:status block:reject];
      return;
    }

    resolve(nil);
  });
}

RCT_EXPORT_METHOD(getItem:(NSString *)key
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSMutableDictionary *query = [self queryForGet:key options:options];
  BOOL useTouchID = [RCTConvert BOOL:options[@"touchID"]];

  if (!useTouchID) {
    [self fetchItemWithQuery:query resolver:resolve rejecter:reject];
    return;
  }

#if TARGET_OS_TV
  reject(@"E_UNAVAILABLE", @"Biometric authentication is not available on tvOS.", nil);
#else
  NSString *fallbackTitle = [RCTConvert NSString:options[@"kLocalizedFallbackTitle"]];
  LAContext *context = [[LAContext alloc] init];
  context.localizedFallbackTitle = fallbackTitle ?: @"";
  context.touchIDAuthenticationAllowableReuseDuration = 1;

  query[(__bridge id)kSecUseAuthenticationContext] = context;

  self.activeContext = context;
  LAPolicy policy = [self policyForOptions:options fallbackTitle:fallbackTitle ?: @""]; 
  NSString *prompt = [self promptFromOptions:options];

  dispatch_async(dispatch_get_main_queue(), ^{
    [context evaluatePolicy:policy localizedReason:prompt reply:^(BOOL success, NSError * _Nullable error) {
      self.activeContext = nil;
      if (!success) {
        if (error) {
          reject(StringFromStatus((OSStatus)error.code), error.localizedDescription, error);
        } else {
          reject(@"E_AUTH_FAILED", @"Biometric authentication failed.", nil);
        }
        return;
      }

      [self fetchItemWithQuery:query resolver:resolve rejecter:reject];
    }];
  });
#endif
}

RCT_EXPORT_METHOD(hasItem:(NSString *)key
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSMutableDictionary *query = [self baseQueryForKey:key options:options];
    query[(__bridge id)kSecReturnData] = (__bridge id)kCFBooleanFalse;
    query[(__bridge id)kSecReturnAttributes] = (__bridge id)kCFBooleanFalse;
    query[(__bridge id)kSecMatchLimit] = (__bridge id)kSecMatchLimitOne;

    CFTypeRef resultRef = NULL;
    OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &resultRef);
    if (resultRef != NULL) {
      CFRelease(resultRef);
    }

    if (status == errSecItemNotFound) {
      resolve(@(NO));
      return;
    }

    if (status != errSecSuccess) {
      [self rejectStatus:status block:reject];
      return;
    }

    resolve(@(YES));
  });
}

RCT_EXPORT_METHOD(getAllItems:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSString *service = [RCTConvert NSString:options[@"keychainService"]];

    NSMutableDictionary *query = [@{
      (__bridge id)kSecReturnAttributes: (__bridge id)kCFBooleanTrue,
      (__bridge id)kSecReturnData: (__bridge id)kCFBooleanTrue,
      (__bridge id)kSecMatchLimit: (__bridge id)kSecMatchLimitAll,
      (__bridge id)kSecAttrSynchronizable: (__bridge id)kSecAttrSynchronizableAny
    } mutableCopy];

    if (service.length > 0) {
      query[(__bridge id)kSecAttrService] = service;
    }

    NSArray *classes = @[ (__bridge id)kSecClassGenericPassword,
                          (__bridge id)kSecClassInternetPassword ];

    NSMutableArray<NSDictionary *> *collected = [NSMutableArray array];
    for (id secClass in classes) {
      query[(__bridge id)kSecClass] = secClass;
      [collected addObjectsFromArray:[self resultsFromQuery:query]];
    }

    resolve(collected);
  });
}

RCT_EXPORT_METHOD(deleteItem:(NSString *)key
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSDictionary *query = [self baseQueryForKey:key options:options];
    OSStatus status = SecItemDelete((__bridge CFDictionaryRef)query);
    if (status != errSecSuccess && status != errSecItemNotFound) {
      [self rejectStatus:status block:reject];
      return;
    }
    resolve(nil);
  });
}

RCT_EXPORT_METHOD(isSensorAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
#if TARGET_OS_TV
  resolve(@(NO));
#else
  LAContext *context = [[LAContext alloc] init];
  NSError *error = nil;
  if ([context canEvaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics error:&error]) {
    if (@available(iOS 11.0, *)) {
      if (context.biometryType == LABiometryTypeFaceID) {
        resolve(@"Face ID");
        return;
      }
    }
    resolve(@"Touch ID");
    return;
  }

  if (error.code == LAErrorBiometryLockout) {
    reject(@"E_BIOMETRY_LOCKED", @"Biometry is locked", error);
    return;
  }
  resolve(@(NO));
#endif
}

RCT_EXPORT_METHOD(hasEnrolledFingerprints:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
#if TARGET_OS_TV
  resolve(@(NO));
#else
  LAContext *context = [[LAContext alloc] init];
  NSError *error = nil;
  BOOL canEvaluate = [context canEvaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics error:&error];
  if (canEvaluate) {
    resolve(@(YES));
    return;
  }

  if (error == nil) {
    resolve(@(NO));
    return;
  }

  if (error.code == LAErrorBiometryNotEnrolled || error.code == LAErrorBiometryNotAvailable) {
    resolve(@(NO));
    return;
  }

  if (error.code == LAErrorBiometryLockout) {
    reject(@"E_BIOMETRY_LOCKED", @"Biometry is locked", error);
    return;
  }

  resolve(@(NO));
#endif
}

RCT_EXPORT_METHOD(cancelFingerprintAuth)
{
#if !TARGET_OS_TV
  LAContext *context = self.activeContext;
  if (context != nil) {
    [context invalidate];
    self.activeContext = nil;
  }
#endif
}

RCT_EXPORT_METHOD(setInvalidatedByBiometricEnrollment:(BOOL)value)
{
  self.invalidateBiometricEnrollment = value;
}

@end

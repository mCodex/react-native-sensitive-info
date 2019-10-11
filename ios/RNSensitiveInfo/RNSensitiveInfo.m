/* Adapted From https://github.com/oblador/react-native-keychain */

#import <Security/Security.h>
#import "RNSensitiveInfo.h"
#import "React/RCTConvert.h"
#import "React/RCTBridge.h"
#import "React/RCTUtils.h"

#if !TARGET_OS_TV
#import <LocalAuthentication/LocalAuthentication.h>
#endif

@implementation RNSensitiveInfo

@synthesize bridge = _bridge;
RCT_EXPORT_MODULE();

CFStringRef convertkSecAttrAccessible(NSString* key){
    if([key isEqual: @"kSecAttrAccessibleAfterFirstUnlock"]){
        return kSecAttrAccessibleAfterFirstUnlock;
    }
    if([key isEqual: @"kSecAttrAccessibleAlways"]){
        return kSecAttrAccessibleAlways;
    }
    if([key isEqual: @"kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly"]){
        return kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly;
    }
    if([key isEqual: @"kSecAttrAccessibleWhenUnlockedThisDeviceOnly"]){
        return kSecAttrAccessibleWhenUnlockedThisDeviceOnly;
    }
    if([key isEqual: @"kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly"]){
        return kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly;
    }
    if([key isEqual: @"kSecAttrAccessibleAlwaysThisDeviceOnly"]){
        return kSecAttrAccessibleAlwaysThisDeviceOnly;
    }
    if ([key isEqual: @"kSecAccessControlBiometryAny"]) {
        return kSecAccessControlBiometryAny;
    }
    if ([key isEqual: @"kSecAccessControlBiometryCurrentSet"]) {
        return kSecAccessControlBiometryCurrentSet;
    }
    return kSecAttrAccessibleWhenUnlocked;
}

CFStringRef convertkSecAccessControl(NSString* key){
    if([key isEqual: @"kSecAccessControlApplicationPassword"]){
        return kSecAccessControlApplicationPassword;
    }
    if([key isEqual: @"kSecAccessControlPrivateKeyUsage"]){
        return kSecAccessControlPrivateKeyUsage;
    }
    if([key isEqual: @"kSecAccessControlDevicePasscode"]){
        return kSecAccessControlDevicePasscode;
    }
    if([key isEqual: @"kSecAccessControlTouchIDAny"]){
        return kSecAccessControlTouchIDAny;
    }
    if([key isEqual: @"kSecAccessControlTouchIDCurrentSet"]){
        return kSecAccessControlTouchIDCurrentSet;
    }
    return kSecAccessControlUserPresence;
}

// Messages from the comments in <Security/SecBase.h>
- (NSString *)messageForError:(NSError *)error
{
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
      return @"No keychain is available. You may need to restart your computer.";

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
      return error.localizedDescription;
  }
}

RCT_EXPORT_METHOD(setItem:(NSString*)key value:(NSString*)value options:(NSDictionary *)options resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject){

    NSString * keychainService = [RCTConvert NSString:options[@"keychainService"]];
    if (keychainService == NULL) {
        keychainService = @"app";
    }

    NSData* valueData = [value dataUsingEncoding:NSUTF8StringEncoding];
    NSMutableDictionary* query = [NSMutableDictionary dictionaryWithObjectsAndKeys:
                                      (__bridge id)(kSecClassGenericPassword), kSecClass,
                                      keychainService, kSecAttrService,
                                      valueData, kSecValueData,
                                      key, kSecAttrAccount, nil];

    if([RCTConvert BOOL:options[@"kSecAttrSynchronizable"]]){
        [query setValue:@YES forKey:(NSString *)kSecAttrSynchronizable];
    }

    if([RCTConvert BOOL:options[@"touchID"]]){
        CFStringRef kSecAccessControlValue = convertkSecAccessControl([RCTConvert NSString:options[@"kSecAccessControl"]]);
        SecAccessControlRef sac = SecAccessControlCreateWithFlags(kCFAllocatorDefault, kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, kSecAccessControlValue, NULL);
        [query setValue:(__bridge id _Nullable)(sac) forKey:(NSString *)kSecAttrAccessControl];
    } else if([RCTConvert NSString:options[@"kSecAttrAccessible"]] != NULL){
        CFStringRef kSecAttrAccessibleValue = convertkSecAttrAccessible([RCTConvert NSString:options[@"kSecAttrAccessible"]]);
        [query setValue:(__bridge id _Nullable)(kSecAttrAccessibleValue) forKey:(NSString *)kSecAttrAccessible];
    }

    OSStatus osStatus = SecItemDelete((__bridge CFDictionaryRef) query);
    osStatus = SecItemAdd((__bridge CFDictionaryRef) query, NULL);
    if (osStatus != noErr) {
        NSError *error = [NSError errorWithDomain:NSOSStatusErrorDomain code:osStatus userInfo:nil];
        reject([NSString stringWithFormat:@"%ld",(long)error.code], [self messageForError:error], nil);
        return;
    }
    resolve(value);
}

RCT_EXPORT_METHOD(getItem:(NSString *)key options:(NSDictionary *)options resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject){
    
    
    NSString * keychainService = [RCTConvert NSString:options[@"keychainService"]];
    if (keychainService == NULL) {
        keychainService = @"app";
    }
    
    // Create dictionary of search parameters
    NSMutableDictionary* query = [NSMutableDictionary dictionaryWithObjectsAndKeys:(__bridge id)(kSecClassGenericPassword), kSecClass,
                                  keychainService, kSecAttrService,
                                  key, kSecAttrAccount,
                                  kSecAttrSynchronizableAny, kSecAttrSynchronizable,
                                  kCFBooleanTrue, kSecReturnAttributes,
                                  kCFBooleanTrue, kSecReturnData,
                                  nil];
    
    if([RCTConvert NSString:options[@"kSecUseOperationPrompt"]] != NULL){
        [query setValue:[RCTConvert NSString:options[@"kSecUseOperationPrompt"]] forKey:(NSString *)kSecUseOperationPrompt];
    }
    
    if([RCTConvert BOOL:options[@"touchID"]]){
        LAContext *context = [[LAContext alloc] init];
        NSString *kLocalizedFallbackTitle = [RCTConvert NSString:options[@"kLocalizedFallbackTitle"]];
        context.localizedFallbackTitle = kLocalizedFallbackTitle ? kLocalizedFallbackTitle : @"";
        context.touchIDAuthenticationAllowableReuseDuration = 1;
        
        [query setValue:context forKey:(NSString *)kSecUseAuthenticationContext];
        
        NSString *prompt = @"";
        if ([RCTConvert NSString:options[@"kSecUseOperationPrompt"]] != NULL) {
            prompt = [RCTConvert NSString:options[@"kSecUseOperationPrompt"]];
        }
        
        // If kLocalizedFallbackTitle exist, LAPolicy must allow fallback to pin also
        NSInteger policy = kLocalizedFallbackTitle ? LAPolicyDeviceOwnerAuthentication : LAPolicyDeviceOwnerAuthenticationWithBiometrics;
        
        [context evaluatePolicy:policy
                localizedReason:prompt
                          reply:^(BOOL success, NSError * _Nullable error) {
                              if (!success) {
                                  if (error) {
                                      reject(nil, error.localizedDescription, error);
                                  } else {
                                      reject(nil, @"The user name or passphrase you entered is not correct.", nil);
                                  }
                                  return;
                              }
                              
                              [self getItemWithQuery:query resolver:resolve rejecter:reject];
                          }];
        return;
    }
    
    [self getItemWithQuery:query resolver:resolve rejecter:reject];
}

- (void)getItemWithQuery:(NSDictionary *)query resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
    // Look up server in the keychain
    NSDictionary* found = nil;
    CFTypeRef foundTypeRef = NULL;
    OSStatus osStatus = SecItemCopyMatching((__bridge CFDictionaryRef) query, (CFTypeRef*)&foundTypeRef);
    
    if (osStatus != noErr && osStatus != errSecItemNotFound) {
        NSError *error = [NSError errorWithDomain:NSOSStatusErrorDomain code:osStatus userInfo:nil];
        reject([NSString stringWithFormat:@"%ld",(long)error.code], [self messageForError:error], nil);
        return;
    }
    
    found = (__bridge NSDictionary*)(foundTypeRef);
    if (!found) {
        resolve(nil);
    } else {
        // Found
        NSString* value = [[NSString alloc] initWithData:[found objectForKey:(__bridge id)(kSecValueData)] encoding:NSUTF8StringEncoding];
        resolve(value);
        
    }
}

RCT_EXPORT_METHOD(getAllItems:(NSDictionary *)options resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject){
    
    NSString * keychainService = [RCTConvert NSString:options[@"keychainService"]];
    
    NSMutableArray* finalResult = [[NSMutableArray alloc] init];
    NSMutableDictionary *query = [NSMutableDictionary dictionaryWithObjectsAndKeys:
                                  (__bridge id)kSecAttrSynchronizableAny, kSecAttrSynchronizable,
                                  (__bridge id)kCFBooleanTrue, (__bridge id)kSecReturnAttributes,
                                  (__bridge id)kSecMatchLimitAll, (__bridge id)kSecMatchLimit,
                                  (__bridge id)kCFBooleanTrue, (__bridge id)kSecReturnData,
                                  nil];
    
    if (keychainService) {
        [query setObject:keychainService forKey:(NSString *)kSecAttrService];
    }
    
    NSArray *secItemClasses = [NSArray arrayWithObjects:
                               (__bridge id)kSecClassGenericPassword,
                               (__bridge id)kSecClassInternetPassword,
                               (__bridge id)kSecClassCertificate,
                               (__bridge id)kSecClassKey,
                               (__bridge id)kSecClassIdentity,
                               nil];

    for (id secItemClass in secItemClasses) {
        [query setObject:secItemClass forKey:(__bridge id)kSecClass];

        CFTypeRef result = NULL;

        SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);

        if(result!=NULL){
            //[finalResult removeObjectAtIndex:3];

            for (NSDictionary* item in (__bridge id)result) {
                NSMutableDictionary *finalItem = [[NSMutableDictionary alloc] init];
              
                @try
                {
                  [finalItem setObject:(NSString*)[item objectForKey:(__bridge id)(kSecAttrService)] forKey:@"service"];
                  [finalItem setObject:(NSString*)[item objectForKey:(__bridge id)(kSecAttrAccount)] forKey:@"key"];
                  [finalItem setObject:[[NSString alloc] initWithData:[item objectForKey:(__bridge id)(kSecValueData)] encoding:NSUTF8StringEncoding] forKey:@"value"];

                  [finalResult addObject: finalItem];
                }
                @catch(NSException *exception){} // Ignore items with weird keys or values
            }

        }
    }
    if(finalResult != nil){
    resolve(@[finalResult]);
    } else {
        reject(@"no_events", @"There were no events", @[[NSNull null]]);
    }
}


RCT_EXPORT_METHOD(deleteItem:(NSString *)key options:(NSDictionary *)options resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject){

    NSString * keychainService = [RCTConvert NSString:options[@"keychainService"]];
    if (keychainService == NULL) {
        keychainService = @"app";
    }

    // Create dictionary of search parameters
    NSDictionary* query = [NSDictionary dictionaryWithObjectsAndKeys:
                          (__bridge id)(kSecClassGenericPassword), kSecClass,
                          (__bridge id)(kSecAttrSynchronizableAny), kSecAttrSynchronizable,
                          keychainService, kSecAttrService,
                          key, kSecAttrAccount,
                          kCFBooleanTrue, kSecReturnAttributes,
                          kCFBooleanTrue, kSecReturnData, nil];

    // Remove any old values from the keychain
    OSStatus osStatus = SecItemDelete((__bridge CFDictionaryRef) query);
    if (osStatus != noErr && osStatus != errSecItemNotFound) {
        NSError *error = [NSError errorWithDomain:NSOSStatusErrorDomain code:osStatus userInfo:nil];
        reject([NSString stringWithFormat:@"%ld",(long)error.code], [self messageForError:error], nil);
        return;
    }
    resolve(nil);
}

RCT_EXPORT_METHOD(isSensorAvailable:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
#if !TARGET_OS_TV
    LAContext *context = [[LAContext alloc] init];
    
    NSError *evaluationError = nil;
    if ([context canEvaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics error:&evaluationError]) {
        if (@available(iOS 11, macOS 10.13.2, *)) {
            if (context.biometryType == LABiometryTypeFaceID) {
                return resolve(@"Face ID");
            }
        }
        resolve(@"Touch ID");
    } else {
        if (evaluationError && evaluationError.code == LAErrorBiometryLockout) {
            return reject(nil, @"Biometry is locked", nil);
        }
        resolve(@(NO));
    }
#else
  resolve(@(NO));
#endif
}
@end

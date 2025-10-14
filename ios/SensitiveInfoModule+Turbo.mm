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

@implementation SensitiveInfo (TurboModule)

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeSensitiveInfoSpecSpecJSI>(params);
}
#endif

@end

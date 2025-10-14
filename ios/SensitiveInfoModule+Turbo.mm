#import <React/RCTBridgeModule.h>
#import <React/RCTTurboModule.h>
#import "SensitiveInfoModule-Swift.h"

#ifdef RCT_NEW_ARCH_ENABLED
#import "NativeSensitiveInfoSpec.h"
#endif

@interface SensitiveInfo ()
#ifdef RCT_NEW_ARCH_ENABLED
<NativeSensitiveInfoSpec>
#endif
@end

@implementation SensitiveInfo (TurboModule)

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeSensitiveInfoSpecJSI>(params);
}
#endif

@end

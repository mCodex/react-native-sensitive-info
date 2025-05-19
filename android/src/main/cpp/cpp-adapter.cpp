#include <jni.h>
#include "sensitiveinfoOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::sensitiveinfo::initialize(vm);
}

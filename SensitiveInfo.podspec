require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "SensitiveInfo"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  # Multi-platform support: iOS, macOS, visionOS, watchOS
  s.platforms = {
    :ios       => "13.0",
    :macos     => "10.15",
    :visionos  => "1.0",
    :watchos   => "6.0"
  }
  
  s.source       = { :git => "https://github.com/mCodex/react-native-sensitive-info.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.private_header_files = "ios/**/*.h"
  
  # Swift version
  s.swift_version = "5.5"
  
  # Framework dependencies
  s.frameworks = "Security", "LocalAuthentication"
  
  # Platform-specific frameworks
  s.ios.frameworks = "UIKit"
  s.macos.frameworks = "AppKit"
  s.visionos.frameworks = "RealityKit"
  
  install_modules_dependencies(s)
end

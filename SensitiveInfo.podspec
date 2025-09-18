require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "SensitiveInfo"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/mCodex/react-native-sensitive-info.git", :tag => "#{s.version}" }


  s.source_files = [
    "ios/**/*.{swift}",
    "ios/**/*.{m,mm}",
    "cpp/**/*.{hpp,cpp}",
  ]

  s.pod_target_xcconfig = {
    # C++ compiler flags, mainly for folly.
    "GCC_PREPROCESSOR_DEFINITIONS" => "$(inherited) FOLLY_NO_CONFIG FOLLY_CFG_NO_COROUTINES"
  }

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'

  # Guard: during initial clone the generated Nitrogen files may not exist yet.
  autolinking_rb = File.join(__dir__, 'nitrogen/generated/ios/SensitiveInfo+autolinking.rb')
  if File.exist?(autolinking_rb)
    load autolinking_rb
    add_nitrogen_files(s) if defined?(add_nitrogen_files)
  else
    Pod::UI.puts "[SensitiveInfo] Nitrogen generated files missing. Run `yarn nitrogen` (or `yarn bob build`) in the package root before `pod install`.".yellow if defined?(Pod::UI)
  end

  install_modules_dependencies(s)
end

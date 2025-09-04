require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name          = package['name']
  s.version       = package['version']
  s.source_files  = 'ios/**/*.{h,m,mm}'
  s.platform      = :ios, "11.0"
  s.author        = package['author']
  s.license       = package['license']
  s.summary       = package['description']
  s.homepage      = 'https://github.com/mCodex/react-native-sensitive-info'
  s.source        = { :git => 'https://github.com/mCodex/react-native-sensitive-info.git' }

  # Use install_modules_dependencies helper to install the dependencies if React Native version >=0.71.0.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end
end

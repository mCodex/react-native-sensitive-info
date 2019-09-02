require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name          = package['name']
  s.version       = package['version']
  s.source_files  = 'ios/**/*.{h,m}'
  s.platform      = :ios, "8.0"
  s.author        = package['author']
  s.license       = package['license']
  s.summary       = package['description']
  s.homepage      = 'https://github.com/mCodex/react-native-sensitive-info'
  s.source        = { :git => 'https://github.com/mCodex/react-native-sensitive-info.git' }

  s.dependency "React"
end

const {
  createRunOncePlugin,
  withGradleProperties,
  withPodfileProperties,
} = require('@expo/config-plugins')

const pkg = require('./package.json')

function ensureGradleProperty(gradleProperties, name, value) {
  const property = gradleProperties.find((item) => item.name === name)
  if (property) {
    property.value = value
  } else {
    gradleProperties.push({ type: 'property', name, value })
  }
}

function withAndroidNewArchitecture(config) {
  return withGradleProperties(config, (modConfig) => {
    ensureGradleProperty(modConfig.modResults, 'newArchEnabled', 'true')
    ensureGradleProperty(modConfig.modResults, 'expo.jsEngine', 'hermes')
    return modConfig
  })
}

function withIosNewArchitecture(config) {
  return withPodfileProperties(config, (modConfig) => {
    modConfig.modResults.new_arch_enabled = 'true'
    modConfig.modResults.RCT_NEW_ARCH_ENABLED = '1'
    return modConfig
  })
}

function withSensitiveInfoExpo(config) {
  config = withAndroidNewArchitecture(config)
  config = withIosNewArchitecture(config)
  return config
}

module.exports = createRunOncePlugin(
  withSensitiveInfoExpo,
  pkg.name,
  pkg.version
)

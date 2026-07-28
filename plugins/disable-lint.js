const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withDisableLint(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents += `
// Disable linting to prevent Metaspace OutOfMemory errors in CI
allprojects {
    tasks.whenTaskAdded { task ->
        if (task.name.contains("lintVitalAnalyzeRelease") || task.name.contains("lintVitalRelease")) {
            task.enabled = false
        }
    }
}
`;
    }
    return config;
  });
};

const { withGradleProperties, withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withBuildFixes(config) {
  // Fix 1: Inject memory directly into android/gradle.properties so the EAS local
  // builder cannot ignore it. This gives the JVM 4GB Heap and 1.5GB Metaspace.
  config = withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      item => item.type !== 'property' || item.key !== 'org.gradle.jvmargs'
    );
    config.modResults.push({
      type: 'property',
      key: 'org.gradle.jvmargs',
      value: '-Xmx4096m -XX:MaxMetaspaceSize=1536m -Dfile.encoding=UTF-8'
    });
    return config;
  });

  // Fix 2: Forcefully disable lint tasks across all subprojects after the Gradle
  // task graph is fully resolved. (whenTaskAdded sometimes misses tasks added dynamically)
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents += `
gradle.taskGraph.whenReady { taskGraph ->
    taskGraph.allTasks.each { task ->
        if (task.name.contains("lintVitalAnalyzeRelease") || task.name.contains("lintVitalRelease")) {
            task.enabled = false
        }
    }
}
`;
    }
    return config;
  });

  return config;
};

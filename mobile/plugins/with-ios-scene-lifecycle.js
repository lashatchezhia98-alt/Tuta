const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

// iOS 27 requires the scene lifecycle. Expo's scene delegate creates the
// window and starts React Native; the app delegate only owns the factory.
module.exports = function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (next) => {
    next.modResults.CFBundleShortVersionString = '$(MARKETING_VERSION)';
    next.modResults.CFBundleVersion = '$(CURRENT_PROJECT_VERSION)';
    next.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return next;
  });

  return withAppDelegate(config, (next) => {
    if (next.modResults.language !== 'swift') {
      throw new Error('Tuta requires a Swift AppDelegate for iOS scene lifecycle support.');
    }

    let source = next.modResults.contents;
    if (!source.includes('ExpoReactNativeFactoryProvider')) {
      const declaration = /class AppDelegate: ExpoAppDelegate\s*\{/;
      if (!declaration.test(source)) {
        throw new Error('Could not find the Expo AppDelegate declaration.');
      }
      source = source.replace(declaration, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    }

    const legacyWindowStart = /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;
    source = source.replace(legacyWindowStart, '\n');
    if (source.includes('factory.startReactNative(')) {
      throw new Error('AppDelegate still starts React Native before a scene connects.');
    }

    next.modResults.contents = source;
    return next;
  });
};

// const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// /**
//  * Metro configuration
//  * https://reactnative.dev/docs/metro
//  *
//  * @type {import('@react-native/metro-config').MetroConfig}
//  */
// const config = {};

// module.exports = mergeConfig(getDefaultConfig(__dirname), config);



const path = require("path");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Metro configuration for React Native
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  transformer: {
    babelTransformerPath: require.resolve("react-native-svg-transformer"),
  },
  resolver: {
    assetExts: defaultConfig.resolver.assetExts.filter(
      (ext) => ext !== "svg"
    ),
    sourceExts: [...defaultConfig.resolver.sourceExts, "svg"],
    // Cloud Functions are deployed separately and never part of the app bundle.
    blockList: [
      ...[].concat(defaultConfig.resolver.blockList ?? []),
      new RegExp(`^${escapeRegExp(path.join(__dirname, "functions"))}[\\\\/].*`),
    ],
  },
};

module.exports = mergeConfig(defaultConfig, config);
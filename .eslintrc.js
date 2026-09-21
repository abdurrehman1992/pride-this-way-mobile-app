module.exports = {
  root: true,
  extends: '@react-native',
  // Cloud Functions have their own package and TypeScript config.
  ignorePatterns: ['functions/'],
};

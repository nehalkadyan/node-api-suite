module.exports = {
  testEnvironment: 'node',
  verbose: true,
  testMatch: [
    '**/src/tests/**/*.test.js',
    '**/tests/**/*.test.js',
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  testTimeout: 60000,
  detectOpenHandles: true,
  forceExit: true,
};

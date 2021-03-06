module.exports = {
  moduleNameMapper: {
    '__fixtures__(.*)': '<rootDir>/__fixtures__/$1',
  },
  modulePathIgnorePatterns: ['/.serverless/'],
  setupFiles: ['jest-canvas-mock', './jest.setup.js'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.js', '!**/__fixtures__/*'],
};

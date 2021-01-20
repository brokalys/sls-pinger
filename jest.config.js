module.exports = {
  moduleNameMapper: {
    '__fixtures__(.*)': '<rootDir>/__fixtures__/$1',
  },
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
};

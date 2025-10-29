/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/_tests'],
  testMatch: ['**/?(*.)+(test).[jt]s'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/index.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  maxWorkers: 1
};

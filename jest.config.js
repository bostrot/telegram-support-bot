module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    transformIgnorePatterns: ['/node_modules/'],
    setupFiles: ['<rootDir>/jest.setup.js', '<rootDir>/test/mocks.ts'],
    testTimeout: 10000,
};

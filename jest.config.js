module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    transformIgnorePatterns: ['/node_modules/'],
    setupFiles: ['<rootDir>/test/mocks.ts']
};

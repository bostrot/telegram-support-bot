// Jest setup file - automatically sets up environment for all tests
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key-for-testing';

// Mock fancy-log globally to prevent import issues
jest.mock('fancy-log', () => ({
  __esModule: true,
  default: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock OpenAI globally to prevent API key requirements
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'Mocked OpenAI response',
              },
            },
          ],
        }),
      },
    },
  })),
}));

// Console warnings during tests can be noise - optionally suppress them
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes?.('Executing command') || args[0]?.includes?.('timed out')) {
    return; // Suppress these specific warnings
  }
  originalWarn(...args);
};

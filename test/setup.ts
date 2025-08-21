// Setup for test environment
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';

// Create a proper jest setup file
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Mock fancy-log globally
jest.mock('fancy-log', () => mockLogger);

// Mock OpenAI globally
jest.mock('openai', () => {
  return {
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
  };
});

// Mock other problematic modules
jest.mock('../src/cache', () => ({
  config: {
    language: {
      from: 'From:',
      language: 'Language:',
      helpCommandText: 'Help text',
      helpCommandStaffText: 'Staff help text',
    },
    llm_api_key: 'test-key',
    llm_base_url: 'https://api.openai.com/v1',
    parse_mode: 'MarkdownV2',
    spam_time: 60000,
    spam_cant_msg: 5,
  },
  ticketSent: {},
  userId: '',
  ticketIDs: [],
  ticketStatus: {},
}));

export { mockLogger };

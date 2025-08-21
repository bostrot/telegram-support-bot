import { getResponseFromLLM } from '../src/addons/llm';

// Mock the entire OpenAI module
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Test response' } }]
          })
        }
      }
    }))
  };
});

// Mock middleware module with config
jest.mock('../src/middleware', () => ({
  config: {
    openai: {
      api_key: 'test-api-key',
      model: 'gpt-3.5-turbo',
    },
    support: {
      instructions: 'You are an AI assistant helping with customer support.',
    },
  },
}));

describe('LLM Module (Simple)', () => {
  const createMockContext = (): any => ({
    message: {
      text: 'Hello, I need help',
      from: { id: 123, is_bot: false },
      date: Date.now(),
    },
    chat: { id: 456, type: 'private' },
    update_id: 1,
    messenger: 'telegram',
    session: {},
    reply: jest.fn(),
    replyWithMarkdown: jest.fn(),
    getFile: () => {},
  });

  describe('getResponseFromLLM', () => {
    it('should return a string response', async () => {
      const ctx = createMockContext();
      const result = await getResponseFromLLM(ctx);
      expect(typeof result).toBe('string');
    });

    it('should handle basic functionality without errors', async () => {
      const ctx = createMockContext();
      const result = await getResponseFromLLM(ctx);
      expect(result).toBeDefined();
    });
  });
});

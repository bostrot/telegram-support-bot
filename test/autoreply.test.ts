// Tests for keyword auto-replies: questions used to match case-sensitively only,
// so 'install' never answered "Install?". autoreply_ignore_case opts into
// case-insensitive matching; the default keeps the old behaviour.
const mockReply = jest.fn();

jest.mock('../src/middleware', () => ({
  sendMessage: jest.fn().mockResolvedValue(undefined),
  reply: mockReply,
  strictEscape: jest.fn((str) => str),
  buildInlineKeyboard: jest.fn().mockReturnValue([]),
}));

jest.mock('../src/addons/llm', () => ({
  getResponseFromLLM: jest.fn(),
}));

jest.mock('../src/db', () => ({
  getTicketByUserId: jest.fn().mockResolvedValue(null),
}));

jest.mock('../src/workflows', () => ({
  isWithinBusinessHours: jest.fn().mockReturnValue(true),
}));

import { chat, findAutoReply } from '../src/users';
import cache from '../src/cache';

const items = [
  { question: 'install', answer: 'See the wiki.' },
  { question: 'Are you sure?', answer: 'Yes.' },
];

describe('findAutoReply', () => {
  it('matches case-sensitively by default', () => {
    expect(findAutoReply('how do I install it', items, false)?.answer).toBe('See the wiki.');
    expect(findAutoReply('Install help?', items, false)).toBeUndefined();
    expect(findAutoReply('are you sure?', items, false)).toBeUndefined();
  });

  it('ignores case when enabled', () => {
    expect(findAutoReply('Install help?', items, true)?.answer).toBe('See the wiki.');
    expect(findAutoReply('HOW DO I INSTALL', items, true)?.answer).toBe('See the wiki.');
    expect(findAutoReply('are you sure?', items, true)?.answer).toBe('Yes.');
    expect(findAutoReply('Ünïcode ÄÖÜ', [{ question: 'äöü', answer: 'ok' }], true)?.answer).toBe('ok');
  });

  it('returns undefined when nothing matches and skips entries without a question', () => {
    expect(findAutoReply('hello', items, true)).toBeUndefined();
    expect(findAutoReply('anything', [{ question: undefined, answer: 'x' }], true)).toBeUndefined();
  });
});

describe('chat with autoreply_ignore_case', () => {
  const ctx = (text: string): any => ({
    message: { text, from: { id: 'u1', first_name: 'Ann', language_code: 'en' } },
    from: { id: 'u1' },
    session: { groupCategory: null, groupTag: '' },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(cache.config, {
      autoreply: items,
      clean_replies: true,
      use_llm: false,
      show_auto_replied: false,
    });
  });

  it('does not answer a capitalised keyword with the default setting', async () => {
    cache.config.autoreply_ignore_case = false;
    await chat(ctx('Install help?'), { id: 'u1' });
    expect(mockReply).not.toHaveBeenCalledWith(expect.anything(), 'See the wiki.');
  });

  it('answers a capitalised keyword when autoreply_ignore_case is true', async () => {
    cache.config.autoreply_ignore_case = true;
    await chat(ctx('Install help?'), { id: 'u1' });
    expect(mockReply).toHaveBeenCalledWith(expect.anything(), 'See the wiki.');
  });
});

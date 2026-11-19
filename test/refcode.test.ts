// Tests for checked ticket reference codes and the staff-only /ref lookup (#211)
const mockReply = jest.fn().mockResolvedValue(undefined);
const mockGetByTicketId = jest.fn();

jest.mock('../src/middleware', () => ({
  reply: mockReply,
  sendMessage: jest.fn().mockResolvedValue(undefined),
  strictEscape: jest.fn((str: string) => str.replace(/-/g, '\\-')),
  buildInlineKeyboard: jest.fn().mockReturnValue({}),
}));

jest.mock('../src/db', () => ({
  getByTicketId: mockGetByTicketId,
  getTicketById: jest.fn().mockResolvedValue(null),
  getTicketByUserId: jest.fn().mockResolvedValue(null),
  getInternalNotes: jest.fn().mockResolvedValue([]),
  getConversationHistory: jest.fn().mockResolvedValue([]),
}));

jest.mock('../src/webhooks', () => ({ webhooks: {} }));
jest.mock('../src/analytics', () => ({}));
jest.mock('../src/team', () => ({}));
jest.mock('../src/workflows', () => ({}));

jest.mock('../src/cache', () => ({
  __esModule: true,
  default: {
    config: {
      language: {
        ticketDetails: 'Ticket details',
        customer: 'customer',
        ticketRef: 'Reference code',
      },
      parse_mode: 'MarkdownV2',
      anonymous_tickets: false,
      ticket_ref_codes: true,
      categories: [],
    },
    staffMembers: new Map(),
  },
}));

import { encodeRefCode, parseRefCode, userRefCodeLine } from '../src/refcode';
import * as commands from '../src/commands';
import { Context, Messenger } from '../src/interfaces';
import cache from '../src/cache';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ*~$=U';

const makeCtx = (isAdmin: boolean, text: string, match?: string): Context =>
  ({
    match,
    message: {
      text,
      from: { id: 'user123', first_name: 'John', username: 'john', is_bot: false, language_code: 'en' },
      chat: { id: 'chat123', first_name: 'John', username: 'john', type: 'private' },
      reply_to_message: { from: { is_bot: true }, text: '', caption: '' },
    },
    messenger: Messenger.TELEGRAM,
    session: { admin: isAdmin },
    chat: { id: 'chat123', first_name: 'John', username: 'john', type: 'private' },
    from: { username: 'john', id: 'user123' },
  } as unknown as Context);

describe('encodeRefCode', () => {
  it('produces a prefixed, padded Crockford base32 code with a check symbol', () => {
    expect(encodeRefCode(0)).toBe('TR-0000-0');
    expect(encodeRefCode(1234)).toBe('TR-016J-D');
    expect(encodeRefCode(36)).toBe('TR-0014-U');
    expect(encodeRefCode(1234)).toMatch(/^TR-[0-9A-HJKMNP-TV-Z]{4,}-[0-9A-HJKMNP-TV-Z*~$=U]$/);
  });

  it('round-trips through parseRefCode', () => {
    for (const id of [0, 1, 36, 37, 1234, 99999, 123456789, 2 ** 40]) {
      expect(parseRefCode(encodeRefCode(id))).toBe(id);
    }
  });

  it('rejects invalid ticket ids', () => {
    expect(() => encodeRefCode(-1)).toThrow();
    expect(() => encodeRefCode(1.5)).toThrow();
  });
});

describe('parseRefCode', () => {
  const code = encodeRefCode(1234);

  it('accepts lowercase, missing prefix/hyphens, spaces and Crockford aliases', () => {
    expect(parseRefCode(code.toLowerCase())).toBe(1234);
    expect(parseRefCode(code.replace('TR-', ''))).toBe(1234);
    expect(parseRefCode(code.replace(/-/g, '').replace(/^TR/, ''))).toBe(1234);
    expect(parseRefCode('  TR 016J D ')).toBe(1234);
    // 0 may be typed as O, 1 as I or L
    expect(parseRefCode(code.replace('016J', 'O16J'))).toBe(1234);
    expect(parseRefCode(code.replace('016J', '0I6J'))).toBe(1234);
    expect(parseRefCode(code.replace('016J', '0l6J'))).toBe(1234);
  });

  it('rejects empty or malformed input', () => {
    expect(parseRefCode('')).toBeNull();
    expect(parseRefCode(undefined)).toBeNull();
    expect(parseRefCode('TR-')).toBeNull();
    expect(parseRefCode('TR-01#J-0')).toBeNull();
    expect(parseRefCode('TR-01UJ-0')).toBeNull(); // U is only valid as check symbol
    expect(parseRefCode('TR-ZZZZZZZZZZZ-0')).toBeNull(); // too long
  });

  it('rejects every single-character substitution', () => {
    for (const id of [1, 1234, 98765, 4242424]) {
      const compact = encodeRefCode(id).slice(3).replace('-', '');
      for (let pos = 0; pos < compact.length; pos++) {
        for (const char of ALPHABET) {
          if (char === compact[pos]) continue;
          const typo = compact.slice(0, pos) + char + compact.slice(pos + 1);
          expect(parseRefCode(typo)).toBeNull();
        }
      }
    }
  });

  it('rejects every adjacent transposition', () => {
    for (const id of [1234, 98765, 4242424]) {
      const compact = encodeRefCode(id).slice(3).replace('-', '');
      for (let pos = 0; pos < compact.length - 1; pos++) {
        if (compact[pos] === compact[pos + 1]) continue;
        const swapped = compact.slice(0, pos) + compact[pos + 1] + compact[pos] + compact.slice(pos + 2);
        expect(parseRefCode(swapped)).toBeNull();
      }
    }
  });
});

describe('userRefCodeLine', () => {
  afterEach(() => {
    cache.config.ticket_ref_codes = true;
  });

  it('is empty when ticket_ref_codes is off', () => {
    cache.config.ticket_ref_codes = false;
    expect(userRefCodeLine(1234, 'telegram')).toBe('');
  });

  it('escapes the code for Telegram only', () => {
    const code = encodeRefCode(1234);
    expect(userRefCodeLine(1234, 'telegram')).toBe(`\nReference code: ${code.replace(/-/g, '\\-')}`);
    expect(userRefCodeLine(1234, 'signal')).toBe(`\nReference code: ${code}`);
    expect(userRefCodeLine(1234, 'web')).toBe(`\nReference code: ${code}`);
  });
});

describe('refCommand (/ref)', () => {
  const ticket = { ticketId: 1234, userid: '42', name: 'Jane', status: 'closed', messenger: 'telegram', tags: [] };

  beforeEach(() => {
    jest.clearAllMocks();
    cache.config.ticket_ref_codes = true;
    mockGetByTicketId.mockResolvedValue(ticket);
  });

  it('does nothing for non-staff users, even with a valid code', async () => {
    const code = encodeRefCode(1234);
    await commands.refCommand(makeCtx(false, `/ref ${code}`, code));
    expect(mockGetByTicketId).not.toHaveBeenCalled();
    expect(mockReply).not.toHaveBeenCalled();
  });

  it('does nothing for non-staff users when the feature is disabled', async () => {
    cache.config.ticket_ref_codes = false;
    await commands.refCommand(makeCtx(false, '/ref x', 'x'));
    expect(mockReply).not.toHaveBeenCalled();
  });

  it('shows ticket details to staff for a valid code', async () => {
    const code = encodeRefCode(1234);
    await commands.refCommand(makeCtx(true, `/ref ${code}`, code));
    expect(mockGetByTicketId).toHaveBeenCalledWith('1234');
    const text = mockReply.mock.calls[0][1];
    expect(text).toContain('#T001234');
    expect(text).toContain(`Reference code: ${code.replace(/-/g, '\\-')}`);
  });

  it('trims the command argument', async () => {
    const code = encodeRefCode(1234);
    await commands.refCommand(makeCtx(true, `/ref  ${code} `, ` ${code} `));
    expect(mockGetByTicketId).toHaveBeenCalledWith('1234');
  });

  it('rejects a mistyped code without a DB lookup', async () => {
    const code = encodeRefCode(1234);
    const typo = code.replace('016J', '016K');
    await commands.refCommand(makeCtx(true, `/ref ${typo}`, typo));
    expect(mockGetByTicketId).not.toHaveBeenCalled();
    expect(mockReply.mock.calls[0][1]).toMatch(/Invalid reference code/);
  });

  it('reports an unknown ticket', async () => {
    mockGetByTicketId.mockResolvedValue(null);
    const code = encodeRefCode(777);
    await commands.refCommand(makeCtx(true, `/ref ${code}`, code));
    expect(mockReply.mock.calls[0][1]).toMatch(/No ticket found/);
  });

  it('shows usage without an argument', async () => {
    await commands.refCommand(makeCtx(true, '/ref', ''));
    expect(mockReply.mock.calls[0][1]).toBe('Usage: /ref <code>');
  });

  it('tells staff when the feature is disabled', async () => {
    cache.config.ticket_ref_codes = false;
    const code = encodeRefCode(1234);
    await commands.refCommand(makeCtx(true, `/ref ${code}`, code));
    expect(mockGetByTicketId).not.toHaveBeenCalled();
    expect(mockReply.mock.calls[0][1]).toMatch(/disabled/);
  });
});

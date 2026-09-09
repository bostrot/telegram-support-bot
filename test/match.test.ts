// Tests for the ctx.match helpers shared by every addon (src/match.ts)
import { matchArg, matchedCommand } from '../src/match';

describe('matchArg', () => {
  it('trims a plain command argument', () => {
    expect(matchArg('  42 ')).toBe('42');
    expect(matchArg('some longer text')).toBe('some longer text');
  });

  it('prefers the first capture group of a RegExp match', () => {
    const match = '/faq'.match(/^\/(\w+)(?:@\w+)?$/);
    expect(matchArg(match)).toBe('faq');
  });

  it('falls back to the whole match when there is no capture group', () => {
    const match = '/faq'.match(/^\/\w+$/);
    expect(matchArg(match)).toBe('/faq');
  });

  it('returns an empty string for missing or empty matches', () => {
    expect(matchArg(undefined)).toBe('');
    expect(matchArg(null)).toBe('');
    expect(matchArg('')).toBe('');
    expect(matchArg([] as unknown as RegExpMatchArray)).toBe('');
  });
});

describe('matchedCommand', () => {
  it('strips the leading slash', () => {
    expect(matchedCommand('/faq')).toBe('faq');
    expect(matchedCommand('faq')).toBe('faq');
  });

  it('handles RegExp match arrays as grammY hands them over', () => {
    expect(matchedCommand('/hours'.match(/^\/(\w+)(?:@\w+)?$/))).toBe('hours');
    expect(matchedCommand('/hours@my_bot'.match(/^\/(\w+)(?:@\w+)?$/))).toBe('hours');
  });

  it('returns null when nothing usable is left', () => {
    expect(matchedCommand(undefined)).toBeNull();
    expect(matchedCommand('/')).toBeNull();
    expect(matchedCommand('')).toBeNull();
  });
});

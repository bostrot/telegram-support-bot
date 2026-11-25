import { checkConfigValues } from '../src/configfile';

describe('checkConfigValues', () => {
  it('accepts a config with real ids and numeric spam settings', () => {
    const config = { staffchat_id: '-100123', owner_id: '42', spam_time: 300000, spam_cant_msg: 5 };
    expect(checkConfigValues(config)).toEqual([]);
    expect(config).toEqual({ staffchat_id: '-100123', owner_id: '42', spam_time: 300000, spam_cant_msg: 5 });
  });

  it('warns when staffchat_id and owner_id are still the sample placeholders', () => {
    const warnings = checkConfigValues({
      staffchat_id: 'SUPERGROUP_CHAT_ID', owner_id: 'YOUR_TELEGRAM_ID', spam_time: 1, spam_cant_msg: 1,
    });
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('staffchat_id is still the sample value');
    expect(warnings[1]).toContain('owner_id is still the sample value');
    expect(warnings[1]).toContain('empty ticket history');
  });

  it('falls back to the default when spam_time is an expression YAML reads as text (issue #161)', () => {
    const config: Record<string, unknown> = { spam_time: '5 * 60 * 1000', spam_cant_msg: 5 };
    const warnings = checkConfigValues(config);
    expect(config.spam_time).toBe(300000);
    expect(warnings).toEqual([expect.stringContaining('spam_time must be a plain number of milliseconds')]);
    // The configured value is not echoed back.
    expect(warnings[0]).not.toContain('5 * 60');
  });

  it('converts quoted whole numbers without a warning', () => {
    const config: Record<string, unknown> = { spam_time: '300000', spam_cant_msg: ' 5 ' };
    expect(checkConfigValues(config)).toEqual([]);
    expect(config.spam_time).toBe(300000);
    // A string '5' would never equal the numeric message counter, so the
    // "please wait" reply would not be sent.
    expect(config.spam_cant_msg).toBe(5);
  });

  it('replaces missing, negative or fractional spam settings with the defaults', () => {
    for (const bad of [null, undefined, -1, 2.5, 'five', true]) {
      const config: Record<string, unknown> = { spam_time: bad, spam_cant_msg: bad };
      const warnings = checkConfigValues(config);
      expect(config).toEqual({ spam_time: 300000, spam_cant_msg: 5 });
      expect(warnings).toHaveLength(2);
    }
  });
});

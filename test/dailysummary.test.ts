// Tests for daily summary scheduling: an invalid daily_summary_time used to give
// NaN timer delays, so the summary was sent to the staff chat in a tight loop.
const mockLogError = jest.fn();
jest.mock('../src/logger', () => ({ error: mockLogError, info: jest.fn() }));

import { msUntilNext, parseSummaryTime, scheduleDailySummary } from '../src/dailysummary';

describe('parseSummaryTime', () => {
  it('accepts 24-hour HH:MM and H:MM', () => {
    expect(parseSummaryTime('09:00')).toEqual({ hours: 9, minutes: 0 });
    expect(parseSummaryTime('9:30')).toEqual({ hours: 9, minutes: 30 });
    expect(parseSummaryTime(' 23:59 ')).toEqual({ hours: 23, minutes: 59 });
    expect(parseSummaryTime('0:00')).toEqual({ hours: 0, minutes: 0 });
  });

  it.each([['9am'], ['25:00'], ['12:60'], ['09'], ['9:5'], [''], [9], [null], [undefined]])(
    'rejects %p', (value) => {
      expect(parseSummaryTime(value)).toBeNull();
    });
});

describe('msUntilNext', () => {
  it('returns the time until later today', () => {
    const now = new Date(2026, 0, 10, 8, 30);
    expect(msUntilNext(now, { hours: 9, minutes: 0 })).toBe(30 * 60 * 1000);
  });

  it('rolls over to tomorrow when the time has passed or is now', () => {
    const now = new Date(2026, 0, 10, 9, 0);
    expect(msUntilNext(now, { hours: 9, minutes: 0 })).toBe(24 * 60 * 60 * 1000);
    expect(msUntilNext(new Date(2026, 0, 10, 10, 0), { hours: 9, minutes: 0 }))
      .toBe(23 * 60 * 60 * 1000);
  });
});

describe('scheduleDailySummary', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 10, 8, 0));
    mockLogError.mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  /** Advances fake time and lets the send() promise chain reschedule. */
  async function advance(ms: number) {
    await jest.advanceTimersByTimeAsync(ms);
  }

  it('sends once a day at the configured time', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    scheduleDailySummary('09:00', send);

    await advance(60 * 60 * 1000 - 1);
    expect(send).not.toHaveBeenCalled();
    await advance(1);
    expect(send).toHaveBeenCalledTimes(1);
    await advance(24 * 60 * 60 * 1000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it.each([['9am'], [9], ['25:00']])(
    'falls back to 09:00 with an error for invalid value %p instead of looping', async (value) => {
      const send = jest.fn().mockResolvedValue(undefined);
      expect(scheduleDailySummary(value, send)).toEqual({ hours: 9, minutes: 0 });
      expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining('daily_summary_time'));

      await advance(1000);
      expect(send).not.toHaveBeenCalled();
      await advance(60 * 60 * 1000);
      expect(send).toHaveBeenCalledTimes(1);
    });

  it('uses the default silently when the option is missing', () => {
    expect(scheduleDailySummary(undefined, jest.fn())).toEqual({ hours: 9, minutes: 0 });
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('keeps the schedule running after a failed send', async () => {
    const send = jest.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined);
    scheduleDailySummary('09:00', send);
    await advance(60 * 60 * 1000);
    await advance(24 * 60 * 60 * 1000);
    expect(send).toHaveBeenCalledTimes(2);
  });
});

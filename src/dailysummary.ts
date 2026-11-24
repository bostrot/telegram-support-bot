import * as log from './logger';

export const DEFAULT_SUMMARY_TIME = '09:00';
const DEFAULT_TIME: SummaryTime = { hours: 9, minutes: 0 };

export interface SummaryTime {
  hours: number;
  minutes: number;
}

/**
 * Parses a `daily_summary_time` value such as '09:00' or '9:30'. Returns null for
 * anything that is not a valid 24-hour HH:MM time, e.g. '9am', '25:00' or the
 * number 9.
 */
export function parseSummaryTime(value: unknown): SummaryTime | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/** Milliseconds from `now` until the next occurrence of the given server-local time. */
export function msUntilNext(now: Date, time: SummaryTime): number {
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.hours, time.minutes);
  if (target.getTime() <= now.getTime()) {
    // Already passed today: same time tomorrow (the Date constructor handles DST).
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

/**
 * Sends the daily summary every day at `daily_summary_time`. An invalid value
 * falls back to the default time with an error in the log instead of producing a
 * NaN delay, which made the summary repeat in a tight loop.
 */
export function scheduleDailySummary(
  configured: unknown,
  send: () => Promise<void>,
): SummaryTime {
  // A missing or empty value silently uses the default, as before.
  const parsed = parseSummaryTime(configured || DEFAULT_SUMMARY_TIME);
  if (!parsed) {
    log.error(
      `daily_summary_time must be a quoted 24-hour time like '09:00'; ` +
      `using ${DEFAULT_SUMMARY_TIME} instead.`,
    );
  }
  const time: SummaryTime = parsed || DEFAULT_TIME;

  const run = () => {
    send()
      .catch((err) => log.error('Error sending daily summary:', err))
      .finally(() => {
        setTimeout(run, msUntilNext(new Date(), time));
      });
  };

  const delay = msUntilNext(new Date(), time);
  setTimeout(run, delay);
  const hh = String(time.hours).padStart(2, '0');
  const mm = String(time.minutes).padStart(2, '0');
  log.info(`Daily summary scheduled at ${hh}:${mm} server time (first run in ${Math.round(delay / 60000)} min)`);
  return time;
}

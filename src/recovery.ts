import cache from './cache';
import * as log from 'fancy-log';

/**
 * Runs startup recovery to establish a resilient ticket ID baseline.
 *
 * Note: Telegram Bot API cannot fetch chat history (that requires MTProto/TDLib).
 * Instead, we rely on MongoDB's stored max ticketId and use atomic increments
 * to prevent collisions even if the DB is partially lost or reset.
 */
export async function runRecovery(): Promise<void> {
  const dbMax = await getMaxDbTicketId();

  cache.recoveryBaseline = dbMax;

  log.info(
    `Recovery: DB max=#T${dbMax} → baseline set to #T${cache.recoveryBaseline}`,
  );

  if (dbMax === 0) {
    log.info('Recovery: No existing tickets found in DB — will start from #T000001');
  }
}

/**
 * Returns the highest ticketId currently in MongoDB.
 */
async function getMaxDbTicketId(): Promise<number> {
  const { Supportee } = await import('./db.js');
  try {
    const lastEntry = await (Supportee as any).findOne()
      .sort({ ticketId: -1 })
      .select('ticketId');
    return lastEntry ? lastEntry.ticketId : 0;
  } catch (err) {
    log.error('Recovery: Failed to query DB for max ticket ID:', err);
    return 0;
  }
}

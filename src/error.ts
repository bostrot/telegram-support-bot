import * as fs from 'fs';
import cache from './cache';
import * as middleware from './middleware';
import * as log from 'fancy-log'

const debugFile = './config/debug.log';
const logStdout = process.stdout;

/**
 * Initializes error logging and global exception handlers.
 *
 * @param logs - Whether to log to file (default true).
 */
function init(logs = true) {
  // Rate limiting state — tracks recent errors to avoid spamming staff chat
  let currentErrors = 0;
  let lastErrorReset: number = Date.now();

  /**
   * Checks if we should suppress notifications due to error flood.
   * Returns true when in normal operation (safe to notify).
   */
  const shouldNotify = (): boolean => {
    // Reset counter every 30 seconds
    if (Date.now() - lastErrorReset > 30_000) {
      currentErrors = 0;
      lastErrorReset = Date.now();
    }
    currentErrors++;
    // Only notify on the first error in a window, then suppress to avoid spam
    return currentErrors <= 1 || currentErrors % 5 === 0;
  };

  /**
   * Writes error details to the debug log file.
   */
  const writeDebugLog = (error: unknown): void => {
    const message = `${new Date().toISOString()}: ${error instanceof Error ? error.stack : String(error)}\n`;
    fs.appendFileSync(debugFile, message, 'utf8');
  };

  /**
   * Sends a notification to the staff chat about the error.
   */
  const notifyStaff = (errorMessage: string): void => {
    if (!shouldNotify()) return;
    middleware.sendMessage(
      cache.config.staffchat_id,
      cache.config.staffchat_type,
      errorMessage,
      {},
    ).catch(log.error);
  };

  // Catch uncaught exceptions to log them and notify staff
  process.on('uncaughtException', (err: unknown) => {
    const error = err instanceof Error ? err : new Error(String(err));
    log.info('=== UNHANDLED ERROR ===');
    writeDebugLog(error);
    log.error(`${new Date()}: Unhandled exception:`, error);
    notifyStaff(`An uncaught error occurred. Please report this to your admin:\n\n${error.message}`);
    process.exit(1);
  });

  // Catch unhandled promise rejections to log them and notify staff if necessary
  process.on('unhandledRejection', (reason: unknown) => {
    const errorMessage = reason instanceof Error ? reason.stack : String(reason);
    log.info('=== UNHANDLED REJECTION ===');
    writeDebugLog(errorMessage);
    console.error(`${new Date()}: Unhandled rejection:`, errorMessage);
    notifyStaff(`An unhandled promise rejection occurred. Please report this to your admin:\n\n${errorMessage}`);
  });
}

export { init };

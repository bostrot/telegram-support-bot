import * as fs from 'fs';
import * as util from 'util';
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
  // Rate limiting variables
  let currentErrors = 0;
  let lastErrors = 0;
  let waiting = false;
  let waitingLast = false;

  /**
   * Sleeps for the specified number of seconds.
   *
   * @param seconds - Number of seconds to sleep.
   * @returns A promise that resolves after the delay.
   */
  const sleep = (seconds: number) =>
    new Promise(resolve => setTimeout(resolve, seconds * 1000));

  /**
   * Applies rate limiting by delaying execution when errors occur too frequently.
   */
  const rateLimit = () => {
    if (currentErrors > 3) {
      // "Synchronous" wait (note: not truly synchronous in Node)
      sleep(5 * lastErrors);
      currentErrors = 0;
      lastErrors++;
    }
    if (!waiting) {
      setTimeout(() => {
        currentErrors = 0;
        waiting = false;
      }, 3000);
    }
    if (!waitingLast) {
      setTimeout(() => {
        currentErrors = 0;
        waitingLast = false;
      }, 30000);
    }
    waiting = true;
    currentErrors++;
  };

  // Overload log.info to write to file when logging is enabled
  // log.info = (d: any) => {
  //   if (logs) {
  //     const formatted = util.format(d);
  //     logStdout.write(formatted + '\n');
  //     fs.appendFile(
  //       debugFile,
  //       `${new Date()}: ${formatted}\n`,
  //       'utf8',
  //       err => {
  //         if (err) throw err;
  //       }
  //     );
  //   }
  // };

  // Catch uncaught exceptions to log them and notify staff
  process.on('uncaughtException', (err) => {
    rateLimit();
    log.info('=== UNHANDLED ERROR ===');
    fs.appendFile(debugFile, err.stack + '\n', 'utf8', appendErr => {
      if (appendErr) throw appendErr;
    });
    log.error(`${new Date()}: Error: `, err);
    middleware.sendMessage(
      cache.config.staffchat_id,
      cache.config.staffchat_type,
      `An error occurred, please report this to your admin: \n\n ${err}`,
      {}
    );
    process.exit(1);
  });

  // Catch unhandled promise rejections to log them and notify staff if necessary
  process.on('unhandledRejection', (err: any) => {
    rateLimit();
    log.info('=== UNHANDLED REJECTION ===');
    fs.appendFile(debugFile, err + '\n', 'utf8', appendErr => {
      if (appendErr) throw appendErr;
    });
    console.dir(`${new Date()}: ${err.stack}`);
    if (currentErrors === 0) {
      middleware.sendMessage(
        cache.config.staffchat_id,
        cache.config.staffchat_type,
        `An error occurred, please report this to your admin: \n\n ${err}`
      );
    }
  });
}

export { init };

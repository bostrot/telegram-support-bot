import * as fs from 'fs';
import * as util from 'util';
import cache from './cache';
import * as middleware from './middleware';
const debugFile = './config/debug.log';
const logStdout = process.stdout;

/**
 * Init error logger
 * @param {boolean} logs
 */
function init(logs = true) {
  // overload logging to file
  console.log = function(d) {
    if (logs) {
      logStdout.write(util.format(d) + '\n');
      fs.appendFile(
          debugFile,
          new Date() + ': ' + util.format(d) + '\n',
          'utf8',
          function(err) {
            if (err) throw err;
          },
      );
    }
  };

  // catch uncaught exceptions to log
  process.on('uncaughtException', (err) => {
    rateLimit();
    console.log('=== UNHANDLED ERROR ===');
    fs.appendFile(debugFile, err.stack + '\n', 'utf8', function(err) {
      if (err) throw err;
    });
    console.error(new Date() + ': ' + 'Error: ', err);
    middleware.msg(
        cache.config.staffchat_id,
        `An error occured, please report this to your admin: \n\n ${err}`,
        {},
    );
    process.exit(1);
  });

  // catch uncaught rejections to log
  process.on('unhandledRejection', (err: any) => {
    rateLimit();
    console.log('=== UNHANDLED REJECTION ===');
    fs.appendFile(debugFile, err + '\n', 'utf8', function(err) {
      if (err) throw err;
    });
    console.dir(new Date() + ': ' + err['stack']);
    if (currentErrors == 0) {
      middleware.msg(
          cache.config.staffchat_id,
          `An error occured, please report this 
          to your admin: \n\n ${err}`,
          {},
      );
    }
  });

  let currentErrors = 0;
  let lastErrors = 0;
  let waiting = false;
  let waitingLast = false;

  /**
   * blocking rate limiting
   */
  function rateLimit() {
    // rate limiting
    if (currentErrors > 3) {
      // syncronous waiting to prevent spamming
      sleep(5 * lastErrors);
      currentErrors = 0;
      lastErrors++;
    }
    // if not waiting start to wait
    if (!waiting) {
      setTimeout(() => {
        // reset errors after 3 seconds
        currentErrors = 0;
        waiting = false;
      }, 3000);
    }
    if (!waitingLast) {
      setTimeout(() => {
        // reset errors after 30 seconds
        currentErrors = 0;
        waitingLast = false;
      }, 30000);
    }
    waiting = true;
    currentErrors++;
  }

  /**
   * blocking
   * @param {number} seconds
   * @return {Promise} resolve after seconds
   */
  function sleep(seconds: number) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}

export {init};

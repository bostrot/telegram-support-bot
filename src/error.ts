import * as fs from 'fs';
import * as util from 'util';
import cache from './cache';
import * as middleware from './middleware';
const debugFile = './config/debug.log';
const logStdout = process.stdout;

function init(bot, logs = true) {
  // overload logging to file
  console.log = function(d) {
    if (logs) {
      logStdout.write(util.format(d) + '\n');
      fs.appendFile(debugFile,
        new Date() + ': ' + util.format(d) + '\n', 'utf8',
        function(err) {
          if (err) throw err;
        });
    }
  };

  // catch uncaught exceptions to log
  process.on('uncaughtException', (err) => {
    console.log('=== UNHANDLED ERROR ===');
    fs.appendFile(debugFile,
        err.stack + '\n', 'utf8',
        function(err) {
          if (err) throw err;
        });
    console.error(new Date() + ': ' + 'Error: ', err);
    middleware.msg(cache.config.staffchat_id, `An error occured, please report this to your admin: \n\n ${err}`, {});
    process.exit(1);
  });


  // catch uncaught rejections to log
  process.on('unhandledRejection', (err, p) => {
    console.log('=== UNHANDLED REJECTION ===');
    fs.appendFile(debugFile,
        err + '\n', 'utf8',
        function(err) {
          if (err) throw err;
        });
    console.dir(new Date() + ': ' + err["stack"]);
    bot.drop();
    middleware.msg(cache.config.staffchat_id, `An error occured, please report this to your admin: \n\n ${err}`, {});
  });
}

export {
  init
};
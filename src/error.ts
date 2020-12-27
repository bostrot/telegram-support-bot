import * as fs from 'fs';
import * as util from 'util';
const debugFile = './config/debug.log';
const logStdout = process.stdout;

function init() {
  // overload logging to file
  console.log = function(d) {
    logStdout.write(util.format(d) + '\n');
    fs.appendFile(debugFile,
        new Date() + ': ' + util.format(d) + '\n', 'utf8',
        function(err) {
          if (err) throw err;
        });
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
  });
}

export {
  init
};
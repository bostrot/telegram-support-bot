"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const util = require("util");
const debugFile = '../config/debug.log';
const logStdout = process.stdout;
// overload logging to file
console.log = function (d) {
    logStdout.write(util.format(d) + '\n');
    fs.appendFile(debugFile, util.format(d) + '\n', 'utf8', function (err) {
        if (err)
            throw err;
    });
};
// catch uncaught exceptions to log
process.on('uncaughtException', (err) => {
    console.log('=== UNHANDLED ERROR ===');
    fs.appendFile(debugFile, err.stack + '\n', 'utf8', function (err) {
        if (err)
            throw err;
    });
    console.error('Error: ', err);
    process.exit(1);
});
// catch uncaught rejections to log
process.on('unhandledRejection', (err, p) => {
    console.log('=== UNHANDLED REJECTION ===');
    fs.appendFile(debugFile, err + '\n', 'utf8', function (err) {
        if (err)
            throw err;
    });
    console.dir(err);
});
//# sourceMappingURL=error.js.map
const Database = require('better-sqlite3');
const db = new Database('bin/support.db', { /*verbose: console.log*/ }); // debugging

var dbTable = db.prepare(`CREATE TABLE IF NOT EXISTS supportees (userid TEXT PRIMARY KEY, status TEXT);`);
dbTable.run();

exports.check = function(userid, callback) {
    var searchDB = db.prepare("select * from supportees where userid = " + userid).get();
    callback(searchDB);
}

exports.add = function(userid, status) {
    var stmt = db.prepare(`INSERT or REPLACE INTO supportees VALUES ('`+userid+`', '`+status+`')`).run();
}

exports.open = function(callback) {
    var searchDB = db.prepare("select * from supportees where status = 'open'").all();
    callback(searchDB);
}
const Database = require('better-sqlite3');
const db = new Database(__dirname + '/support.db', {
  /* verbose: console.log */}); // debugging

const dbTable = db.prepare(
    `CREATE TABLE IF NOT EXISTS supportees
    (userid TEXT PRIMARY KEY, status TEXT);`);
dbTable.run();

exports.check = function(userid, callback) {
  const searchDB = db.prepare('select * from supportees where userid = ' +
        userid).get();
  callback(searchDB);
};

exports.add = function(userid, status) {
  db.prepare(`INSERT or REPLACE INTO supportees VALUES ('`+
        userid+`', '`+status+`')`).run();
};

exports.open = function(callback) {
  const searchDB = db.prepare(
      'select * from supportees where status = \'open\'').all();
  callback(searchDB);
};

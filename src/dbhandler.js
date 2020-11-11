const Database = require('better-sqlite3');
const db = new Database(__dirname + '../config/support.db', {
  /* verbose: console.log */}); // debugging

const dbTable = db.prepare(
    `CREATE TABLE IF NOT EXISTS supportees
    (id INTEGER PRIMARY KEY AUTOINCREMENT, userid TEXT, status TEXT);`);
dbTable.run();

exports.check = function(userid, callback) {
  const searchDB = db.prepare(
      `select * from supportees where userid = ${userid} or id = ${userid}`).get();
  callback(searchDB);
};

exports.add = function(userid, status) {
  if (status == 'closed') {
    db.prepare(`DELETE FROM supportees WHERE userid = ${userid}`).run();
  } else {
    db.prepare(
        `INSERT or REPLACE INTO supportees (userid, status) VALUES ('${userid}', '${status}')`)
        .run();
  }
};

exports.open = function(callback) {
  const searchDB = db.prepare(
      'select * from supportees where status = \'open\'').all();
  callback(searchDB);
};

const Database = require('better-sqlite3');
const db = new Database('./config/support.db', {
/* verbose: console.log */ }); // debugging

try {
  db.prepare(
      `ALTER TABLE supportees ADD category TEXT;`).run();
} catch (e) {}
db.prepare(
    `CREATE TABLE IF NOT EXISTS supportees
    (id INTEGER PRIMARY KEY AUTOINCREMENT, `+
    `userid TEXT, status TEXT, category TEXT);`).run();

const check = function(userid, category, callback) {
  const searchDB = db.prepare(
      `select * from supportees where (userid = `+
      `${userid} or id = ${userid}) ` +
      `${(category ? `AND category = '${category}'`: '')}`).all();
  callback(searchDB);
};

const getOpen = function(userid, category, callback) {
  const searchDB = db.prepare(
      `select * from supportees where (userid = `+
      `${userid} or id = ${userid}) AND status='open' ` +
      `${(category ? `AND category = '${category}'`: '')}`).get();
  callback(searchDB);
};

const getId = function(userid, callback) {
  const searchDB = db.prepare(
      `select * from supportees where (userid = `+
      `${userid} or id = ${userid})`).get();
  callback(searchDB);
};

const checkBan = function(userid, callback) {
  const searchDB = db.prepare(
      `select * from supportees where (userid = `+
      `${userid} or id = ${userid}) AND status='banned' `).get();
  callback(searchDB);
};

const add = function(userid, status, category) {
  let msg;
  if (status == 'closed') {
    console.log(`UPDATE supportees SET status='closed' WHERE `+
    `(userid='${userid}' or id='${userid}')` +
    `${(category ? `AND category = '${category}'`: '')}`)
    msg = db.prepare(
        `UPDATE supportees SET status='closed' WHERE `+
        `(userid='${userid}' or id='${userid}')` +
        `${(category ? `AND category = '${category}'`: '')}`).run();
  } else if (status == 'open') {
    //db.prepare(`DELETE FROM supportees WHERE userid='${userid}'` +
    //    ` or id='${userid}'`).run();
    msg = db.prepare(
        `REPLACE INTO supportees (userid, `+
        `status ${(category ? `,category`: '')}) `+
        `VALUES ('${userid}', '${status}' ${(category ? `,'${category}'`: '')})`
    ).run();
  } else if (status = 'banned') {
    msg = db.prepare(
        `REPLACE INTO supportees (userid, status, category)` +
        `VALUES ('${userid}', '${status}', 'BANNED')`).run();
  }
  return (msg.changes);    
};

const open = function(callback, category) {
  let searchText = '';
  for (let i = 0; i < category.length; i++)
  {
    if (i == 0) 
      searchText += `= '${category[i]}'`;
    else
      searchText +=  ` OR category = '${category[i]}'`;
  }

  const searchDB = db.prepare(
      `select * from supportees where status = 'open' `+
      `and (category ${(category.length > 0 ? searchText : 'is NULL')})`).all();
  
  
  callback(searchDB);
};

export {
  open,
  add,
  check,
  getOpen,
  checkBan,
  getId,
}
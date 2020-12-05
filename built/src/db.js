const Database = require('better-sqlite3');
const db = new Database('../config/support.db', {
/* verbose: console.log */ }); // debugging
try {
    db.prepare(`ALTER TABLE supportees ADD category TEXT;`).run();
}
catch (e) { }
db.prepare(`CREATE TABLE IF NOT EXISTS supportees
    (id INTEGER PRIMARY KEY AUTOINCREMENT, ` +
    `userid TEXT, status TEXT, category TEXT);`).run();
const check = function (userid, callback) {
    const searchDB = db.prepare(`select * from supportees where userid = ` +
        `${userid} or id = ${userid}`).get();
    callback(searchDB);
};
const add = function (userid, status, category) {
    if (status == 'closed') {
        db.prepare(`DELETE FROM supportees WHERE userid = ${userid}`).run();
    }
    else if (status == 'open') {
        db.prepare(`INSERT or REPLACE INTO supportees (userid, ` +
            `status ${(category ? `,category` : '')}) ` +
            `VALUES ('${userid}', '${status}' ${(category ? `,'${category}'` : '')})`)
            .run();
    }
    else if (status = 'banned') {
        db.prepare(`UPDATE supportees SET status='banned' WHERE ` +
            `userid='${userid}' or id='${userid}'`)
            .run();
    }
};
const open = function (callback, category) {
    console.log(`select * from supportees where status = 'open' ` +
        `and category ${(category ? ` = '${category}'` : 'is NULL')}`);
    const searchDB = db.prepare(`select * from supportees where status = 'open' ` +
        `and category ${(category ? `= '${category}'` : 'is NULL')}`).all();
    callback(searchDB);
};
export { open, add, check, };

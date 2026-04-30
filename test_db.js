const mysql = require('mysql2');
const conn = mysql.createConnection({host: '127.0.0.1', user: 'root', password: 'MYSQL12#1', database: 'LibraryDB'});
conn.connect(err => { if(err) console.error(err); else {console.log('CONNECTED'); conn.end();} });

import Database from 'better-sqlite3';

export function initDB() {
    const usersDB = new Database('./data/usersDB.db');
    usersDB.exec(
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name        CHAR(150),
            mail        CHAR(150),
            password    CHAR(150),
            enable2FA   BOOLEAN DEFAULT 0,
            secret2FA   TEXT
        );`
    );
    return usersDB;
}
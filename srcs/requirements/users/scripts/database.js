import Database from 'better-sqlite3';

export function initDB() {
    const usersDB = new Database('./data/usersDB.db');
    usersDB.exec(
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            mail        TEXT NOT NULL UNIQUE,
            password    TEXT NOT NULL,
            enable2FA   BOOLEAN DEFAULT 0,
            secret2FA   TEXT,
            avatar_path TEXT NOT NULL DEFAULT 'default.png'
        )`
    );
    return usersDB;
}
import Database from 'better-sqlite3';

export function initDB() {
    const usersDB = new Database('./data/usersDB.db');
    usersDB.exec(
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL UNIQUE,
            mail        TEXT NOT NULL UNIQUE,
            password    TEXT,
            enable2FA   BOOLEAN DEFAULT 0,
            secret2FA   TEXT,
            avatar_path TEXT NOT NULL DEFAULT 'default.png',
            wins        INTEGER DEFAULT 0,
            losses      INTEGER DEFAULT 0,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS friends (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            friend_id   INTEGER NOT NULL,
            status      TEXT NOT NULL DEFAULT 'pending',
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, friend_id)
        );`
    );
    return usersDB;
}
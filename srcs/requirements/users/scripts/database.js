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
            avatar_path TEXT NOT NULL DEFAULT 'default.png',
            wins        INTERGER DEFAULT 0,
            losses      INTERGER DEFAULT 0,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS friends (
            id          INTERGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTERGER NOT NULL,
            friends_id  INTERGER NOT NULL,
            status      TEXT NOT NULL DEFAULT 'pending',
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, friend_id)
        );`
    );
    return usersDB;
}
import Database from 'better-sqlite3';

export function initDB() {
    const usersDB = new Database('./data/usersDB.db');
    usersDB.exec(
        `CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL UNIQUE,
            mail        TEXT NOT NULL UNIQUE,
            password    TEXT NOT NULL,
            enable2FA   BOOLEAN DEFAULT 0,
            secret2FA   TEXT,
            auth_type   TEXT DEFAULT 'local',
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
            blocked_by  INTEGER DEFAULT 0,
            UNIQUE(user_id, friend_id)
        );
        CREATE TABLE IF NOT EXISTS matches (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            player1_id  INTEGER NOT NULL,
            player2_id  INTEGER NOT NULL,
            winner_id   INTEGER NOT NULL,
            score_p1    INTEGER NOT NULL,
            score_p2    INTEGER NOT NULL,
            match_type  TEXT NOT NULL,
            played_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        );`
    );
    return usersDB;
}
import Database from 'better-sqlite3';

export async function initDB() {
    const usersDB = new Database('./data/usersDB.db');
    
    usersDB.exec(
        `CREATE TABLE IF NOT EXISTS users (
            id          	INTEGER PRIMARY KEY AUTOINCREMENT,
            name        	TEXT NOT NULL UNIQUE,
            mail        	TEXT NOT NULL UNIQUE,
            password    	TEXT NOT NULL,
            enable2FA   	BOOLEAN DEFAULT 0,
            secret2FA   	TEXT DEFAULT NULL,
            auth_type   	TEXT DEFAULT 'local',
            avatar_path 	TEXT NOT NULL DEFAULT 'default.png',
            pong_wins       INTEGER DEFAULT 0,
            pong_losses     INTEGER DEFAULT 0,
            snake_wins      INTEGER DEFAULT 0,
            snake_losses    INTEGER DEFAULT 0,
            is_guest        BOOLEAN DEFAULT 0,
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS friends (
            id          	INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     	INTEGER NOT NULL,
            friend_id   	INTEGER NOT NULL,
            status      	TEXT NOT NULL DEFAULT 'pending',
            blocked_by  	INTEGER DEFAULT 0,
            created_at  	DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, friend_id)
        );
        CREATE TABLE IF NOT EXISTS matches (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            player1_id      INTEGER NOT NULL,
            player1_name    TEXT NOT NULL,
            player2_id      INTEGER NOT NULL,
            player2_name    TEXT NOT NULL,
            winner_id       INTEGER NOT NULL,
            score_p1        INTEGER NOT NULL,
            score_p2        INTEGER NOT NULL,
            match_type      TEXT NOT NULL,
            game_type       TEXT NOT NULL,
            played_at       DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS invitations (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL,
            friend_id       INTEGER NOT NULL,
            game_type       TEXT NOT NULL,
            sent_at         DATETIME DEFAULT CURRENT_TIMESTAMP
        );`
    );
    return usersDB;
}
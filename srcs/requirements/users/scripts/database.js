import Database from 'better-sqlite3';

export async function initDB() {
    const usersDB = new Database('./data/usersDB.db');
    
    ///// REMETTRE WIN ET LOSSES A DEFAULT 0 !!!!!!!!!!!!!!!!!!!!!!!!!!
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
            pong_wins        INTEGER DEFAULT 2,
            pong_losses      INTEGER DEFAULT 2,
            snake_wins        INTEGER DEFAULT 1,
            snake_losses      INTEGER DEFAULT 1,
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
        );`
    );
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// A SUPPRIMER
    usersDB.exec(`INSERT INTO matches 
        (player1_id, player1_name, player2_id, player2_name, winner_id, score_p1, score_p2, match_type, game_type)
        VALUES 
            (1, 'alice', 2, 'bob', 1, 5, 0, 'remote', 'pong'),
            (1, 'alice', 2, 'bob', 2, 0, 5, 'remote', 'pong'),
            (1, 'alice', 2, 'bob', 1, 5, 0, 'tournament', 'pong'),
            (1, 'alice', 2, 'bob', 2, 0, 5, 'tournament', 'pong'),
            (1, 'alice', 2, 'bob', 1, 5, 0, 'remote', 'snake'),
            (1, 'alice', 2, 'bob', 2, 0, 5, 'remote', 'snake')
    `);
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// A SUPPRIMER
    return usersDB;
}
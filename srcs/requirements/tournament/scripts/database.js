import sqlite3 from "sqlite3";
import { open } from "sqlite";

let db;

export async function initDB() {
    if(!db) {
        db = await open({
            filename: "tournament.db",
            driver: sqlite3.Database,
        });
    
    await db.exec(
        `CREATE TABLE IF NOT EXISTS tournament (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            name                TEXT NOT NULL UNIQUE,
            status              TEXT DEFAULT 'pending',
            mode                TEXT,
            players_ids         TEXT,
            players_names       TEXT,
            creator_id          TEXT,
            winner_alias        TEXT DEFAULT NULL,
            nb_max_players      INTEGER NOT NULL,
            nb_current_players  INTEGER DEFAULT 0,
            created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log("BD initialisee");
    };
    return db;
}
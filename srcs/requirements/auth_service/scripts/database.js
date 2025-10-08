import sqlite3 from "sqlite3";
import { open } from "sqlite";

// Ouvrir la base SQLite
let dbSessions;

export async function initDB() {
    if(!dbSessions) {
        dbSessions = await open({
            filename: "auth.db",
            driver: sqlite3.Database,
        });
    
    // Créer la table users si elle n'existe pas
    await dbSessions.exec(`CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL)`);

    console.log("BD initialisee");
    };
    return dbSessions;
}
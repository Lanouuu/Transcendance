import sqlite3 from "sqlite3";
import { open } from "sqlite";

let db;

export async function initDB() {
    if(!db) {
        db = await open({
            filename: "auth.db",
            driver: sqlite3.Database,
        });
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL);
    `);

    console.log("BD initialisee");
    };
    return db;
}
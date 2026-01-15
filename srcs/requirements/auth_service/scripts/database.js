import sqlite3 from "sqlite3";
import { open } from "sqlite";

let db;

export async function initDB() {
  if (!db) {
    try {
      db = await open({
        filename: "auth.db",
        driver: sqlite3.Database,
      });
    } catch (err) {
      throw new Error("Failed to connect to database: " + err.message);
    }

    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token_hash TEXT NOT NULL
        );
      `);
    } catch (err) {
      throw new Error("Failed to initialize database tables: " + err.message);
    }
  }
  return db;
}
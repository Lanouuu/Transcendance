import Database from 'better-sqlite3';

export function initDB() {
    const db = new Database('./data/database.db');
    db.exec(
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name CHAR(100)
        )`
    )
    return db;
}
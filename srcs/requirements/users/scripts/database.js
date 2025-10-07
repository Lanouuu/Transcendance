import Database from 'better-sqlite3';

export function initDB() {
    const usersDB = new Database('./data/usersDB.db');
    usersDB.exec(
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name        CHAR(150),
            mail        CHAR(150),
            password    CHAR(150)
        )`
    );

    const insertUser = usersDB.prepare("INSERT INTO users (name, mail, password) VALUES (?, ?, ?)");


    insertUser.run("Alice", "alice@mail.com", "1234");
    insertUser.run("Alyssia", "alyssia@mail.com", "abcd");
    insertUser.run("Doudou", "doudou@mail.com", "lol");

    return usersDB;
}
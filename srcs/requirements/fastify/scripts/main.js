import * as db from "./database.js";
import * as ffy from "./server.js";


function main() {
    const database = db.initDB();
    ffy.runServer();
}

main();
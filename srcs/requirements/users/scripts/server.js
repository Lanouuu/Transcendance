import Fastify from 'fastify'
import * as db from "./database.js"

export function runServer() {
    
    const fastify = Fastify({ logger: true });
    const PORT = parseInt(process.env.USERS_PORT, 10);
    const HOST = process.env.USERS_HOST;

    const usersDB = db.initDB();

    fastify.get('/:id', function handler (request, reply) {
        const { id } = request.params;

        try {
            const stmt = usersDB.prepare('SELECT name FROM users WHERE id = ?');
            const user = stmt.get(id)
            if (!user)
                return reply.status(404).send({ error : "User not find" });
            return reply.send({ id, name: user.name});
        } catch (err) {
            return reply.status(500).send({error : "Internal Server Error: " + err.message});
        }
    })
    
    fastify.listen({host: HOST, port: PORT}, (err) => {
        if (err) {
            fastify.log.error(err);
            process.exit(1);
        }
    })
}
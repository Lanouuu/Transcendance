import Fastify from 'fastify'
import * as db from "./database.js"
import bcrypt from "bcryptjs";

export function runServer() {
    
    const fastify = Fastify({ logger: true });
    const PORT = parseInt(process.env.USERS_PORT, 10);
    const HOST = process.env.USERS_HOST;

    const usersDB = db.initDB();

    fastify.post("/signup", async (request, reply) => {
      const { name, mail, password } = request.body;
      if(!mail || !password)
            return reply.code(400).send({error: "Mail and password required"});
    
      const hashedPassword = await bcrypt.hash(password, 10);
      try {
        const result = usersDB.prepare( "INSERT INTO users (name, mail, password) VALUES (?, ?, ?)" );
        result.run(name, mail, hashedPassword);
        return reply.status(201).send({name, mail});
      } catch (err) {
        fastify.log.error(err, "Error signup");
        return reply.status(400).send({error: "Signup failed"});
      }
    });
    
    // Route pour récupérer un user par mail (utilisée par auth_service)
    fastify.get("/mail/:mail", (req, reply) => {
      try {
        const stmt = usersDB.prepare("SELECT * FROM users WHERE mail = ?");
        const user = stmt.get(req.params.mail);
        console.log(user);

        if (!user) {
          return reply.status(404).send({ error: "User not found (in users)" });
        }

        return reply.send(user);
      } catch (err) {
        console.error("Database error:", err);
        return reply.status(500).send({ error: "Internal Server Error: " + err.message });
      }
    });


    fastify.get('/:id', function handler (request, reply) {
        const { id } = request.params;

        try {
            const stmt = usersDB.prepare('SELECT name FROM users WHERE id = ?');
            const user = stmt.get(id)
            if (!user)
                return reply.status(404).send({ error : "User not find" });
            return reply.send({ id, name: user.name });
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
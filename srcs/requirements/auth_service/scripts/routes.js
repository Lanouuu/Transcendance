import bcrypt from "bcryptjs";
import jwt from "@fastify/jwt";
import { initDB } from "./database.js";

export default async function routes(fastify, options) {
    const db = await options.db;

    fastify.get('/', function handler (request, reply) {
        reply.send('Hello World!')
    });
    
    // connexion
    fastify.post("/login", async (request, reply) => {
      const { mail, password } = request.body;

      const res = await fetch(`http://users:3000/mail/${mail}`);
      console.log(res);
      if(!res.ok) return reply.status(400).send({ error: "User not found (in auth)" });
      const user = await res.json();

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) return reply.status(401).send({ error: "Invalid password"});
    
      const token = fastify.jwt.sign({id: user.id, mail: user.mail });

      const db = await initDB();
      const tokenHash = await bcrypt.hash(token, 10);
      await db.run("INSERT INTO sessions (user_id, token_hash) VALUES (?, ?)", [user.id, tokenHash]);

      reply.send({token});
    });

    // deconnexion
    fastify.post("/logout", { preHandler: [fastify.authenticate] }, async (req, reply) => {
      const db = await initDB();
      const tokenHash = await bcrypt.hash(request.token,10);
      await db.run("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);

      reply.send({ message: "Logged out" });
    });

    // Route protégée
    fastify.get("/profile", { preHandler: [fastify.authenticate] }, async (request, reply) => {
      reply.send({ id: request.user.id, mail: request.user.mail })
    });
}
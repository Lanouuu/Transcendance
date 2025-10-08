import bcrypt from "bcryptjs";
import jwt from "@fastify/jwt";

// // Auth middleware
// fastify.decorate("authenticate", async function(request, reply) {
//   try {
//     await request.jwtVerify();
//   } catch (err) {
//     reply.status(401).send({error: "Not authorized"});
//   }
// });

export default async function routes(fastify, options) {
    const db = await options.db;

    fastify.get('/', function handler (request, reply) {
        reply.send('Hello World!')
    });
    
    // connexion
    fastify.post("/login", async (request, reply) => {
      const { email, password } = request.body;
      const user = await db.get("SELECT * FROM sessions WHERE email = ?", [email]);
      if (!user) return reply.status(401).send({ error: "User doesn't exist" });
    
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) return reply.status(401).send({ error: "Invalid password"});
    
      const token = fastify.jwt.sign({id: user.id, email: user.email });
      return {token};
    });
}
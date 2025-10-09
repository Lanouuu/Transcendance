import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { initDB } from "./database.js";
import authRoutes from "./routes.js";

const fastify = Fastify({ logger: true });
const PORT = parseInt(process.env.AUTH_PORT, 10);
const HOST = process.env.AUTH_HOST;

fastify.register(jwt, { secret: "supersecretkey" });

fastify.decorate("authenticate", async function(request, reply) {
try {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
    return reply.status(401).send({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    request.user = await request.jwtVerify(token); //token decode

    const db = await initDB();
    const tokenHash = await bcrypt.hash(token, 10);
    const session = await db.get("SELECT * FROM sessions WHERE token_hash = ?", [tokenHash]);

    if (!session) {
    return reply.status(401).send({ error: "Token invalidated" });
    }

    // Ajout du token brut à la requete
    request.token = token;

} catch (err) {
    console.error("Auth error:", err);
    reply.status(401).send({ error: "Not authorized" });
}
});

const dbSessions = await initDB();

fastify.register(authRoutes, { dbSessions });

fastify.listen({ port: PORT, host: HOST }, (err) => {
    if(err) {
        fastify.log.error(err);
        process.exit(1);
    }
});
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { initDB } from "./database.js";
import authRoutes from "./routes.js";

const fastify = Fastify({ logger: true });

// plugin JWT
fastify.register(jwt, { secret: "supersecretkey" });

// Init DB
const dbSessions = await initDB();

// Routes
fastify.register(authRoutes, { dbSessions });

// Start server
fastify.listen({ port: 8080, host: "0.0.0.0" }, (err) => {
    if(err) {
        fastify.log.error(err);
        process.exit(1);
    }
});

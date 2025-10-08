import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { initDB } from "./database.js";
import authRoutes from "./routes.js";

const fastify = Fastify({ logger: true });
const PORT = parseInt(process.env.AUTH_PORT, 10);
const HOST = process.env.AUTH_HOST;

fastify.register(jwt, { secret: "supersecretkey" });

const dbSessions = await initDB();

fastify.register(authRoutes, { dbSessions });

fastify.listen({ port: PORT, host: HOST }, (err) => {
    if(err) {
        fastify.log.error(err);
        process.exit(1);
    }
});
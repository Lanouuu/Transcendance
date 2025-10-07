import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { initDB } from "../data/database.js";
// import authRoutes from "../scripts/routes.js";

const fastify = Fastify({ logger: true });

// JWT secret
fastify.register(jwt, { secret: "supersecretkey" });

// Init DB
const db = await initDB();

// // Routes
// fastify.register(authRoutes, { db });

fastify.get('/', function handler (request, reply) {
    reply.send('Hello World!')
})

// Start server
fastify.listen({ port: 8080, host: "0.0.0.0" });

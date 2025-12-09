import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { initDB } from "./database.js";
import authRoutes from "./routes.js";
import cors from "@fastify/cors";
import { verifyToken } from "./auth_utils.js";
import fastifyOauth2 from "@fastify/oauth2";


const fastify = Fastify({ logger: true });
const PORT = parseInt(process.env.AUTH_PORT, 10);
const HOST = process.env.AUTH_HOST;

fastify.register(fastifyOauth2, {
    name: "fortyTwoOauth2",
    credentials: {
        client: {
            id: process.env.CLIENT_ID,
            secret: process.env.CLIENT_SECRET,
        },
        auth: {
            authorizeHost: "https://api.intra.42.fr",
            authorizePath: process.env.APP_URI,
            tokenHost: "https://api.intra.42.fr",
            tokenPath: "/oauth/token",
        },
    },
    scope: ["public"],
    startRedirectPath: "/login/42",
    callbackUri: "https://localhost:8443/auth_service/login/42/callback",
});

fastify.register(jwt, { secret: process.env.JWT_SECRET });

await fastify.register(cors, {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
});

fastify.decorate("authenticate", async function(request, reply) {
try {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
    return reply.status(401).send({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        return reply.code(401).send({ error: "No token provided" });
    }
    console.log("verify token logout");
    const decoded = await verifyToken(fastify,token);
    
    request.user = decoded;
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
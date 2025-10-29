import Fastify from "fastify";
import * as db from "./database.js";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fs from "fs";
import path from "path";

export function runServer() {
    
    const fastify = Fastify({ logger: true });
    const PORT = parseInt(process.env.USERS_PORT, 10);
    const HOST = process.env.USERS_HOST;
    const usersDB = db.initDB();
    
    fastify.register(cors, { 
      origin: "*",
      methods: ["GET", "POST", "DELETE"],
      credentials: true
    });

    fastify.register(multipart, {
      limits: { fileSize: 2 * 1024 * 1024 },
    });
    
    fastify.post("/create_user", async (request, reply) => {
      const { name, mail, password, enable2FA, secret2FA } = request.body;

      try {
        const stmt = usersDB.prepare(`
          INSERT INTO users (name, mail, password, enable2FA, secret2FA)
          VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(name, mail, password, enable2FA, secret2FA || null);
        return reply.status(201).send({ success: true });
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: "Database error" });
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
        return reply.status(400).send({ error: "Internal Server Error: " + err.message });
      }
    });

    fastify.post("/upload-avatar", async (req, reply) => {
      const data = await req.file();
      if (!data) {
        return reply.status(400).send({ error: "No file uploaded" });
      }

      const { id } = data.fields;
      if (!id) {
        return reply.status(400).send({ error: "ID required" });
      }

      const allowedTypes = ["image/jpeg", "image/png"];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({ error: "Invalid file type" });
      }

      const extension = data.mimetype === "image/png" ? ".png" : ".jpg";
      const fileName = `${id}${extension}`;
      const filePath = `/data/avatars/${fileName}`;
      const fullPath = path.join(process.cwd(), filePath);

      const stream = fs.createWriteStream(fullPath);
      await data.file.pipe(stream);

      const stmt = usersDB.prepare("UPDATE users SET avatar_path = ? WHERE id = ?");
      stmt.run(fileName, id);

      reply.send({ success: true, avatar:fileName})

    });

    fastify.get("/get-avatar/:id", async (req, reply) => {
      const { id } = req.params;
      if (!id) {
        return reply.status(400).send({ error: "ID required" });
      }

      try {

        const stmt = usersDB.prepare("SELECT avatar_path FROM users WHERE id = ?");
        const user = stmt.get(id);
        if (!user || !user.avatar_path) {
          return reply.status(400).send({ error: "Avatar not found" });
        }

        const filePath = path.join(process.cwd(), "/data/avatars", user.avatar_path);
        if (!fs.existsSync(filePath)) {
          return reply.status(400).send({ error: "Avatar file not found on server" });
        }

        return reply.type(`image/${path.extname(user.avatar_path).slice(1)}`).send(fs.createReadStream(filePath));

      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    fastify.get("/get-user/:id", async (req, reply) => {
      const { id } = req.params;
      if (!id) {
        return reply.status(400).send({ error: "ID required" });
      }

      try {

        const stmt = usersDB.prepare("SELECT id, name, mail FROM users WHERE id = ?");
        const user = stmt.get(id);
        if (!user) {
          return reply.status(400).send({ error: "User not found" });
        }

        const sanitizedUser = {
          id: user.id,
          name: user.name,
          mail: user.mail
        };

        reply.send(sanitizedUser);

      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }

    });

    fastify.listen({host: HOST, port: PORT}, (err) => {
        if (err) {
            fastify.log.error(err);
            process.exit(1);
        }
    });
}
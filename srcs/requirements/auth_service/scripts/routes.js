import bcrypt from "bcryptjs";
import jwt from "@fastify/jwt";
import { initDB } from "./database.js";
import { authenticator } from "otplib";
import QRCode from "qrcode";

export default async function routes(fastify, options) {
    // const db = await options.db;
    const db = await initDB();

    fastify.get('/', function handler (request, reply) {
        reply.send('Hello World!')
    });
    
    // connexion
    fastify.post("/login", async (request, reply) => {
      const { mail, password, code2FA } = request.body;

      const res = await fetch(`http://users:3000/mail/${mail}`);
      if(!res.ok) return reply.status(400).send({ error: "User not found (in auth)" });
      const user = await res.json();

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) return reply.status(401).send({ error: "Invalid password"});
    

      if(user.secret2FA) {
        if(!code2FA) {
          return reply.status(400).send({error: "2FA code required" });
        }
      }
      const isValid2FA = authenticator.check(code2FA, user.secret2FA);
      if(!isValid2FA) return reply.status(401).send({error: "Invalid 2FA code"});

      const token = fastify.jwt.sign({id: user.id, mail: user.mail });

      const tokenHash = await bcrypt.hash(token, 10);
      await db.run("INSERT INTO sessions (user_id, token_hash) VALUES (?, ?)", [user.id, tokenHash]);

      reply.send({token});
    });

    // creation du code
    fastify.post("/enable-2fa", async (req, reply) => {
      const { mail } = req.body;

      const secret = authenticator.generateSecret();
      const otpAuthUrl = authenticator.keyuri(mail, "Transcendence", secret);

      await db.run("INSERT INTO twofa (user_mail, secret) VALUES (?, ?)", [mail, secret]);

      // Générer le QR Code sous forme de base64
      const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

      reply.send({
        message: "Scan this QR code with Google Authenticator",
        qrCode: qrCodeDataUrl
      });
    });

    //verification du code
    fastify.post("/verify-2fa", async (req, reply) => {
      const { mail, code } = req.body;

      const user = await db.get("SELECT secret FROM twofa WHERE user_mail = ?", [mail]);
      if (!user) return reply.status(404).send({ error: "2FA not enabled for this user" });

      const isValid = authenticator.check(code, user.secret);
      if (!isValid) return reply.status(401).send({ error: "Invalid 2FA code" });

      reply.send({ success: true, message: "2FA validated" });
    });

    // deconnexion
    fastify.post("/logout", { preHandler: [fastify.authenticate] }, async (req, reply) => {
      const tokenHash = await bcrypt.hash(request.token,10);
      await db.run("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);

      reply.send({ message: "Logged out" });
    });

    // Route protégée
    fastify.get("/profile", { preHandler: [fastify.authenticate] }, async (request, reply) => {
      reply.send({ id: request.user.id, mail: request.user.mail })
    });
}
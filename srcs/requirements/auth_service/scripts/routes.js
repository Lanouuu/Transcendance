import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "@fastify/jwt";
import { initDB } from "./database.js";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { verifyToken } from "./auth_utils.js";

const SECRET_HMAC = process.env.HMAC_SECRET;

export default async function routes(fastify, options) {
    // const db = await options.db;
    const db = await initDB();
    
    fastify.get("/verify", async (req, reply) => {
      try {

        const authHeader = req.headers["authorization"];
        if(!authHeader) return reply.code(401).send();
        
        const token = authHeader.split(" ")[1];
        if (!token) return reply.code(401).send({ error: "Token manquant" });
        
        const decoded = await verifyToken(fastify, token);

        reply.code(200).send({ user: decoded });
      } catch {
        reply.code(401).send({ error: "Invalid token" });
      }
    });

    // signup
    fastify.post("/signup", async (request, reply) => {
      const { name, mail, password, enable2FA } = request.body;
      if(!mail || !password)
            return reply.code(400).send({error: "Mail and password required"});
    
      const hashedPassword = await bcrypt.hash(password, 10);

      let secret2FA = null;
      let qrcodedata = null;

      if(enable2FA) {
        secret2FA = authenticator.generateSecret();
        const otpauth = authenticator.keyuri(mail, "Transcendence42", secret2FA);
        qrcodedata = await QRCode.toDataURL(otpauth);
      }

      try {
        const response = await fetch("http://users:3000/create_user", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            name: name,
            mail: mail,
            password: hashedPassword,
            enable2FA: enable2FA ? 1 : 0,
            secret2FA: enable2FA ? secret2FA : null,
          }),
        });

      if(!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "User creation failed");
      }

      return reply.status(201).send({name, mail, qrcodedata });
      } catch (err) {
        fastify.log.error(err, "Error signup");
        return reply.status(400).send({error: "Signup failed"});
      }
    });

    // connexion
    fastify.post("/login", async (request, reply) => {
      const { mail, password, code2FA } = request.body;

      const res = await fetch(`http://users:3000/mail/${mail}`);
      if(!res.ok) return reply.status(400).send({ error: "User not found (in auth)" });
      const user = await res.json();
      
      const isValid = await bcrypt.compare(password, user.password); 
      if (!isValid) return reply.status(401).send({ error: "Invalid password"});

      if(user.enable2FA) {
        if(!code2FA) {
          return reply.status(400).send({error: "2FA code required" });
        }
        const isValid2FA = authenticator.check(code2FA, user.secret2FA);
        if(!isValid2FA) return reply.status(401).send({error: "Invalid 2FA code"});
      }

      const token = fastify.jwt.sign({id: user.id, mail: user.mail });

      const tokenHash = crypto.createHmac("sha256", SECRET_HMAC).update(token).digest("hex");
      await db.run("INSERT INTO sessions (user_id, token_hash) VALUES (?, ?)", [user.id, tokenHash]);

      reply.code(200).send({token});
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

}
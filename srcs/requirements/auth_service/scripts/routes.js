import bcrypt from "bcryptjs";
import crypto from "crypto";
import { initDB } from "./database.js";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { verifyToken } from "./auth_utils.js";
import Redis from "ioredis";

const SECRET_HMAC = process.env.HMAC_SECRET;
const redis = new Redis({ host: "redis", port: 6379 });

export default async function routes(fastify, options) {
    const db = await initDB();
    
    fastify.get("/login/42/callback", async function (request, reply) {
      try {
        const token = await this.fortyTwoOauth2.getAccessTokenFromAuthorizationCodeFlow(request);
        // console.log("Token reçu :", token);
        // console.log("access Token :", token.token.access_token);

        const userInfo = await fetch("https://api.intra.42.fr/v2/me", {
        headers: { Authorization: `Bearer ${token.token.access_token}`,
        },
      });

      // console.log("Réponse API 42 status :", userInfo.status);

      if (!userInfo.ok) {
        console.error("Erreur 42 API status:", userInfo.status, await userInfo.text());
        return reply.code(400).send({ error: "Cannot fetch 42 profile" });
      }

      const profile = await userInfo.json();

      const checkRes = await fetch(`http://users:3000/mail/${profile.email}`);
      let user;
      if(checkRes.ok) {
        user = await checkRes.json();
      }
      else {
        const randomPass = crypto.randomBytes(10).toString("base64").slice(0, 10).replace(/\//g, "_").replace(/\+/g, "-");
        const createUser = await fetch("http://users:3000/create_user", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            name: profile.login,
            mail: profile.email,
            password: randomPass,
            enable2FA: 0,
            secret2FA: null,
            auth_type: "oauth42",
          }),
        });

        if(!createUser.ok) {
          const text = await createUser.text();
          console.error("Error while creating user :", text);
          return reply.code(400).send({error: "User creation failed"})
        }
      }

      const userRes = await fetch(`http://users:3000/mail/${profile.email}`);
      user = await userRes.json();

      if(!user || !user.id) {
        console.error("User not found after creation");
        return reply.code(400).send({ error: "User not found after creation"})
      }

      const jwt = fastify.jwt.sign({id: user.id, mail: user.mail });
      
      const tokenHash = crypto.createHmac("sha256", SECRET_HMAC).update(jwt).digest("hex");
      await db.run("INSERT INTO sessions (user_id, token_hash) VALUES (?, ?)", [user.id, tokenHash]);
      
      reply.code(200).send({ token:jwt, id: user.id });

      } catch (err) {
        console.error("OAuth 42 error:", err);
        reply.code(500).send({ error: "OAuth 42 callback failed" });
      }
    });

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
      const { userName, mail, password, enable2FA } = request.body;
      if(!userName || !mail || !password)
        return reply.code(400).send({error: "Username, mail and password required"});
      
      let testmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
      if(!testmail)
        return reply.code(400).send({error: "Wrong mail format"});

      try {
        const res = await fetch(`http://users:3000/mail/${mail}`);
        if(res.ok) return reply.status(400).send({ error: "Mail already in use" });
        const rez = await fetch(`http://users:3000/name/${userName}`);
        if(rez.ok) return reply.status(400).send({ error: "User name already in use" });
      } catch (err) {
        console.error("Erreur de connexion au service user:", err);
        return reply.status(400).send({ error: "User service unavailable" });
      }

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
            name: userName,
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

      return reply.status(201).send({userName, mail, qrcodedata });

      } catch (err) {
        fastify.log.error(err, "Error signup");
        return reply.status(400).send({error: "Signup failed"});
      }
    });

    // connexion
    fastify.post("/login", async (request, reply) => {
      const { mail, password, code2FA } = request.body;
      
      let user;

      try {
        const res = await fetch(`http://users:3000/mail/${mail}`);
        if(!res.ok) return reply.status(400).send({ error: "User not found" });
        user = await res.json();
      } catch (err) {
        console.error("Erreur de connexion au service user:", err);
        return reply.status(400).send({error: "User service unavailable" });
      }
      
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

      await redis.set(`user:${user.id}:online`, 1);

      reply.code(200).send({
        token,
        id: user.id});
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
      const tokenHash = await bcrypt.hash(req.token,10);
      await db.run("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);

      const userID = req.user.id;
      await redis.set(`user:${userID}`, 0);
      reply.send({ message: "Logged out" });
    });
}
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

        if (!request.query.code) {
          return reply.status(400).send({ error: "Authorization code is missing." });
        }

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
        const userRes = await fetch(`http://users:3000/mail/${profile.email}`);
        if (!userRes.ok) {
          console.error("User not found after creation");
          return reply.code(400).send({ error: "User not found after creation" });
        }
        user = await userRes.json();
      }

      if(!user || !user.id) {
        console.error("User not found after creation");
        return reply.code(400).send({ error: "User not found after creation"})
      }

      const jwt = fastify.jwt.sign({id: user.id, mail: user.mail });
      
      const tokenHash = crypto.createHmac("sha256", SECRET_HMAC).update(jwt).digest("hex");
      await db.run("INSERT INTO sessions (user_id, token_hash) VALUES (?, ?)", [user.id, tokenHash]);
      
      await redis.set(`user:${user.id}:online`, "1", "EX", 30);

      //reply.code(200).send({ token:jwt, id: user.id });
      reply.redirect(`https://localhost:8443/#/oauth42-success?token=${jwt}&id=${user.id}`);

      } catch (err) {
        console.error("OAuth 42 error:", err);
        reply.code(400).send({ error: "OAuth 42 callback failed" });
      }
    });

    fastify.get("/verify", async (req, reply) => {
      try {

        const authHeader = req.headers["authorization"];
        if(!authHeader) return reply.code(401).send();
        
        const token = authHeader.split(" ")[1];
        if (!token) return reply.code(401).send({ error: "Token manquant" });
        
        const decoded = await verifyToken(fastify, token);

        return reply
         .code(200)
         .header("X-User-ID", String(decoded.id))
         .send({ user: decoded });
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


      // check le format du password, a remettre a la fin du projet !!!!!!!!!!!
      // //min 8 letter password, with at least a symbol, upper and lower case letters and a number
      // let testpassword = /^(?=.*\d)(?=.*[!@#$%^&*])(?=.*[a-z])(?=.*[A-Z]).{8,}$/.test(password);
      // if(!testpassword)
      //     return reply.code(400).send({error: "Wrong password format"});

      try {
        const rez = await fetch(`http://users:3000/name/${userName}`);
        if(rez.ok) return reply.status(400).send({ error: "User name already in use" });
        const res = await fetch(`http://users:3000/mail/${mail}`);
        if(res.ok) return reply.status(400).send({ error: "Mail already in use" });
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

      return reply.status(201).send({message: "Signup successful!",userName, mail, qrcodedata });

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

      await redis.set(`user:${user.id}:online`, "1", "EX", 30);

      reply.code(200).send({
        message: "Login successful!",
        token,
        id: user.id});
    });

    // deconnexion
    fastify.post("/logout", async (req, reply) => {
      try {
        const authHeader = req.headers["authorization"] || "";
        let token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : (authHeader || undefined);

        if (!token) {
          fastify.log.warn("logout: no token provided");
          return reply.code(401).send({ error: "No token provided" });
        }

        let payload;
        try {
          payload = await verifyToken(fastify, token);
        } catch (err) {
          fastify.log.warn({ err }, "logout: token verification failed");
          return reply.code(401).send({ error: "Invalid token" });
        }

        const userID = String(payload.id);
        if (!userID) {
          fastify.log.warn("logout: no user id in token");
          return reply.code(400).send({ error: "Invalid token payload" });
        }

        await db.run("DELETE FROM sessions WHERE user_id = ?", [userID]);

        const delCount = await redis.del(`user:${userID}:online`);

        reply.send({ message: "Logged out" });
      } catch (err) {
        fastify.log.error(err, "logout error");
        return reply.code(400).send({ error: "Logout failed" });
      }
    });
}
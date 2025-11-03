import Fastify from "fastify";
import cors from "@fastify/cors";
import * as db from "./database.js";
import multipart from "@fastify/multipart";
import fs from "fs";
import path from "path";
import { pipeline } from 'stream/promises';

export function runServer() {
    
    /****************************************************************************/
    /*                       Init Fastify Users Server                          */
    /****************************************************************************/

    //#region init_users_server
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

    //#endregion init_users_server
    
    /****************************************************************************/
    /*                             Create Users                                 */
    /****************************************************************************/

    //#region create_user

    fastify.post("/create_user", async (req, reply) => {
      const { name, mail, password, enable2FA, secret2FA } = req.body;

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

    fastify.get("/mail/:mail", (req, reply) => {
      try {
        const stmt = usersDB.prepare("SELECT * FROM users WHERE mail = ?");
        const user = stmt.get(req.params.mail);
        if (!user) {
          return reply.status(404).send({ error: "User not found (in users)" });
        }

        return reply.send(user);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error: " + err.message });
      }
    });

    //#endregion create_user

    /****************************************************************************/
    /*                       Users Avatars Management                           */
    /****************************************************************************/

    //#region avatar_management

    fastify.post("/upload-avatar/:id", async (req, reply) => {
      try {
        const data = await req.file();
        if (!data) {
          return reply.status(400).send({ error: "No file uploaded" });
        }
  
        const { id } = req.params;
        if (!id) {
          return reply.status(400).send({ error: "ID required" });
        }
        const reqID = req.headers["x-user-id"];
        if (id !== reqID) {
          return reply.status(403).send({ error: "Can only modify your own avatar" });
        }
  
        const allowedTypes = ["image/jpeg", "image/png"];
        if (!allowedTypes.includes(data.mimetype)) {
          return reply.status(400).send({ error: "Invalid file type" });
        }
  
        const extension = data.mimetype === "image/png" ? ".png" : ".jpg";
        const fileName = `${id}${extension}`;
        const avatarsDir = path.join(process.cwd(), "data", "avatars");
        await fs.promises.mkdir(avatarsDir, { recursive: true });
        const fullPath = path.join(avatarsDir, fileName);
  
        const writeStream = fs.createWriteStream(fullPath);
        await pipeline(data.file, writeStream);
  
        const stmt = usersDB.prepare("UPDATE users SET avatar_path = ? WHERE id = ?");
        stmt.run(fileName, id);
  
        reply.send({ success: true, avatar:fileName});
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
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

    //#endregion avatar_management
 
    /****************************************************************************/
    /*                           Get Users Data                                 */
    /****************************************************************************/

    //#region get_users_data

    fastify.get("/get-user/:id", async (req, reply) => {
      const { id } = req.params;
      if (!id) {
        return reply.status(400).send({ error: "ID required" });
      }
      const reqID = req.headers["x-user-id"];

      try {
        let stmt = null;
        if (reqID !== id) {
          stmt = usersDB.prepare("SELECT id, name, wins, losses FROM users WHERE id = ?");
        } else {
          stmt = usersDB.prepare("SELECT id, name, mail, wins, losses, created_at FROM users WHERE id = ?");
        }
        const user = stmt.get(id);
        if (!user) {
          return reply.status(400).send({ error: "User not found" });
        }

        const sanitizedUser = {
          id: user.id,
          name: user.name,
          mail: reqID === id ? user.mail : undefined,
          wins: user.wins,
          losses: user.losses,
          createdAt: reqID === id ? user.created_at : undefined
        };

        reply.send(sanitizedUser);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });
    
    //#endregion get_users_data

    /****************************************************************************/
    /*                       Users Friends Management                           */
    /****************************************************************************/

    //#region friends_management

    fastify.post("/send-invit/:id/:friendName", async (req, reply) => {
      try {
        const userID = req.params.id;
        const friendName = req.params.friendName;
        if (!userID) {
          return reply.status(400).send({ error: "ID required" });
        } else if (!friendName) {
          return reply.status(400).send({ error: "friend name required" });
        }
        const reqID = req.headers["x-user-id"];
        if (userID !== reqID) {
          return reply.status(403).send({ error: "Can only send invitations for yourself" });
        }
  
        const getStmt = usersDB.prepare("SELECT id FROM users WHERE name = ?");
        const row = getStmt.get(friendName);
        if (!row) {
          return reply.status(404).send({ error: "User (friend) not found" });
        }
        const friendID = row.id;
        if (Number(userID) === friendID) {
          return reply.status(400).send({ error: "You cannot invite yourself" });
        }
  
        const checkStmt = usersDB.prepare(`SELECT status FROM friends WHERE user_id = ? AND friend_id = ?`);
        const existing = checkStmt.get(userID, friendID);
        if (existing) {
          return reply.status(409).send({ message: "Invitation already sent" });
        }
  
        const insertStmt = usersDB.prepare("INSERT INTO friends (user_id, friend_id, status, created_at) VALUES (?, ?, 'pending', datetime('now'))");
        insertStmt.run(userID, friendID);

        return reply.status(201).send({ success: true });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    fastify.post("/accept-invit", async (req, reply) => {
      try {
        const { userID, friendID } = req.body;
        if (!userID || !friendID) {
          return reply.status(400).send({ error: "Missing parameters" });
        }
        
        const pendingStmt = usersDB.prepare("SELECT * FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'");
        const isPending = pendingStmt.get(friendID, userID);
        if (!isPending) {
          return reply.status(400).send({ error: "No pending invitation found" });
        }
  
        const acceptStmt = usersDB.prepare("UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?");
        acceptStmt.run(friendID, userID);

        reply.send({ success: true, message: "Invitation accepted" });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    fastify.get("/friends-list/:id", async (req, reply) => {
      try {
        const userID = req.params.id;
        if (!userID) {
          return reply.status(400).send({ error: "ID required" });
        }
        const reqID = req.headers["x-user-id"];
        if (userID !== reqID) {
          return reply.status(403).send({ error: "Can only view your own friends list" });
        }
  
        const listStmt = usersDB.prepare(`
          SELECT
            f.friend_id AS id, u.name, u.wins, u.losses
          FROM friends f
          JOIN users u ON f.friend_id = u.id
          WHERE f.user_id = ? AND f.status = 'accepted'
          UNION
          SELECT
            f.user_id AS id, u.name, u.wins, u.losses
          FROM friends f
          JOIN users u ON f.user_id = u.id
          WHERE f.friend_id = ? AND f.status = 'accepted'
        `);
        const friendsList = listStmt.all(userID, userID);

        reply.send({ friendsList });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    //#endregion friends_management

    fastify.listen({host: HOST, port: PORT}, (err) => {
      if (err) {
          fastify.log.error(err);
          process.exit(1);
      }
    });
}
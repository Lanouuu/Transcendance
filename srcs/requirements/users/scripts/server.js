import Fastify from "fastify";
import cors from "@fastify/cors";
import * as db from "./database.js";
import multipart from "@fastify/multipart";
import fs from "fs";
import path from "path";
import { pipeline } from 'stream/promises';
import bcrypt from "bcryptjs";
import Redis from "ioredis";

export async function runServer() {
    
    /****************************************************************************/
    /*                       Init Fastify Users Server                          */
    /****************************************************************************/

    //#region init_users_server

    const fastify = Fastify({ logger: true });
    const PORT = parseInt(process.env.USERS_PORT, 10);
    const HOST = process.env.USERS_HOST;
    const usersDB = await db.initDB();

    const redis = new Redis({ host: "redis", port: 6379 });
    
    fastify.register(cors, { 
      origin: "*",
      methods: ["GET", "POST", "DELETE"],
      credentials: true
    });

    fastify.register(multipart, {
      limits: { fileSize: 2 * 1024 * 1024 },
    });

    const AUTH_URL = "http://auth_service:3001";

    //#endregion init_users_server
    
    /****************************************************************************/
    /*                             Create Users                                 */
    /****************************************************************************/

    //#region create_user

    fastify.post("/create_user", async (req, reply) => {
      try {
        const { name, mail, password, enable2FA, secret2FA, auth_type } = req.body;

        if (!name || !mail)
          return reply.code(400).send({ error: "Missing name or mail" });

        const stmt = usersDB.prepare(`
          INSERT INTO users (name, mail, password, enable2FA, secret2FA, auth_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run(name, mail, password, enable2FA, secret2FA || null, auth_type);
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
          return reply.status(404).send({ error: "User not found" });
        }

        return reply.send(user);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error: " + err.message });
      }
    });

    fastify.get("/name/:name", (req, reply) => {
      try {
        const stmt = usersDB.prepare("SELECT * FROM users WHERE name = ?");
        const user = stmt.get(req.params.name);
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
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

        const authHeader = req.headers.authorization || '';
        const sessionsCheck = await fetch(`${AUTH_URL}/sessions/validate`, {
          method : 'POST',
          headers: {
            authorization: authHeader, 
          }
        });
        if (!sessionsCheck.ok) {
          return reply.status(500).send({ error: "Session verification failed" });
        }
        const sessionsJson = await sessionsCheck.json();
        if (!sessionsJson.valid) {
          return reply.status(401).send({ error: "Invalid session" });
        }
        if (sessionsJson.userId && String(sessionsJson.userId) !== String(id)) {
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
  
        reply.send({ success: true, avatar:fileName });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    fastify.get("/get-avatar/:id", async (req, reply) => {
      try {
        const { id } = req.params;
        if (!id) {
          return reply.status(400).send({ error: "ID required" });
        }

        const stmt = usersDB.prepare("SELECT avatar_path FROM users WHERE id = ?");
        const user = stmt.get(id);
        if (!user || !user.avatar_path) {
          return reply.status(404).send({ error: "Avatar not found" });
        }

        const filePath = path.join(process.cwd(), "/data/avatars", user.avatar_path);
        if (!fs.existsSync(filePath)) {
          return reply.status(404).send({ error: "Avatar file not found on server" });
        }

        return reply.type(`image/${path.extname(user.avatar_path).slice(1)}`).send(fs.createReadStream(filePath));
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    //#endregion avatar_management
 
    /****************************************************************************/
    /*                           Users Data Management                          */
    /****************************************************************************/

    //#region users_data_management

    fastify.get("/is-online/:id", async (req, reply) => {
      try {
        const { id } = req.params;
        const isOnline = await redis.exists(`user:${id}:online`);
        return reply.send({ online: isOnline === 1});
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    fastify.post("/heartbeat", async (req, reply) => {
      const userID = req.headers["x-user-id"];
      if (!userID) { 
        return reply.status(401).send({ error: "Missing user" });
      }

      await redis.set(`user:${userID}:online`, "1", "EX", 30);
      return reply.status(200).send({ success: true });
    });

    fastify.get("/get-user/:id", async (req, reply) => {
      try {
        const { id } = req.params;
        if (!id) {
          return reply.status(400).send({ error: "ID required" });
        }
        const reqID = req.headers["x-user-id"];

        let stmt = null;
        if (reqID !== id) {
          stmt = usersDB.prepare("SELECT id, name, wins, losses FROM users WHERE id = ?");
        } else {
          stmt = usersDB.prepare("SELECT id, name, mail, wins, losses, created_at FROM users WHERE id = ?");
        }
        const user = stmt.get(id);
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
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

    fastify.post("/update-name/:id", async (req, reply) => {
      try {
        const { id } = req.params;
        if (!id) {
          return reply.status(400).send({ error: "ID required" });
        }
        
        const authHeader = req.headers.authorization || '';
        const sessionsCheck = await fetch(`${AUTH_URL}/sessions/validate`, {
          method : 'POST',
          headers: {
            authorization: authHeader, 
          }
        });
        if (!sessionsCheck.ok) {
          return reply.status(500).send({ error: "Session verification failed" });
        }
        const sessionsJson = await sessionsCheck.json();
        if (!sessionsJson.valid) {
          return reply.status(401).send({ error: "Invalid session" });
        }
        if (sessionsJson.userId && String(sessionsJson.userId) !== String(id)) {
          return reply.status(403).send({ error: "Can only change your name" });
        }

        const { newName } = req.body;
        if (!newName) {
          return reply.status(400).send({ error: "New name required" });
        }

        const checkStmt = usersDB.prepare("SELECT * FROM users WHERE name = ?");
        const checkName = checkStmt.get(newName);
        if (checkName) {
          return reply.status(400).send({ error: "Name already in use" });
        }

        const changeStmt = usersDB.prepare("UPDATE users SET name = ? WHERE id = ?");
        changeStmt.run(newName, id);

        return reply.status(200).send({ success: true, message: "Name updated" });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    fastify.post("/update-mail/:id", async (req, reply) => {
      try {
        const { id } = req.params;
        if (!id) {
          return reply.status(400).send({ error: "ID required" });
        }

        const authHeader = req.headers.authorization || '';
        const sessionsCheck = await fetch(`${AUTH_URL}/sessions/validate`, {
          method : 'POST',
          headers: {
            authorization: authHeader, 
          }
        });
        if (!sessionsCheck.ok) {
          return reply.status(500).send({ error: "Session verification failed" });
        }
        const sessionsJson = await sessionsCheck.json();
        if (!sessionsJson.valid) {
          return reply.status(401).send({ error: "Invalid session" });
        }
        if (sessionsJson.userId && String(sessionsJson.userId) !== String(id)) {
          return reply.status(403).send({ error: "Can only change your mail" });
        }

        const checkStmt = usersDB.prepare("SELECT * FROM users WHERE id = ?")
        const checkData = checkStmt.get(id);
        if (!checkData) {
          return reply.status(404).send({ error: "User not found" });
        }

        const { newMail } = req.body;
        if (!newMail) {
          return reply.status(400).send({ error: "New mail required" });
        }
        const { confirmMail } = req.body;
        if (!confirmMail) {
          return reply.status(400).send({ error: "Mail confirmation required" });
        }

        if (checkData.auth_type === "oauth42") {
          return reply.status(403).send({ error: "Mail change not allowed for 42 accounts" });
        }
        if (checkData.mail === newMail) {
          return reply.status(400).send({ error: "Mail already in use" });
        }

        let testmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newMail);
        if(!testmail) {
          return reply.code(400).send({ error: "Wrong mail format" });
        }

        if (newMail !== confirmMail) {
          return reply.status(400).send({ error: "Email confirmation does not match" });
        }

        const changeStmt = usersDB.prepare("UPDATE users SET mail = ? WHERE id = ?");
        changeStmt.run(newMail, id);

        return reply.status(200).send({ success: true, message: "Mail updated" });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });
    
    fastify.post("/update-password/:id", async (req, reply) => {
      try {
        const { id } = req.params;
        if (!id) {
          return reply.status(400).send({ error: "ID required" });
        }

        const authHeader = req.headers.authorization || '';
        const sessionsCheck = await fetch(`${AUTH_URL}/sessions/validate`, {
          method : 'POST',
          headers: {
            authorization: authHeader, 
          }
        });
        if (!sessionsCheck.ok) {
          return reply.status(500).send({ error: "Session verification failed" });
        }
        const sessionsJson = await sessionsCheck.json();
        if (!sessionsJson.valid) {
          return reply.status(401).send({ error: "Invalid session" });
        }
        if (sessionsJson.userId && String(sessionsJson.userId) !== String(id)) {
          return reply.status(403).send({ error: "Can only change your password" });
        }

        const user_auth_type = usersDB.prepare("SELECT auth_type, password FROM users WHERE id = ?");
        const user = user_auth_type.get(id);
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }
        if(user.auth_type === "oauth42") {
          return reply.status(403).send({ error: "Password change not allowed for 42 accounts" });
        }

        const { currentPassword } = req.body;
        if (!currentPassword) {
          return reply.status(400).send({ error: "current password required" });
        }
        const { newPassword } = req.body;
        if (!newPassword) {
          return reply.status(400).send({ error: "New password required" });
        }
        const { confirmPassword } = req.body;
        if (!confirmPassword) {
          return reply.status(400).send({ error: "Password confirmation required" });
        }

        const isValid = await bcrypt.compare(currentPassword, user.password); 
        if (!isValid) {
          return reply.status(401).send({ error: "Invalid current password"});
        }

        const checkNewPass = await bcrypt.compare(newPassword, user.password);
        if (checkNewPass) {
          return reply.status(400).send({ error: "New password must be different from the current one"});
        }

        if (newPassword !== confirmPassword) {
          return reply.status(400).send({ error: "Password confirmation does not match"});
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const changeStmt = usersDB.prepare("UPDATE users SET password = ? WHERE id = ?");
        changeStmt.run(hashedPassword, id);

        return reply.status(200).send({ success: true, message: "Password updated" });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    //#endregion users_data_management

    /****************************************************************************/
    /*                       Users Friends Management                           */
    /****************************************************************************/

    //#region friends_management

    fastify.post("/send-invit", async (req, reply) => {
      try {
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        const userID = req.headers["x-user-id"];
        const { friendName } = req.body;
        if (!userID) {
          return reply.status(400).send({ error: "ID required" });
        } else if (!friendName) {
          return reply.status(400).send({ error: "friend name required" });
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
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        const blockedStmt = usersDB.prepare(`
          SELECT blocked_by FROM friends
          WHERE status = 'blocked'
          AND (
            (user_id = ? AND friend_id = ?)
            OR
            (user_id = ? AND friend_id = ?) 
          );`
        );
        const checkBlocked = blockedStmt.get(userID, friendID, friendID, userID);
        if (checkBlocked) {
          if (checkBlocked.blocked_by === Number(userID)) {
            return reply.status(403).send({ error: "You have blocked this user" });
          } else {
              return reply.status(403).send({ error: "You are blocked by this user" });
          }
        }

        const checkStmt = usersDB.prepare(`
          SELECT * FROM friends
          WHERE (user_id = ? AND friend_id = ?) 
          OR 
          (user_id = ? AND friend_id = ?)`
        );
        const existing = checkStmt.get(userID, friendID, friendID, userID);
        if (existing) {
          return reply.status(409).send({ message: "Invitation already sent" });
        }
  
        const insertStmt = usersDB.prepare("INSERT INTO friends (user_id, friend_id, status, created_at) VALUES (?, ?, 'pending', datetime('now'))");
        insertStmt.run(userID, friendID);

        return reply.status(201).send({ success: true, message: "Invitation send to friend" });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    fastify.get("/get-invits/:id", async (req, reply) => {
      try {
        const userID = req.params.id;
        if (!userID) {
          return reply.status(400).send({ error: "ID required" });
        }
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        const reqID = req.headers["x-user-id"];
        if (userID !== reqID) {
          return reply.status(403).send({ error: "Can only view your invitations" });
        }
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        const listStmt = usersDB.prepare(`
          SELECT
            f.user_id AS sender_id,
            u.name AS sender_name,
            f.created_at AS sent_at,
            f.id AS invite_id
          FROM friends f
          JOIN users u ON f.user_id = u.id
          WHERE f.friend_id = ? AND f.status = 'pending'
          ORDER BY f.created_at DESC;
        `);
        const pendingList = listStmt.all(userID);
        
        return reply.status(200).send({ pendingList });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    fastify.post("/accept-invit", async (req, reply) => {
      try {
        const userID = req.headers["x-user-id"];
        const { friendID } = req.body;
        if (!userID || !friendID) {
          return reply.status(400).send({ error: "Missing parameters" });
        }
        
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

    fastify.post("/decline-invit", async (req, reply) => {
      try {
        const userID = req.headers["x-user-id"];
        const { friendID } = req.body;
        if (!userID || !friendID) {
          return reply.status(400).send({ error: "Missing parameters" });
        }

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        const pendingStmt = usersDB.prepare(`
          SELECT * FROM friends 
          WHERE user_id = ? AND friend_id = ? 
          AND status = 'pending'
        `);
        const isPending = pendingStmt.get(friendID, userID);
        if (!isPending) {
          return reply.status(404).send({ error: "No pending invitation found" });
        }

        const delStmt = usersDB.prepare("DELETE FROM friends WHERE id = ?");
        delStmt.run(isPending.id);

        return reply.send({ success: true, message: "Invitation declined" });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    fastify.post("/delete-friend", async (req, reply) => {
      try {
        const userID = req.headers["x-user-id"];
        const { friendID } = req.body;
        if (!userID || !friendID) {
          return reply.status(400).send({ error: "Missing parameters" });
        }

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        deleteStmt = usersDB.prepare(`
          DELETE FROM friends
          WHERE status = 'accepted'
          AND (
            (user_id = ? AND friend_id = ?)
            OR
            (user_id = ? AND friend_id = ?) 
          );`
        );
        const deleteResult = deleteStmt.run(userID, friendID, friendID, userID);
        if (deleteResult.changes === 0) {
          return reply.status(404).send({ error: "No friendship found to delete" });
        }

        return reply.send({ success: true, message: "Friend deleted"});
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    fastify.post("/block-friend", async (req, reply) => {
      try {
        const userID = req.headers["x-user-id"];
        const { friendID } = req.body;
        if (!userID || !friendID) {
          return reply.status(400).send({ error: "Missing parameters" });
        }

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        const blockStmt = usersDB.prepare(`
          UPDATE friends
          SET status = 'blocked', blocked_by = ?
          WHERE status = 'accepted'
          AND (
            (user_id = ? AND friend_id = ?)
            OR
            (user_id = ? AND friend_id = ?) 
          );`
        );
        const blockResult = blockStmt.run(userID, userID, friendID, friendID, userID);
        if (blockResult.changes === 0) {
          return reply.status(404).send({ error: "No friendship found to block" });
        }

        return reply.send({ success: true, message: "Friend blocked"});
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    fastify.post("/unblock-user", async (req, reply) => {
      try {
        const userID = req.headers["x-user-id"];
        const { friendID } = req.body;
        if (!userID || !friendID) {
          return reply.status(400).send({ error: "Missing parameters" });
        }

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        const unblockStmt = usersDB.prepare(`
          UPDATE friends
          SET status = 'accepted', blocked_by = 0
          WHERE status = 'blocked' AND blocked_by = ?
          AND (
            (user_id = ? AND friend_id = ?)
            OR
            (user_id = ? AND friend_id = ?) 
          );`
        );
        const unblockResult = unblockStmt.run(userID, userID, friendID, friendID, userID);
        if (unblockResult.changes === 0) {
          return reply.status(404).send({ error: "No friendship found to unblock" });
        }
        return reply.send({ success: true, message: "Friend unblocked"});
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
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        const reqID = req.headers["x-user-id"];
        if (userID !== reqID) {
          return reply.status(403).send({ error: "Can only view your own friends list" });
        }
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  
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

        return reply.status(200).send({ friendsList });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    fastify.get("/blocked-users/:id", async (req, reply) => {
      try {
        const userID = req.params.id;
        if (!userID) {
          return reply.status(400).send({ error: "ID required" });
        }
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        const reqID = req.headers["x-user-id"];
        if (userID !== reqID) {
          return reply.status(403).send({ error: "Can only view your own blocked list" });
        }
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        const blockedStmt = usersDB.prepare(`
          SELECT f.friends_id AS id, u.name
          FROM friends f
          JOIN users ON
            (u.id = f.friend_id OR u.id = f.user_id)
          WHERE f.blocked_by = ?`
        );
        const blockedUsers = blockedStmt.all(userID);

        reply.status(200).send({ blockedUsers });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    //#endregion friends_management

    /****************************************************************************/
    /*                           Matches Management                             */
    /****************************************************************************/

    //#region matches_management

    fastify.post("/save-match", async (req, reply) => {
      try {
        const { player1ID, player2ID, winnerID, scoreP1, scoreP2, matchType } = req.body;

        const saveStmt = usersDB.prepare(`
          INSERT INTO matches 
            (player1_id, player2_id, winner_id, score_p1, score_p2, match_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        saveStmt.run(player1ID, player2ID, winnerID, scoreP1, scoreP2, matchType);

        return reply.status(201).send({ success: true, message: "Match saved" });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    fastify.get("/get-matches/:id", async (req, reply) => {
      try {
        const userID = req.params.id;
        if (!userID) {
            return reply.status(400).send({ error: "userID required" });
          }

        const authHeader = req.headers.authorization || '';
        const sessionsCheck = await fetch(`${AUTH_URL}/sessions/validate`, {
          method : 'POST',
          headers: {
            authorization: authHeader, 
          }
        });
        if (!sessionsCheck.ok) {
          return reply.status(500).send({ error: "Session verification failed" });
        }
        const sessionsJson = await sessionsCheck.json();
        if (!sessionsJson.valid) {
          return reply.status(401).send({ error: "Invalid session" });
        }
        if (sessionsJson.userId && String(sessionsJson.userId) !== String(id)) {
          return reply.status(403).send({ error: "Can only view your own matches list" });
        }

        const getStmt = usersDB.prepare(`
          SELECT * FROM matches 
          WHERE player1_id = ? OR player2_id = ? 
          ORDER BY played_at DESC
        `); 
        const macthList = getStmt.all(userID, userID);
      
        return reply.status(200).send({ macthList });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    //#endregion matches_management

    fastify.listen({host: HOST, port: PORT}, (err) => {
      if (err) {
          fastify.log.error(err);
          process.exit(1);
      }
    });
}
import Fastify from "fastify";
import cors from "@fastify/cors";
import * as db from "./database.js";
import multipart from "@fastify/multipart";
import fs from "fs";
import path from "path";
import { pipeline } from 'stream/promises';
import bcrypt from "bcryptjs";
import Redis from "ioredis";
import { authenticator } from "otplib";
import QRCode from "qrcode";

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

    async function checkIsGuest(userID) {
      if (!userID) {
        return false;
      } else {
        const checkStmt = usersDB.prepare("SELECT is_guest FROM users WHERE id = ?");
        const checkRes = checkStmt.get(userID);
        if (checkRes && checkRes.is_guest) {
          return true;
        } else {
          return false;
        }
      }
    };

    function blockGuests(handler) {
      return async (req, reply) => {
        const userID = req.headers["x-user-id"];
        if (await checkIsGuest(userID)) {
          return reply.status(403).send({ error: "Unauthorized for guests" });
        } else {
          return handler(req, reply);
        }
      };
    }

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
        return reply.code(400).send({ error: "Database error" });
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
        return reply.status(400).send({ error: "Internal Server Error: " + err.message });
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
        return reply.status(400).send({ error: "Internal Server Error: " + err.message });
      }
    });

    fastify.post("/create-guest", async (req, reply) => {
      try {
        const lastRow = usersDB.prepare("SELECT MAX(id) AS id FROM users").get();
        const guestID = (lastRow?.id || 0) + 1;
        const guestName = `guest${guestID}`;
        const mail = `${guestName}@guest.fr`;
        const password = `${guestName}-Guest2025`;
        const code2FA = null;

        if (!guestName || !mail || !password)
          return reply.code(400).send({ error: "Missing name or mail or pass" });

        const hashedPassword = await bcrypt.hash(password, 10);

        const stmt = usersDB.prepare(`
          INSERT INTO users (name, mail, password, is_guest)
          VALUES (?, ?, ?, ?)
        `);
        stmt.run(guestName, mail, hashedPassword, 1);

        const guestLog = await fetch('http://auth_service:3001/login', {
          method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ mail, password, code2FA }),
        });

        if (!guestLog.ok)
          return reply.status(400).send({ error: "Counldn't login guest" });
        
        const data = await guestLog.json();

        return reply.status(201).send({ token: data.token, id: data.id });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({ error: "Internal Server Error: " + err.message });
      }
    });

    fastify.get("/is-guest", async (req, reply) => {
      try {
        const guestID = req.headers["x-user-id"];
        if (!guestID) {
          return reply.status(400).send({ error: "ID required" });
        }

        const checkStmt = usersDB.prepare("SELECT is_guest FROM users WHERE id = ?");
        const checkRes = checkStmt.get(guestID);

        return reply.status(200).send({ isGuest: checkRes.is_guest });
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

    fastify.post("/upload-avatar/:id",  blockGuests(async (req, reply) => {
      try {
        const data = await req.file();
        if (!data) {
          return reply.status(400).send({ error: "No file uploaded" });
        }
  
        const { id } = req.params;
        if (!id) {
          return reply.status(400).send({ error: "ID required" });
        }

        const userID = req.headers["x-user-id"];
        if (!userID || String(userID) !== String(id)) {
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
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    fastify.get("/get-avatar/:id",  blockGuests(async(req, reply) => {
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
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

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
        return reply.status(400).send({ error: "Internal Server Error" });
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

    fastify.get("/get-user/:id",  blockGuests(async (req, reply) => {
      try {
        const { id } = req.params;
        if (!id) {
          return reply.status(400).send({ error: "ID required" });
        }
        const reqID = req.headers["x-user-id"];

        let stmt = null;
        if (reqID !== id) {
          stmt = usersDB.prepare("SELECT id, name, pong_wins, pong_losses, snake_wins, snake_losses, snake_elo FROM users WHERE id = ?");
        } else {
          stmt = usersDB.prepare("SELECT id, name, mail, pong_wins, pong_losses, snake_wins, snake_losses, snake_elo, created_at FROM users WHERE id = ?");
        }
        const user = stmt.get(id);
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }

        const sanitizedUser = {
          id: user.id,
          name: user.name,
          mail: String(reqID) === String(id) ? user.mail : undefined,
          pong_wins: user.pong_wins,
          pong_losses: user.pong_losses,
          snake_wins: user.snake_wins,
          snake_losses: user.snake_losses,
          createdAt: String(reqID) === String(id) ? user.created_at : undefined
        };

        reply.send(sanitizedUser);
      } catch (err) {
        fastify.log.error(err);
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    fastify.post("/update-name/:id",  blockGuests(async (req, reply) => {
      try {
        const { id } = req.params;
        if (!id) {
          return reply.status(400).send({ error: "ID required" });
        }
        
        const userID = req.headers["x-user-id"];
        if (!userID || String(userID) !== String(id)) {
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
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    fastify.post("/update-mail/:id",  blockGuests(async (req, reply) => {
      try {
        const { id } = req.params;
        if (!id) {
          return reply.status(400).send({ error: "ID required" });
        }

        const userID = req.headers["x-user-id"];
        if (!userID || String(userID) !== String(id)) {
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
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));
    
    fastify.post("/update-password/:id",  blockGuests(async (req, reply) => {
      try {
        const { id } = req.params;
        if (!id) {
          return reply.status(400).send({ error: "ID required" });
        }

        const userID = req.headers["x-user-id"];
        if (!userID || String(userID) !== String(id)) {
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

        // check le format du password, a remettre a la fin du projet !!!!!!!!!!!
        // let testpassword = /^(?=.*\d)(?=.*[!@#$%^&*])(?=.*[a-z])(?=.*[A-Z]).{8,}$/.test(newPassword);
        // if(!testpassword)
        //     return reply.code(400).send({error: "Wrong password format"});
        
        if (newPassword !== confirmPassword) {
          return reply.status(400).send({ error: "Password confirmation does not match"});
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const changeStmt = usersDB.prepare("UPDATE users SET password = ? WHERE id = ?");
        changeStmt.run(hashedPassword, id);

        return reply.status(200).send({ success: true, message: "Password updated" });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    fastify.post("/enable2fa/:id", blockGuests(async (req,reply) => {
      try {
        const { id } = req.params;
        if (!id)
          return reply.status(400).send({ error: "ID required" });

        const userID = req.headers["x-user-id"];
        if (!userID || String(userID) !== String(id))
          return reply.status(403).send({ error: "Can only enable 2fa" });

        const userStmt = usersDB.prepare("SELECT auth_type, enable2FA, mail FROM users WHERE id = ?");
        const user = userStmt.get(id);
        if (!user)
          return reply.status(404).send({ error: "User not found" });
        
        if (user.auth_type === "oauth42")
          return reply.status(403).send({ error: "2FA not allowed for 42 accounts" });
        
        if (user.enable2FA === 1)
          return reply.status(400).send({ error: "2FA already enabled" });

        const secret2FA = authenticator.generateSecret();
        const otpauth = authenticator.keyuri(user.mail, "Transcendence42", secret2FA);
        const qrcodedata = await QRCode.toDataURL(otpauth);

        const updateStmt = usersDB.prepare("UPDATE users SET enable2FA = ?, secret2FA = ? WHERE id = ?");
        updateStmt.run(1, secret2FA, id);

        return reply.status(200).send({message: "2FA enabled", qrcodedata});

        } catch (err) {
          fastify.log.error(err);
          return reply.status(400).send({ error: "Internal Server Error" });
        }
    }));

      fastify.post("/remove2fa/:id", blockGuests(async (req,reply) => {
      try {
        const { id } = req.params;
        if (!id)
          return reply.status(400).send({ error: "ID required" });

        const userID = req.headers["x-user-id"];
        if (!userID || String(userID) !== String(id))
          return reply.status(403).send({ error: "Can only remove 2fa" });

        const userStmt = usersDB.prepare("SELECT auth_type, enable2FA, mail FROM users WHERE id = ?");
        const user = userStmt.get(id);
        if (!user)
          return reply.status(404).send({ error: "User not found" });
        
        if (user.auth_type === "oauth42")
          return reply.status(403).send({ error: "2FA not allowed for 42 accounts" });
        
        if (user.enable2FA === 0)
          return reply.status(400).send({ error: "2FA already inactivated" });

        const updateStmt = usersDB.prepare("UPDATE users SET enable2FA = ?, secret2FA = ? WHERE id = ?");
        updateStmt.run(0, null, id);

        return reply.status(200).send({message: "2FA removed"});

        } catch (err) {
          fastify.log.error(err);
          return reply.status(400).send({ error: "Internal Server Error" });
        }
    }));

    //#endregion users_data_management

    /****************************************************************************/
    /*                       Users Friends Management                           */
    /****************************************************************************/

    //#region friends_management

    fastify.post("/send-invit",  blockGuests(async (req, reply) => {
      try {
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

        const reversePending = usersDB.prepare(`
          SELECT * FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'
        `).get(friendID, userID);
        if (reversePending) {
          usersDB.prepare("UPDATE friends SET status = 'accepted' WHERE id = ?").run(reversePending.id);

          usersDB.prepare(`
            DELETE FROM friends
            WHERE id != ?
            AND (
              (user_id = ? AND friend_id = ?)
              OR
              (user_id = ? AND friend_id = ?)
            )
          `).run(reversePending.id, userID, friendID, friendID, userID);

          return reply.status(201).send({ success: true, message: "Invitation accepted (mutual)" });
        }

        const existingRows = usersDB.prepare(`
          SELECT id, status FROM friends
          WHERE (user_id = ? AND friend_id = ?)
             OR (user_id = ? AND friend_id = ?)
        `).all(userID, friendID, friendID, userID);

        if (existingRows.length > 0) {
          if (existingRows.length > 1) {
            const keepId = existingRows[0].id;
            usersDB.prepare(`
              DELETE FROM friends
              WHERE id != ?
              AND (
                (user_id = ? AND friend_id = ?)
                OR
                (user_id = ? AND friend_id = ?)
              )
            `).run(keepId, userID, friendID, friendID, userID);
          }
          return reply.status(409).send({ message: "Invitation already sent" });
        }
  
        const insertStmt = usersDB.prepare("INSERT INTO friends (user_id, friend_id, status, created_at) VALUES (?, ?, 'pending', datetime('now'))");
        insertStmt.run(userID, friendID);

        return reply.status(201).send({ success: true, message: "Invitation send to friend" });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    fastify.get("/get-invits/:id",  blockGuests(async (req, reply) => {
      try {
        const userID = req.params.id;
        if (!userID) {
          return reply.status(400).send({ error: "ID required" });
        }

        const reqID = req.headers["x-user-id"];
        if (userID !== reqID) {
          return reply.status(403).send({ error: "Can only view your invitations" });
        }

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
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    fastify.post("/accept-invit",  blockGuests(async (req, reply) => {
      try {
        const userID = req.headers["x-user-id"];
        const { friendID } = req.body;
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
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    fastify.post("/decline-invit",  blockGuests(async (req, reply) => {
      try {
        const userID = req.headers["x-user-id"];
        const { friendID } = req.body;
        if (!userID || !friendID) {
          return reply.status(400).send({ error: "Missing parameters" });
        }

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
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    fastify.post("/delete-friend",  blockGuests(async (req, reply) => {
      try {
        const userID = req.headers["x-user-id"];
        const { friendID } = req.body;
        if (!userID || !friendID) {
          return reply.status(400).send({ error: "Missing parameters" });
        }

        const deleteStmt = usersDB.prepare(`
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
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    fastify.post("/block-friend",  blockGuests(async (req, reply) => {
      try {
        const userID = req.headers["x-user-id"];
        const { friendID } = req.body;
        if (!userID || !friendID) {
          return reply.status(400).send({ error: "Missing parameters" });
        }

        const blockStmt = usersDB.prepare(`
          UPDATE friends
          SET status = 'blocked', blocked_by = ?
          WHERE (status = 'accepted' OR status = 'pending')
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
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    fastify.post("/unblock-user",  blockGuests(async (req, reply) => {
      try {
        const userID = req.headers["x-user-id"];
        const { friendID } = req.body;
        if (!userID || !friendID) {
          return reply.status(400).send({ error: "Missing parameters" });
        }

        const unblockStmt = usersDB.prepare(`
          DELETE FROM friends
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
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    fastify.get("/friends-list/:id",  blockGuests(async (req, reply) => {
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
            f.friend_id AS id, u.name
          FROM friends f
          JOIN users u ON f.friend_id = u.id
          WHERE f.user_id = ? AND f.status = 'accepted'
          UNION
          SELECT
            f.user_id AS id, u.name
          FROM friends f
          JOIN users u ON f.user_id = u.id
          WHERE f.friend_id = ? AND f.status = 'accepted'
        `);
        const friendsList = listStmt.all(userID, userID);

        return reply.status(200).send({ friendsList });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    fastify.get("/blocked-users/:id",  blockGuests(async (req, reply) => {
      try {
        const userID = req.params.id;
        if (!userID) {
          return reply.status(400).send({ error: "ID required" });
        }

        const reqID = req.headers["x-user-id"];
        if (userID !== reqID) {
          return reply.status(403).send({ error: "Can only view your own blocked list" });
        }

        const blockedStmt = usersDB.prepare(`
          SELECT 
            CASE 
              WHEN f.user_id = ? THEN f.friend_id 
              ELSE f.user_id 
            END AS id,
            u.name
          FROM friends f
          JOIN users u ON u.id = CASE 
            WHEN f.user_id = ? THEN f.friend_id 
            ELSE f.user_id 
          END
          WHERE f.blocked_by = ? AND f.status = 'blocked'`
        );
        const blockedUsers = blockedStmt.all(userID, userID, userID);

        reply.status(200).send({ blockedUsers });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    //#endregion friends_management

    /****************************************************************************/
    /*                           Matches Management                             */
    /****************************************************************************/

    //#region matches_management

    /**
     * Calcule le nouveau rating ELO pour deux joueurs après un match
     * Formule standard: Nouveau ELO = Ancien ELO + K × (Score réel - Score attendu)
     *
     * @param {number} eloA - ELO actuel du joueur A
     * @param {number} eloB - ELO actuel du joueur B
     * @param {number} scoreA - Score réel du joueur A (1 = victoire, 0.5 = draw, 0 = défaite)
     * @param {number} scoreB - Score réel du joueur B
     * @returns {Object} {newEloA, newEloB}
     */
    function calculateNewElo(eloA, eloB, scoreA, scoreB) {
      const K = 32;  // Facteur standard pour joueurs réguliers

      const expectedA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
      const expectedB = 1 / (1 + Math.pow(10, (eloA - eloB) / 400));

      const newEloA = Math.round(eloA + K * (scoreA - expectedA));
      const newEloB = Math.round(eloB + K * (scoreB - expectedB));

      return { newEloA, newEloB };
    }

    fastify.post("/save-match", async (req, reply) => {
      try {
        const { player1ID, player2ID, winnerID, scoreP1, scoreP2, matchType, gameType } = req.body;

        const p1NameStmt = usersDB.prepare('SELECT name FROM users WHERE id = ?');
        const player1Name = p1NameStmt.get(player1ID);
        if (!player1Name) {
          return reply.status(404).send({ error: "Player 1 not found" });
        }

        const p2NameStmt = usersDB.prepare('SELECT name FROM users WHERE id = ?');
        const player2Name = p2NameStmt.get(player2ID);
        if (!player2Name) {
          return reply.status(404).send({ error: "Player 2 not found" });
        }

        const saveStmt = usersDB.prepare(`
          INSERT INTO matches 
            (player1_id, player1_name, player2_id, player2_name, winner_id, score_p1, score_p2, match_type, game_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        saveStmt.run(player1ID, player1Name.name, player2ID, player2Name.name, winnerID, scoreP1, scoreP2, matchType, gameType);

        if (Number(winnerID) !== 0) {
          let loserID;

          if (winnerID === player1ID) {
            loserID = player2ID;
          } else {
            loserID = player1ID;
          }

          const updateWinnerStmt = usersDB.prepare(`
            UPDATE users 
            SET pong_wins = pong_wins + CASE WHEN ? = 'pong' THEN 1 ELSE 0 END,
              snake_wins = snake_wins + CASE WHEN ? = 'snake' THEN 1 ELSE 0 END
            WHERE id = ?
          `);
          updateWinnerStmt.run(gameType, gameType, winnerID);

          const updateLoserStmt = usersDB.prepare(`
            UPDATE users 
            SET pong_losses = pong_losses + CASE WHEN ? = 'pong' THEN 1 ELSE 0 END,
              snake_losses = snake_losses + CASE WHEN ? = 'snake' THEN 1 ELSE 0 END
            WHERE id = ?
          `);
          updateLoserStmt.run(gameType, gameType, loserID);
        }

        // === CALCUL ELO POUR SNAKE ===
        if (gameType === "snake") {
          // Récupérer les ELO actuels
          const p1EloStmt = usersDB.prepare('SELECT snake_elo FROM users WHERE id = ?');
          const p2EloStmt = usersDB.prepare('SELECT snake_elo FROM users WHERE id = ?');

          const p1Elo = p1EloStmt.get(player1ID)?.snake_elo || 1200;
          const p2Elo = p2EloStmt.get(player2ID)?.snake_elo || 1200;

          // Déterminer les scores (1 = victoire, 0.5 = draw, 0 = défaite)
          let scoreP1, scoreP2;

          if (Number(winnerID) === 0) {
            // Draw
            scoreP1 = 0.5;
            scoreP2 = 0.5;
          } else if (Number(winnerID) === Number(player1ID)) {
            // Player 1 gagne
            scoreP1 = 1;
            scoreP2 = 0;
          } else {
            // Player 2 gagne
            scoreP1 = 0;
            scoreP2 = 1;
          }

          // Calculer les nouveaux ELO
          const { newEloA, newEloB } = calculateNewElo(p1Elo, p2Elo, scoreP1, scoreP2);

          // Mettre à jour les ELO
          const updateEloStmt = usersDB.prepare('UPDATE users SET snake_elo = ? WHERE id = ?');
          updateEloStmt.run(newEloA, player1ID);
          updateEloStmt.run(newEloB, player2ID);

          console.log(`ELO updated: P1 ${p1Elo} → ${newEloA}, P2 ${p2Elo} → ${newEloB}`);
        }

        return reply.status(201).send({ success: true, message: "Match saved" });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    });

    fastify.get("/get-matches/:id",  blockGuests(async (req, reply) => {
      try {
        const userID = req.params.id;
        if (!userID) {
            return reply.status(400).send({ error: "userID required" });
          }

        const reqID = req.headers["x-user-id"];
        if (!reqID || String(reqID) !== String(userID)) {
          return reply.status(403).send({ error: "Can only view your own matches list" });
        }   

        const getStmt = usersDB.prepare(`
          SELECT * FROM matches 
          WHERE player1_id = ? OR player2_id = ? 
          ORDER BY played_at DESC
        `); 
        const matchList = getStmt.all(userID, userID);
      
        return reply.status(200).send({ matchList });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    fastify.post("/invit-game/:id", blockGuests(async (req, reply) => {
      try {
        const userID = req.headers["x-user-id"];
        const friendID = req.params.id;
        const { gameType } = req.body; 

        if (!userID || !friendID || !gameType) {
          return reply.status(400).send({ error: "userID/friendID/gameType required" });
        }

        if (userID === friendID) {
          return reply.status(403).send({ error: "Can't invite yourself" });
        }

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

        const existingStmt = usersDB.prepare(`
          SELECT * FROM invitations 
          WHERE game_type = ? 
          AND (
            (user_id = ? AND friend_id = ?)
            OR 
            (user_id = ? AND friend_id = ? )
          );`
        );
        const existingInvit = existingStmt.get(gameType, userID, friendID, friendID, userID);
        if (existingInvit) {
          return reply.status(403).send({ error: "Invitation already sent" });
        }

        const insertStmt = usersDB.prepare("INSERT INTO invitations (user_id, friend_id, game_type) VALUES (?, ?, ?)");
        insertStmt.run(userID, friendID, gameType);

        return reply.status(200).send({ success: true });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    fastify.post("/clear-invit/:id", blockGuests(async (req, reply) => {
      try {
        const userID = req.headers["x-user-id"];
        const friendID = req.params.id;
        const { gameType } = req.body; 

        if (!userID || !friendID || !gameType) {
          return reply.status(400).send({ error: "userID/friendID/gameType required" });
        }

        const deleteStmt = usersDB.prepare(`
          DELETE FROM invitations 
          WHERE game_type = ? 
          AND (
            (user_id = ? AND friend_id = ?)
            OR 
            (user_id = ? AND friend_id = ? )
          );`);
        deleteStmt.run(gameType, userID, friendID, friendID, userID);

        return reply.status(200).send({ success: true });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(400).send({ error: "Internal Server Error" });
      } 
    }));

    fastify.get("/get-game-invits/:id", blockGuests(async (req, reply) => {
      try {
        const reqID = req.headers["x-user-id"];
        const userID = req.params.id;
        if (!userID || !reqID) {
          return reply.status(400).send({ error: "userID/reqID required" });
        }

        if (reqID !== userID) {
          return reply.status(403).send({ error: "Can only view your own invitations list" });
        }

        const listStmt = usersDB.prepare("SELECT * FROM invitations WHERE friend_id = ?");
        const invitList = listStmt.all(userID);
        
        return reply.status(200).send({ invitList });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(400).send({ error: "Internal Server Error" });
      }
    }));

    //#endregion matches_management

    fastify.listen({host: HOST, port: PORT}, (err) => {
      if (err) {
          fastify.log.error(err);
          process.exit(1);
      }
    });
}
import crypto from "crypto";
import { initDB } from "./database.js";

const TOKEN_SECRET = process.env.JWT_SECRET;
const SECRET_HMAC = process.env.HMAC_SECRET;

export async function verifyToken(fastify, token) {
  if (!token) throw new Error("No token provided");

  let decoded;
  try {
    decoded = fastify.jwt.verify(token);
  } catch (err) {
    throw new Error("Invalid JWT");
  }

  let db;
  try {
    db = await initDB();
  } catch (err) {
    throw new Error("Database connection failed");
  }
  
  let tokenHash;
  try {
    tokenHash = crypto.createHmac("sha256", SECRET_HMAC).update(token).digest("hex");
  } catch (err) {
    throw new Error("Token hash generation failed");
  }

  let session;
  try {
    session = await db.get("SELECT * FROM sessions WHERE token_hash = ?", [tokenHash]);
  } catch (err) {
    throw new Error("Session lookup failed");
  }

  if (!session) throw new Error("Token invalidated");

  return decoded;
}

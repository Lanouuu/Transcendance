import bcrypt from "bcryptjs";
import { initDB } from "./database.js";

export async function verifyToken(token) {
  if (!token) throw new Error("No token provided");

  const decoded = fastify.jwt.verify(token);

  const db = await initDB();
  const tokenHash = await bcrypt.hash(token, 10);
  const session = await db.get("SELECT * FROM sessions WHERE token_hash = ?", [tokenHash]);

  if (!session) throw new Error("Token invalidated");

  return { decoded, session };
}

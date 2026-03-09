import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import db from "../db.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || "15m";
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS || 7);
const RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 15);

const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
});

const loginLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  keyFn: (req) => `${req.ip}:${(req.body?.username || "").toLowerCase()}`,
});

const hashToken = (value) => crypto.createHash("sha256").update(value).digest("hex");

const buildAccessToken = (user) =>
  jwt.sign({ userId: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TTL,
  });

const mintRefreshToken = (userId) => {
  const raw = crypto.randomBytes(48).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)").run(
    userId,
    tokenHash,
    expiresAt
  );
  return raw;
};

const buildAuthPayload = (user) => {
  const token = buildAccessToken(user);
  const refreshToken = mintRefreshToken(user.id);
  return {
    token,
    refreshToken,
    user: { id: user.id, username: user.username, role: user.role },
  };
};

router.post("/register", authLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existingUser) {
    return res.status(409).json({ message: "Username already exists" });
  }

  const usersCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  const role = usersCount === 0 ? "admin" : "user";
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = db
    .prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)")
    .run(username, hashedPassword, role);

  const newUser = { id: result.lastInsertRowid, username, role };

  return res.status(201).json(buildAuthPayload(newUser));
});

router.post("/login", authLimiter, loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  const user = db
    .prepare("SELECT id, username, role, password_hash FROM users WHERE username = ?")
    .get(username);

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  return res.status(200).json(buildAuthPayload(user));
});

router.post("/refresh", authLimiter, (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token is required" });
  }

  const tokenHash = hashToken(refreshToken);
  const storedToken = db
    .prepare("SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ?")
    .get(tokenHash);

  if (!storedToken) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  if (new Date(storedToken.expires_at).getTime() <= Date.now()) {
    db.prepare("DELETE FROM refresh_tokens WHERE id = ?").run(storedToken.id);
    return res.status(401).json({ message: "Refresh token expired" });
  }

  const user = db.prepare("SELECT id, username, role FROM users WHERE id = ?").get(storedToken.user_id);
  if (!user) {
    db.prepare("DELETE FROM refresh_tokens WHERE id = ?").run(storedToken.id);
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  db.prepare("DELETE FROM refresh_tokens WHERE id = ?").run(storedToken.id);
  return res.status(200).json(buildAuthPayload(user));
});

router.post("/logout", authLimiter, (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(200).json({ message: "Logged out" });
  }
  db.prepare("DELETE FROM refresh_tokens WHERE token_hash = ?").run(hashToken(refreshToken));
  return res.status(200).json({ message: "Logged out" });
});

router.post("/forgot-password", authLimiter, (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }

  const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (!user) {
    // Avoid user enumeration.
    return res.status(200).json({ message: "If account exists, reset instructions were generated." });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000).toISOString();
  db.prepare("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)").run(
    user.id,
    tokenHash,
    expiresAt
  );

  // Demo mode: return token directly since email service is not configured.
  return res.status(200).json({
    message: "Reset token generated. Use this token in reset-password endpoint.",
    resetToken: rawToken,
    expiresAt,
  });
});

router.post("/reset-password", authLimiter, async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) {
    return res.status(400).json({ message: "Reset token and new password are required" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const tokenHash = hashToken(resetToken);
  const resetRecord = db
    .prepare("SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?")
    .get(tokenHash);

  if (!resetRecord || resetRecord.used_at) {
    return res.status(400).json({ message: "Invalid reset token" });
  }

  if (new Date(resetRecord.expires_at).getTime() <= Date.now()) {
    return res.status(400).json({ message: "Reset token expired" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const tx = db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, resetRecord.user_id);
    db.prepare("UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?").run(resetRecord.id);
    db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(resetRecord.user_id);
  });
  tx();

  return res.status(200).json({ message: "Password updated successfully" });
});

export default router;

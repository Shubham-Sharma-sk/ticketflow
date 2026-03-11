import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { createRateLimiter } from "../middleware/rateLimit.js";
import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import PasswordResetToken from "../models/PasswordResetToken.js";

const router = express.Router();

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || "15m";
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS || 7);
const RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 15);
const AUTH_RATE_WINDOW_MS = Number(process.env.AUTH_RATE_WINDOW_MS || 60 * 1000);
const AUTH_RATE_MAX = Number(process.env.AUTH_RATE_MAX || 40);
const LOGIN_RATE_WINDOW_MS = Number(process.env.LOGIN_RATE_WINDOW_MS || 10 * 60 * 1000);
const LOGIN_RATE_MAX = Number(process.env.LOGIN_RATE_MAX || 30);

const authLimiter = createRateLimiter({
  windowMs: AUTH_RATE_WINDOW_MS,
  max: AUTH_RATE_MAX,
});

const loginLimiter = createRateLimiter({
  windowMs: LOGIN_RATE_WINDOW_MS,
  max: LOGIN_RATE_MAX,
  keyFn: (req) => `${req.ip}:${(req.body?.username || "").toLowerCase()}`,
});

const hashToken = (value) => crypto.createHash("sha256").update(value).digest("hex");

const buildAccessToken = (user) =>
  jwt.sign({ userId: String(user._id), username: user.username, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TTL,
  });

const mintRefreshToken = (userId) => {
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const raw = crypto.randomBytes(48).toString("hex");
  return { raw, tokenHash: hashToken(raw), expiresAt, userId };
};

const persistRefreshToken = async ({ userId, tokenHash, expiresAt }) => {
  await RefreshToken.create({
    userId,
    tokenHash,
    expiresAt,
  });
};

const buildAuthPayload = async (user) => {
  const token = buildAccessToken(user);
  const refresh = mintRefreshToken(user.id);
  await persistRefreshToken(refresh);
  return {
    token,
    refreshToken: refresh.raw,
    user: { id: String(user._id), username: user.username, role: user.role },
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

  const existingUser = await User.exists({ username });
  if (existingUser) {
    return res.status(409).json({ message: "Username already exists" });
  }

  const usersCount = await User.countDocuments();
  const role = usersCount === 0 ? "admin" : "user";
  const hashedPassword = await bcrypt.hash(password, 10);
  const inserted = await User.create({
    username,
    passwordHash: hashedPassword,
    role,
  });

  return res.status(201).json(await buildAuthPayload(inserted));
});

router.post("/login", authLimiter, loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  const user = await User.findOne({ username });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  return res.status(200).json(await buildAuthPayload(user));
});

router.post("/refresh", authLimiter, async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token is required" });
  }

  const tokenHash = hashToken(refreshToken);
  const storedToken = await RefreshToken.findOne({ tokenHash });
  if (!storedToken) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  if (new Date(storedToken.expiresAt).getTime() <= Date.now()) {
    await RefreshToken.deleteOne({ _id: storedToken._id });
    return res.status(401).json({ message: "Refresh token expired" });
  }

  const user = await User.findById(storedToken.userId);
  if (!user) {
    await RefreshToken.deleteOne({ _id: storedToken._id });
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  await RefreshToken.deleteOne({ _id: storedToken._id });
  return res.status(200).json(await buildAuthPayload(user));
});

router.post("/logout", authLimiter, async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(200).json({ message: "Logged out" });
  }
  await RefreshToken.deleteOne({ tokenHash: hashToken(refreshToken) });
  return res.status(200).json({ message: "Logged out" });
});

router.post("/forgot-password", authLimiter, async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }

  const user = await User.findOne({ username }).select("_id");
  if (!user) {
    return res.status(200).json({ message: "If account exists, reset instructions were generated." });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000).toISOString();
  await PasswordResetToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
  });

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
  const resetRecord = await PasswordResetToken.findOne({ tokenHash });
  if (!resetRecord || resetRecord.usedAt) {
    return res.status(400).json({ message: "Invalid reset token" });
  }

  if (new Date(resetRecord.expiresAt).getTime() <= Date.now()) {
    return res.status(400).json({ message: "Reset token expired" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await User.updateOne({ _id: resetRecord.userId }, { $set: { passwordHash } });
  await PasswordResetToken.updateOne({ _id: resetRecord._id }, { $set: { usedAt: new Date() } });
  await RefreshToken.deleteMany({ userId: resetRecord.userId });

  return res.status(200).json({ message: "Password updated successfully" });
});

export default router;

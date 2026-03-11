import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { adminMiddleware, authMiddleware } from "../middleware/auth.js";
import User from "../models/User.js";
import Seat from "../models/Seat.js";
import RefreshToken from "../models/RefreshToken.js";
import PasswordResetToken from "../models/PasswordResetToken.js";

const router = express.Router();

router.use(authMiddleware, adminMiddleware);

router.get("/users", async (req, res) => {
  const users = await User.find().sort({ createdAt: 1 }).lean();
  const bookedCounts = await Seat.aggregate([
    { $match: { isBooked: true, bookedBy: { $ne: null } } },
    { $group: { _id: "$bookedBy", count: { $sum: 1 } } },
  ]);
  const bookedCountMap = new Map(bookedCounts.map((item) => [String(item._id), item.count]));

  return res.status(200).json({
    users: users.map((user) => ({
      id: String(user._id),
      username: user.username,
      role: user.role,
      created_at: user.createdAt,
      booked_count: bookedCountMap.get(String(user._id)) || 0,
    })),
  });
});

router.post("/users", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const role = req.body?.role === "admin" ? "admin" : "user";

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
    return res.status(400).json({ message: "Username must be 3-30 chars and contain only letters, numbers, _ or -" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const existingUser = await User.exists({ username });
  if (existingUser) {
    return res.status(409).json({ message: "Username already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const inserted = await User.create({
    username,
    passwordHash: hashedPassword,
    role,
  });

  return res.status(201).json({
    message: "User created successfully",
    user: {
      id: String(inserted._id),
      username: inserted.username,
      role: inserted.role,
    },
  });
});

router.patch("/users/:userId/role", async (req, res) => {
  const userId = req.params.userId;
  const { role } = req.body;
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  if (!["admin", "user"].includes(role)) {
    return res.status(400).json({ message: "Role must be 'admin' or 'user'" });
  }

  const user = await User.findById(userId).select("_id role").lean();
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (user.role === "admin" && role === "user") {
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      return res.status(400).json({ message: "At least one admin user is required" });
    }
  }

  await User.updateOne({ _id: userId }, { $set: { role } });
  return res.status(200).json({ message: "User role updated" });
});

router.patch("/users/:userId", async (req, res) => {
  const userId = req.params.userId;
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const user = await User.findById(userId).select("_id role").lean();
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const incomingUsername = req.body?.username;
  const incomingPassword = req.body?.password;
  const incomingRole = req.body?.role;

  const updates = {};

  if (incomingUsername !== undefined) {
    const username = String(incomingUsername || "").trim();
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
      return res.status(400).json({ message: "Username must be 3-30 chars and contain only letters, numbers, _ or -" });
    }
    const existingUser = await User.exists({ username, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(409).json({ message: "Username already exists" });
    }
    updates.username = username;
  }

  if (incomingPassword !== undefined) {
    const password = String(incomingPassword || "");
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    updates.passwordHash = hashedPassword;
  }

  if (incomingRole !== undefined) {
    if (!["admin", "user"].includes(incomingRole)) {
      return res.status(400).json({ message: "Role must be 'admin' or 'user'" });
    }

    if (user.role === "admin" && incomingRole === "user") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return res.status(400).json({ message: "At least one admin user is required" });
      }
    }

    updates.role = incomingRole;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: "No valid fields provided to update" });
  }

  await User.updateOne({ _id: userId }, { $set: updates });
  return res.status(200).json({ message: "User updated successfully" });
});

router.delete("/users/:userId", async (req, res) => {
  const userId = req.params.userId;
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const user = await User.findById(userId).select("_id role").lean();
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (String(user._id) === req.user.userId) {
    return res.status(400).json({ message: "You cannot delete your own account" });
  }

  if (user.role === "admin") {
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      return res.status(400).json({ message: "Cannot delete the last admin user" });
    }
  }

  const targetUserId = new mongoose.Types.ObjectId(userId);
  await Seat.updateMany(
    { bookedBy: targetUserId },
    { $set: { isBooked: false }, $unset: { bookedBy: "", bookedAt: "" } }
  );
  await Seat.updateMany({ holdBy: targetUserId }, { $unset: { holdBy: "", holdExpiresAt: "" } });
  await RefreshToken.deleteMany({ userId: targetUserId });
  await PasswordResetToken.deleteMany({ userId: targetUserId });
  await User.deleteOne({ _id: targetUserId });

  req.app.locals.io.emit("seat:updated", { message: "Seat state updated after user deletion" });
  return res.status(200).json({ message: "User deleted successfully" });
});

router.post("/seats/reset", async (req, res) => {
  await Seat.updateMany(
    {},
    {
      $set: { isBooked: false },
      $unset: { bookedBy: "", bookedAt: "", holdBy: "", holdExpiresAt: "" },
    }
  );
  req.app.locals.io.emit("seats:reset", { message: "All seats reset" });
  return res.status(200).json({ message: "All seats reset" });
});

router.post("/seats/create", async (req, res) => {
  const incomingNames = Array.isArray(req.body?.seatNames) ? req.body.seatNames : [];
  const normalizedNames = [...new Set(incomingNames.map((name) => String(name || "").trim().toUpperCase()).filter(Boolean))];

  if (!normalizedNames.length) {
    return res.status(400).json({ message: "Please provide at least one seat name" });
  }

  if (normalizedNames.length > 200) {
    return res.status(400).json({ message: "You can create up to 200 seats at once" });
  }

  const invalidNames = normalizedNames.filter((name) => !/^[A-Z][A-Z0-9-]{0,14}$/.test(name));
  if (invalidNames.length) {
    return res.status(400).json({
      message: "Invalid seat name format. Use letters/numbers (e.g. A7, VIP-1).",
      invalidSeatNames: invalidNames,
    });
  }

  const existingRows = await Seat.find({ seatNumber: { $in: normalizedNames } }).select("seatNumber").lean();
  const existing = new Set(existingRows.map((row) => row.seatNumber));
  const seatNamesToCreate = normalizedNames.filter((name) => !existing.has(name));

  if (!seatNamesToCreate.length) {
    return res.status(409).json({ message: "All provided seat names already exist", existingSeatNames: normalizedNames });
  }

  await Seat.insertMany(seatNamesToCreate.map((name) => ({ seatNumber: name })));

  req.app.locals.io.emit("seats:reset", { message: "Seats created" });
  return res.status(201).json({
    message: `${seatNamesToCreate.length} seats created successfully`,
    seatNumbers: seatNamesToCreate,
    skippedExistingSeatNames: normalizedNames.filter((name) => existing.has(name)),
  });
});

router.post("/seats/:seatId/reset", async (req, res) => {
  const seatId = req.params.seatId;
  if (!mongoose.isValidObjectId(seatId)) {
    return res.status(400).json({ message: "Invalid seat id" });
  }

  const seat = await Seat.findById(seatId).select("_id").lean();
  if (!seat) {
    return res.status(404).json({ message: "Seat not found" });
  }

  await Seat.updateOne(
    { _id: seatId },
    {
      $set: { isBooked: false },
      $unset: { bookedBy: "", bookedAt: "", holdBy: "", holdExpiresAt: "" },
    }
  );

  req.app.locals.io.emit("seat:updated", { id: seatId });
  return res.status(200).json({ message: "Seat reset successfully" });
});

export default router;

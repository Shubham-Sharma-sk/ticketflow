import express from "express";
import bcrypt from "bcryptjs";
import db from "../db.js";
import { adminMiddleware, authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware, adminMiddleware);

router.get("/users", (req, res) => {
  const users = db
    .prepare(
      `
      SELECT
        u.id,
        u.username,
        u.role,
        u.created_at,
        COUNT(s.id) AS booked_count
      FROM users u
      LEFT JOIN seats s ON s.booked_by = u.id
      GROUP BY u.id
      ORDER BY u.created_at ASC
    `
    )
    .all();
  return res.status(200).json({ users });
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

  const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existingUser) {
    return res.status(409).json({ message: "Username already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const result = db
    .prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)")
    .run(username, hashedPassword, role);

  return res.status(201).json({
    message: "User created successfully",
    user: {
      id: result.lastInsertRowid,
      username,
      role,
    },
  });
});

router.patch("/users/:userId/role", (req, res) => {
  const userId = Number(req.params.userId);
  const { role } = req.body;
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  if (!["admin", "user"].includes(role)) {
    return res.status(400).json({ message: "Role must be 'admin' or 'user'" });
  }

  const user = db.prepare("SELECT id, role FROM users WHERE id = ?").get(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (user.role === "admin" && role === "user") {
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
    if (adminCount <= 1) {
      return res.status(400).json({ message: "At least one admin user is required" });
    }
  }

  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
  return res.status(200).json({ message: "User role updated" });
});

router.patch("/users/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const user = db.prepare("SELECT id, role FROM users WHERE id = ?").get(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const incomingUsername = req.body?.username;
  const incomingPassword = req.body?.password;
  const incomingRole = req.body?.role;

  const updates = [];
  const values = [];

  if (incomingUsername !== undefined) {
    const username = String(incomingUsername || "").trim();
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
      return res.status(400).json({ message: "Username must be 3-30 chars and contain only letters, numbers, _ or -" });
    }
    const existingUser = db.prepare("SELECT id FROM users WHERE username = ? AND id <> ?").get(username, userId);
    if (existingUser) {
      return res.status(409).json({ message: "Username already exists" });
    }
    updates.push("username = ?");
    values.push(username);
  }

  if (incomingPassword !== undefined) {
    const password = String(incomingPassword || "");
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    updates.push("password_hash = ?");
    values.push(hashedPassword);
  }

  if (incomingRole !== undefined) {
    if (!["admin", "user"].includes(incomingRole)) {
      return res.status(400).json({ message: "Role must be 'admin' or 'user'" });
    }

    if (user.role === "admin" && incomingRole === "user") {
      const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
      if (adminCount <= 1) {
        return res.status(400).json({ message: "At least one admin user is required" });
      }
    }

    updates.push("role = ?");
    values.push(incomingRole);
  }

  if (!updates.length) {
    return res.status(400).json({ message: "No valid fields provided to update" });
  }

  db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values, userId);
  return res.status(200).json({ message: "User updated successfully" });
});

router.delete("/users/:userId", (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const user = db.prepare("SELECT id, role FROM users WHERE id = ?").get(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (user.id === req.user.userId) {
    return res.status(400).json({ message: "You cannot delete your own account" });
  }

  if (user.role === "admin") {
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
    if (adminCount <= 1) {
      return res.status(400).json({ message: "Cannot delete the last admin user" });
    }
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE seats SET booked_by = NULL, booked_at = NULL, is_booked = 0 WHERE booked_by = ?").run(userId);
    db.prepare("UPDATE seats SET hold_by = NULL, hold_expires_at = NULL WHERE hold_by = ?").run(userId);
    db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  });
  tx();

  req.app.locals.io.emit("seat:updated", { message: "Seat state updated after user deletion" });
  return res.status(200).json({ message: "User deleted successfully" });
});

router.post("/seats/reset", (req, res) => {
  db.prepare(
    `
    UPDATE seats
    SET is_booked = 0,
        booked_by = NULL,
        booked_at = NULL,
        hold_by = NULL,
        hold_expires_at = NULL
  `
  ).run();
  req.app.locals.io.emit("seats:reset", { message: "All seats reset" });
  return res.status(200).json({ message: "All seats reset" });
});

router.post("/seats/create", (req, res) => {
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

  const existingRows = db
    .prepare(
      `
      SELECT seat_number
      FROM seats
      WHERE seat_number IN (${normalizedNames.map(() => "?").join(", ")})
    `
    )
    .all(...normalizedNames);
  const existing = new Set(existingRows.map((row) => row.seat_number));
  const seatNamesToCreate = normalizedNames.filter((name) => !existing.has(name));

  if (!seatNamesToCreate.length) {
    return res.status(409).json({ message: "All provided seat names already exist", existingSeatNames: normalizedNames });
  }

  const insertSeat = db.prepare("INSERT INTO seats (seat_number) VALUES (?)");
  const tx = db.transaction(() => {
    seatNamesToCreate.forEach((name) => insertSeat.run(name));
  });
  tx();

  req.app.locals.io.emit("seats:reset", { message: "Seats created" });
  return res.status(201).json({
    message: `${seatNamesToCreate.length} seats created successfully`,
    seatNumbers: seatNamesToCreate,
    skippedExistingSeatNames: normalizedNames.filter((name) => existing.has(name)),
  });
});

router.post("/seats/:seatId/reset", (req, res) => {
  const seatId = Number(req.params.seatId);
  if (Number.isNaN(seatId)) {
    return res.status(400).json({ message: "Invalid seat id" });
  }

  const seat = db.prepare("SELECT id FROM seats WHERE id = ?").get(seatId);
  if (!seat) {
    return res.status(404).json({ message: "Seat not found" });
  }

  db.prepare(
    `
    UPDATE seats
    SET is_booked = 0,
        booked_by = NULL,
        booked_at = NULL,
        hold_by = NULL,
        hold_expires_at = NULL
    WHERE id = ?
  `
  ).run(seatId);

  req.app.locals.io.emit("seat:updated", { id: seatId });
  return res.status(200).json({ message: "Seat reset successfully" });
});

export default router;

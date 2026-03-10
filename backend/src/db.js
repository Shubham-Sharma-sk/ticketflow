import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configuredDbPath = process.env.DB_PATH || "data.db";
const dbPath =
  configuredDbPath === ":memory:"
    ? ":memory:"
    : path.isAbsolute(configuredDbPath)
      ? configuredDbPath
      : path.join(__dirname, "..", configuredDbPath);
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seat_number TEXT UNIQUE NOT NULL,
    is_booked INTEGER DEFAULT 0,
    booked_by INTEGER,
    booked_at TEXT,
    hold_by INTEGER,
    hold_expires_at TEXT,
    FOREIGN KEY(booked_by) REFERENCES users(id),
    FOREIGN KEY(hold_by) REFERENCES users(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    used_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all();
if (!userColumns.some((column) => column.name === "role")) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
}

const seatColumns = db.prepare("PRAGMA table_info(seats)").all();
if (!seatColumns.some((column) => column.name === "hold_by")) {
  db.exec("ALTER TABLE seats ADD COLUMN hold_by INTEGER");
}
if (!seatColumns.some((column) => column.name === "hold_expires_at")) {
  db.exec("ALTER TABLE seats ADD COLUMN hold_expires_at TEXT");
}

const seatCountRow = db.prepare("SELECT COUNT(*) as count FROM seats").get();
if (seatCountRow.count === 0) {
  const insertSeat = db.prepare("INSERT INTO seats (seat_number) VALUES (?)");
  const seedSeats = [];

  for (let row = 0; row < 5; row += 1) {
    for (let col = 1; col <= 6; col += 1) {
      const seatLabel = `${String.fromCharCode(65 + row)}${col}`;
      seedSeats.push(seatLabel);
    }
  }

  const insertMany = db.transaction((seats) => {
    for (const seat of seats) {
      insertSeat.run(seat);
    }
  });

  insertMany(seedSeats);
}

const adminCountRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
if (adminCountRow.count === 0) {
  const firstUser = db.prepare("SELECT id FROM users ORDER BY id ASC LIMIT 1").get();
  if (firstUser) {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(firstUser.id);
  }
}

const defaultAdminPasswordHash = bcrypt.hashSync("admin@123", 10);
const existingAdminUser = db.prepare("SELECT id FROM users WHERE username = ?").get("admin");
if (existingAdminUser) {
  db.prepare("UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?").run(
    defaultAdminPasswordHash,
    existingAdminUser.id
  );
} else {
  db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run(
    "admin",
    defaultAdminPasswordHash
  );
}


export default db;

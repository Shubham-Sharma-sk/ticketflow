import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "./models/User.js";
import Seat from "./models/Seat.js";
import RefreshToken from "./models/RefreshToken.js";
import PasswordResetToken from "./models/PasswordResetToken.js";

const defaultUri = "mongodb://127.0.0.1:27017/ticketflow";
const mongoUri = process.env.MONGODB_URI || (process.env.NODE_ENV === "test" ? "mongodb://127.0.0.1:27017/ticketflow-test" : defaultUri);

if (!mongoUri) {
  throw new Error("MONGODB_URI is required for MongoDB");
}

let isConnected = false;

export async function connectDb() {
  if (isConnected) return;
  await mongoose.connect(mongoUri);
  isConnected = true;
}

async function seedSeatsIfMissing() {
  const seatCount = await Seat.countDocuments();
  if (seatCount > 0) return;

  const seedSeats = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 1; col <= 6; col += 1) {
      seedSeats.push({ seatNumber: `${String.fromCharCode(65 + row)}${col}` });
    }
  }
  await Seat.insertMany(seedSeats);
}

async function ensureDefaultAdmin() {
  const defaultAdminPasswordHash = bcrypt.hashSync("admin@123", 10);
  const existingAdmin = await User.findOne({ username: "admin" });
  if (existingAdmin) {
    existingAdmin.passwordHash = defaultAdminPasswordHash;
    existingAdmin.role = "admin";
    await existingAdmin.save();
    return;
  }

  await User.create({
    username: "admin",
    passwordHash: defaultAdminPasswordHash,
    role: "admin",
  });
}

export async function initDatabase() {
  await connectDb();
  await Promise.all([
    User.syncIndexes(),
    Seat.syncIndexes(),
    RefreshToken.syncIndexes(),
    PasswordResetToken.syncIndexes(),
  ]);
  await seedSeatsIfMissing();
  await ensureDefaultAdmin();
}

export async function resetForTests() {
  await connectDb();
  await RefreshToken.deleteMany({});
  await PasswordResetToken.deleteMany({});
  await Seat.updateMany(
    {},
    {
      $set: {
        isBooked: false,
        bookedBy: null,
        bookedAt: null,
        holdBy: null,
        holdExpiresAt: null,
      },
    }
  );
  await User.deleteMany({ username: { $ne: "admin" } });
  await ensureDefaultAdmin();
}

export async function closeDb() {
  if (!isConnected) return;
  await mongoose.connection.close();
  isConnected = false;
}

await initDatabase();

export default {
  connectDb,
  initDatabase,
  resetForTests,
  closeDb,
};

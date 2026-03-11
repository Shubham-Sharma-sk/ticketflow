import express from "express";
import mongoose from "mongoose";
import { authMiddleware } from "../middleware/auth.js";
import Seat from "../models/Seat.js";

const router = express.Router();
const HOLD_TTL_SECONDS = Number(process.env.SEAT_HOLD_TTL_SECONDS || 60);

const clearExpiredHolds = async () => {
  await Seat.updateMany(
    {
      isBooked: false,
      holdExpiresAt: { $ne: null, $lte: Date.now() },
    },
    {
      $set: {
        holdBy: null,
        holdExpiresAt: null,
      },
    }
  );
};

const getSeatById = async (seatId) => {
  return Seat.findById(seatId)
    .populate("bookedBy", "username")
    .populate("holdBy", "username")
    .lean();
};

const mapSeat = (seat) => ({
  id: String(seat._id),
  seatNumber: seat.seatNumber,
  isBooked: Boolean(seat.isBooked),
  bookedById: seat.bookedBy ? String(seat.bookedBy._id || seat.bookedBy) : null,
  bookedAt: seat.bookedAt,
  bookedBy: seat.bookedBy?.username || null,
  isHeld: Boolean(seat.holdBy && seat.holdExpiresAt && Number(seat.holdExpiresAt) > Date.now()),
  heldById: seat.holdBy ? String(seat.holdBy._id || seat.holdBy) : null,
  heldBy: seat.holdBy?.username || null,
  holdExpiresAt: seat.holdExpiresAt ? new Date(Number(seat.holdExpiresAt)).toISOString() : null,
});

router.get("/", authMiddleware, async (req, res) => {
  await clearExpiredHolds();
  const seats = await Seat.find()
    .sort({ seatNumber: 1 })
    .populate("bookedBy", "username")
    .populate("holdBy", "username")
    .lean();

  return res.status(200).json({ seats: seats.map(mapSeat) });
});

router.get("/mine", authMiddleware, async (req, res) => {
  await clearExpiredHolds();
  const seats = await Seat.find({ bookedBy: new mongoose.Types.ObjectId(req.user.userId) })
    .sort({ bookedAt: -1, seatNumber: 1 })
    .populate("bookedBy", "username")
    .populate("holdBy", "username")
    .lean();

  return res.status(200).json({ seats: seats.map(mapSeat) });
});

router.post("/:seatId/hold", authMiddleware, async (req, res) => {
  const seatId = req.params.seatId;
  if (!mongoose.isValidObjectId(seatId)) {
    return res.status(400).json({ message: "Invalid seat id" });
  }

  await clearExpiredHolds();
  const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
  const now = Date.now();
  const holdExpiresAt = now + HOLD_TTL_SECONDS * 1000;

  const updatedSeat = await Seat.findOneAndUpdate(
    {
      _id: seatId,
      isBooked: false,
      $or: [{ holdBy: null }, { holdExpiresAt: { $lte: now } }, { holdBy: userObjectId }],
    },
    {
      $set: { holdBy: userObjectId, holdExpiresAt },
    },
    { new: true }
  )
    .populate("bookedBy", "username")
    .populate("holdBy", "username")
    .lean();

  if (!updatedSeat) {
    const seat = await Seat.findById(seatId).lean();
    if (!seat) return res.status(404).json({ message: "Seat not found" });
    if (seat.isBooked) return res.status(409).json({ message: "Seat already booked" });
    return res.status(409).json({ message: "Seat is currently on hold by another user" });
  }

  const payload = { message: "Seat hold placed. Confirm before timeout.", seat: mapSeat(updatedSeat) };
  req.app.locals.io.emit("seat:held", payload.seat);
  req.app.locals.io.emit("seat:updated", payload.seat);
  return res.status(200).json(payload);
});

router.post("/:seatId/book", authMiddleware, async (req, res) => {
  const seatId = req.params.seatId;
  if (!mongoose.isValidObjectId(seatId)) {
    return res.status(400).json({ message: "Invalid seat id" });
  }

  await clearExpiredHolds();
  const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
  const now = Date.now();

  const updatedSeat = await Seat.findOneAndUpdate(
    {
      _id: seatId,
      isBooked: false,
      holdBy: userObjectId,
      holdExpiresAt: { $gt: now },
    },
    {
      $set: { isBooked: true, bookedBy: userObjectId, bookedAt: new Date() },
      $unset: { holdBy: "", holdExpiresAt: "" },
    },
    { new: true }
  )
    .populate("bookedBy", "username")
    .populate("holdBy", "username")
    .lean();

  if (!updatedSeat) {
    const seat = await Seat.findById(seatId).lean();
    if (!seat) return res.status(404).json({ message: "Seat not found" });
    if (seat.isBooked) return res.status(409).json({ message: "Seat already booked" });
    return res.status(409).json({ message: "Hold this seat first, then confirm booking" });
  }

  const payload = { message: "Seat booked successfully", seat: mapSeat(updatedSeat) };
  req.app.locals.io.emit("seat:booked", payload.seat);
  req.app.locals.io.emit("seat:updated", payload.seat);
  return res.status(200).json(payload);
});

router.post("/:seatId/unbook", authMiddleware, async (req, res) => {
  const seatId = req.params.seatId;
  if (!mongoose.isValidObjectId(seatId)) {
    return res.status(400).json({ message: "Invalid seat id" });
  }

  await clearExpiredHolds();
  const userObjectId = new mongoose.Types.ObjectId(req.user.userId);

  const updatedSeat = await Seat.findOneAndUpdate(
    {
      _id: seatId,
      isBooked: true,
      bookedBy: userObjectId,
    },
    {
      $set: { isBooked: false },
      $unset: { bookedBy: "", bookedAt: "" },
    },
    { new: true }
  )
    .populate("bookedBy", "username")
    .populate("holdBy", "username")
    .lean();

  if (!updatedSeat) {
    const seat = await Seat.findById(seatId).lean();
    if (!seat) return res.status(404).json({ message: "Seat not found" });
    if (!seat.isBooked) return res.status(409).json({ message: "Seat is already available" });
    return res.status(403).json({ message: "You can only cancel your own booking" });
  }

  const payload = { message: "Booking cancelled successfully", seat: mapSeat(updatedSeat) };
  req.app.locals.io.emit("seat:released", payload.seat);
  req.app.locals.io.emit("seat:updated", payload.seat);
  return res.status(200).json(payload);
});

export default router;

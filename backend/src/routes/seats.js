import express from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();
const HOLD_TTL_SECONDS = Number(process.env.SEAT_HOLD_TTL_SECONDS || 60);

const clearExpiredHolds = () => {
  db.prepare(
    `
    UPDATE seats
    SET hold_by = NULL, hold_expires_at = NULL
    WHERE is_booked = 0
      AND hold_expires_at IS NOT NULL
      AND (
        hold_by IS NULL
        OR CAST(hold_expires_at AS INTEGER) <= ?
        OR NOT EXISTS (SELECT 1 FROM users WHERE users.id = seats.hold_by)
      )
  `
  ).run(Date.now());
};

const getSeatById = (seatId) =>
  db
    .prepare(
      `
      SELECT
        seats.id,
        seats.seat_number,
        seats.is_booked,
        seats.booked_by AS booked_by_id,
        seats.booked_at,
        seats.hold_by AS held_by_id,
        seats.hold_expires_at,
        booked_user.username AS booked_by_name,
        hold_user.username AS held_by_name
      FROM seats
      LEFT JOIN users AS booked_user ON seats.booked_by = booked_user.id
      LEFT JOIN users AS hold_user ON seats.hold_by = hold_user.id
      WHERE seats.id = ?
    `
    )
    .get(seatId);

const mapSeat = (seat) => ({
  id: seat.id,
  seatNumber: seat.seat_number,
  isBooked: Boolean(seat.is_booked),
  bookedById: seat.booked_by_id || null,
  bookedAt: seat.booked_at,
  bookedBy: seat.booked_by_name || null,
  isHeld: Boolean(seat.held_by_id && seat.hold_expires_at && Number(seat.hold_expires_at) > Date.now()),
  heldById: seat.held_by_id || null,
  heldBy: seat.held_by_name || null,
  holdExpiresAt: seat.hold_expires_at ? new Date(Number(seat.hold_expires_at)).toISOString() : null,
});

router.get("/", authMiddleware, (req, res) => {
  clearExpiredHolds();
  const seats = db
    .prepare(
      `
      SELECT
        seats.id,
        seats.seat_number,
        seats.is_booked,
        seats.booked_by AS booked_by_id,
        seats.booked_at,
        seats.hold_by AS held_by_id,
        seats.hold_expires_at,
        booked_user.username AS booked_by_name,
        hold_user.username AS held_by_name
      FROM seats
      LEFT JOIN users AS booked_user ON seats.booked_by = booked_user.id
      LEFT JOIN users AS hold_user ON seats.hold_by = hold_user.id
      ORDER BY seats.id ASC
    `
    )
    .all()
    .map(mapSeat);

  return res.status(200).json({ seats });
});

router.get("/mine", authMiddleware, (req, res) => {
  clearExpiredHolds();
  const seats = db
    .prepare(
      `
      SELECT
        seats.id,
        seats.seat_number,
        seats.is_booked,
        seats.booked_by AS booked_by_id,
        seats.booked_at,
        seats.hold_by AS held_by_id,
        seats.hold_expires_at,
        booked_user.username AS booked_by_name,
        hold_user.username AS held_by_name
      FROM seats
      LEFT JOIN users AS booked_user ON seats.booked_by = booked_user.id
      LEFT JOIN users AS hold_user ON seats.hold_by = hold_user.id
      WHERE seats.booked_by = ?
      ORDER BY seats.booked_at DESC, seats.id ASC
    `
    )
    .all(req.user.userId)
    .map(mapSeat);

  return res.status(200).json({ seats });
});

router.post("/:seatId/hold", authMiddleware, (req, res) => {
  const seatId = Number(req.params.seatId);
  if (Number.isNaN(seatId)) {
    return res.status(400).json({ message: "Invalid seat id" });
  }

  const transaction = db.transaction(() => {
    clearExpiredHolds();
    const seat = db
      .prepare("SELECT id, is_booked, hold_by, hold_expires_at FROM seats WHERE id = ?")
      .get(seatId);
    if (!seat) {
      return { status: 404, payload: { message: "Seat not found" } };
    }

    if (seat.is_booked) {
      return { status: 409, payload: { message: "Seat already booked" } };
    }

    const now = Date.now();
    const hasActiveHold = Boolean(seat.hold_by && seat.hold_expires_at && Number(seat.hold_expires_at) > now);
    if (hasActiveHold && seat.hold_by !== req.user.userId) {
      return { status: 409, payload: { message: "Seat is currently on hold by another user" } };
    }

    const holdExpiresAt = now + HOLD_TTL_SECONDS * 1000;
    db.prepare("UPDATE seats SET hold_by = ?, hold_expires_at = ? WHERE id = ?").run(
      req.user.userId,
      holdExpiresAt,
      seatId
    );

    return {
      status: 200,
      payload: {
        message: "Seat hold placed. Confirm before timeout.",
        seat: mapSeat(getSeatById(seatId)),
      },
    };
  });

  const result = transaction();
  if (result.status !== 200) {
    return res.status(result.status).json(result.payload);
  }

  req.app.locals.io.emit("seat:held", result.payload.seat);
  req.app.locals.io.emit("seat:updated", result.payload.seat);
  return res.status(200).json(result.payload);
});

router.post("/:seatId/book", authMiddleware, (req, res) => {
  const seatId = Number(req.params.seatId);
  if (Number.isNaN(seatId)) {
    return res.status(400).json({ message: "Invalid seat id" });
  }

  const transaction = db.transaction(() => {
    clearExpiredHolds();
    const seat = db
      .prepare("SELECT id, is_booked, hold_by, hold_expires_at FROM seats WHERE id = ?")
      .get(seatId);
    if (!seat) {
      return { status: 404, payload: { message: "Seat not found" } };
    }

    if (seat.is_booked) {
      return { status: 409, payload: { message: "Seat already booked" } };
    }

    const hasValidHold =
      seat.hold_by === req.user.userId &&
      seat.hold_expires_at &&
      Number(seat.hold_expires_at) > Date.now();
    if (!hasValidHold) {
      return { status: 409, payload: { message: "Hold this seat first, then confirm booking" } };
    }

    db.prepare(
      `
      UPDATE seats
      SET is_booked = 1, booked_by = ?, booked_at = CURRENT_TIMESTAMP, hold_by = NULL, hold_expires_at = NULL
      WHERE id = ?
    `
    ).run(req.user.userId, seatId);

    const updatedSeat = getSeatById(seatId);

    return {
      status: 200,
      payload: {
        message: "Seat booked successfully",
        seat: mapSeat(updatedSeat),
      },
    };
  });

  const result = transaction();
  if (result.status !== 200) {
    return res.status(result.status).json(result.payload);
  }

  req.app.locals.io.emit("seat:booked", result.payload.seat);
  req.app.locals.io.emit("seat:updated", result.payload.seat);
  return res.status(200).json(result.payload);
});

router.post("/:seatId/unbook", authMiddleware, (req, res) => {
  const seatId = Number(req.params.seatId);
  if (Number.isNaN(seatId)) {
    return res.status(400).json({ message: "Invalid seat id" });
  }

  const transaction = db.transaction(() => {
    clearExpiredHolds();
    const seat = db.prepare("SELECT id, is_booked, booked_by FROM seats WHERE id = ?").get(seatId);
    if (!seat) {
      return { status: 404, payload: { message: "Seat not found" } };
    }

    if (!seat.is_booked) {
      return { status: 409, payload: { message: "Seat is already available" } };
    }

    if (seat.booked_by !== req.user.userId) {
      return { status: 403, payload: { message: "You can only cancel your own booking" } };
    }

    db.prepare("UPDATE seats SET is_booked = 0, booked_by = NULL, booked_at = NULL WHERE id = ?").run(seatId);
    const updatedSeat = getSeatById(seatId);

    return {
      status: 200,
      payload: {
        message: "Booking cancelled successfully",
        seat: mapSeat(updatedSeat),
      },
    };
  });

  const result = transaction();
  if (result.status !== 200) {
    return res.status(result.status).json(result.payload);
  }

  req.app.locals.io.emit("seat:released", result.payload.seat);
  req.app.locals.io.emit("seat:updated", result.payload.seat);
  return res.status(200).json(result.payload);
});

export default router;

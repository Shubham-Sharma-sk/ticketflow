import mongoose from "mongoose";

const seatSchema = new mongoose.Schema(
  {
    seatNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    isBooked: {
      type: Boolean,
      default: false,
      required: true,
    },
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    bookedAt: {
      type: Date,
      default: null,
    },
    holdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    holdExpiresAt: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: false,
  }
);

export default mongoose.models.Seat || mongoose.model("Seat", seatSchema);

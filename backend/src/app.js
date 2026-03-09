import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import seatRoutes from "./routes/seats.js";
import adminRoutes from "./routes/admin.js";

export function createApp({ allowedOrigin }) {
  const app = express();
  app.locals.io = { emit: () => {} };

  app.use(
    cors({
      origin: allowedOrigin,
    })
  );
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/seats", seatRoutes);
  app.use("/api/admin", adminRoutes);

  return app;
}

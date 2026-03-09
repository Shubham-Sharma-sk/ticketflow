import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import "./db.js";
import { createApp } from "./app.js";

const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
const app = createApp({ allowedOrigin });
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"],
  },
});

app.locals.io = io;

io.on("connection", (socket) => {
  socket.emit("socket:connected", { message: "Connected to booking updates" });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

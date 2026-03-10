import "dotenv/config";
import "../src/db.js";
import { createApp } from "../src/app.js";

const allowedOrigin = process.env.FRONTEND_URL || "*";
const app = createApp({ allowedOrigin });

export default app;

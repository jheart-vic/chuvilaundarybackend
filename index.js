import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import { connectDB } from "./config/db.js";
import routes from "./routes/index.js";
import { errorHandler } from "./middlewares/erroHandler.js";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import monnifyWebhook from "./routes/monnifyWebhook.js";
import subscriptionWebhook from "./routes/subscriptionWebhook.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Wrap Express app in HTTP server
const server = http.createServer(app);

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // change to your frontend domain in production
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});

// Middleware to inject io into requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static uploads
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", process.env.UPLOAD_DIR || "uploads"))
);

// Mount API routes
app.use("/api", routes);
app.use("/api", monnifyWebhook);
app.use("/api", subscriptionWebhook);

// Health check
app.get("/", (req, res) => res.json({ ok: true }));

// Error handler
app.use(errorHandler);

// Socket.IO connection logging
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);
  socket.on("disconnect", () => console.log("🔴 Client disconnected:", socket.id));
});

// Connect DB and start server
const PORT = process.env.PORT || 4000;
connectDB(process.env.MONGO_URI).then(() => {
  server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
});

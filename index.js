import express from "express";
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

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


// static uploads
app.use("/uploads", express.static(path.join(__dirname, "..", process.env.UPLOAD_DIR || "uploads")));

// mount api
app.use("/api", routes);
app.use("/api", monnifyWebhook);
app.use("/api", subscriptionWebhook);

// health
app.get("/", (req, res) => res.json({ ok: true }));

// error handler
app.use(errorHandler);

// connect DB and start
const PORT = process.env.PORT || 4000;
connectDB(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
});

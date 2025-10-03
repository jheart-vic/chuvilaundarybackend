import express from "express";
import { emailSubscribe } from "../controllers/emailSubscriber.js";

const router = express.Router();

// Public route to handle email subscriptions
router.post("/subscribe", emailSubscribe);

export default router;
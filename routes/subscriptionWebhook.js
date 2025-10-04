// routes/subscriptionWebhook.js
import express from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { confirmSubscriptionPayment } from "../controllers/subscriptionController.js";

const router = express.Router();

router.post("/webhook/monnify/subscription", requireAuth, confirmSubscriptionPayment);

export default router;

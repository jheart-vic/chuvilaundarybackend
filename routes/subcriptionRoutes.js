import express from "express";
import {
  subscribe,
  pauseSubscription,
  resumeSubscription,
  changePlan,
  rolloverUsage,
  getCurrentSubscription,
  cancelSubscription,
} from "../controllers/subscriptionController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";


const router = express.Router();

// All routes require authentication
router.post("/subscribe", requireAuth, subscribe);
router.post("/pause", requireAuth, pauseSubscription);
router.post("/resume", requireAuth, resumeSubscription);
router.post("/change-plan", requireAuth, changePlan);
router.post("/rollover", requireAuth, rolloverUsage);
router.get("/current", requireAuth, getCurrentSubscription);
router.patch("/:subscriptionId/cancel-auto-payment", cancelSubscription);

export default router;

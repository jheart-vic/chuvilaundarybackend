import express, { Router } from "express";
import { applyCoupon } from "../controllers/couponController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { validateBody } from "../middlewares/validateMiddleware.js";
import { applyCouponSchema } from "../utils/validator.js";

const router = Router();

router.post("/apply", requireAuth, validateBody(applyCouponSchema), applyCoupon);

export default router;

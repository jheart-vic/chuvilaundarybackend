import { Router } from "express";
import {
  createOrder,  listUserOrders,  cancelOrder
} from "../controllers/orderController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/uploadMiddleware.js";
import { validateBody } from "../middlewares/validateMiddleware.js";
import { createOrderSchema } from "../utils/validator.js";

const router = Router();

// create order (authenticated)
router.post("/", requireAuth, upload.array("photos", 5), validateBody(createOrderSchema), createOrder);
router.get("/:phone", requireAuth, listUserOrders)
router.post("/:id/cancel", requireAuth, cancelOrder);

export default router;

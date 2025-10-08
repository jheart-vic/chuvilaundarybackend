import { Router } from "express";
import {
  createOrder,
  listUserOrders,
  cancelOrderUser,
  trackOrderPublic
} from "../controllers/orderController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/uploadMiddleware.js";
import { validateBody } from "../middlewares/validateMiddleware.js";
import { createOrderSchema } from "../utils/validator.js";

const router = Router();

// 📝 Create a new order (authenticated)
router.post("/", requireAuth, upload.array("photos", 5), validateBody(createOrderSchema), createOrder);

// 📄 List all orders for a user by phone number
router.get("/user/:phone", requireAuth, listUserOrders); // 👈 made route more descriptive

// ❌ Cancel an order by orderId
router.post("/:orderId/cancel", requireAuth, cancelOrderUser); // 👈 renamed :id → :orderId

router.get("/track/:orderId", trackOrderPublic); // 👈 Public tracking endpoint

export default router;

import { Router } from "express";
import authRoutes from "./authRoutes.js";
import servicesRoutes from "./serviceRoutes.js";
import ordersRoutes from "./orderRoutes.js";
import usersRoutes from "./userRoutes.js";
import couponsRoutes from "./couponRoutes.js";
import adminRoutes from "./adminRoutes.js";
import notificationRoutes from './notificationRoutes.js';
import reviewRoutes from "./reviewRoutes.js";
import subscriptionRoutes from "./subcriptionRoutes.js";
import issueRoutes from "./issueRoutes.js";
import emailSubscriberRoutes from "./emailsubscriberRoutes.js";
import employeeRoutes from "./employeeRoutes.js";


const router = Router();

router.use("/auth", authRoutes);
router.use("/services", servicesRoutes);
router.use("/orders", ordersRoutes);
router.use("/users", usersRoutes);
router.use("/coupons", couponsRoutes);
router.use("/admin", adminRoutes);
router.use("/reviews", reviewRoutes);
router.use('/api/notifications', notificationRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use("/issues", issueRoutes);
router.use("/", emailSubscriberRoutes);
router.use("/employee", employeeRoutes);

export default router;

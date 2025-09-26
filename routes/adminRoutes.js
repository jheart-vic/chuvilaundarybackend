import { Router } from "express";
import { createEmployee, adminUpdateOrderStatus, deleteCoupon, getCouponById, getCoupons, createCoupon, updateCoupon, adminRegister, adminLogin } from "../controllers/adminController.js";
import { validateBody } from "../middlewares/validateMiddleware.js";
import { requireAuth, requireAdmin, requireEmployeeOrAdmin } from "../middlewares/authMiddleware.js";
import { adminLoginSchema, adminRegisterSchema, createCouponSchema, createEmployeeSchema, updateStatusSchema } from "../utils/validator.js";
import { getAllConfigs, getConfig, upsertConfig, deleteConfig } from '../controllers/configController.js';
import { listServices, createService, updateService, deleteService } from "../controllers/serviceController.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import { deletePricing, listPricings, upsertPricing } from "../controllers/servicePricingController.js";

const router = Router();

router.post("/register", validateBody(adminRegisterSchema), adminRegister);
router.post("/login", validateBody(adminLoginSchema), adminLogin);
router.post("/employees", requireAuth, requireAdmin, validateBody(createEmployeeSchema), createEmployee);
router.patch("/orders/:id/status",requireAuth, requireEmployeeOrAdmin, validateBody(updateStatusSchema), adminUpdateOrderStatus);

// ✅ create coupon
router.post("/create/coupons", requireAuth, requireAdmin, validateBody(createCouponSchema), createCoupon);
router.get("/coupons",requireAuth, requireAdmin, getCoupons);
router.get("/coupons/:id",requireAuth, requireAdmin, getCouponById);
router.put("/coupons/:id",requireAuth, requireAdmin, validateBody(createCouponSchema), updateCoupon);
router.delete("/coupons/:id",requireAuth, requireAdmin, deleteCoupon);

router.post("/create/subcription-plan",requireAuth ,requireAdmin, async (req, res) => {
  const plan = new SubscriptionPlan(req.body);
  await plan.save();
  res.status(201).json(plan);
});

// List all plans
router.get("/get-subcription-plan", requireAuth, requireAdmin, async (req, res) => {
  const plans = await SubscriptionPlan.find();
  res.json(plans);
});


// Config routes
router.get('/get-config',  requireAuth, requireAdmin, getAllConfigs);
router.get('/config/:key', requireAuth, requireAdmin,  getConfig);
router.post('/create/config', requireAuth, requireAdmin,  upsertConfig);
router.delete('/config/:key', requireAuth, requireAdmin,  deleteConfig);

// Service routes
router.get("/get-services", requireAuth, requireAdmin, listServices);
router.post("/create/services", requireAuth, requireAdmin, createService);
router.put("/services/:id", requireAuth, requireAdmin, updateService);
router.delete("/services/:id", requireAuth, requireAdmin, deleteService);

//Service Pricing routes
router.get("/get-service-pricings", requireAuth, requireAdmin, listPricings);
router.put("/service-pricings/:id", requireAuth, requireAdmin, upsertPricing);
router.delete("/service-pricings/:id", requireAuth, requireAdmin, deletePricing);

export default router;

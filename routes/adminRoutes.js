import { Router } from "express";
import { createEmployee, deleteCoupon, getCouponById, getCoupons, createCoupon, updateCoupon, adminRegister, adminLogin, listEmployees, toggleCouponActive, deleteEmployee, listAllOrders, cancelOrderAdmin, getTotalOrders } from "../controllers/adminController.js";
import { validateBody } from "../middlewares/validateMiddleware.js";
import { requireAuth, requireAdmin, requireEmployeeOrAdmin } from "../middlewares/authMiddleware.js";
import { adminLoginSchema, adminRegisterSchema, createCouponSchema, createEmployeeSchema, updateStatusSchema } from "../utils/validator.js";
import { getAllConfigs, getConfig, upsertConfig, deleteConfig } from '../controllers/configController.js';
import { listServices, createService, updateService, deleteService } from "../controllers/serviceController.js";
// import SubscriptionPlan from "../models/SubscriptionPlan.js";
import { deletePricing, listPricings, upsertPricing } from "../controllers/servicePricingController.js";
import { updateOrderStatus } from "../controllers/orderController.js";
import { activatePlan, createPlan, deactivatePlan, getSinglePlan, listActivePlans, updatePlan } from "../controllers/subscriptionPlanController.js";
import { getTotalIssues, listIssues, updateIssue } from "../controllers/issuesController.js";
import { listReviews, reviewSummary } from "../controllers/reviewsController.js";

const router = Router();
const allowedModels = ["Order", "ServicePricing", "Service", "User", "Notification", "Coupon", "SubscriptionPlan"];


router.post("/register", validateBody(adminRegisterSchema), adminRegister);
router.post("/login", validateBody(adminLoginSchema), adminLogin);
router.post("/employees", requireAuth, requireAdmin, validateBody(createEmployeeSchema), createEmployee);
router.get("/get-employees", requireAuth, requireAdmin, listEmployees);
router.delete("/employees/:id", requireAuth, requireAdmin, deleteEmployee)

// ✅ create coupon
router.post("/create/coupons", requireAuth, requireAdmin, validateBody(createCouponSchema), createCoupon);
router.get("/coupons",requireAuth, requireAdmin, getCoupons);
router.get("/coupons/:id",requireAuth, requireAdmin, getCouponById);
router.put("/coupons/:id",requireAuth, requireAdmin, updateCoupon);
router.patch("/coupons/:id/toggle",requireAuth,requireAdmin,toggleCouponActive);

router.delete("/coupons/:id",requireAuth, requireAdmin, deleteCoupon);

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

//orders
router.get("/orders", requireAuth, requireEmployeeOrAdmin, listAllOrders)
router.get("/orders/total", requireAuth, requireAdmin, getTotalOrders)
router.patch("/orders/:id/status", requireAuth, requireEmployeeOrAdmin, validateBody(updateStatusSchema), updateOrderStatus)
router.patch("/orders/:orderId/cancel", requireAuth, requireEmployeeOrAdmin, cancelOrderAdmin)

// Subscription Plan routes
router.post("/plans", requireAuth, requireAdmin, createPlan);
router.put("/plans/:code", requireAuth, requireAdmin, updatePlan);
router.delete("/plans/:code", requireAuth, requireAdmin, deactivatePlan);
router.patch('/plans/:code/activate',requireAuth, requireAdmin, activatePlan);
router.get('/plan', requireAuth, requireAdmin,  getSinglePlan)
router.get("/plans/active", requireAuth, requireAdmin, listActivePlans);

//issues routes
router.get("/issues",  requireAuth, requireEmployeeOrAdmin, listIssues);
router.patch("/issues/:id",  requireAuth, requireEmployeeOrAdmin, updateIssue);
router.get("/issues/total", requireAuth, requireEmployeeOrAdmin, getTotalIssues);

//review/feedback routes
router.get('/reviews', requireAuth,requireEmployeeOrAdmin, listReviews);
router.get('/reviews/summary', requireAuth,requireEmployeeOrAdmin, reviewSummary);

// Generic delete many route for any model
router.delete("/:model", requireAdmin, async (req, res) => {
  try {
    const { model } = req.params;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No IDs provided" });
    }

    if (!allowedModels.includes(model)) {
      return res.status(403).json({ error: `Model '${model}' is not allowed` });
    }

    const Model = mongoose.models[model];
    if (!Model) {
      return res.status(400).json({ error: `Model '${model}' not found` });
    }

    const result = await Model.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      model,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;

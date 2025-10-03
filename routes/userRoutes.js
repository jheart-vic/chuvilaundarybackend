import { Router } from "express";
import { changePassword, getAddresses, getProfile, getReferralInfo, joinMembership, leaveMembership, saveAddress, updateAddress, updatePreferences, updateProfile } from "../controllers/userController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { validateBody } from "../middlewares/validateMiddleware.js";
import { saveAddressSchema } from "../utils/validator.js";
import { subscribe } from "../controllers/emailSubscriber.js";
import { getPlan, listPlans } from "../controllers/subscriptionPlanController.js";

const router = Router();

router.get("/me", requireAuth, getProfile);
router.put("/me", requireAuth, updateProfile);
router.put("/me/password", requireAuth, changePassword);
router.post("/me/addresses", requireAuth, validateBody(saveAddressSchema), saveAddress);
router.put("/me/addresses/:addressId", requireAuth, validateBody(saveAddressSchema), updateAddress);
router.get("/me/addresses", requireAuth, getAddresses);
// Route to join membership
router.post('/membership/join', requireAuth, joinMembership);

// Route to leave membership
router.post('/membership/leave',requireAuth, leaveMembership);
router.patch("/me/preferences", requireAuth, updatePreferences);

//Referal link
router.get('/refer', requireAuth, getReferralInfo)

// Email subscription
router.post("/subscribe", requireAuth, subscribe);

// Public
router.get("/plans", requireAuth, listPlans);
router.get("/plans/:code", requireAuth, getPlan);


export default router;

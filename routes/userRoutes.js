import { Router } from "express";
import { changePassword, deleteAddress, getAddresses, getProfile, getReferralInfo, joinMembership, leaveMembership, saveAddress, updateAddress, updatePreferences, updateProfile } from "../controllers/userController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { validateBody } from "../middlewares/validateMiddleware.js";
import { saveAddressSchema } from "../utils/validator.js";
import { getPlan, listPlans } from "../controllers/subscriptionPlanController.js";
import { subscribe } from "../controllers/subscriptionController.js";
import { upload } from "../middlewares/uploadMiddleware.js";

const router = Router();

router.get("/me", requireAuth, getProfile);
router.put("/me/password", requireAuth, changePassword);
router.put("/me/profile",  requireAuth, upload.single("photo"), updateProfile);
router.post("/me/addresses", requireAuth, validateBody(saveAddressSchema), saveAddress);
router.put("/me/addresses/:addressId", requireAuth, validateBody(saveAddressSchema), updateAddress);
router.delete("/me/addresses/:addressId", requireAuth, deleteAddress);
router.get("/me/addresses", requireAuth, getAddresses);
// Route to join membership
router.post('/membership/join', requireAuth, joinMembership);

// Route to leave membership
router.post('/membership/leave',requireAuth, leaveMembership);
router.patch("/me/preferences", requireAuth, updatePreferences);
//Referal link
router.get('/refer', requireAuth, getReferralInfo)

// user subscribe
router.post("/subscribe", requireAuth, subscribe);

// Public
router.get("/plans", listPlans);
router.get("/plans/:code", requireAuth, getPlan);


export default router;

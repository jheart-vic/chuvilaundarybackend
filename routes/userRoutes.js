import { Router } from "express";
import { changePassword, getAddresses, getProfile, joinMembership, leaveMembership, saveAddress, updateAddress, updatePreferences, updateProfile } from "../controllers/userController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { validateBody } from "../middlewares/validateMiddleware.js";
import { saveAddressSchema } from "../utils/validator.js";

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

export default router;

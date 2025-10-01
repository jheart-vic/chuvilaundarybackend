import { Router } from "express";
import {
  register,
  login,
  verifyPhone,
  resetPasswordDirect,
  resendCode,
} from "../controllers/authController.js";

const router = Router();

// ✅ Full Registration (with password + referral support)
router.post("/register", register);

// ✅ Login with password
router.post("/login", login);

// ✅ Verify phone number after registration
router.post("/verify-phone", verifyPhone);

// ✅ Resend verification code (SMS)
router.post("/resend-code", resendCode);

// ✅ Reset password (direct reset by phone)
router.post("/reset-password", resetPasswordDirect);
export default router;

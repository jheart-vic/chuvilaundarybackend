// utils/coupons.js
import Coupon from "../models/Coupon.js";
import { DateTime } from "luxon";

/**
 * Validate and calculate discount for a given subtotal.
 */
export async function validateAndApplyCoupon(code, subtotal, userPhone, orderId = null) {
  if (!code) return { discount: 0, valid: false, reason: "No code" };

  const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });
  if (!coupon) return { discount: 0, valid: false, reason: "Not found" };

  // Expiry check
  if (coupon.expiresAt) {
    const couponExpires = DateTime.fromJSDate(coupon.expiresAt).setZone("Africa/Lagos");
    if (DateTime.now().setZone("Africa/Lagos") > couponExpires) {
      return { discount: 0, valid: false, reason: "Expired" };
    }
  }

  // Usage limits
  if (coupon.maxUses && coupon.uses >= coupon.maxUses) {
    return { discount: 0, valid: false, reason: "Max uses reached" };
  }

  // Minimum order value
  if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
    return { discount: 0, valid: false, reason: `Minimum ₦${coupon.minOrderValue}` };
  }

  // Discount calculation
  let discount = 0;
  if (coupon.discountPercent) discount += (coupon.discountPercent / 100) * subtotal;
  if (coupon.discountAmount) discount += coupon.discountAmount;

  const appliedDiscount = Math.min(discount, subtotal);

  // Track redemption if we know orderId/user
  if (userPhone && orderId) {
    coupon.uses += 1;
    coupon.redemptions.push({ userPhone, orderId });
    await coupon.save();
  }

  return {
    discount: appliedDiscount,
    valid: true,
    reason: "OK",
    coupon: {
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      discountAmount: coupon.discountAmount,
      expiresAt: coupon.expiresAt,
    }
  };
}

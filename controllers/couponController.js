import Coupon from "../models/Coupon.js";
import { DateTime } from "luxon";

export const applyCoupon = async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;

    if (!code) return res.status(400).json({ message: "Coupon code required" });
    if (typeof subtotal !== "number")
      return res.status(400).json({ message: "Subtotal must be a number" });

    const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });
    if (!coupon)
      return res.status(404).json({ message: "Coupon not found" });

    // ✅ Check if coupon is active
    if (!coupon.isActive) {
      return res.status(400).json({ message: "Coupon is inactive" });
    }

    // ✅ Check expiry date
    if (coupon.expiresAt) {
      const couponExpires = DateTime.fromJSDate(coupon.expiresAt).setZone("Africa/Lagos");
      if (DateTime.now().setZone("Africa/Lagos") > couponExpires) {
        return res.status(400).json({ message: "Coupon expired" });
      }
    }

    // ✅ Check max uses
    if (coupon.maxUses && coupon.uses >= coupon.maxUses) {
      return res.status(400).json({ message: "Coupon usage limit reached" });
    }

    // ✅ Check minimum order
    if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
      return res.status(400).json({ message: `Minimum order value is ₦${coupon.minOrderValue}` });
    }

    // ✅ Calculate discount
    let discount = 0;
    if (coupon.discountPercent)
      discount += (coupon.discountPercent / 100) * subtotal;
    if (coupon.discountAmount)
      discount += coupon.discountAmount;

    const appliedDiscount = Math.min(discount, subtotal);
    const newTotal = Math.max(0, subtotal - appliedDiscount);

    res.json({
      valid: true,
      code: coupon.code,
      discount: appliedDiscount,
      newTotal,
      coupon: {
        discountPercent: coupon.discountPercent,
        discountAmount: coupon.discountAmount,
        expiresAt: coupon.expiresAt,
        maxUses: coupon.maxUses,
        uses: coupon.uses,
        isActive: coupon.isActive,
      },
    });
  } catch (err) {
    console.error("Apply coupon error:", err);
    next(err);
  }
};

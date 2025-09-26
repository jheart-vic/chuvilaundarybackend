import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discountPercent: Number,
  discountAmount: Number,
  expiresAt: Date,
  minOrderValue: Number,
  maxUses: Number,
 redemptions: [
  {
    userPhone: String,
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    redeemedAt: { type: Date, default: Date.now },
  },
],

  uses: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model("Coupon", CouponSchema);

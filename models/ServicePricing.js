import mongoose from "mongoose";

const ServicePricingSchema = new mongoose.Schema(
  {
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
    pricingModel: {
      type: String,
      enum: ["RETAIL"],
      default: "RETAIL"
    },
    serviceTier: {
      type: String,
      enum: ["STANDARD", "PREMIUM", "VIP"],
      required: true
    },

    pricePerItem: { type: Number, required: true },

    // Multipliers
    expressMultiplier: { type: Number, default: 1.5 },
    sameDayMultiplier: { type: Number, default: 1.8 },
  },
  { timestamps: true }
);

export default mongoose.model("ServicePricing", ServicePricingSchema);

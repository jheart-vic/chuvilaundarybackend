import mongoose from "mongoose";

const ServicePricingSchema = new mongoose.Schema(
  {
    serviceCode: { type: String, required: true }, // e.g. "SHIRT01"
    serviceName: { type: String, required: true }, // e.g. "Shirt"

    pricingModel: {
      type: String,
      enum: ["RETAIL"],
      default: "RETAIL"
    },
    serviceTier: {
      type: String,
      enum: ["STANDARD", "PREMIUM", "SIGNATURE"],
      required: true
    },

    pricePerItem: { type: Number, required: true },
    expressMultiplier: { type: Number, default: 1.5 },

    // Delivery rules (retail differs from subscription)
    delivery_km_included: { type: Number, default: 0 },
    delivery_fee_per_km: { type: Number, default: 500 }
  },
  { timestamps: true }
);

export default mongoose.model("ServicePricing", ServicePricingSchema);

import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, required: true }, // e.g. "PREM_CHOICE_24"
    name: String, // marketing name
    family: { type: String, enum: ["BASIC_SAVER", "PREM_CHOICE", "VIP"] },
    tier: {
      type: String,
      enum: ["STANDARD", "PREMIUM", "SIGNATURE"],
      required: true
    },


    // Bundle details
    monthly_items: { type: Number, required: true, default: 20 }, // total items allowed per month
    overageFee: { type: Number, required: true, default: 500 }, // cost per extra item
    included_trips: { type: Number, required: true, default: 2 }, // free trips per month
    price_ngn: { type: Number, required: true, default: 5000 }, // plan cost

    // SLA & express
    sla_hours: { type: Number, required: true, default: 48 }, // standard SLA per tier
    express_multiplier: { type: Number, default: 1.2 }, // surcharge for express service
    sameDay_multiplier: { type: Number, default: 1.8 }, // surcharge for same-day service
    priority_overhead_per_item_ngn: { type: Number, default: 0 }, // extra per express item

    // Delivery policy
    delivery_km_included: { type: Number, default: 0 },
    delivery_fee_per_km: { type: Number, default: 500 },

    // Discounts & extras
    discount_pct: { type: Number, default: 0 },
    priority_overhead_per_item_ngn: { type: Number, default: 0 },

    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model("SubscriptionPlan", subscriptionPlanSchema);

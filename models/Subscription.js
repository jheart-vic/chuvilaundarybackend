import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  plan_code: { type: String, required: true },
  status: { type: String, enum: ["ACTIVE", "PAUSED", "CANCEL_AT_PERIOD_END"], default: "ACTIVE" },
  start_date: { type: Date, default: Date.now },
  renewal_date: { type: Date, required: true },
  rollover_cap_pct: { type: Number, default: 25 },
  rollover_balance: { type: Number, default: 0 },
  pause_count_qtr: { type: Number, default: 0 },
  delivery_zone_status: { type: String, enum: ["INSIDE", "OUTSIDE"], default: "INSIDE" }
}, { timestamps: true });

export default mongoose.model("Subscription", subscriptionSchema);

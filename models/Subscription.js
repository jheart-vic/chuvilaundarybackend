import mongoose from "mongoose";

// ✅ Subscription Payment Plan Schema (Monnify-ready)
const PaymentPlanSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ["CARD", "WALLET", "BANK_TRANSFER"],
      required: true,
    },
    mode: {
      type: String,
      enum: ["FULL", "INSTALLMENT"],
      default: "FULL",
    },
    gateway: {
      type: String,
      enum: ["MONNIFY"], // lock to Monnify since that’s your only PSP
      default: "MONNIFY",
      required: true,
    },
    authorizationRef: String, // Monnify token for auto-renewal (recurring debit mandate)
    lastTransactionId: String, // Monnify transaction reference for last payment
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    installments: [
      {
        dueDate: Date,
        amount: Number,
        status: {
          type: String,
          enum: ["PENDING", "PAID", "FAILED"],
          default: "PENDING",
        },
      },
    ],

    // 🔑 Helpful for retries / billing cycles
    nextBillingDate: { type: Date },
    lastBillingAttempt: { type: Date },
    failedAttempts: { type: Number, default: 0 },
    currency: { type: String, enum: ["NGN"], default: "NGN" },
  },
  { _id: false }
);



const subscriptionSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    plan_code: { type: String, required: true },
    status: {
      type: String,
      enum: ["ACTIVE", "PAUSED", "CANCEL_AT_PERIOD_END"],
      default: "ACTIVE",
    },
    paymentPlan: PaymentPlanSchema, // 👈 attach here
    start_date: { type: Date, default: Date.now },
    renewal_date: { type: Date, required: true },
    rollover_cap_pct: { type: Number, default: 25 },
    rollover_balance: { type: Number, default: 0 },
    pause_count_qtr: { type: Number, default: 0 },
    delivery_zone_status: {
      type: String,
      enum: ["INSIDE", "OUTSIDE"],
      default: "INSIDE",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Subscription", subscriptionSchema);

import mongoose from "mongoose";

// ✅ Payment plan subdocument (Monnify-ready)
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
      enum: ["MONNIFY"],
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
    nextBillingDate: { type: Date },
    lastBillingAttempt: { type: Date },
    failedAttempts: { type: Number, default: 0 },
    currency: { type: String, enum: ["NGN"], default: "NGN" },
  },
  { _id: false }
);

// ✅ Subscription schema
const subscriptionSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    plan_code: { type: String, required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPlan" },

    status: {
      type: String,
      enum: ["ACTIVE", "PAUSED", "CANCEL_AT_PERIOD_END", "CANCELLED", "PENDING", "FAILED"],
      default: "PENDING",
    },

    paymentPlan: PaymentPlanSchema,
    start_date: { type: Date, default: Date.now },
    period_start: { type: Date, required: true },
    period_end: { type: Date, required: true },
    renewal_date: { type: Date, required: true },
    ended_at: { type: Date },
    renewal_count: { type: Number, default: 0 },

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

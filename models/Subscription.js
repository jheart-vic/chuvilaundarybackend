import mongoose from 'mongoose'
import PaymentPlanSchema from './Payment.js'

const subscriptionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    plan_code: { type: String, required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    subId: {
      type: String,
      unique: true,
      index: true
    },
    status: {
      type: String,
      enum: [
        'ACTIVE',
        'PAUSED',
        'CANCEL_AT_PERIOD_END',
        'CANCELLED',
        'PENDING',
        'FAILED',
        'AUTO_PAYMENT_CANCELLED'
      ],
      default: 'PENDING'
    },

    // ✅ Unified payment schema (Paystack + Monnify)
    payment: PaymentPlanSchema,

    start_date: { type: Date, default: Date.now },
    period_start: { type: Date, required: true },
    period_end: { type: Date, required: true },
    renewal_date: { type: Date, required: true },
    ended_at: { type: Date },
    renewal_count: { type: Number, default: 0 },

    usage: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubUsage' }],

    rollover_cap_pct: { type: Number, default: 25 },
    rollover_balance: { type: Number, default: 0 },
    pause_count_qtr: { type: Number, default: 0 },
    canceled_reason: { type: String },

    delivery_zone_status: {
      type: String,
      enum: ['INSIDE', 'OUTSIDE'],
      default: 'INSIDE'
    }
  },
  { timestamps: true }
)

export default mongoose.model('Subscription', subscriptionSchema)

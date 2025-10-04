import mongoose from 'mongoose'

const subUsageSchema = new mongoose.Schema(
  {
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true
    },
    period_label: { type: String, required: true }, // e.g. "2025-09"
    items_used: { type: Number, default: 0 },
    trips_used: { type: Number, default: 0 },
    overage_items: { type: Number, default: 0 },
    express_orders_used: { type: Number, default: 0 },
    sameDay_orders_used: { type: Number, default: 0 },
    computed_overage_fee_ngn: { type: Number, default: 0 },
    rollover_items: { type: Number, default: 0 },
    on_time_pct: { type: Number, default: 100 }

  },
  { timestamps: true }
)

export default mongoose.model('SubUsage', subUsageSchema)

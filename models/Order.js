import mongoose from 'mongoose'
import PaymentPlanSchema from './Payment.js'

const OrderItemSchema = new mongoose.Schema(
  {
    serviceCode: String,
    serviceName: String,
    quantity: Number,
    unit: String,
    itemNotes: String,
    addOns: [{ key: String, name: String, price: Number }],
    price: Number,
    express: { type: Boolean, default: false }, // per-item express
    sameDay: { type: Boolean, default: false } // per-item same-day
  },
  { _id: false }
)

export const Statuses = [
  'Pending Payment',
  'Booked',
  'Picked Up',
  'In Cleaning',
  'Ready',
  'Out For Delivery',
  'Delivered',
  'Cancelled'
]

const OrderSchema = new mongoose.Schema(
  {
    userPhone: { type: String, required: true },
    orderId: {
      type: String,
      required: false,
      unique: true,
      index: true
    },
    userEmail: { type: String, lowercase: true, trim: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    userName: String,
    items: [OrderItemSchema],
    notes: String,
    photos: [String],
    couponCode: String,
    express: { type: Boolean, default: false },
    sameDay: { type: Boolean, default: false },

    totals: {
      itemsTotal: Number,
      addOnsTotal: Number,
      deliveryFee: Number,
      discount: Number,
      grandTotal: Number
    },
    deliveryPin: {
      type: String,
      required: true
    },

    pickup: {
      date: Date,
      window: String,
      address: {
        label: String,
        line1: String,
        line2: String,
        city: String,
        lga: String,
        state: String,
        landmark: String,
        zone: String
      }
    },
    delivery: {
      date: Date,
      window: String,
      address: {
        label: String,
        line1: String,
        line2: String,
        city: String,
        lga: String,
        state: String,
        landmark: String,
        zone: String
      }
    },
    status: { type: String, enum: Statuses, default: 'Booked' },
    history: [
      { status: String, note: String, at: { type: Date, default: Date.now } }
    ],
    rating: { type: Number, min: 1, max: 5, default: null },
    reviewCount: { type: Number, default: 0 },
    pricingModel: {
      type: String,
      enum: ['RETAIL', 'SUBSCRIPTION'],
      required: true
    },
    serviceTier: {
      type: String,
      enum: ['STANDARD', 'PREMIUM', 'VIP'],
      required: true
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500
    },
    cancellationReason: { type: String },
    cancelledBy: { type: String, enum: ['user', 'admin'], default: null },
    cancelledAt: { type: Date },
    subscriptionPlanCode: { type: String }, // e.g. "PREM_CHOICE_24"
    slaHours: { type: Number },
    discount: { type: Number, default: 0 },

    expectedReadyAt: { type: Date },
    payment: PaymentPlanSchema
  },
  { timestamps: true }
)

export default mongoose.model('Order', OrderSchema)

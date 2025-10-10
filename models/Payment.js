// models/PaymentPlan.js
import mongoose from 'mongoose'

const PaymentPlanSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ['CARD', 'BANK_TRANSFER', 'WALLET', 'SUBSCRIPTION'],
      required: true
    },
    mode: {
      type: String,
      enum: ['FULL', 'INSTALLMENT'],
      default: 'FULL'
    },
    gateway: {
      type: String,
      enum: ['PAYSTACK', 'MONNIFY'],
      required: true
    },

    // ⚡ Common fields
    currency: { type: String, enum: ['NGN'], default: 'NGN' },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },

    transactionId: {
      type: String,
      default: null, // initially null, will be set when payment is initiated
      index: true // optional but helps with fast lookups in webhooks
    },

    // ⚙️ Gateway-specific identifiers
    // --- Paystack ---
    paystack: {
      reference: String, // transaction reference
      authorizationCode: String, // recurring charge code (if applicable)
      customerCode: String, // Paystack customer ID
      accessCode: String // optional (from init response)
    },

    // --- Monnify ---
    monnify: {
      transactionReference: String,
      authorizationRef: String, // mandate ref for recurring
      accountReference: String, // reserved account ref
      accountNumber: String,
      bankName: String,
      contractCode: String
    },

    // 🧾 Installments (shared)
    installments: [
      {
        dueDate: Date,
        amount: Number,
        status: {
          type: String,
          enum: ['PENDING', 'PAID', 'FAILED'],
          default: 'PENDING'
        }
      }
    ],
    checkoutUrl: String,

    // 🔁 Billing metadata
    nextBillingDate: { type: Date },
    lastBillingAttempt: { type: Date },
    failedAttempts: { type: Number, default: 0 }
  },
  { _id: false }
)

export default PaymentPlanSchema

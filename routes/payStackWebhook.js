import express from 'express'
import crypto from 'crypto'
import { DateTime } from 'luxon'
import Order from '../models/Order.js'
import Subscription from '../models/Subscription.js'
import SubUsage from '../models/SubUsage.js'
import { notifyOrderEvent } from '../services/notificationService.js'
import dotenv from 'dotenv'
import User from '../models/User.js'
dotenv.config()

const router = express.Router()

/**
 * ✅ Verify Paystack webhook signature
 */
function verifyPaystackSignature (req) {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY
    const signature = req.headers['x-paystack-signature']
    if (!signature || !secret) return false

    const computed = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(req.body))
      .digest('hex')

    return computed === signature
  } catch (err) {
    console.error('❌ Paystack signature verification error:', err)
    return false
  }
}

/**
 * ✅ Paystack Webhook
 * Handles:
 * - Successful one-time order payments
 * - Subscription activations or renewals
 */
router.post('/webhook/paystack', async (req, res) => {
  try {
    const event = req.body
    console.log('🔔 Paystack Webhook Received:', {
      event: event?.event,
      reference: event?.data?.reference
    })

    if (!verifyPaystackSignature(req)) {
      console.warn('⚠️ Invalid Paystack signature detected')
      return res.status(401).json({ message: 'Invalid signature' })
    }

    const data = event.data
    const successEvents = [
      'charge.success',
      'subscription.create',
      'invoice.create'
    ]
    const success = successEvents.includes(event.event)

    const reference = data.reference || data.subscription_code
    const amount = data.amount / 100 // Convert from kobo to NGN

    // === 🧠 Idempotency for Orders ===
    const existingOrder = await Order.findOne({
      'payment.transactionId': reference,
      'payment.status': 'PAID'
    })

    if (existingOrder) {
      console.log(
        '♻️ Duplicate Paystack webhook ignored for Order:',
        existingOrder._id
      )
      return res.status(200).json({ message: 'Order already processed' })
    }

    // === 1️⃣ Handle ORDER Payments ===
    const order = await Order.findOne({
      'payment.transactionId': reference
    }).populate('user')

    if (order) {
      console.log(`📦 Processing Paystack Order: ${order._id}`)

      order.payment.amountPaid = success ? amount : 0
      order.payment.balance = success ? 0 : order.payment.balance
      order.payment.status = success ? 'PAID' : 'FAILED'
      order.payment.paymentReference = reference
      order.status = success ? 'Booked' : 'Pending'
      order.history.push({
        status: order.status,
        note: success ? 'Payment successful' : 'Payment failed'
      })

      await order.save()

      const notifyTasks = [
        (async () => {
          try {
            await notifyOrderEvent({
              user: order.user,
              order,
              type: success ? 'orderDelivered' : 'payment_failed'
            })
          } catch (err) {
            console.warn('⚠️ User notification failed:', err.message)
          }
        })(),

        (async () => {
          try {
            const admins = await User.find({ role: 'admin' })
            await Promise.all(
              admins.map(admin =>
                notifyOrderEvent({
                  user: admin,
                  order,
                  type: success
                    ? 'orderCreatedForAdmin'
                    : 'payment_failed_forAdmin'
                })
              )
            )
          } catch (err) {
            console.warn('⚠️ Admin notifications failed:', err.message)
          }
        })()
      ]

      await Promise.all(notifyTasks)

      console.log(
        success
          ? `✅ Paystack order confirmed: ${order._id}`
          : `❌ Paystack order failed: ${order._id}`
      )

      return res.status(200).json({ message: 'Order webhook processed' })
    }

    // === 🧠 Idempotency for Subscriptions ===
    const existingSub = await Subscription.findOne({
      'payment.lastTransactionId': reference
    })
    if (existingSub) {
      console.log(
        '♻️ Duplicate Paystack webhook ignored for Subscription:',
        existingSub._id
      )
      return res.status(200).json({ message: 'Subscription already processed' })
    }

    // === 2️⃣ Handle Subscription Payments (Initial or Recurring) ===
    const subscription = await Subscription.findOne({
      $or: [
        { 'payment.transactionId': reference },
        { 'payment.subscriptionCode': data.subscription_code }
      ]
    }).populate('plan')

    if (subscription) {
      console.log(`💳 Processing Paystack Subscription: ${subscription._id}`)

      const now = DateTime.now().setZone('Africa/Lagos')

      if (success) {
        subscription.payment.lastTransactionId = reference
        subscription.payment.amountPaid += amount
        subscription.payment.balance = 0
        subscription.payment.failedAttempts = 0
        subscription.status = 'ACTIVE'

        const newPeriodStart = subscription.period_end
          ? DateTime.fromJSDate(subscription.period_end)
          : now

        subscription.period_start = newPeriodStart.toJSDate()
        subscription.period_end = newPeriodStart.plus({ months: 1 }).toJSDate()
        subscription.renewal_date = newPeriodStart
          .plus({ months: 1 })
          .toJSDate()
        subscription.start_date = subscription.start_date || now.toJSDate()
        subscription.renewal_count += 1

        await subscription.save()

        const periodLabel = now.toFormat('yyyy-LL')
        await SubUsage.findOneAndUpdate(
          { subscription: subscription._id, period_label: periodLabel },
          {
            $setOnInsert: {
              subscription: subscription._id,
              period_label: periodLabel,
              items_used: 0,
              trips_used: 0,
              overage_items: 0,
              express_orders_used: 0,
              computed_overage_fee_ngn: 0,
              on_time_pct: 100
            }
          },
          { upsert: true, new: true }
        )

        console.log(`✅ Subscription activated or renewed: ${subscription._id}`)
      } else {
        subscription.payment.failedAttempts += 1
        if (subscription.payment.failedAttempts >= 3) {
          subscription.status = 'PAUSED'
          console.warn(
            `⚠️ Subscription auto-paused after 3 failures: ${subscription._id}`
          )
        }
        await subscription.save()
        console.log(`❌ Subscription payment failed: ${subscription._id}`)
      }

      return res.status(200).json({ message: 'Subscription webhook processed' })
    }

    console.warn('⚠️ No matching record found for Paystack webhook:', reference)
    return res.status(404).json({ message: 'No matching record found' })
  } catch (err) {
    console.error('❌ Paystack Webhook Error:', err)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
})

export default router

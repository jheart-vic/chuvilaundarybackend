import Order from '../models/Order.js'
import Coupon from '../models/Coupon.js'
import { uploadToCloudinary } from '../middlewares/uploadMiddleware.js'
import { Statuses } from '../models/Order.js'
import { notifyOrderEvent } from '../services/notificationService.js'
import { computeOrderTotals } from '../utils/orderTotals.js'
import { computeExpectedReadyAt } from '../utils/slaHours.js'
import User from '../models/User.js'
import mongoose from 'mongoose'
// import Subscription from "../models/Subscription.js";
import SubscriptionPlan from '../models/SubscriptionPlan.js'
import SubUsage from '../models/SubUsage.js'
import { DateTime } from 'luxon'
import { initMonnifyPayment } from '../utils/monnify.js'
import { initPaystackPayment } from '../utils/paystack.js'
import { generateReceipt } from'../utils/generateReceipt.js'

const generateDeliveryPin = () =>
  Math.floor(1000 + Math.random() * 9000).toString()

// ✅ Utility: Generate Custom Order ID
function generateOrderId (docId) {
  const randomPart = docId.toString().slice(-6).toUpperCase() // last 6 chars of ObjectID
  return `CHUVI-ORD-${randomPart}`
}

/**
 * Create order (supports retail and subscription)
 */

export const createOrder = async (req, res, next) => {
  const MAX_RETRIES = 3
  let attempt = 0

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const payload = req.body

      // 🧩 1. Fetch logged-in user
      const user = await User.findById(req.user._id)
        .populate('currentSubscription')
        .session(session)
      if (!user) return res.status(404).json({ message: 'User not found' })

      const userPhone = user.phone
      if (!userPhone)
        return res.status(400).json({ message: 'User phone required' })
      if (!user.email)
        return res
          .status(400)
          .json({ message: 'User email required for payment' })

      // 🧾 2. Basic payload validations
      if (!payload.items?.length)
        return res.status(400).json({ message: 'At least one item required' })
      if (!payload.pickup?.address)
        return res.status(400).json({ message: 'Pickup address required' })
      if (!payload.delivery?.address)
        return res.status(400).json({ message: 'Delivery address required' })

      // 🎯 Generate delivery pin and orderId
      const deliveryPin = generateDeliveryPin()
      const tempId = new mongoose.Types.ObjectId()
      const orderId = generateOrderId(tempId)

      // 🖼️ 3. Handle photo uploads (parallel, fail silently)
      let photos = []
      if (req.files?.length) {
        photos = await Promise.all(
          req.files.map(async f => {
            try {
              const result = await uploadToCloudinary(
                f.buffer,
                'laundry/photos'
              )
              return result.secure_url
            } catch (err) {
              console.warn('Photo upload failed:', err.message)
              return null // ignore failed uploads
            }
          })
        ).then(results => results.filter(Boolean)) // remove nulls
      }

      // 🧾 4. Handle coupons
      const couponCode = payload.couponCode?.trim().toUpperCase() || null

      // 📦 5. Subscription check
      const subscription = user.currentSubscription
      let plan = null
      let usage = null

      if (subscription?.status === 'ACTIVE') {
        plan = await SubscriptionPlan.findOne({
          code: subscription.plan_code,
          active: true
        }).session(session)

        if (plan) {
          const periodLabel = DateTime.now().toFormat('yyyy-LL')
          usage = await SubUsage.findOneAndUpdate(
            { subscription: subscription._id, period_label: periodLabel },
            {},
            { new: true, upsert: true, session }
          )
        }
      }

      // ⚖️ 6. Determine pricing model and tier
      const isSubscription = payload.pricingModel === 'SUBSCRIPTION' || !!plan
      const pricingModel = isSubscription ? 'SUBSCRIPTION' : 'RETAIL'

      let serviceTier = 'STANDARD'
      let tierOverrideMessage = null
      if (isSubscription) {
        if (
          payload.serviceTier &&
          payload.serviceTier.toUpperCase() !== plan?.tier
        ) {
          tierOverrideMessage = `Service tier overridden to ${plan?.tier}`
        }
        serviceTier = plan?.tier || 'STANDARD'
      } else {
        serviceTier = payload.serviceTier?.toUpperCase() || 'STANDARD'
      }

      // 💰 7. Compute totals
      const totals = await computeOrderTotals(
        {
          ...payload,
          couponCode,
          pricingModel,
          subscriptionPlanCode: plan?.code,
          userPhone,
          serviceTier
        },
        { plan, usage }
      )

      // ⏰ 8. Compute SLA & ready time
      const hasExpress = payload.items.some(i => i.express)
      const hasSameDay = Boolean(payload.sameDay)

      if (hasSameDay) {
        const totalItems = payload.items.reduce(
          (s, i) => s + (i.quantity || 1),
          0
        )
        if (totalItems > 15) {
          return res
            .status(400)
            .json({ message: 'Same-day orders limited to 15 items max' })
        }
      }
      // 🧾 // 🧾 Check if it's user's first order (for discount)
      let firstOrderDiscount = 0

      if (!user.hasUsedFirstOrderDiscount && pricingModel === 'RETAIL') {
        firstOrderDiscount = 500
        totals.grandTotal = Math.max(totals.grandTotal - firstOrderDiscount, 0)
        totals.discount = (totals.discount || 0) + firstOrderDiscount
      }

      const expectedReadyAt = computeExpectedReadyAt(
        new Date(payload.pickup.date),
        serviceTier,
        { express: hasExpress, sameDay: hasSameDay }
      )
      const slaHours = Math.round(
        (expectedReadyAt - new Date(payload.pickup.date)) / (1000 * 60 * 60)
      )
      // 💳 9. Payment setup
      const paymentInput = payload.payment || {}
      if (!paymentInput.method)
        return res.status(400).json({ message: 'Payment method required' })
      if (!paymentInput.gateway)
        return res.status(400).json({ message: 'Payment gateway required' })

      let paymentData = {
        method: paymentInput.method,
        mode: paymentInput.mode || 'FULL',
        amountPaid: 0,
        balance: totals.grandTotal,
        installments: [],
        transactionId: null,
        checkoutUrl: null,
        gateway: paymentInput.gateway,
        failedAttempts: 0
      }

      let paymentInitResponse = null

      // Always initialize payment if CARD or BANK_TRANSFER
      if (['CARD', 'BANK_TRANSFER'].includes(paymentInput.method)) {
        if (paymentInput.gateway === 'PAYSTACK') {
          paymentInitResponse = await initPaystackPayment({
            amount: totals.grandTotal,
            email: user.email,
            name: payload.userName || user.fullName || 'Customer',
            phone: user.phone,
            orderId
          })

          paymentData.transactionId = paymentInitResponse.reference
          paymentData.checkoutUrl = paymentInitResponse.authorization_url
        } else {
          paymentInitResponse = await initMonnifyPayment({
            amount: totals.grandTotal,
            customerName: payload.userName || user.fullName || 'Customer',
            customerEmail: user.email,
            customerPhone: user.phone,
            orderId,
            paymentMethod:
              paymentInput.method === 'CARD' ? 'CARD' : 'ACCOUNT_TRANSFER'
          })

          paymentData.transactionId =
            paymentInitResponse.reference ||
            paymentInitResponse.transactionReference
          paymentData.checkoutUrl =
            paymentInitResponse.checkoutUrl ||
            paymentInitResponse.authorization_url
        }
      }

      // 💰 Installment validation
      if (paymentInput.mode === 'INSTALLMENT' && paymentInput.installments) {
        paymentData.installments = paymentInput.installments.map(i => ({
          dueDate: i.dueDate,
          amount: i.amount,
          status: 'PENDING'
        }))

        const totalInstallments = paymentData.installments.reduce(
          (s, i) => s + i.amount,
          0
        )
        if (totalInstallments !== totals.grandTotal) {
          return res
            .status(400)
            .json({ message: 'Installment amounts must equal grand total' })
        }
      }

      // 🧾 10. Create the order (inside transaction)
      const order = await Order.create(
        [
          {
            _id: tempId,
            user: user._id,
            userPhone,
            userName: payload.userName || user.fullName,
            items: payload.items,
            notes: payload.notes,
            photos,
            couponCode,
            totals,
            discount: firstOrderDiscount,
            pickup: payload.pickup,
            delivery: payload.delivery,
            status: 'Pending Payment',
            history: [
              {
                status: 'Pending Payment',
                note: 'Order created and awaiting payment'
              }
            ],
            subscriptionPlanCode: plan?.code || null,
            pricingModel,
            serviceTier,
            slaHours,
            expectedReadyAt,
            express: hasExpress,
            sameDay: hasSameDay,
            orderId,
            payment: paymentData,
            deliveryPin
          }
        ],
        { session }
      )

      const orderDoc = order[0]

      // 🎟️ 11. Handle coupon increment
      if (couponCode) {
        const coupon = await Coupon.findOne({ code: couponCode }).session(
          session
        )
        if (coupon) {
          coupon.uses += 1
          coupon.redemptions.push({
            userPhone,
            orderId: orderDoc._id,
            redeemedAt: DateTime.now().setZone('Africa/Lagos').toJSDate()
          })
          await coupon.save({ session })
        }
      }

      // 🔁 12. Update subscription usage (if applicable)
      if (usage) {
        usage.items_used =
          (usage.items_used || 0) +
          payload.items.reduce((s, i) => s + (i.quantity || 1), 0)
        await usage.save({ session })
      }
      console.log('💳 Paystack init reference:', paymentInitResponse.reference)
      console.log(
        '💳 Monnify init reference:',
        paymentInitResponse.transactionReference
      )
      // 🔔 13. Notifications (fail silently, non-blocking)
      const notifyTasks = [
        // User: order created
        (async () => {
          try {
            await notifyOrderEvent({
              user,
              order: orderDoc,
              type: 'orderCreated'
            })
          } catch (err) {
            console.warn('User orderCreated notification failed:', err.message)
          }
        })(),

        // User: delivery PIN
        (async () => {
          try {
            await notifyOrderEvent({
              user,
              order: orderDoc,
              type: 'deliveryPin',
              extra: { pin: deliveryPin }
            })
          } catch (err) {
            console.warn('User deliveryPin notification failed:', err.message)
          }
        })(),

        // Admins: order created
        (async () => {
          try {
            const admins = await User.find({ role: 'admin' })
            await Promise.all(
              admins.map(admin =>
                notifyOrderEvent({
                  user: admin,
                  order: orderDoc,
                  type: 'orderCreatedForAdmin',
                  extra: { pin: deliveryPin } // optional, you can include PIN for admins too
                })
              )
            )
          } catch (err) {
            console.warn('Admin notification failed:', err.message)
          }
        })()
      ]

      await Promise.all(notifyTasks)
      // 🧾 Mark first-order discount as used (if applied)
      if (firstOrderDiscount > 0 && !user.hasUsedFirstOrderDiscount) {
        user.hasUsedFirstOrderDiscount = true
        await user.save({ session })
      }

      // ✅ 14. Commit transaction
      await session.commitTransaction()
      session.endSession()

      // ✅ Response
      return res.status(201).json({
        order: orderDoc,
        paymentInitResponse,
        ...(tierOverrideMessage && { message: tierOverrideMessage })
      })
    } catch (err) {
      await session.abortTransaction()
      session.endSession()

      if (
        err.hasErrorLabel &&
        err.hasErrorLabel('TransientTransactionError') &&
        attempt < MAX_RETRIES - 1
      ) {
        attempt++
        console.warn(
          `TransientTransactionError, retrying attempt ${attempt + 1}...`
        )
        continue
      }

      console.error('Create order failed:', err)
      return next(err)
    }
  }
}

export const getOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: req.params.id }) // 👈 switched to orderId
    if (!order) return res.status(404).json({ message: 'order not found' })

    let orderData = order.toObject()

    // 🚫 Hide deliveryPin for normal users
    if (req.user?.role === 'user') {
      delete orderData.deliveryPin
    }

    res.json(orderData)
  } catch (err) {
    next(err)
  }
}

export const listUserOrders = async (req, res, next) => {
  try {
    const { phone } = req.params
    if (!phone) {
      return res.status(400).json({ message: 'phone required' })
    }

    // Fetch all orders for that phone
    const orders = await Order.find({ userPhone: phone }).sort({
      createdAt: -1
    })

    let ordersData = orders.map(o => {
      let orderObj = o.toObject()

      // 🚫 Hide deliveryPin if requester is a normal user
      if (req.user?.role === 'user') {
        delete orderObj.deliveryPin
      }

      return orderObj
    })

    res.json(ordersData)
  } catch (err) {
    next(err)
  }
}

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body
    if (!Statuses.includes(status)) {
      return res.status(400).json({ message: 'invalid status' })
    }

    const order = await Order.findOne({ orderId: req.params.id }).populate(
      'user'
    )
    if (!order) return res.status(404).json({ message: 'order not found' })

    order.status = status
    order.history.push({ status, note })
    await order.save()

    // 🔔 Notify user with mapped template
    await notifyOrderEvent({
      user: order.user,
      order,
      type: 'statusUpdate'
    })

    res.json(order)
  } catch (err) {
    next(err)
  }
}

export const cancelOrderUser = async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).populate('user')
    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    // Ensure user owns the order
    if (order.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only cancel your own orders' })
    }

    // Prevent cancelling twice or delivered
    if (order.status === 'Cancelled') {
      return res.status(400).json({ message: 'Order already cancelled' })
    }
    if (order.status === 'Delivered') {
      return res.status(400).json({ message: 'Delivered orders cannot be cancelled' })
    }

    // ✅ Safe extraction of reason
    const { reason } =  req.body

    order.status = 'Cancelled'
    order.cancellationReason = reason
    order.history.push({
      status: 'Cancelled',
      note: reason
    })

    await order.save()

    await notifyOrderEvent({
      user: order.user,
      order,
      type: 'cancelled_user'
    })

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order
    })
  } catch (err) {
    next(err)
  }
}

export const trackOrderPublic = async (req, res, next) => {
  try {
    const { orderId } = req.params

    const order = await Order.findOne({ orderId })
    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    // 🧼 Extract fields
    const {
      orderId: id,
      status,
      serviceTier,
      totals,
      createdAt,
      updatedAt
    } = order

    // 🧠 Format totals to make them clear for frontend display
    const totalSummary = {
      subtotal: totals?.subtotal ?? 0,
      deliveryFee: totals?.delivery ?? 0,
      discount: totals?.discount ?? 0,
      total: totals?.grandTotal ?? 0
    }

    // ✨ Clean, sorted response object
    res.json({
      orderId: id,
      status,
      tier: serviceTier, // 👈 renamed for shorter label on frontend
      totals: totalSummary,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString()
    })
  } catch (err) {
    next(err)
  }
}

export async function getOrderReceipt (req, res) {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).populate(
      'user'
    )

    if (!order) return res.status(404).json({ message: 'Order not found' })

    if (order.user._id.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Unauthorized' })

    const receiptPath = await generateReceipt(order)
    res.sendFile(path.resolve(receiptPath))
  } catch (err) {
    console.error('Receipt generation error:', err)
    res.status(500).json({ message: 'Failed to generate receipt' })
  }
}

export const previewOrder = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      'currentSubscription'
    )
    if (!user) return res.status(404).json({ message: 'User not found' })

    const payload = req.body
    const subscription = user.currentSubscription

    let plan = null
    let usage = null

    // 🧭 1️⃣ Load subscription info if active
    if (subscription?.status === 'ACTIVE') {
      plan = await SubscriptionPlan.findOne({
        code: subscription.plan_code,
        active: true
      })

      if (plan) {
        const periodLabel = new Date().toISOString().slice(0, 7)
        usage = await SubUsage.findOne({
          subscription: subscription._id,
          period_label: periodLabel
        })
      }
    }

    // 🧮 2️⃣ Determine pricing model
    const pricingModel = plan ? 'SUBSCRIPTION' : 'RETAIL'

    // 🧾 3️⃣ Compute normal totals
    const totals = await computeOrderTotals(
      {
        ...payload,
        pricingModel,
        userPhone: user.phone
      },
      { plan, usage }
    )

    // 💰 4️⃣ Check if this is the user's first order
    const previousOrders = await Order.countDocuments({
      user: user._id,
      status: { $ne: 'Cancelled' }
    })

    const isFirstOrder = previousOrders === 0 && !user.hasUsedFirstOrderDiscount

    // 🧮 5️⃣ Apply ₦500 flat first-order discount
    if (isFirstOrder && pricingModel === 'RETAIL') {
      const firstOrderDiscount = 500
      totals.firstOrderDiscount = firstOrderDiscount
      totals.grandTotal = Math.max(totals.grandTotal - firstOrderDiscount, 0)
    }

    // ✅ 6️⃣ Respond
    res.json({
      success: true,
      totals,
      meta: {
        pricingModel,
        isFirstOrder
      }
    })
  } catch (err) {
    console.error('Preview failed:', err)
    res.status(500).json({ message: 'Failed to preview order' })
  }
}

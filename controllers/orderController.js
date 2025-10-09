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
  try {
    const payload = req.body
    const userPhone = req.user?.phone || payload.userPhone
    if (!userPhone)
      return res.status(400).json({ message: 'userPhone required' })
    if (!payload.items?.length)
      return res.status(400).json({ message: 'At least one item required' })
    if (!payload.pickup?.address)
      return res.status(400).json({ message: 'Pickup address required' })
    if (!payload.delivery?.address)
      return res.status(400).json({ message: 'Delivery address required' })

    const deliveryPin = generateDeliveryPin()
    // ✅ Generate ObjectId before saving
    const tempId = new mongoose.Types.ObjectId()
    const orderId = generateOrderId(tempId)

    // --- Photos upload
    const photos = []
    if (req.files?.length) {
      for (const f of req.files) {
        const result = await uploadToCloudinary(f.buffer, 'laundry/photos')
        photos.push(result.secure_url)
      }
    }

    // --- Coupon normalization
    const couponCode = payload.couponCode?.trim().toUpperCase() || null

    // --- Subscription check
    let plan = null
    let usage = null
    const user = await User.findOne({ phone: userPhone }).populate(
      'currentSubscription'
    )
    const subscription = user?.currentSubscription

    if (subscription?.status === 'ACTIVE') {
      plan = await SubscriptionPlan.findOne({
        code: subscription.plan_code,
        active: true
      })
      if (plan) {
        const periodLabel = DateTime.now().toFormat('yyyy-LL')
        usage = await SubUsage.findOneAndUpdate(
          { subscription: subscription._id, period_label: periodLabel },
          {},
          { new: true, upsert: true }
        )
      }
    }

    // --- Pricing model selection
    let pricingModel
    if (payload.pricingModel === 'SUBSCRIPTION') {
      if (!plan)
        return res
          .status(400)
          .json({ message: 'Active subscription not found' })
      pricingModel = 'SUBSCRIPTION'
    } else if (plan) {
      pricingModel = 'SUBSCRIPTION'
    } else {
      pricingModel = 'RETAIL'
    }

    // --- Service tier
    let serviceTier
    let tierOverrideMessage = null
    if (pricingModel === 'SUBSCRIPTION') {
      if (
        payload.serviceTier &&
        payload.serviceTier.toUpperCase() !== plan?.tier
      ) {
        tierOverrideMessage = `serviceTier overridden to ${plan?.tier}`
      }
      serviceTier = plan?.tier || 'STANDARD'
    } else {
      serviceTier = payload.serviceTier?.toUpperCase() || 'STANDARD'
    }

    // --- Totals (includes subscription overages if any)
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

    // --- SLA / Ready time
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
    const expectedReadyAt = computeExpectedReadyAt(
      new Date(payload.pickup.date),
      serviceTier,
      { express: hasExpress, sameDay: hasSameDay }
    )
    const slaHours = Math.round(
      (expectedReadyAt - new Date(payload.pickup.date)) / (1000 * 60 * 60)
    )

    // --- Payment info
    const paymentInput = payload.payment || {}
    if (!paymentInput.method)
      return res.status(400).json({ message: 'Payment method required' })

    let paymentData = {
      method: paymentInput.method,
      mode: paymentInput.mode || 'FULL',
      amountPaid: 0,
      balance: totals.grandTotal,
      installments: []
    }

    let paymentInitResponse = null

    if (
      ['CARD', 'BANK_TRANSFER'].includes(paymentInput.method) &&
      (pricingModel === 'RETAIL' ||
        (pricingModel === 'SUBSCRIPTION' && totals.grandTotal > 0))
    ) {
      if (paymentInput.gateway === 'PAYSTACK') {
        paymentInitResponse = await initPaystackPayment({
          amount: totals.grandTotal,
          email: user?.email,
          name: payload.userName || 'Customer',
          phone: userPhone,
          orderId
        })
      } else {
        paymentInitResponse = await initMonnifyPayment({
          amount: totals.grandTotal,
          customerName: payload.userName || 'Customer',
          customerEmail: user?.email || 'noemail@example.com',
          customerPhone: userPhone,
          orderId,
          paymentMethod:
            paymentInput.method === 'CARD' ? 'CARD' : 'ACCOUNT_TRANSFER'
        })
      }

      paymentData = {
        ...paymentData,
        gateway: paymentInput.gateway || 'MONNIFY',
        transactionId:
          paymentInitResponse?.reference ||
          paymentInitResponse?.transactionReference,
        checkoutUrl:
          paymentInitResponse?.checkoutUrl ||
          paymentInitResponse?.authorization_url
      }
    }
    // --- Installments validation
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

    // --- Create order
    const order = await Order.create({
      _id: tempId,
      userPhone,
      userName: payload.userName,
      items: payload.items,
      notes: payload.notes,
      photos,
      couponCode,
      totals,
      pickup: payload.pickup,
      delivery: payload.delivery,
      status: 'Booked',
      history: [{ status: 'Booked', note: 'Order created' }],
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
    })

    // --- Coupon usage increment
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode })
      if (coupon) {
        coupon.uses += 1
        coupon.redemptions.push({
          userPhone,
          orderId: order._id,
          redeemedAt: DateTime.now().setZone('Africa/Lagos').toJSDate()
        })
        await coupon.save()
      }
    }

    // --- Notifications
    await notifyOrderEvent({
      user: req.user,
      order,
      type: 'orderCreated',
      meta: { deliveryPin }
    })
    const admins = await User.find({ role: 'admin' })
    for (const admin of admins) {
      await notifyOrderEvent({
        user: admin,
        order,
        type: 'orderCreatedForAdmin',
        meta: { deliveryPin }
      })
    }

    res.status(201).json({
      order,
      paymentInitResponse, // Monnify link/account if needed
      ...(tierOverrideMessage && { message: tierOverrideMessage })
    })
  } catch (err) {
    console.error('Create order failed:', err)
    next(err)
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
    const order = await Order.findOne({ orderId: req.params.id }).populate(
      'user'
    ) // 👈 switched
    if (!order) return res.status(404).json({ message: 'order not found' })

    if (order.user._id.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: 'You can only cancel your own orders' })
    }

    order.status = 'Cancelled'
    order.history.push({
      status: 'Cancelled',
      note: req.body.note || 'Cancelled by user'
    })

    await order.save()

    await notifyOrderEvent({
      user: order.user,
      order,
      type: 'cancelled_user'
    })

    res.json(order)
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

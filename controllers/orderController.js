import Order from '../models/Order.js'
import Coupon from '../models/Coupon.js'
import { uploadToCloudinary } from '../middlewares/uploadMiddleware.js'
import { Statuses } from '../models/Order.js'
import { notifyOrderEvent } from '../services/notificationService.js'
import { computeOrderTotals } from '../utils/orderTotals.js'
import { computeExpectedReadyAt } from '../utils/slaHours.js'
import User from '../models/User.js'
// import Subscription from "../models/Subscription.js";
import SubscriptionPlan from '../models/SubscriptionPlan.js'
import SubUsage from '../models/SubUsage.js'
import { DateTime } from 'luxon'

const generateDeliveryPin = () =>
  Math.floor(1000 + Math.random() * 9000).toString()

/**
 * Create order (supports retail and subscription)
 */
// export const createOrder = async (req, res, next) => {
//   console.log("Raw req.body:", req.body);

//   try {
//     const payload = req.body;
//     const userPhone = req.user?.phone || payload.userPhone;

//     // ✅ Basic validation
//     if (!userPhone)
//       return res.status(400).json({ message: "userPhone required" });
//     if (!payload.items?.length)
//       return res.status(400).json({ message: "At least one item is required" });
//     if (!payload.pickup?.address)
//       return res.status(400).json({ message: "Pickup address is required" });
//     if (!payload.delivery?.address)
//       return res.status(400).json({ message: "Delivery address is required" });

//     // 1️⃣ Upload photos
//     const photos = [];
//     if (req.files?.length) {
//       for (const f of req.files) {
//         const result = await uploadToCloudinary(f.buffer, "laundry/photos");
//         photos.push(result.secure_url);
//       }
//     }

//     // 2️⃣ Normalize coupon code
//     const couponCode = payload.couponCode?.trim().toUpperCase() || null;

//     // 3️⃣ Check user subscription
//     let plan = null;
//     let usage = null;
//     const user = await User.findOne({ phone: userPhone }).populate(
//       "currentSubscription"
//     );
//     const subscription = user?.currentSubscription;

//     if (subscription?.status === "ACTIVE") {
//       plan = await SubscriptionPlan.findOne({
//         code: subscription.plan_code,
//         active: true,
//       });
//       if (plan) {
//         const periodLabel = DateTime.now().toFormat("yyyy-LL");
//         usage = await SubUsage.findOneAndUpdate(
//           { subscription: subscription._id, period_label: periodLabel },
//           {},
//           { new: true, upsert: true }
//         );
//       } else {
//         console.warn(
//           "Active subscription exists but plan not found or inactive"
//         );
//       }
//     }

//     // 4️⃣ Determine pricing model
//     let pricingModel;
//     if (payload.pricingModel === "SUBSCRIPTION") {
//       if (!plan)
//         return res
//           .status(400)
//           .json({ message: "Active subscription plan not found" });
//       pricingModel = "SUBSCRIPTION";
//     } else if (plan) {
//       // Auto-detect subscription if user has active plan
//       pricingModel = "SUBSCRIPTION";
//     } else {
//       pricingModel = "RETAIL";
//     }

//     // 5️⃣ Resolve service tier
//     let serviceTier;
//     let tierOverrideMessage = null;

//     if (pricingModel === "SUBSCRIPTION") {
//       if (
//         payload.serviceTier &&
//         payload.serviceTier.toUpperCase() !== plan?.tier
//       ) {
//         console.warn(
//           `User tried to set serviceTier "${payload.serviceTier}" for subscription order, but plan tier "${plan?.tier}" is used instead.`
//         );
//         tierOverrideMessage = `serviceTier overridden to ${plan?.tier}`;
//       }
//       serviceTier = plan?.tier || "STANDARD";
//     } else {
//       serviceTier = payload.serviceTier?.toUpperCase() || "STANDARD";
//     }

//     // 6️⃣ Compute totals (mutates items to add .price)
//     const totals = await computeOrderTotals(
//       {
//         ...payload,
//         couponCode,
//         pricingModel,
//         subscriptionPlanCode: plan?.code,
//         userPhone,
//         serviceTier,
//       },
//       { plan, usage }
//     );

//     // 7️⃣ SLA calculation
//     const hasExpress = payload.items.some((i) => i.express);
//     const hasSameDay = Boolean(payload.sameDay);

//     // ✅ Enforce same-day item limit
//     if (hasSameDay) {
//       const totalItems = payload.items.reduce(
//         (sum, i) => sum + (i.quantity || 1),
//         0
//       );
//       if (totalItems > 15) {
//         return res.status(400).json({
//           message: "Same-day orders are limited to 15 items maximum.",
//         });
//       }
//     }

//     const expectedReadyAt = computeExpectedReadyAt(
//       new Date(payload.pickup.date),
//       serviceTier,
//       { express: hasExpress, sameDay: hasSameDay }
//     );

//     const slaHours = Math.round(
//       (expectedReadyAt - new Date(payload.pickup.date)) / (1000 * 60 * 60)
//     );

//     // 8️⃣ Create order
//     const order = await Order.create({
//       userPhone,
//       userName: payload.userName,
//       items: payload.items,
//       notes: payload.notes,
//       photos,
//       couponCode,
//       totals,
//       pickup: payload.pickup,
//       delivery: {
//         date: payload.delivery.date,
//         window: payload.delivery.window,
//         address: payload.delivery.address,
//       },
//       status: "Booked",
//       history: [{ status: "Booked", note: "Order created" }],
//       subscriptionPlanCode: plan?.code || null,
//       pricingModel,
//       serviceTier,
//       slaHours,
//       expectedReadyAt,
//       sameDay: hasSameDay,
//     });

//     // 9️⃣ Track coupon usage
//     if (couponCode) {
//       const coupon = await Coupon.findOne({ code: couponCode });
//       if (coupon) {
//         coupon.uses += 1;
//         coupon.redemptions.push({
//           userPhone,
//           orderId: order._id,
//           redeemedAt: DateTime.now().setZone("Africa/Lagos").toJSDate(),
//         });
//         await coupon.save();
//       }
//     }

//     // 🔟 Notify user
//     await notifyOrderEvent({ user: req.user, order, type: "created" });

//     res.status(201).json({
//       order,
//       ...(tierOverrideMessage && { message: tierOverrideMessage }),
//     });
//   } catch (err) {
//     console.error("Create order failed:", err);
//     next(err);
//   }
// };

export const createOrder = async (req, res, next) => {
  console.log('Raw req.body:', req.body)

  try {
    const payload = req.body
    const userPhone = req.user?.phone || payload.userPhone

    const deliveryPin = generateDeliveryPin()
    // ✅ Basic validation
    if (!userPhone)
      return res.status(400).json({ message: 'userPhone required' })
    if (!payload.items?.length)
      return res.status(400).json({ message: 'At least one item is required' })
    if (!payload.pickup?.address)
      return res.status(400).json({ message: 'Pickup address is required' })
    if (!payload.delivery?.address)
      return res.status(400).json({ message: 'Delivery address is required' })

    // 1️⃣ Upload photos
    const photos = []
    if (req.files?.length) {
      for (const f of req.files) {
        const result = await uploadToCloudinary(f.buffer, 'laundry/photos')
        photos.push(result.secure_url)
      }
    }

    // 2️⃣ Normalize coupon code
    const couponCode = payload.couponCode?.trim().toUpperCase() || null

    // 3️⃣ Check user subscription
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

    // 4️⃣ Determine pricing model
    let pricingModel
    if (payload.pricingModel === 'SUBSCRIPTION') {
      if (!plan)
        return res
          .status(400)
          .json({ message: 'Active subscription plan not found' })
      pricingModel = 'SUBSCRIPTION'
    } else if (plan) {
      pricingModel = 'SUBSCRIPTION' // auto detect
    } else {
      pricingModel = 'RETAIL'
    }

    // 5️⃣ Resolve service tier
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

    // 6️⃣ Compute totals
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

    // 7️⃣ SLA calculation
    const hasExpress = payload.items.some(i => i.express)
    const hasSameDay = Boolean(payload.sameDay)
    if (hasSameDay) {
      const totalItems = payload.items.reduce(
        (sum, i) => sum + (i.quantity || 1),
        0
      )
      if (totalItems > 15) {
        return res.status(400).json({
          message: 'Same-day orders are limited to 15 items maximum.'
        })
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

    // 8️⃣ Prepare payment info
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

    // Init Monnify for CARD / BANK_TRANSFER
    let paymentInitResponse = null
    if (['CARD', 'BANK_TRANSFER'].includes(paymentInput.method)) {
      paymentInitResponse = await initMonnifyPayment({
        amount: totals.grandTotal,
        customerName: payload.userName || 'Customer',
        customerEmail: user?.email || 'noemail@example.com',
        customerPhone: userPhone,
        orderId: `ORD-${Date.now()}`,
        paymentMethod:
          paymentInput.method === 'CARD' ? 'CARD' : 'ACCOUNT_TRANSFER'
      })
      paymentData.transactionId = paymentInitResponse?.transactionReference
    }

    // If installments mode, prefill schedule
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
        return res.status(400).json({
          message: 'Installment amounts must equal grand total'
        })
      }
    }

    // 9️⃣ Create order
    const order = await Order.create({
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
      sameDay: hasSameDay,
      payment: paymentData,
      deliveryPin
    })

    // 🔟 Track coupon usage
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

    // 1️⃣1️⃣ Notify user
    await notifyOrderEvent({
      user: req.user,
      order,
      type: 'orderCreated',
      meta: { deliveryPin }
    })
    // Notify admin(s) only
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
      paymentInitResponse, // URL / account details for payment
      ...(tierOverrideMessage && { message: tierOverrideMessage })
    })
  } catch (err) {
    console.error('Create order failed:', err)
    next(err)
  }
}

export const getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
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
    if (!Statuses.includes(status))
      return res.status(400).json({ message: 'invalid status' })

    const order = await Order.findById(req.params.id).populate('user')
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
    const order = await Order.findById(req.params.id).populate('user')
    if (!order) return res.status(404).json({ message: 'order not found' })

    // Ensure user owns this order
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

    // 🔔 Notify
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

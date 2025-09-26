import Order from '../models/Order.js'
import Coupon from '../models/Coupon.js'
import { uploadToCloudinary } from '../middlewares/uploadMiddleware.js'
import { Statuses } from '../models/Order.js'
import { notifyOrderEvent } from '../services/notificationService.js'
import { computeOrderTotals } from '../utils/orderTotals.js'
import { computeExpectedReadyAt } from '../utils/slaHours.js'
import User from '../models/User.js'
import Subscription from '../models/Subscription.js'
import SubscriptionPlan from '../models/SubscriptionPlan.js'
import SubUsage from '../models/SubUsage.js'
import { DateTime } from 'luxon'

/**
 * Create order (req.files uploaded to Cloudinary)
 */

export const createOrder = async (req, res, next) => {
console.log("Raw req.body:", req.body);

  try {
    const payload = req.body;
    const userPhone = req.user?.phone || payload.userPhone;
    if (!userPhone)
      return res.status(400).json({ message: "userPhone required" });
    if (!payload.items?.length)
      return res.status(400).json({ message: "At least one item is required" });
    if (!payload.pickup?.address)
      return res.status(400).json({ message: "Pickup address is required" });
    if (!payload.delivery?.address)
      return res.status(400).json({ message: "Delivery address is required" });

    // 1️⃣ Upload photos
    const photos = [];
    if (req.files?.length) {
      for (const f of req.files) {
        const result = await uploadToCloudinary(f.buffer, "laundry/photos");
        photos.push(result.secure_url);
      }
    }

    // 2️⃣ Coupon normalization
    const couponCode = payload.couponCode?.trim().toUpperCase() || null;

    // 3️⃣ Subscription lookup (if any)
    let plan = null;
    let usage = null;
    const user = await User.findOne({ phone: userPhone }).populate(
      "currentSubscription"
    );

    if (user?.currentSubscription) {
      const subscription = await Subscription.findById(
        user.currentSubscription._id
      );
      if (subscription?.status === "ACTIVE") {
        plan = await SubscriptionPlan.findOne({
          code: subscription.plan_code,
          active: true,
        });

        const periodLabel = DateTime.now().toFormat("yyyy-LL");
        usage = await SubUsage.findOneAndUpdate(
          { subscription: subscription._id, period_label: periodLabel },
          {},
          { new: true, upsert: true }
        );
      }
    }

    // 🚨 Strict check: if client requests SUBSCRIPTION but user has none
    if (payload.pricingModel === "SUBSCRIPTION" && !plan) {
      return res
        .status(400)
        .json({ message: "User has no active subscription" });
    }
console.log("Incoming serviceTier:", payload.serviceTier);

    // 4️⃣ Determine pricing model
    const pricingModel =
      payload.pricingModel || (plan ? "SUBSCRIPTION" : "RETAIL");

    // 5️⃣ Resolve serviceTier
    const serviceTier =
      pricingModel === "SUBSCRIPTION"
        ? plan?.serviceTier || "STANDARD"
        : payload.serviceTier?.toUpperCase() || "STANDARD";

    console.log("Resolved serviceTier:", serviceTier);

    // 6️⃣ Compute totals (mutates items to add .price)
    const totals = await computeOrderTotals(
      {
        ...payload,
        couponCode,
        pricingModel,
        subscriptionPlanCode: plan?.code,
        userPhone,
        serviceTier, // ✅ resolved value always wins
      },
      { plan, usage }
    );

    // 7️⃣ SLA calculation (always use util)
    const hasExpress = payload.items.some((i) => i.express);

    const expectedReadyAt = computeExpectedReadyAt(
      new Date(payload.pickup.date),
      serviceTier, // ✅ always use resolved serviceTier
      { express: hasExpress }
    );

    const slaHours = Math.round(
      (expectedReadyAt - new Date(payload.pickup.date)) / (1000 * 60 * 60)
    );

    // 8️⃣ Create order
    const order = await Order.create({
      userPhone,
      userName: payload.userName,
      items: payload.items, // ✅ items already have .price
      notes: payload.notes,
      photos,
      couponCode,
      totals,
      pickup: payload.pickup,
      delivery: {
        date: payload.delivery.date,
        window: payload.delivery.window,
        address: payload.delivery.address,
      },
      status: "Booked",
      history: [{ status: "Booked", note: "Order created" }],
      subscriptionPlanCode: plan?.code || null,
      pricingModel,
      serviceTier,
      slaHours,
      expectedReadyAt,
    });

    // 9️⃣ Track coupon usage
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode });
      if (coupon) {
        coupon.uses += 1;
        coupon.redemptions.push({
          userPhone,
          orderId: order._id,
          redeemedAt: DateTime.now().setZone("Africa/Lagos").toJSDate(),
        });
        await coupon.save();
      }
    }

    await notifyOrderEvent({ user: req.user, order, type: "created" });
    res.status(201).json({ order });
  } catch (err) {
    console.error("Create order failed:", err);
    next(err);
  }
};

export const getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'order not found' })
    res.json(order)
  } catch (err) {
    next(err)
  }
}

export const listUserOrders = async (req, res, next) => {
  try {
    const phone = req.user?.phone || req.query.phone
    if (!phone) return res.status(400).json({ message: 'phone required' })
    const orders = await Order.find({ userPhone: phone }).sort({
      createdAt: -1
    })
    res.json(orders)
  } catch (err) {
    next(err)
  }
}

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body
    if (!Statuses.includes(status))
      return res.status(400).json({ message: 'invalid status' })
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'order not found' })
    order.status = status
    order.history.push({ status, note })
    await order.save()
    await notifyOrderEvent({ user: order.user, order, type: 'statusUpdate' })
    res.json(order)
  } catch (err) {
    next(err)
  }
}

export const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'order not found' })
    order.status = 'Cancelled'
    order.history.push({
      status: 'Cancelled',
      note: req.body.note || 'Cancelled by admin'
    })
    await order.save()
    res.json(order)
  } catch (err) {
    next(err)
  }
}

import Order from "../models/Order.js";
import Coupon from "../models/Coupon.js";
import { uploadToCloudinary } from "../middlewares/uploadMiddleware.js";
import { Statuses } from "../models/Order.js";
import { notifyOrderEvent } from "../services/notificationService.js";
import { computeOrderTotals } from "../utils/orderTotals.js";
import { computeExpectedReadyAt } from "../utils/slaHours.js";
import User from "../models/User.js";
// import Subscription from "../models/Subscription.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import SubUsage from "../models/SubUsage.js";
import { DateTime } from "luxon";

/**
 * Create order (req.files uploaded to Cloudinary)
 */
export const createOrder = async (req, res, next) => {
  console.log("Raw req.body:", req.body);

  try {
    const payload = req.body;
    const userPhone = req.user?.phone || payload.userPhone;

    // ✅ Basic validation
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

    // 2️⃣ Normalize coupon code
    const couponCode = payload.couponCode?.trim().toUpperCase() || null;

    // 3️⃣ Check user subscription
    let plan = null;
    let usage = null;
    const user = await User.findOne({ phone: userPhone }).populate(
      "currentSubscription"
    );

    const subscription = user?.currentSubscription;
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

    // 4️⃣ Determine pricing model
    const pricingModel =
      payload.pricingModel || (plan ? "SUBSCRIPTION" : "RETAIL");

    // Strict check: user requested SUBSCRIPTION but has no active plan
    if (pricingModel === "SUBSCRIPTION" && !plan) {
      return res
        .status(400)
        .json({ message: "Active subscription plan not found" });
    }

    // 5️⃣ Resolve service tier
    const serviceTier =
      pricingModel === "SUBSCRIPTION"
        ? plan?.tier || "STANDARD"
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
        serviceTier,
      },
      { plan, usage }
    );

    // 7️⃣ SLA calculation
    const hasExpress = payload.items.some((i) => i.express);
    const expectedReadyAt = computeExpectedReadyAt(
      new Date(payload.pickup.date),
      serviceTier,
      { express: hasExpress }
    );

    const slaHours = Math.round(
      (expectedReadyAt - new Date(payload.pickup.date)) / (1000 * 60 * 60)
    );

    // 8️⃣ Create order
    const order = await Order.create({
      userPhone,
      userName: payload.userName,
      items: payload.items,
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

    // 10️⃣ Notify user
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

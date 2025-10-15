// controllers/subscriptionController.js
import Subscription from '../models/Subscription.js'
import SubscriptionPlan from '../models/SubscriptionPlan.js'
import SubUsage from '../models/SubUsage.js'
import { DateTime } from 'luxon'
import { initMonnifyPayment, cancelMonnifyMandate } from '../utils/monnify.js'
import { cancelPaystackSubscription, initPaystackPayment } from '../utils/paystack.js'
import User from '../models/User.js'

/**
 *  - Creates a PENDING subscription
 */
export const subscribe = async (req, res, next) => {
  try {
    const now = DateTime.now().setZone("Africa/Lagos");

    const userId = req.user._id;
    const { planCode, gateway } = req.body;

    // 🧩 Always fetch full user details
    const user = await User.findById(userId).select("name email phone");
    if (!user) return res.status(404).json({ message: "User not found" });

    // 🔍 Find subscription plan
    const plan = await SubscriptionPlan.findOne({ code: planCode });
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    // ❌ Prevent duplicate active plan
    const existing = await Subscription.findOne({
      customer: userId,
      plan_code: planCode,
      status: "ACTIVE"
    });
    if (existing)
      return res
        .status(400)
        .json({ message: "You already have this plan active" });

    // 🧹 Cancel other active subs
    await Subscription.updateMany(
      { customer: userId, status: "ACTIVE" },
      {
        $set: {
          status: "CANCELLED",
          ended_at: DateTime.now().setZone("Africa/Lagos").toJSDate(),
          cancelled_reason: "New plan subscribed"
        }
      }
    );

    // 🆕 Generate custom subId here
    const datePart = now.toFormat("yyyyLLdd"); // e.g. 20251015
    const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase(); // e.g. 9A4B2F
    const planPrefix = plan.code.split("_")[0]; // e.g. BASIC
    const subId = `Chuvi-${planPrefix}-${datePart}-${randomPart}`;

    // 🕓 Create new pending subscription
    const subscription = await Subscription.create({
      subId,
      customer: userId,
      plan_code: plan.code,
      plan: plan._id,
      status: "PENDING",
      start_date: now.toJSDate(),
      period_start: now.toJSDate(),
      period_end: now.plus({ months: 1 }).toJSDate(),
      renewal_date: now.plus({ months: 1 }).toJSDate()
    });

    // 🧾 Initialize payment
    let paymentInitResponse;
    const userPhone = user.phone || "00000000000";

    if (gateway === "PAYSTACK") {
      paymentInitResponse = await initPaystackPayment({
        amount: plan.price_ngn,
        email: user.email,
        name: user.name || "Customer",
        phone: userPhone,
        orderId: subId
      });
    } else {
      paymentInitResponse = await initMonnifyPayment({
        amount: plan.price_ngn,
        customerName: user.name || "Customer",
        customerEmail: user.email || "noemail@example.com",
        customerPhone: userPhone,
       orderId: subId,
        paymentMethod: "CARD"
      });
    }

    // ✅ Save payment info under unified schema
    subscription.payment = {
      method: "CARD",
      gateway: gateway || "MONNIFY",
      transactionId:
        paymentInitResponse?.reference ||
        paymentInitResponse?.transactionReference,
      checkoutUrl:
        paymentInitResponse?.checkoutUrl ||
        paymentInitResponse?.authorization_url,
      amountPaid: 0,
      balance: plan.price_ngn
    };

    await subscription.save();

    res.status(201).json({
      message: "Subscription created. Proceed to payment.",
      subscription,
      paymentLink: subscription.payment.checkoutUrl
    });
  } catch (err) {
    console.error("Subscribe error:", err);
    next(err);
  }
};
/**
 * Pause subscription
 */
export const pauseSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({
      customer: req.user._id,
      status: 'ACTIVE'
    })
    if (!subscription)
      return res.status(404).json({ message: 'No active subscription' })

    subscription.status = 'PAUSED'
    subscription.paused_at = DateTime.now().setZone('Africa/Lagos').toJSDate()
    await subscription.save()

    res.json({ message: 'Subscription paused', subscription })
  } catch (err) {
    next(err)
  }
}

/**
 * Resume paused subscription
 */
export const resumeSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({
      customer: req.user._id,
      status: 'PAUSED'
    })
    if (!subscription)
      return res.status(404).json({ message: 'No paused subscription' })

    subscription.status = 'ACTIVE'
    subscription.resumed_at = DateTime.now().setZone('Africa/Lagos').toJSDate()
    await subscription.save()

    res.json({ message: 'Subscription resumed', subscription })
  } catch (err) {
    next(err)
  }
}

/**
 * Upgrade or downgrade plan
 */
export const changePlan = async (req, res, next) => {
  try {
    const { newPlanCode } = req.body
    const userId = req.user._id

    const subscription = await Subscription.findOne({
      customer: userId,
      status: 'ACTIVE'
    })
    if (!subscription)
      return res.status(404).json({ message: 'No active subscription' })

    const newPlan = await SubscriptionPlan.findOne({ code: newPlanCode })
    if (!newPlan) return res.status(404).json({ message: 'New plan not found' })

    subscription.plan_code = newPlan.code
    subscription.changed_at = DateTime.now().setZone('Africa/Lagos').toJSDate()
    await subscription.save()

    res.json({
      message: `Subscription changed to ${newPlan.name}`,
      subscription
    })
  } catch (err) {
    next(err)
  }
}

/**
 * Rollover unused items/trips into new usage period
 */
export const rolloverUsage = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({
      customer: req.user._id,
      status: 'ACTIVE'
    })
    if (!subscription)
      return res.status(404).json({ message: 'No active subscription' })

    const plan = await SubscriptionPlan.findOne({
      code: subscription.plan_code
    })
    if (!plan) return res.status(404).json({ message: 'Plan not found' })

    const currentPeriod = DateTime.now().toFormat('yyyy-LL')
    const lastUsage = await SubUsage.findOne({
      subscription: subscription._id,
      period_label: currentPeriod
    })

    if (!lastUsage)
      return res
        .status(400)
        .json({ message: 'No usage record for current period' })

    // rollover unused items (capped at plan's rollover limit)
    const unusedItems = Math.max(0, plan.monthly_items - lastUsage.items_used)
    const rolloverItems = Math.min(unusedItems, plan.rollover_limit_items || 0)

    // create next period usage doc
    const nextPeriod = DateTime.now().plus({ months: 1 }).toFormat('yyyy-LL')
    const newUsage = await SubUsage.findOneAndUpdate(
      { subscription: subscription._id, period_label: nextPeriod },
      {
        $inc: { rollover_items: rolloverItems }
      },
      { upsert: true, new: true }
    )

    res.json({
      message: 'Rollover applied',
      currentPeriod,
      nextPeriod,
      rolloverItems,
      newUsage
    })
  } catch (err) {
    next(err)
  }
}

export const getCurrentSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({
      customer: req.user._id,
      status: 'ACTIVE'
    })

    if (!subscription) {
      return res.status(404).json({ message: 'No active subscription' })
    }

    res.json({ subscription })
  } catch (err) {
    next(err)
  }
}

export const cancelSubscription = async (req, res) => {
  try {
     const { subId } = req.params
 // subscription ID
    const subscription = await Subscription.findById(subId);

    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    // Prevent double cancellation
    if (subscription.status === "CANCELLED") {
      return res.status(400).json({ message: "Subscription already cancelled" });
    }

    // 🔁 Identify gateway
    const gateway = subscription.payment?.gateway;

    // 🚫 Cancel auto-payment if applicable
    if (gateway === "MONNIFY") {
      const mandateRef = subscription.payment?.monnify?.authorizationRef;
      if (mandateRef) {
        await cancelMonnifyMandate(mandateRef);
      }
    } else if (gateway === "PAYSTACK") {
      const subscriptionCode = subscription.payment?.paystack?.subscriptionCode; // optional
      const authorizationCode = subscription.payment?.paystack?.authorizationCode;

      if (subscriptionCode) {
        // Case 1: Using Paystack Subscription API
        await cancelPaystackSubscription(subscriptionCode);
      } else if (authorizationCode) {
        // Case 2: Manual recurring via stored authorization
        subscription.payment.paystack.authorizationCode = null;
        subscription.auto_payment_cancelled = true;
      }
    }

    // 🧾 Update subscription status
    subscription.status = "CANCELLED";
    subscription.auto_payment_cancelled = true;
    subscription.canceled_reason = req.body.reason || "User cancelled manually";
    subscription.ended_at = new Date();

    await subscription.save();

    return res.json({
      success: true,
      message: "Subscription cancelled successfully",
      subscription,
    });
  } catch (err) {
    console.error("Cancel subscription error:", err);
    res.status(500).json({
      message: "Failed to cancel subscription",
      error: err.message,
    });
  }
};

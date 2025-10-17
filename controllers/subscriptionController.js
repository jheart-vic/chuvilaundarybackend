// controllers/subscriptionController.js
import Subscription from '../models/Subscription.js'
import SubscriptionPlan from '../models/SubscriptionPlan.js'
import SubUsage from '../models/SubUsage.js'
import { DateTime } from 'luxon'
import { initMonnifyPayment, cancelMonnifyMandate } from '../utils/monnify.js'
import { cancelPaystackSubscription, initPaystackPayment } from '../utils/paystack.js'
import User from '../models/User.js'
import crypto from "crypto";

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
    await User.findByIdAndUpdate(userId, {
      $set: { currentSubscription: subscription._id }
    });

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
// export const changePlan = async (req, res, next) => {
//   try {
//     const { newPlanCode } = req.body
//     const userId = req.user._id

//     const subscription = await Subscription.findOne({
//       customer: userId,
//       status: 'ACTIVE'
//     })
//     if (!subscription)
//       return res.status(404).json({ message: 'No active subscription' })

//     const newPlan = await SubscriptionPlan.findOne({ code: newPlanCode })
//     if (!newPlan) return res.status(404).json({ message: 'New plan not found' })

//     subscription.plan_code = newPlan.code
//     subscription.changed_at = DateTime.now().setZone('Africa/Lagos').toJSDate()
//     await subscription.save()

//     res.json({
//       message: `Subscription changed to ${newPlan.name}`,
//       subscription
//     })
//   } catch (err) {
//     next(err)
//   }
// }

export const changePlan = async (req, res, next) => {
  try {
    const { newPlanCode, paymentGateway = 'PAYSTACK' } = req.body;
    const userId = req.user._id;

    const subscription = await Subscription.findOne({
      customer: userId,
      status: 'ACTIVE'
    });
    if (!subscription) return res.status(404).json({ message: 'No active subscription' });

    const newPlan = await SubscriptionPlan.findOne({ code: newPlanCode });
    if (!newPlan) return res.status(404).json({ message: 'New plan not found' });

    // 1️⃣ Prorate
    const now = DateTime.now().setZone('Africa/Lagos');
    const periodStart = DateTime.fromJSDate(subscription.period_start).setZone('Africa/Lagos');
    const periodEnd = DateTime.fromJSDate(subscription.period_end).setZone('Africa/Lagos');
    const totalDays = periodEnd.diff(periodStart, 'days').days;
    const usedDays = now.diff(periodStart, 'days').days;
    const remainingDays = totalDays - usedDays;

    const oldPlan = await SubscriptionPlan.findOne({ code: subscription.plan_code });
    const unusedCredit = (oldPlan.price / totalDays) * remainingDays;
    const newPlanCharge = (newPlan.price / totalDays) * remainingDays;
    let adjustedAmount = newPlanCharge - unusedCredit;

    subscription.plan_code = newPlan.code;
    subscription.changed_at = now.toJSDate();
    subscription.amountDue = adjustedAmount > 0 ? adjustedAmount : 0;
    subscription.balance = adjustedAmount > 0 ? adjustedAmount : Math.abs(adjustedAmount);
    await subscription.save();

    // 2️⃣ Fetch user details for payment
    const user = await User.findById(userId);

    // 3️⃣ Initiate gateway payment if needed
    let paymentInfo = null;
    if (adjustedAmount > 0) {
      if (paymentGateway === 'PAYSTACK') {
        paymentInfo = await initPaystackPayment({
          email: user.email,
          name: user.fullName,
          phone: user.phone,
          amount: adjustedAmount,
          orderId: subscription.subId
        });
      } else if (paymentGateway === 'MONNIFY') {
        paymentInfo = await initMonnifyPayment({
          customerName: user.fullName,
          customerEmail: user.email,
          customerPhone: user.phone,
          amount: adjustedAmount,
          orderId: subscription.subId,
        });
      }
    }

    res.json({
      message: `Subscription changed to ${newPlan.name}. Adjusted amount due: ₦${adjustedAmount.toFixed(2)}`,
      subscription,
      payment: paymentInfo
    });
  } catch (err) {
    next(err);
  }
};

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
      status: { $in: ["ACTIVE", "PAUSED"] }
    }).populate(
      "plan",
      "name code family tier price_ngn monthly_items included_trips overageFee sla_hours express_multiplier sameDay_multiplier rollover_limit_items"
    ).populate('usage');

    if (!subscription) {
      return res
        .status(404)
        .json({ message: "You don't have any subscription yet" });
    }

    // 🕒 Calculate days left
    const now = DateTime.now().setZone("Africa/Lagos");
    const renewalDate = DateTime.fromJSDate(subscription.renewal_date);
    const daysLeft = Math.max(0, Math.ceil(renewalDate.diff(now, "days").days));

    // 🔁 Determine auto-renew status
    const autoRenew =
      subscription.status === "ACTIVE" &&
      !["CANCELLED", "CANCEL_AT_PERIOD_END"].includes(subscription.status);

    // 🔢 Calculate items remaining
    const currentUsage = subscription.usage[subscription.usage.length - 1]; // latest period
    const itemsRemaining = subscription.plan.monthly_items +
                           (currentUsage?.rollover_items || subscription.rollover_balance || 0) -
                           (currentUsage?.items_used || 0) -
                           (currentUsage?.overage_items || 0);

    const formatted = {
      id: subscription._id,
      subId: subscription.subId,
      status: subscription.status,
      startedAt: subscription.start_date,
      periodStart: subscription.period_start,
      periodEnd: subscription.period_end,
      renewalDate: subscription.renewal_date,
      renewalCount: subscription.renewal_count,
      rolloverBalance: subscription.rollover_balance || 0,
      pauseCountQuarter: subscription.pause_count_qtr || 0,
      daysLeft,
      autoRenew,
      itemsRemaining: itemsRemaining > 0 ? itemsRemaining : 0, // never negative

      plan: {
        name: subscription.plan?.name,
        code: subscription.plan?.code,
        tier: subscription.plan?.tier,
        family: subscription.plan?.family,
        price: subscription.plan?.price_ngn,
        monthlyItems: subscription.plan?.monthly_items,
        includedTrips: subscription.plan?.included_trips,
        overageFee: subscription.plan?.overageFee,
        slaHours: subscription.plan?.sla_hours,
        expressMultiplier: subscription.plan?.express_multiplier,
        sameDayMultiplier: subscription.plan?.sameDay_multiplier,
        rolloverLimitItems: subscription.plan?.rollover_limit_items
      },

      payment: {
        method: subscription.payment?.method,
        gateway: subscription.payment?.gateway,
        status: subscription.payment?.status,
        amountPaid: subscription.payment?.amountPaid,
        balance: subscription.payment?.balance,
      }
    };

    res.json({ subscription: formatted });
  } catch (err) {
    next(err);
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const { subId } = req.params;
    const subscription = await Subscription.findOne({ subId }).populate('customer');

    if (!subscription) return res.status(404).json({ message: "Subscription not found" });

    if (subscription.auto_payment_cancelled) {
      return res.status(400).json({ message: "Auto payment already cancelled" });
    }

    const gateway = subscription.payment?.gateway;

    // Cancel the auto-payment remotely
    if (gateway === "MONNIFY") {
      const mandateRef = subscription.payment?.monnify?.authorizationRef;
      if (mandateRef) await cancelMonnifyMandate(mandateRef);
    } else if (gateway === "PAYSTACK") {
      const subscriptionCode = subscription.payment?.paystack?.subscriptionCode;
      const authorizationCode = subscription.payment?.paystack?.authorizationCode;
      if (subscriptionCode) await cancelPaystackSubscription(subscriptionCode);
      if (authorizationCode) subscription.payment.paystack.authorizationCode = null;
    }

    // ✅ Mark auto-payment as cancelled locally
    subscription.auto_payment_cancelled = true;
    subscription.canceled_reason = req.body.reason || "Auto-payment cancelled";
    await subscription.save();

    return res.json({
      success: true,
      message: "Auto-payment cancelled successfully. Current plan remains active.",
      subscription
    });
  } catch (err) {
    console.error("Cancel auto-payment error:", err);
    res.status(500).json({ message: "Failed to cancel auto-payment", error: err.message });
  }
};



// export const cancelSubscription = async (req, res) => {
//   try {
//     const { subId } = req.params;

//     // ✅ Find by custom subscription ID
//     const subscription = await Subscription.findOne({ subId }).populate('customer');

//     if (!subscription) {
//       return res.status(404).json({ message: "Subscription not found" });
//     }

//     // ❌ Prevent double cancellation
//     if (subscription.status === "CANCELLED") {
//       return res.status(400).json({ message: "Subscription already cancelled" });
//     }

//     // 🔁 Identify payment gateway
//     const gateway = subscription.payment?.gateway;

//     // 🚫 Cancel auto-payment remotely if applicable
//     if (gateway === "MONNIFY") {
//       const mandateRef = subscription.payment?.monnify?.authorizationRef;
//       if (mandateRef) {
//         try {
//           await cancelMonnifyMandate(mandateRef);
//         } catch (err) {
//           console.error("Monnify mandate cancellation failed:", err);
//           return res.status(500).json({
//             message: "Failed to cancel Monnify mandate",
//             error: err.message
//           });
//         }
//       }
//     } else if (gateway === "PAYSTACK") {
//       const subscriptionCode = subscription.payment?.paystack?.subscriptionCode;
//       const authorizationCode = subscription.payment?.paystack?.authorizationCode;

//       if (subscriptionCode) {
//         try {
//           await cancelPaystackSubscription(subscriptionCode);
//         } catch (err) {
//           console.error("Paystack subscription cancellation failed:", err);
//           return res.status(500).json({
//             message: "Failed to cancel Paystack subscription",
//             error: err.message
//           });
//         }
//       } else if (authorizationCode) {
//         // Manual recurring via stored authorization
//         subscription.payment.paystack.authorizationCode = null;
//         subscription.auto_payment_cancelled = true;
//       }
//     }

//     // 🧾 Update subscription status locally
//     subscription.status = "CANCELLED";
//     subscription.auto_payment_cancelled = subscription.auto_payment_cancelled || true;
//     subscription.canceled_reason = req.body.reason || "User cancelled manually";
//     subscription.ended_at = new Date();

//     await subscription.save();

//     return res.json({
//       success: true,
//       message: "Subscription cancelled successfully",
//       subscription
//     });
//   } catch (err) {
//     console.error("Cancel subscription error:", err);
//     res.status(500).json({
//       message: "Failed to cancel subscription",
//       error: err.message
//     });
//   }
// };


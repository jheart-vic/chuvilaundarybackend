// controllers/subscriptionController.js
import Subscription from '../models/Subscription.js'
import SubscriptionPlan from '../models/SubscriptionPlan.js'
import SubUsage from '../models/SubUsage.js'
import { DateTime } from 'luxon'

/**
 * Subscribe user to a plan
 */
export const subscribe = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { planCode } = req.body;

    const plan = await SubscriptionPlan.findOne({ code: planCode });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    // Check if the user already has this plan active
    const existing = await Subscription.findOne({
      customer: userId,
      plan_code: planCode,
      status: 'ACTIVE'
    });

    if (existing) {
      return res.status(400).json({
        message: 'You already have this plan active'
      });
    }

    // Cancel any other active subscriptions (different plans)
    await Subscription.updateMany(
      { customer: userId, status: 'ACTIVE' },
      { $set: { status: 'CANCELLED', ended_at: DateTime.now().toJSDate() } }
    );

    const startDate = DateTime.now().setZone("Africa/Lagos");
    const renewalDate = startDate.plus({ months: 1 });
    // Create new subscription
    const subscription = await Subscription.create({
      customer: userId,
      plan_code: plan.code,
      status: 'ACTIVE',
      started_at: startDate.toJSDate(),
      renewal_date: renewalDate.toJSDate()
    });


    // Create initial usage record for current period
    const currentPeriod = startDate.toFormat("yyyy-LL"); // e.g. "2025-09"
    await SubUsage.create({
      subscription: subscription._id,
      period_label: currentPeriod,
      items_used: 0,
      trips_used: 0,
      overage_items: 0,
      express_orders_used: 0,
      computed_overage_fee_ngn: 0,
      on_time_pct: 100
    });

    res.status(201).json({ message: 'Subscribed successfully', subscription });
  } catch (err) {
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

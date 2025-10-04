// controllers/subscriptionController.js
import Subscription from '../models/Subscription.js'
import SubscriptionPlan from '../models/SubscriptionPlan.js'
import SubUsage from '../models/SubUsage.js'
import { DateTime } from 'luxon'
import { initMonnifyPayment } from '../utils/monnify.js'

/**
 *  - Creates a PENDING subscription
 */
export const subscribe = async (req, res, next) => {
  try {
    const userId = req.user._id
    const { planCode } = req.body

    // 🔍 Find subscription plan
    const plan = await SubscriptionPlan.findOne({ code: planCode })
    if (!plan) return res.status(404).json({ message: 'Plan not found' })

    // ❌ Prevent duplicate active plan
    const existing = await Subscription.findOne({
      customer: userId,
      plan_code: planCode,
      status: 'ACTIVE'
    })
    if (existing)
      return res
        .status(400)
        .json({ message: 'You already have this plan active' })

    // 🧹 Cancel other active subs
    await Subscription.updateMany(
      { customer: userId, status: 'ACTIVE' },
      {
        $set: {
          status: 'CANCELLED',
          ended_at: DateTime.now().setZone('Africa/Lagos').toJSDate(),
          cancelled_reason: 'New plan subscribed'
        }
      }
    )

    // 🕓 Create new pending subscription
    const now = DateTime.now().setZone('Africa/Lagos')
    const subscription = await Subscription.create({
      customer: userId,
      plan_code: plan.code,
      plan: plan._id,
      status: 'PENDING',
      start_date: now.toJSDate(),
      period_start: now.toJSDate(),
      period_end: now.plus({ months: 1 }).toJSDate(),
      renewal_date: now.plus({ months: 1 }).toJSDate()
    })

    // 💳 Generate Monnify payment link
    const monnifyResponse = await initMonnifyPayment({
      amount: plan.price_ngn,
      customerName: req.user.name,
      customerEmail: req.user.email,
      customerPhone: req.user.phone,
      orderId: subscription._id.toString(),
      paymentMethod: 'CARD'
    })

    const paymentLink = monnifyResponse.checkoutUrl

    res.status(201).json({
      message: 'Subscription created. Proceed to payment.',
      subscription,
      paymentLink
    })
  } catch (err) {
    console.error('Subscribe error:', err)
    next(err)
  }
}

/**
 *  Payment gateway callback (webhook)
 */
export const confirmSubscriptionPayment = async (req, res, next) => {
  try {
    const { eventType, eventData } = req.body

    // Only handle successful transactions
    if (eventType !== 'SUCCESSFUL_TRANSACTION') {
      return res
        .status(400)
        .json({ message: 'Not a successful transaction event' })
    }

    // You must ensure this ID is passed when creating the payment on Monnify
    const subscriptionId = eventData.paymentReference
    const subscription = await Subscription.findById(subscriptionId).populate(
      'plan'
    )

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' })
    }

    if (subscription.status === 'ACTIVE')
      return res.json({ message: 'Already active' })

    // Validate payment status
    if (eventData.paymentStatus !== 'PAID') {
      subscription.status = 'FAILED'
      await subscription.save()
      return res.status(400).json({ message: 'Payment not completed' })
    }

    // ✅ Activate subscription
    const startDate = DateTime.now().setZone('Africa/Lagos')
    const endDate = startDate.plus({ months: 1 })

    subscription.status = 'ACTIVE'
    subscription.start_date = startDate.toJSDate()
    subscription.period_start = startDate.toJSDate()
    subscription.period_end = endDate.toJSDate()
    subscription.renewal_date = endDate.toJSDate()
    subscription.paymentPlan = {
      method: 'CARD',
      mode: 'FULL',
      gateway: 'MONNIFY',
      lastTransactionId: eventData.transactionReference,
      authorizationRef: eventData.authorizationCode || '',
      amountPaid: eventData.amountPaid,
      balance: 0,
      currency: 'NGN'
    }

    await subscription.save()

    // 🧾 Create initial usage record
    const currentPeriod = startDate.toFormat('yyyy-LL')
    await SubUsage.create({
      subscription: subscription._id,
      period_label: currentPeriod,
      items_used: 0,
      trips_used: 0,
      overage_items: 0,
      express_orders_used: 0,
      computed_overage_fee_ngn: 0,
      on_time_pct: 100
    })

    res.json({
      message: 'Payment confirmed. Subscription activated.',
      subscription
    })
  } catch (err) {
    next(err)
  }
}

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

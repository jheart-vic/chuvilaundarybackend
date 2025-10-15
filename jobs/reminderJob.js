import cron from 'node-cron'
import Order from '../models/Order.js'

import { DateTime } from 'luxon'
import { notifyOrderEvent } from '../services/notificationService.js'

export function startReminderJobs () {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    const now = DateTime.now()
    const inOneHour = now.plus({ hours: 1 })

    // 🧺 1️⃣ Pickup reminders — status = 'Booked'
    const upcomingPickups = await Order.find({
      status: 'Booked',
      'pickup.date': { $gte: now.toJSDate(), $lte: inOneHour.toJSDate() }
    }).populate('user')

    for (const order of upcomingPickups) {
      await notifyOrderEvent({
        user: order.user,
        order,
        type: 'pickupReminder'
      })
    }

    // 🧴 2️⃣ Delivery ready reminders — status = 'Ready'
    const upcomingReadyDeliveries = await Order.find({
      status: 'Ready',
      expectedReadyAt: { $gte: now.toJSDate(), $lte: inOneHour.toJSDate() }
    }).populate('user')

    for (const order of upcomingReadyDeliveries) {
      await notifyOrderEvent({
        user: order.user,
        order,
        type: 'deliveryReminder'
      })
    }

    // 📦 3️⃣ Out-for-delivery reminders (delivery in 1 hour)
    const upcomingDeliveries = await Order.find({
      status: 'Out For Delivery',
      'delivery.date': { $gte: now.toJSDate(), $lte: inOneHour.toJSDate() }
    }).populate('user')

    for (const order of upcomingDeliveries) {
      await notifyOrderEvent({
        user: order.user,
        order,
        type: 'deliveryOnTheWay'
      })
    }
  })
}

import cron from 'node-cron';
import Order from '../models/Order.js';
import { notifyOrderEvent } from '../services/notification.service.js';
import { DateTime } from 'luxon';

export function startReminderJobs() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    const now = DateTime.now();
    const inOneHour = now.plus({ hours: 1 });

    const upcomingPickups = await Order.find({
      status: 'Booked',
      pickupTime: { $gte: now.toJSDate(), $lte: inOneHour.toJSDate() }
    }).populate('user');

    for (const order of upcomingPickups) {
      await notifyOrderEvent({ user: order.user, order, type: 'pickupReminder' });
    }
  });
}

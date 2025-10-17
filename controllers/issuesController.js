import Issue from '../models/Issue.js'
import Notification from '../models/Notification.js'
import Order from '../models/Order.js'
import { notifyIssueEvent, sendEmail } from '../services/notificationService.js'
import dotenv from 'dotenv'

dotenv.config()

// create, update, get total issues, list issues
export async function createIssue(req, res, next) {
  try {
    const { fullName, phone, order, message } = req.body;

    const issue = await Issue.create({
      fullName,
      phone,
      order,
      messages: [{ sender: 'customer', content: message }]
    });

    // Re-fetch issue with populated orderId (for response)
    const populatedIssue = await Issue.findById(issue._id)
      .populate('order', 'orderId');

    await Notification.create({
      user: req.user?._id,
      title: 'New Issue Created',
      message: `Issue reported: ${message}`,
      type: 'system'
    });

    const supportEmail = process.env.SUPPORT_EMAIL || 'support@yourapp.com';
    await sendEmail(
      supportEmail,
      'New Issue Reported',
      `<p>User <strong>${fullName}</strong> (${phone}) reported an issue:</p>
       <p><em>${message}</em></p>
       ${populatedIssue.order ? `<p>Order ID: ${populatedIssue.order.orderId}</p>` : ''}`
    );

    await notifyIssueEvent({ user: req.user, issue: populatedIssue, type: 'issue_created' });

    return res.status(201).json({ success: true, issue: populatedIssue });
  } catch (err) {
    next(err);
  }
}

export async function updateIssue(req, res, next) {
  try {
    const { id } = req.params;
    const { status, adminMessage } = req.body;

    const allowedStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // 1️⃣ Find the related order
    const order = await Order.findOne({ orderId: id });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // 2️⃣ Prepare update object
    const updateFields = {};
    const messagesToPush = [];

    // If status changed, log it as a message
    if (status) {
      if (!updateFields.$set) updateFields.$set = {};
      updateFields.$set.status = status;

      messagesToPush.push({
        sender: 'admin',
        content: `Status changed to ${status.replace('_', ' ')} by Admin`,
        createdAt: new Date()
      });
    }

    // If admin manually added a message
    if (adminMessage) {
      messagesToPush.push({
        sender: 'admin',
        content: adminMessage,
        createdAt: new Date()
      });
    }

    // Only push messages if any exist
    if (messagesToPush.length > 0) {
      updateFields.$push = { messages: { $each: messagesToPush } };
    }

    // 3️⃣ Update the issue document
    const issue = await Issue.findOneAndUpdate(
      { order: order._id },
      updateFields,
      { new: true }
    ).populate('order', 'orderId');

    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found for this order' });
    }

    // 4️⃣ Create an in-app notification
    await Notification.create({
      user: req.user?._id,
      title: 'Issue Updated',
      message: `Issue for order ${order.orderId} updated. Status: ${issue.status}`,
      type: 'system'
    });

    // 5️⃣ Send user email
    await sendEmail(
      issue.phone || issue.email,
      `Your Issue (${order.orderId}) is ${issue.status}`,
      `
        <p>Hello ${issue.fullName},</p>
        <p>Your issue regarding order <strong>${order.orderId}</strong> has been updated.</p>
        <p><strong>Status:</strong> ${issue.status}</p>
        ${
          adminMessage
            ? `<p><strong>Note from support:</strong> ${adminMessage}</p>`
            : `<p><strong>Note from support:</strong> Status changed to ${issue.status.replace('_', ' ')} by Admin.</p>`
        }
        <p>We’ll keep you informed as it progresses.</p>
      `
    );

    // 6️⃣ Notify via sockets / real-time events
    await notifyIssueEvent({ user: req.user, issue, type: 'issue_updated' });

    return res.json({ success: true, issue });
  } catch (err) {
    next(err);
  }
}

export async function getTotalIssues (req, res, next) {
  try {
    const totalIssues = await Issue.countDocuments()
    const openIssues = await Issue.countDocuments({ status: 'open' })
    const resolvedIssues = await Issue.countDocuments({ status: 'resolved' })

    res.json({
      total: totalIssues,
      open: openIssues,
      resolved: resolvedIssues
    })
  } catch (err) {
    next(err)
  }
}

export async function listIssues(req, res, next) {
  try {
    const issues = await Issue.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('order', 'orderId'); // 👈 Only include orderId

    return res.json({ success: true, issues });
  } catch (err) {
    next(err);
  }
}

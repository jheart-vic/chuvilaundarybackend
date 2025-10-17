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
    const { id } = req.params; // e.g. CHUVI-ORD-34F8D3
    const { status, adminMessage } = req.body;

    const allowedStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const updateFields = {};
    if (status) updateFields.status = status;
    if (adminMessage) {
      updateFields.$push = { messages: { sender: 'admin', content: adminMessage } };
    }

    // 1️⃣ Find the order by its custom string ID
    const order = await Order.findOne({ orderId: id });
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // 2️⃣ Use the order._id to find the linked issue
    const issue = await Issue.findOneAndUpdate(
      { order: order._id },
      updateFields,
      { new: true }
    ).populate('order', 'orderId');

    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found for this order' });
    }

    // 3️⃣ Notify and return
    await Notification.create({
      user: req.user?._id,
      title: 'Issue Updated',
      message: `Issue for order ${order.orderId} updated. Status: ${issue.status}`,
      type: 'system'
    });

    await notifyIssueEvent({ user: req.user, issue, type: "issue_updated" });

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

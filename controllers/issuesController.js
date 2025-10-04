import Issue from '../models/Issue.js'
import Notification from '../models/Notification.js'
import { notifyIssueEvent, sendEmail } from '../services/notificationService.js'
import dotenv from 'dotenv'

dotenv.config()

// create, update, get total issues, list issues

export async function createIssue (req, res, next) {
  try {
    const { fullName, phone, order, message } = req.validated || req.body

    const issue = await Issue.create({
      fullName,
      phone,
      order,
      messages: [{ sender: 'customer', content: message }]
    })

    await Notification.create({
      user: req.user?._id,
      title: 'New Issue Created',
      message: `Issue reported: ${message}`,
      type: 'system'
    })

    // ✅ Notify support (for internal tracking)
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@yourapp.com'
    await sendEmail(
      supportEmail,
      'New Issue Reported',
      `<p>User <strong>${fullName}</strong> (${phone}) reported an issue:</p>
       <p><em>${message}</em></p>
       ${order ? `<p>Order ID: ${order}</p>` : ''}`
    )

    // ✅ Notify user (using templates)
    await notifyIssueEvent({ user: req.user, issue, type: 'issue_created' })

    return res.status(201).json({ success: true, issue })
  } catch (err) {
    next(err)
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

    const updateFields = {};
    if (status) updateFields.status = status;
    if (adminMessage) {
      updateFields.$push = { messages: { sender: 'admin', content: adminMessage } };
    }

    const issue = await Issue.findByIdAndUpdate(id, updateFields, { new: true });
    if (!issue) return res.status(404).json({ success: false, error: 'Issue not found' });

    // Notify admin / system
    await Notification.create({
      user: req.user?._id,
      title: 'Issue Updated',
      message: `Issue #${issue._id} updated. Status: ${issue.status}`,
      type: 'system'
    });

    // Notify user using templates with latest message
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

export async function listIssues (req, res, next) {
  try {
    const issues = await Issue.find({}).sort({ createdAt: -1 }).limit(200)
    return res.json({ success: true, issues })
  } catch (err) {
    next(err)
  }
}

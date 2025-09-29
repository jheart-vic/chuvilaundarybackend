import Issue from '../models/Issue.js';
import Notification from '../models/Notification.js';
import { sendEmail } from '../services/notificationService.js';


export async function createIssue(req, res, next) {
  try {
    const { name, phone, order, message } = req.validated || req.body

    // 1️⃣ Save issue
    const issue = await Issue.create({ name, phone, order, message })

    // 2️⃣ Save notification (system type by default)
    await Notification.create({
      user: req.user?._id, // only if logged-in user is known
      title: 'New Issue Created',
      message: `Issue reported: ${message}`,
      type: 'system'
    })

    // 3️⃣ Send email to support/admin
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@yourapp.com'
    await sendEmail(
      supportEmail,
      'New Issue Reported',
      `<p>User <strong>${name}</strong> (${phone}) reported an issue:</p>
       <p><em>${message}</em></p>
       ${order ? `<p>Order ID: ${order}</p>` : ''}`
    )

    return res.status(201).json({ success: true, issue })
  } catch (err) {
    next(err)
  }
}


export async function updateIssue(req, res, next) {
  try {
    const { id } = req.params
    const { status, message } = req.body

    const allowedStatuses = ['open', 'in_progress', 'resolved', 'closed']
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' })
    }

    const issue = await Issue.findByIdAndUpdate(
      id,
      { ...(status && { status }), ...(message && { message }) },
      { new: true }
    )

    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' })
    }

    // 1️⃣ Save notification
    await Notification.create({
      user: req.user?._id,
      title: 'Issue Updated',
      message: `Issue #${issue._id} updated. Status: ${issue.status}`,
      type: 'system'
    })

    // 2️⃣ Send email (to user or support)
    const to = process.env.SUPPORT_EMAIL || 'support@yourapp.com'
    await sendEmail(
      to,
      'Issue Updated',
      `<p>Issue #${issue._id} has been updated.</p>
       <p>Status: ${issue.status}</p>
       <p>Message: ${issue.message}</p>`
    )

    return res.json({ success: true, issue })
  } catch (err) {
    next(err)
  }
}


export async function listIssues(req, res, next) {
try {
const issues = await Issue.find({}).sort({ createdAt: -1 }).limit(200);
return res.json({ success: true, issues });
} catch (err) { next(err); }
}
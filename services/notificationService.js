import axios from 'axios'
import nodemailer from 'nodemailer'
import Notification from '../models/Notification.js';
import dotenv from 'dotenv'
dotenv.config()

const TERMII_BASE_URL = 'https://api.ng.termii.com/api/sms/send';

// --- Send OTP via Termii ---
// const TERMII_SMS_URL = "https://v3.api.termii.com/api/sms/send";

export async function sendSMS(to, message) {
  try {
    const response = await axios.post(
      TERMII_BASE_URL,
      {
        api_key: process.env.TERMII_API_KEY,
        to,
        from: process.env.TERMII_SENDER_ID,
        sms: message,
        type: "plain",
        channel: "generic"
      },
      { headers: { "Content-Type": "application/json" } }
    );
    return response.data;
  } catch (err) {
    if (err.response) {
      console.error("SMS Error Response:", {
        status: err.response.status,
        data: err.response.data,
        url: err.config.url
      });
    } else {
      console.error("SMS Error:", err.message);
    }
    throw new Error("Failed to send SMS");
  }
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: { rejectUnauthorized: false }
})

export async function sendEmail (to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.APP_NAME}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    })
    return info
  } catch (err) {
    console.error('Email Error:', err.message)
    throw new Error('Failed to send email')
  }
}

export async function notifyOrderEvent({ user, order, type, extra = {} }) {
  const templates = {
    deliveryPin: "Your Chuvilaundry delivery PIN is {{pin}}. Share with our rider to collect your items safely.",
    loginCode: "Your Chuvilaundry login code is {{code}}. Valid for 10 minutes, one-time use only.",
    orderCreated: "Dear {{name}}, your laundry order has been received. Pickup/delivery window: {{window}}. Powered by Chuvilaundry.",
    orderReady: "Dear {{name}}, your laundry order is ready. Delivery window: {{window}}. Powered by Chuvilaundry.",
    orderDelivered: "Dear {{name}}, your laundry was delivered. Amount: ₦{{amount}}, Payment: {{method}}. Thank you for choosing Chuvilaundry.",
    rescheduled: "Dear {{name}}, due to {{reason}}, your delivery is rescheduled to {{new_window}}. Thank you for your patience. – Chuvilaundry.",
    feedback: "Dear {{name}}, how did we do? Rate your laundry service: {{feedback_link}}. Powered by Chuvilaundry.",
    pickupReminder: "Reminder: Your laundry pickup is in 1 hour. Please have your items ready. – Chuvilaundry.",
    processing: "Dear {{name}}, your laundry is now being processed. We’ll notify you when it’s ready. – Chuvilaundry.",
    complaintReceived: "Dear {{name}}, we’ve received your complaint and are working on it. Resolution update coming soon. – Chuvilaundry.",

    // ✅ Payment events
    payment_success: "Dear {{name}}, your payment of ₦{{amount}} via {{method}} was successful. Thank you for using Chuvilaundry.",
    payment_failed: "Dear {{name}}, your payment attempt of ₦{{amount}} via {{method}} has failed. Please try again or contact support. hello@chuvilaundry.com",

  // ✅ Cancellation events
    cancelled_admin: "Dear {{name}}, your laundry order was cancelled by Chuvilaundry support. Please contact us if you need further assistance. hello@chuvilaundry.com",
    cancelled_user: "Dear {{name}}, you have successfully cancelled your laundry order. If this was a mistake, kindly place a new order."
  };

  // ✅ Map admin statuses → templates
  const statusMap = {
    Processing: "processing",
    Ready: "orderReady",
    Delivered: "orderDelivered",
    Rescheduled: "rescheduled"
  };

  // If type = "statusUpdate", translate actual order.status → template key
  if (type === "statusUpdate") {
    const mappedType = statusMap[order?.status];
    if (mappedType) type = mappedType;
  }

  // Pick correct template
  const template = templates[type];
  if (!template) return;

  // Build context
  const context = {
    name: user?.name || "Customer",
    window: order?.delivery?.window || order?.pickup?.window || "",
    amount: extra.amount || order?.totals?.grandTotal || "",
    method: extra.method || order?.payment?.method || "",
    pin: extra.pin || "",
    code: extra.code || "",
    reason: extra.reason || "",
    new_window: extra.new_window || "",
    feedback_link: extra.feedback_link || ""
  };

  // Replace placeholders
  const message = template.replace(/{{(.*?)}}/g, (_, key) => context[key.trim()] || "");

  // ✅ Save notification
  await Notification.create({
    user: user._id || user.id,
    title: `Order ${type}`,
    message,
    type: ["payment_success", "payment_failed"].includes(type) ? "payment" : "order"
  });

  // ✅ Send via SMS/Email
  if (user.phone) await sendSMS(user.phone, message);
  if (user.email) await sendEmail(user.email, `Order ${type}`, `<p>${message}</p>`);
}


export async function notifyIssueEvent({ user, issue, type }) {
  const templates = {
    issue_created: "Dear {{name}}, we’ve received your issue report: \"{{message}}\". Our support team will get back to you shortly. – Chuvilaundry",
    issue_updated: "Dear {{name}}, your issue (#{{id}}) has been updated. Current status: {{status}}. Message: {{message}}"
  };

  const template = templates[type];
  if (!template) {
    console.warn(`No issue template for type: ${type}`);
    return;
  }

  const context = {
    id: issue._id,
    name: issue.name || user?.name || "Customer",
    message: issue.message || "",
    status: issue.status || "open"
  };

  const message = template.replace(/{{(.*?)}}/g, (_, key) => context[key.trim()] || "");

  // Save notification
  await Notification.create({
    user: user?._id || user?.id,
    title: type === "issue_created" ? "Issue Created" : "Issue Updated",
    message,
    type: "issue"
  });

  // Send SMS + Email
  if (user?.phone || issue.phone) {
    await sendSMS(user?.phone || issue.phone, message);
  }

  if (user?.email || issue.email) {
    await sendEmail(user?.email || issue.email, "Issue Notification", `<p>${message}</p>`);
  }
}

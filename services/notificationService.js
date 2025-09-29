import axios from 'axios'
import nodemailer from 'nodemailer'
import Notification from '../models/Notification.js';

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

// --- Wrapper for Order Events ---
export async function notifyOrderEvent ({ user, order, type }) {
  const messageTemplates = {
    created: `Hi ${user.name}, your order #${order._id} has been placed successfully!`,
    pickupReminder: `Reminder: Our rider will pick up your laundry at ${order.pickupTime}.`,
    statusUpdate: `Your order #${order._id} is now ${order.status}.`,
    cancelled: `Your order #${order._id} has been cancelled by admin. Please contact support if this is unexpected.`
  }

  const message = messageTemplates[type]
  if (!message) return

  // ✅ Save notification in DB
  await Notification.create({
    user: user._id || user.id,
    title: `Order ${type}`,
    message,
    type: type === 'statusUpdate' ? 'status' : 'order'
  })

  if (user.phone) await sendSMS(user.phone, message)
  if (user.email)
    await sendEmail(user.email, `Order ${type}`, `<p>${message}</p>`)
}

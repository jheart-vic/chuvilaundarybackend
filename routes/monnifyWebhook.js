import express from "express";
import crypto from "crypto";
import { DateTime } from "luxon";
import Order from "../models/Order.js";
import Subscription from "../models/Subscription.js";
import SubUsage from "../models/SubUsage.js";
import { notifyOrderEvent } from "../services/notificationService.js";
import dotenv from "dotenv";
import { generateReceipt } from "../utils/generateReceipt.js";
dotenv.config();

const router = express.Router();

/** ✅ Verify Monnify webhook signature */
function verifySignature(req) {
  try {
    const secret = process.env.MONNIFY_SECRET_KEY;
    const signature = req.headers["monnify-signature"];
    if (!signature || !secret) return false;

    const computedSignature = crypto
      .createHmac("sha512", secret)
      .update(req.rawBody)
      .digest("hex");

    return signature === computedSignature;
  } catch (err) {
    console.error("❌ Signature verification error:", err);
    return false;
  }
}

/** ✅ Unified Monnify webhook handler */
router.post("/webhook/monnify", async (req, res) => {
  try {
    const payload = req.body;
    console.log("🔔 Monnify Webhook Received:", {
      eventType: payload?.eventType,
      reference: payload?.eventData?.transactionReference,
    });

    if (!payload?.eventType || !payload?.eventData) {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    if (!verifySignature(req)) {
      console.warn("⚠️ Invalid Monnify signature detected");
      return res.status(401).json({ message: "Invalid signature" });
    }

    const { eventType, eventData } = payload;
    const {
      paymentReference,
      transactionReference,
      paymentStatus,
      paidAmount,
    } = eventData;

    const success = ["PAID", "SUCCESS"].includes(paymentStatus);
    const now = DateTime.now().setZone("Africa/Lagos");

    // === 🧠 Idempotency check for Orders ===
    const existingOrder = await Order.findOne({
      "payment.transactionId": transactionReference,
      "payment.status": "PAID",
    });

    if (existingOrder) {
      console.log("♻️ Duplicate webhook ignored for Order:", existingOrder._id);
      return res.status(200).json({ message: "Order already processed" });
    }

    // === 1️⃣ Handle ORDER payments ===
    const order = await Order.findOne({
      "payment.transactionId": transactionReference,
    }).populate("user");

    if (order) {
      console.log(`📦 Processing Order payment for ID: ${order._id}`);

      order.payment.amountPaid = success ? paidAmount : 0;
      order.payment.balance = success ? 0 : order.payment.balance;
      order.payment.status = success ? "PAID" : "FAILED";
      order.payment.paymentReference = paymentReference;

      const statusNote = success ? "Payment successful" : "Payment failed";
      order.status = success ? "Booked" : "Pending";
      order.history.push({ status: order.status, note: statusNote });

      await order.save();

      const receiptPath = await generateReceipt(order);

      await notifyOrderEvent({
        user: order.user,
        order,
        attachmentPath: receiptPath,
        type: success ? "orderBooked" : "payment_failed",
        extra: success
          ? { amount: order.payment.amountPaid, method: order.payment.method }
          : undefined,
      });

      await notifyOrderEvent({
        user: process.env.ADMIN_USER_ID,
        order,
        attachmentPath: receiptPath,
        type: success ? "orderBookedForAdmin" : "payment_failed_forAdmin",
      });

      console.log(
        success
          ? `✅ Order payment confirmed: ${order._id}`
          : `❌ Order payment failed: ${order._id}`
      );

      return res.status(200).json({ message: "Order webhook processed" });
    }

    // === 🧠 Idempotency check for Subscriptions ===
    const existingSub = await Subscription.findOne({
      "payment.lastTransactionId": transactionReference,
    });
    if (existingSub) {
      console.log("♻️ Duplicate webhook ignored for Subscription:", existingSub._id);
      return res.status(200).json({ message: "Subscription already processed" });
    }

    // === 2️⃣ Handle SUBSCRIPTION payments ===
    const subscription = await Subscription.findOne({
      $or: [
        { "payment.transactionId": transactionReference },
        { monnifyPaymentReference: paymentReference },
      ],
    }).populate("plan user");

    if (subscription) {
      console.log(`💳 Processing Subscription payment: ${subscription._id}`);

      if (success) {
        subscription.payment.status = "PAID";
        subscription.payment.lastTransactionId = transactionReference;
        subscription.payment.transactionId = transactionReference;
        subscription.payment.amountPaid = paidAmount;
        subscription.payment.balance = 0;
        subscription.payment.failedAttempts = 0;
        subscription.autoRenew = true;
        subscription.auto_payment_cancelled = false;
        subscription.status = "ACTIVE";

        let newPeriodStart;
        if (
          subscription.period_end &&
          DateTime.fromJSDate(subscription.period_end) > now
        ) {
          newPeriodStart = DateTime.fromJSDate(subscription.period_end);
        } else {
          newPeriodStart = now;
        }

        subscription.period_start = newPeriodStart.toJSDate();
        subscription.period_end = newPeriodStart.plus({ months: 1 }).toJSDate();
        subscription.renewal_date = newPeriodStart.plus({ months: 1 }).toJSDate();
        subscription.start_date = subscription.start_date || now.toJSDate();
        subscription.renewal_count += 1;
        subscription.lastRenewalId = `REN-${Date.now().toString(36)}-${Math.floor(
          Math.random() * 9999
        )}`;

        await subscription.save();

        const periodLabel = now.toFormat("yyyy-LL");
        await SubUsage.findOneAndUpdate(
          { subscription: subscription._id, period_label: periodLabel },
          {
            $setOnInsert: {
              subscription: subscription._id,
              period_label: periodLabel,
              items_used: 0,
              trips_used: 0,
              overage_items: 0,
              express_orders_used: 0,
              computed_overage_fee_ngn: 0,
              on_time_pct: 100,
            },
          },
          { upsert: true, new: true }
        );

        console.log(`✅ Subscription renewed: ${subscription._id}`);
      } else {
        subscription.payment.status = "FAILED";
        subscription.payment.failedAttempts += 1;

        if (subscription.payment.failedAttempts >= 3) {
          subscription.status = "PAUSED";
          console.warn(`⚠️ Subscription auto-paused after 3 failures: ${subscription._id}`);
        }

        await subscription.save();
        console.log(`❌ Subscription payment failed: ${subscription._id}`);
      }

      return res.status(200).json({ message: "Subscription webhook processed" });
    }

    // === Nothing matched ===
    console.warn("⚠️ No matching Order or Subscription found for webhook:", {
      paymentReference,
      transactionReference,
    });
    return res.status(404).json({ message: "No matching record found" });
  } catch (err) {
    console.error("❌ Monnify Webhook Error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;

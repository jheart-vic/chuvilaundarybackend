// routes/monnifyWebhook.js
import express from "express";
import Order from "../models/Order.js";
import { notifyOrderEvent } from "../services/notificationService.js";


const router = express.Router();

/**
 * Monnify Webhook
 * - Configure the URL in Monnify Dashboard
 * - Example: https://yourdomain.com/api/webhook/monnify
 */
router.post("/webhook/monnify", async (req, res) => {
  try {
    const payload = req.body;
    console.log("🔔 Monnify Webhook Received:", payload);

    if (!payload?.eventType || !payload?.eventData) {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    const {
      paymentReference,
      transactionReference,
      paymentStatus,
      paidAmount,
    } = payload.eventData;

    // 🔎 Find order linked to this transaction
    const order = await Order.findOne({
      "payment.transactionId": transactionReference,
    }).populate("user");

    if (!order) {
      console.warn("⚠️ Order not found for transaction:", transactionReference);
      return res.status(404).json({ message: "Order not found" });
    }

    // 📝 Update payment status
    let notifyType = null;
    if (paymentStatus === "PAID" || paymentStatus === "SUCCESS") {
      order.payment.amountPaid = paidAmount;
      order.payment.balance = 0;
      order.payment.status = "PAID";
      order.payment.paymentReference = paymentReference; // ✅ Save Monnify reference
      order.status = "Confirmed";
      order.history.push({ status: "Confirmed", note: "Payment successful" });
      notifyType = "payment_success";
    } else {
      order.payment.status = "FAILED";
      order.payment.paymentReference = paymentReference; // ✅ Still save it
      order.history.push({ status: "Failed", note: "Payment failed" });
      notifyType = "payment_failed";
    }

    await order.save();

    // 🔔 Send notification using correct template
    if (notifyType === "payment_success") {
      await notifyOrderEvent({
        user: order.user,
        order,
        type: "orderDelivered", // or you can add a new "paymentSuccess" template
        extra: { amount: order.payment.amountPaid, method: order.payment.method },
      });
    } else if (notifyType === "payment_failed") {
      await notifyOrderEvent({
        user: order.user,
        order,
        type: "payment_failed", // add template for this
      });
    }

    res.status(200).json({ message: "Webhook processed" });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

// utils/paystack.js
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY

export async function initPaystackPayment ({
  amount,
  email,
  name,
  phone,
  orderId
}) {
  try {
    const payload = {
      email,
      amount: amount * 100, // in kobo
      metadata: { name, phone, orderId },
      callback_url: `${process.env.FRONTEND_URL}/payment/verify/${orderId}`
    }

    const res = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      payload,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
      }
    )

    return res.data.data // contains reference and authorization_url
  } catch (err) {
    console.error('Paystack init failed:', err.response?.data || err.message)
    throw new Error('Failed to initialize Paystack payment')
  }
}


export async function cancelPaystackSubscription(subscriptionCode) {
  try {
    const res = await axios.delete(
      `https://api.paystack.co/subscription/${subscriptionCode}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      }
    );
    return res.data;
  } catch (err) {
    console.error("Paystack cancel subscription failed:", err.response?.data || err.message);
    throw new Error("Failed to cancel Paystack subscription");
  }
}
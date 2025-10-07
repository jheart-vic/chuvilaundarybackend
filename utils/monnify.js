// utils/monnify.js
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const MONNIFY_BASE_URL = 'https://sandbox.monnify.com/api'
const API_KEY = process.env.MONNIFY_API_KEY
const SECRET_KEY = process.env.MONNIFY_SECRET_KEY
const CONTRACT_CODE = process.env.MONNIFY_CONTRACT_CODE

async function getAuthToken () {
  const auth = Buffer.from(`${API_KEY}:${SECRET_KEY}`).toString('base64')
  const res = await axios.post(
    `${MONNIFY_BASE_URL}/v1/auth/login`,
    {},
    {
      headers: { Authorization: `Basic ${auth}` }
    }
  )
  return res.data.responseBody.accessToken
}

export async function initMonnifyPayment ({
  amount,
  customerName,
  customerEmail,
  customerPhone,
  orderId,
  paymentMethod
}) {
  const token = await getAuthToken()

  const payload = {
    amount,
    customerName,
    customerEmail,
    customerPhoneNumber: customerPhone,
    paymentReference: orderId,
    paymentDescription: `Order Payment - ${orderId}`,
    currencyCode: 'NGN',
    contractCode: CONTRACT_CODE,
    redirectUrl: process.env.MONNIFY_REDIRECT_URL,
    paymentMethods: [paymentMethod]
  }

  const res = await axios.post(
    `${MONNIFY_BASE_URL}/v1/merchant/transactions/init-transaction`,
    payload,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  )

  return res.data.responseBody
}


// 🚫 Cancel recurring auto-payment (mandate)
export async function cancelMonnifyMandate (mandateReference) {
  const token = await getAuthToken()

  const res = await axios.delete(
    `${MONNIFY_BASE_URL}/v1/recurring/mandates/${mandateReference}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  )

  return res.data
}
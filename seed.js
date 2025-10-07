// // testFlow.js
// import mongoose from "mongoose";
// import * as monnifyModule from "./utils/monnify.js";
// import SubscriptionPlan from "./models/SubscriptionPlan.js";
// import Subscription from "./models/Subscription.js";
// import SubUsage from "./models/SubUsage.js";
// import Order from "./models/Order.js";
// import User from "./models/User.js";
// import { subscribe, confirmSubscriptionPayment } from "./controllers/subscriptionController.js";
// import { computeOrderTotals } from "./utils/orderTotals.js";
// import dotenv from "dotenv";
// dotenv.config();

// const monnify = {
//   ...monnifyModule,
//   initMonnifyPayment: async ({ amount, customerName, customerEmail, orderId }) => {
//     console.log(`💳 Mock Monnify: Initialized payment for ₦${amount}`);
//     return {
//       checkoutUrl: `https://mock.monnify.com/pay/${orderId}`,
//       transactionReference: `MOCK_TRX_${Date.now()}`,
//     };
//   },
// };

// async function connectDB() {
//   await mongoose.connect(process.env.MONGO_URI);
//   console.log("✅ Connected to MongoDB");
// }

// function mockExpress(methodBody, user, body = {}) {
//   const req = { user, body };
//   const res = {
//     status(code) {
//       this.statusCode = code;
//       return this;
//     },
//     json(data) {
//       console.log(`🧩 Response [${this.statusCode || 200}]:`, data);
//     },
//   };
//   const next = (err) => err && console.error("❌ Error:", err);
//   return methodBody(req, res, next);
// }

// // 🧹 Clean DB
// async function resetTestData() {
//   await Promise.all([
//     User.deleteMany({ email: "testuser@example.com" }),
//     SubscriptionPlan.deleteMany({ code: "PREM_CHOICE_24" }),
//     Subscription.deleteMany({}),
//     SubUsage.deleteMany({}),
//     Order.deleteMany({}),
//   ]);
//   console.log("🧹 Cleared old test data");
// }

// // 🧩 Seed plan
// async function seedPlan() {
//   const plan = await SubscriptionPlan.create({
//     code: "PREM_CHOICE_24",
//     name: "Premium Choice Plan",
//     family: "PREM_CHOICE",
//     tier: "PREMIUM",
//     monthly_items: 20,
//     overageFee: 500,
//     included_trips: 2,
//     price_ngn: 5000,
//     sla_hours: 48,
//   });
//   console.log("✅ Seeded plan:", plan.name);
//   return plan;
// }

// // 🧭 Subscription Flow
// async function testSubscriptionFlow(user, plan) {
//   console.log("\n=== 🧭 Testing Subscription Flow ===");
//   try {
//     await mockExpress(subscribe, user, { planCode: plan.code });

//     const sub = await Subscription.findOne({ customer: user._id }).sort({ createdAt: -1 });
//     if (!sub) throw new Error("Subscription not created");

//     const webhookReq = {
//       body: {
//         eventType: "SUCCESSFUL_TRANSACTION",
//         eventData: {
//           paymentReference: sub._id.toString(),
//           paymentStatus: "PAID",
//           amountPaid: plan.price_ngn,
//           transactionReference: `TRX_${Date.now()}`,
//         },
//       },
//     };

//     const webhookRes = {
//       status(code) {
//         this.statusCode = code;
//         return this;
//       },
//       json(data) {
//         console.log(`📡 Webhook [${this.statusCode || 200}]:`, data.message);
//       },
//     };

//     await confirmSubscriptionPayment(webhookReq, webhookRes, console.error);

//     const active = await Subscription.findOne({ customer: user._id, status: "ACTIVE" });
//     const usage = await SubUsage.findOne({ subscription: active._id });

//     if (active && usage) {
//       console.log("✅ Subscription flow passed!");
//       return true;
//     }
//     throw new Error("Subscription flow failed");
//   } catch (err) {
//     console.error("❌ Subscription flow error:", err.message);
//     return false;
//   }
// }

// // 🧾 Retail Flow
// async function testRetailFlow(user) {
//   console.log("\n=== 🧾 Testing Retail Flow ===");
//   try {
//     const order = await Order.create({
//       user: user._id,
//       items: [
//         { serviceCode: "WASHFOLD01", quantity: 3, express: false },
//         { serviceCode: "WASHFOLD01", quantity: 2, express: true },
//       ],
//       delivery: { distanceKm: 5 },
//       serviceTier: "STANDARD",
//       deliveryPin: "1234",
//       userPhone: user.phone,
//       pricingModel: "RETAIL",
//     });

//     console.log("🆕 Retail Order Created:", order._id);

//     const totals = await computeOrderTotals(order);
//     console.log("💵 Computed Totals:", totals);

//     order.status = "Booked";
//     order.payment = {
//       method: "CARD",
//       gateway: "MONNIFY",
//       transactionId: `MOCK_${Date.now()}`,
//       amount: totals.grandTotal,
//     };
//     await order.save();

//     console.log("✅ Retail order confirmed!");
//     return true;
//   } catch (err) {
//     console.error("❌ Retail flow error:", err.message);
//     return false;
//   }
// }

// // MAIN TEST RUNNER
// async function runTest() {
//   await connectDB();
//   await resetTestData();

//   const user = await User.create({
//     name: "Test User",
//     email: "testuser@example.com",
//     phone: "08012345678",
//     password: "hashed_password",
//   });

//   const plan = await seedPlan();

//   const subPass = await testSubscriptionFlow(user, plan);
//   const retailPass = await testRetailFlow(user);

//   console.log("\n=== ✅ FINAL TEST SUMMARY ===");
//   console.log(`Subscription Flow: ${subPass ? "✅ Passed" : "❌ Failed"}`);
//   console.log(`Retail Flow: ${retailPass ? "✅ Passed" : "❌ Failed"}`);

//   await mongoose.disconnect();
//   console.log("\n🧩 Test run completed\n");
// }

// runTest().catch((err) => console.error(err));


// import { io } from "socket.io-client";

// const socket = io("http://localhost:4000"); // your server URL

// socket.on("connect", () => {
//   console.log("✅ Connected as client:", socket.id);
// });

// socket.on("disconnect", () => {
//   console.log("⚠️ Disconnected");
// });


import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

// Load keys from env (or you can hardcode for testing)
const API_KEY = process.env.MONNIFY_API_KEY || "MK_TEST_89GW1P7VPU";
const SECRET_KEY = process.env.MONNIFY_SECRET_KEY || "HDC0CN26SGQ6NYY3P7X6Q11SE7XQPUSH";
const BASE_URL = process.env.MONNIFY_BASE_URL || "https://sandbox.monnify.com";

// Function to login
export const monnifyLogin = async () => {
  try {
    const auth = Buffer.from(`${API_KEY}:${SECRET_KEY}`).toString("base64");

    const res = await axios.post(
      `${BASE_URL}/api/v1/auth/login`,
      {}, // Monnify expects an empty JSON object
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (res.data.requestSuccessful) {
      console.log("✅ Monnify login successful");
      console.log("Access token:", res.data.responseBody.accessToken);
      return res.data.responseBody.accessToken;
    } else {
      console.error("❌ Monnify login failed:", res.data.responseCode, res.data.responseMessage);
      return null;
    }
  } catch (err) {
    console.error("⚠️ Monnify login error:", err.response?.data || err.message);
    return null;
  }
};

// Test login
monnifyLogin();

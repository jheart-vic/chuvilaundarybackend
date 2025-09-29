// import mongoose from "mongoose";
import dotenv from "dotenv";
// import crypto from "crypto";
// import User from "./models/User.js";
// import Order from "./models/Order.js";
// import Coupon from "./models/Coupon.js";

dotenv.config();

// async function seed() {
//   try {
//     await mongoose.connect(process.env.MONGO_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     console.log("✅ Connected to MongoDB");

//     // 1. Clear existing
//     await User.deleteMany({});
//     await Order.deleteMany({});
//     await Coupon.deleteMany({});

//     // 2. Create Admin User
// const admin = await User.create({
//   fullName: "Super Admin",
//   phone: "08011111111",
//   role: "admin",
//   email: "admin@test.com",
//   password: "password123",
//   referralCode: crypto.randomBytes(4).toString("hex"),
// });

// console.log("👑 Admin created:", admin.phone);

// const employee = await User.create({
//   fullName: "Employee One",
//   phone: "08022222222",
//   role: "employee",
//   email: "employee1@test.com",
//   password: "password123",
//   referralCode: crypto.randomBytes(4).toString("hex"),
// });

//     console.log("👑 Admin created:", employee.phone);

//     // 4. Create Regular Customer
//     const customer = await User.create({
//       fullName: "Test Customer",
//       phone: "08033333333",
//       role: "user",
//       password: "password123",
//   referralCode: crypto.randomBytes(4).toString("hex"),
//     });
//     console.log("👤 Customer created:", customer.phone);

//     // 5. Create a Test Order
//     const order = await Order.create({
//       user: customer._id,
//       serviceType: "wash_fold",
//       items: [
//         { name: "Shirt", quantity: 3 },
//         { name: "Towel", quantity: 2 },
//       ],
//       status: "booked",
//       history: [{ status: "booked", note: "Order created via seed" }],
//       address: "Awka, Anambra",
//       totalAmount: 2500,
//     });
//     console.log("📦 Order created:", order._id.toString());

//     // 6. Create a Test Coupon
//     const coupon = await Coupon.create({
//       code: "WELCOME10",
//       discountPercent: 10,
//       expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
//       minOrderValue: 1000,
//       maxUses: 50,
//     });
//     console.log("🏷️ Coupon created:", coupon.code);

//     console.log("✅ Seeding completed successfully.");
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Error seeding database:", err);
//     process.exit(1);
//   }
// }

// seed();

// // seedPlans.js
// import mongoose from "mongoose";
// import SubscriptionPlan from "./models/SubscriptionPlan.js";

// async function seed() {
// await mongoose.connect(process.env.MONGO_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     console.log("✅ Connected to MongoDB");

//   const plans = [
//     {
//       code: "PREM_CHOICE_24",
//       name: "Premium Choice 24",
//       family: "PREM_CHOICE",
//       tier: "PREMIUM",
//       monthly_items: 24,
//       included_trips: 4,
//       price_ngn: 15000,
//       sla_hours: 48,
//       express_multiplier: 1.2,
//       delivery_km_included: 5,
//       delivery_fee_per_km: 500,
//       discount_pct: 10,
//       priority_overhead_per_item_ngn: 200,
//       active: true,
//     },
//     {
//       code: "BASIC_SAVER_12",
//       name: "Basic Saver 12",
//       family: "BASIC_SAVER",
//       tier: "STANDARD",
//       monthly_items: 12,
//       included_trips: 2,
//       price_ngn: 8000,
//       sla_hours: 48,
//       active: true,
//     },
//     {
//       code: "VIP_SIG_30",
//       name: "VIP Signature 30",
//       family: "VIP",
//       tier: "SIGNATURE",
//       monthly_items: 30,
//       included_trips: 6,
//       price_ngn: 25000,
//       sla_hours: 24,
//       express_multiplier: 1.2,
//       active: true,
//     }
//   ];

//   await SubscriptionPlan.deleteMany({});
//   await SubscriptionPlan.insertMany(plans);

//   console.log("✅ Subscription plans seeded");
//   mongoose.connection.close();
// }

// seed();


// // scripts/seedServicePricing.js
// import mongoose from "mongoose";
// import ServicePricing from "./models/ServicePricing.js";
// import Service from "./models/Service.js";



// async function seedServicePricing() {
//   try {
//     await mongoose.connect(process.env.MONGO_URI);
//     console.log("✅ Connected to MongoDB");

//     const services = await Service.find();
//     console.log(`Found ${services.length} services`);

//     for (const service of services) {
//       const tiers = ["STANDARD", "PREMIUM", "SIGNATURE"]; // define your tiers

//       for (const tier of tiers) {
//         const exists = await ServicePricing.findOne({
//           serviceCode: service.code,
//           serviceTier: tier,
//           pricingModel: "RETAIL",
//         });

//         if (!exists) {
//           // 👇 define tier multipliers
//           let price = service.basePrice || 1000;
//           if (tier === "EXPRESS") price = Math.round(price * 1.5);
//           if (tier === "DELUXE") price = Math.round(price * 2);

//           await ServicePricing.create({
//             serviceCode: service.code,
//             serviceName: service.name,
//             serviceTier: tier,
//             pricingModel: "RETAIL",
//             pricePerItem: price,
//           });

//           console.log(`➕ Added pricing for ${service.code} (${tier})`);
//         } else {
//           console.log(`✔️ Already has pricing for ${service.code} (${tier})`);
//         }
//       }
//     }

//     console.log("🎉 Seeding complete");
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Error seeding:", err);
//     process.exit(1);
//   }
// }

// seedServicePricing();

// import mongoose from "mongoose"
// import Order from "./models/Order.js" // adjust path
// import User from "./models/User.js"   // adjust path


// async function seed() {
//   try {
//     await mongoose.connect(process.env.MONGO_URI)
//     console.log("Connected to MongoDB ✅")

//     const userPhone = "+2347083896876"

//     // Ensure user exists
//     let user = await User.findOne({ phone: userPhone })
//     if (!user) {
//       user = await User.create({
//         phone: userPhone,
//         name: "Victor Test"
//       })
//       console.log("Created test user")
//     }

//     const order = await Order.create({
//       userPhone,
//       userName: "Victor Test",
//       items: [
//         {
//           serviceCode: "WASHFOLD01",
//           serviceName: "Wash & Fold",
//           quantity: 3,
//           unit: "pcs",
//           itemNotes: "Handle gently",
//           price: 800,
//           addOns: []
//         },
//         {
//           serviceCode: "WASHFOLD01",
//           serviceName: "Wash & Fold",
//           quantity: 2,
//           unit: "pcs",
//           price: 800,
//           express: true,
//           addOns: [{ key: "STARCH", name: "Extra Starch", price: 200 }]
//         }
//       ],
//       notes: "Seeded order",
//       pickup: {
//         date: new Date("2025-09-28T09:00:00.000Z"),
//         window: "9am-12pm",
//         address: {
//           line1: "12 Arthur Eze Avenue",
//           line2: "Flat 2B",
//           city: "Awka",
//           state: "Anambra",
//           landmark: "Close to Temp site",
//           zone: "zone1"
//         }
//       },
//       delivery: {
//         date: new Date("2025-09-30T15:00:00.000Z"),
//         window: "3pm-6pm",
//         address: {
//           line1: "12 Arthur Eze Avenue",
//           line2: "Flat 2B",
//           city: "Awka",
//           state: "Anambra",
//           landmark: "Close to Temp site",
//           zone: "zone1"
//         }
//       },
//       pricingModel: "RETAIL",
//       serviceTier: "PREMIUM",   // 👈 key line for your debugging
//       slaHours: 48,
//       expectedReadyAt: new Date("2025-09-30T09:00:00.000Z"),
//       status: "Booked",
//       history: [{ status: "Booked", note: "Seed order created" }]
//     })

//     console.log("✅ Seeded order:", order._id)
//   } catch (err) {
//     console.error("Seed error:", err)
//   } finally {
//     await mongoose.disconnect()
//   }
// }

// seed()


// import mongoose from "mongoose";

// import User from "./models/User.js";
// import Subscription from "./models/Subscription.js";


// const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/laundry";

// const seedSubscription = async () => {
//   try {
//     await mongoose.connect(MONGO_URI);
//     console.log("MongoDB connected");

//     // 1️⃣ Find the user
//     const user = await User.findOne({ phone: "+2347083896876" });
//     if (!user) {
//       console.log("User not found");
//       return;
//     }

//     // 2️⃣ Create subscription
//     const subscription = new Subscription({
//       customer: user._id,
//       plan_code: "PREM_CHOICE_24",
//       status: "ACTIVE",
//       start_date: new Date(),
//       renewal_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
//       rollover_cap_pct: 25,
//       rollover_balance: 0,
//       pause_count_qtr: 0,
//       delivery_zone_status: "INSIDE",
//     });

//     await subscription.save();
//     console.log("Subscription created:", subscription._id);

//     // 3️⃣ Update user
//     user.currentSubscription = subscription._id;
//     await user.save();

//     console.log("User updated with currentSubscription");
//     process.exit(0);
//   } catch (err) {
//     console.error(err);
//     process.exit(1);
//   }
// };

// seedSubscription();


import nodemailer from "nodemailer";


async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true if you switch to port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.APP_NAME}" <${process.env.SMTP_USER}>`,
      to: "adebowalevictorjheart@gmail.com", // replace with your own address to test
      subject: "SMTP Local Test",
      html: "<p>Hello 🚀 — this is a test from Chuvilu Laundry</p>",
    });

    console.log("✅ Message sent:", info.messageId);
  } catch (err) {
    console.error("❌ Error sending:", err.message);
  }
}

main();

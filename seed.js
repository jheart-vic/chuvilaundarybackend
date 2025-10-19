// // import mongoose from "mongoose";
// import dotenv from "dotenv";
// // import Service from "./models/Service.js";
// // import ServicePricing from "./models/ServicePricing.js";

// dotenv.config();

// // const services = [
// //   { name: "Shirt", code: "SHIRT", basePrice: 500 },
// //   { name: "Trouser", code: "TROUSER", basePrice: 500 },
// //   { name: "Simple Dress", code: "SIMPLE_DRESS", basePrice: 700 },
// //   { name: "Jeans", code: "JEANS", basePrice: 700 },
// //   { name: "Native (Top & Bottom)", code: "NATIVE", basePrice: 1000 },
// //   { name: "Bedsheet", code: "BEDSHEET", basePrice: 700 },
// //   { name: "Pillowcase", code: "PILLOWCASE", basePrice: 400 },
// //   { name: "Duvet", code: "DUVET", basePrice: 2500 },
// //   {name:"Agbada", code:"AGBADA", basePrice: 1500}
// // ];

// // const tiers = [
// //   { serviceTier: "STANDARD", multiplier: 1 },
// //   { serviceTier: "PREMIUM", multiplier: 1.35 },
// //   { serviceTier: "VIP", multiplier: 1.7 },
// // ];

// // async function seed() {
// //   try {
// //     await mongoose.connect(process.env.MONGO_URI);
// //     console.log("✅ Connected to MongoDB");

// //     await Service.deleteMany({});
// //     await ServicePricing.deleteMany({});

// //     for (const svc of services) {
// //       const newService = await Service.create({
// //         name: svc.name,
// //         code: svc.code,
// //         description: `${svc.name} laundry service`,
// //         basePrice: svc.basePrice,
// //         unit: "item",
// //         addOns: [
// //           { key: "hand_finish", name: "Delicates hand-finish", price: 500 },
// //           { key: "express", name: "Express 24-hour", price: 500 },
// //           { key: "same_day", name: "Same-day (6h/8h/12h)", price: 800 },
// //         ],
// //       });

// //       for (const tier of tiers) {
// //         const price = Math.round((svc.basePrice * tier.multiplier) / 100) * 100;
// //         await ServicePricing.create({
// //           serviceCode: newService.code,
// //           pricingModel: "RETAIL",
// //           serviceTier: tier.serviceTier,
// //           pricePerItem: price,
// //           expressMultiplier: 1.5,
// //           sameDayMultiplier: 1.8,
// //           delivery_km_included: 0,
// //           delivery_fee_per_km: 500,
// //         });
// //       }
// //     }

// //     console.log("✅ Services & Pricing seeded successfully!");
// //     process.exit();
// //   } catch (err) {
// //     console.error("❌ Error seeding data:", err);
// //     process.exit(1);
// //   }
// // }

// // seed();

// // scripts/seedServices.js
// import mongoose from "mongoose";
// import Service from "./models/Service.js";
// import ServicePricing from "./models/ServicePricing.js";

// // Connection URI
// const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/laundry_app";

// // --- Helper: calculate tier price ---
// const calcTierPrice = (base, tier) => {
//   switch (tier) {
//     case "PREMIUM":
//       return Math.round(base * 1.35 / 100) * 100 || Math.round(base * 1.35); // round to nearest ₦100
//     case "VIP":
//       return Math.round(base * 1.7 / 100) * 100 || Math.round(base * 1.7);
//     default:
//       return base;
//   }
// };

// // --- Seed data ---
// const services = [
//   { name: "Shirt", code: "SHRT", basePrice: 500 },
//   { name: "Trouser", code: "TRUS", basePrice: 500 },
//   { name: "Simple Dress", code: "SIMD", basePrice: 700 },
//   { name: "Jeans", code: "JEAN", basePrice: 700 },
//   { name: "Native (Top & Bottom)", code: "NATV", basePrice: 1000 },
//   { name: "Bedsheet", code: "BESH", basePrice: 700 },
//   { name: "Pillowcase", code: "PECS", basePrice: 400 },
//   { name: "Duvet", code: "DUVT", basePrice: 2500 },
//   { name: "Agbada", code: "AGBA", basePrice: 1500 },
// ];

// async function seed() {
//   await mongoose.connect(MONGO_URI);
//   console.log("✅ Connected to MongoDB");

//   await Service.deleteMany({});
//   await ServicePricing.deleteMany({});
//   console.log("🧹 Cleared existing services and pricings");

//   for (const svc of services) {
//     const service = await Service.create({
//         name: svc.name,
//         code: svc.code,
//         basePrice: svc.basePrice,
//         description: `${svc.name} laundry service`,
//       unit: "item",
//       turnaroundHours: 48,
//         addOns: [
//           { key: "hand_finish", name: "Delicates hand-finish", price: 500 },
//           { key: "express", name: "Express 24-hour", price: 500 },
//           { key: "same_day", name: "Same-day (6h/8h/12h)", price: 800 },
//         ],
//     });

//     const tiers = ["STANDARD", "PREMIUM", "VIP"];
//     for (const tier of tiers) {
//       const price = calcTierPrice(svc.basePrice, tier);
//       await ServicePricing.create({
//         service: service._id,
//         serviceTier: tier,
//         pricingModel: "RETAIL",
//         pricePerItem: price,
//         expressMultiplier: 1.5,
//         sameDayMultiplier: 1.8,
//       });
//     }

//     console.log(`✅ Seeded: ${service.name}`);
//   }

//   console.log("🌟 All services and pricings seeded successfully");
//   await mongoose.disconnect();
//   process.exit(0);
// }

// seed().catch(err => {
//   console.error("❌ Seeding failed:", err);
//   process.exit(1);
// });





// export async function updateIssue(req, res, next) {
//   try {
//     const { id } = req.params;
//     const { status, adminMessage } = req.body;

//     const allowedStatuses = ['open', 'in_progress', 'resolved', 'closed'];
//     if (status && !allowedStatuses.includes(status)) {
//       return res.status(400).json({ success: false, error: 'Invalid status' });
//     }

//     const order = await Order.findOne({ orderId: id });
//     if (!order) {
//       return res.status(404).json({ success: false, error: 'Order not found' });
//     }

//     // ✅ Combine $set and $push properly
//     const updateFields = {};
//     if (status) updateFields.$set = { status };
//     if (adminMessage) {
//       updateFields.$push = {
//         messages: {
//           sender: 'admin',
//           content: adminMessage,
//           createdAt: new Date()
//         }
//       };
//     }

//     const issue = await Issue.findOneAndUpdate(
//       { order: order._id },
//       updateFields,
//       { new: true }
//     ).populate('order', 'orderId');

//     if (!issue) {
//       return res.status(404).json({ success: false, error: 'Issue not found for this order' });
//     }

//     await Notification.create({
//       user: req.user?._id,
//       title: 'Issue Updated',
//       message: `Issue for order ${order.orderId} updated. Status: ${issue.status}`,
//       type: 'system'
//     });

//     await sendEmail(
//       issue.phone || issue.email,
//       `Your Issue (${order.orderId}) is ${issue.status}`,
//       `
//         <p>Hello ${issue.fullName},</p>
//         <p>Your issue regarding order <strong>${order.orderId}</strong> has been updated.</p>
//         <p><strong>Status:</strong> ${issue.status}</p>
//         ${
//           adminMessage
//             ? `<p><strong>Note from support:</strong> ${adminMessage}</p>`
//             : ''
//         }
//         <p>We’ll keep you informed as it progresses.</p>
//       `
//     );

//     await notifyIssueEvent({ user: req.user, issue, type: 'issue_updated' });

//     return res.json({ success: true, issue });
//   } catch (err) {
//     next(err);
//   }
// }





// export async function updateIssue(req, res, next) {
//   try {
//     const { id } = req.params;
//     const { status, adminMessage } = req.body;

//     const allowedStatuses = ['open', 'in_progress', 'resolved', 'closed'];
//     if (status && !allowedStatuses.includes(status)) {
//       return res.status(400).json({ success: false, error: 'Invalid status' });
//     }

//     // 1️⃣ Find the related order
//     const order = await Order.findOne({ orderId: id });
//     if (!order) {
//       return res.status(404).json({ success: false, error: 'Order not found' });
//     }

//     // 2️⃣ Prepare update object
//     const updateFields = {};
//     const messagesToPush = [];

//     // If status changed, log it as a message
//     if (status) {
//       if (!updateFields.$set) updateFields.$set = {};
//       updateFields.$set.status = status;

//       messagesToPush.push({
//         sender: 'admin',
//         content: `Status changed to ${status.replace('_', ' ')} by Admin`,
//         createdAt: new Date()
//       });
//     }

//     // If admin manually added a message
//     if (adminMessage) {
//       messagesToPush.push({
//         sender: 'admin',
//         content: adminMessage,
//         createdAt: new Date()
//       });
//     }

//     // Only push messages if any exist
//     if (messagesToPush.length > 0) {
//       updateFields.$push = { messages: { $each: messagesToPush } };
//     }

//     // 3️⃣ Update the issue document
//     const issue = await Issue.findOneAndUpdate(
//       { order: order._id },
//       updateFields,
//       { new: true }
//     ).populate('order', 'orderId');

//     if (!issue) {
//       return res.status(404).json({ success: false, error: 'Issue not found for this order' });
//     }

//     // 4️⃣ Create an in-app notification
//     await Notification.create({
//       user: req.user?._id,
//       title: 'Issue Updated',
//       message: `Issue for order ${order.orderId} updated. Status: ${issue.status}`,
//       type: 'system'
//     });

//     // 5️⃣ Send user email
//     await sendEmail(
//       issue.phone || issue.email,
//       `Your Issue (${order.orderId}) is ${issue.status}`,
//       `
//         <p>Hello ${issue.fullName},</p>
//         <p>Your issue regarding order <strong>${order.orderId}</strong> has been updated.</p>
//         <p><strong>Status:</strong> ${issue.status}</p>
//         ${
//           adminMessage
//             ? `<p><strong>Note from support:</strong> ${adminMessage}</p>`
//             : `<p><strong>Note from support:</strong> Status changed to ${issue.status.replace('_', ' ')} by Admin.</p>`
//         }
//         <p>We’ll keep you informed as it progresses.</p>
//       `
//     );

//     // 6️⃣ Notify via sockets / real-time events
//     await notifyIssueEvent({ user: req.user, issue, type: 'issue_updated' });

//     return res.json({ success: true, issue });
//   } catch (err) {
//     next(err);
//   }
// }

// ✅ Reward inviter and new user if valid referral
if (inviter) {
  const REFERRAL_BONUS = 500; // ₦500 bonus each

  // Reward inviter
  inviter.referralCredits = (inviter.referralCredits || 0) + REFERRAL_BONUS;
  await inviter.save();

  await Notification.create({
    user: inviter._id,
    title: "Referral Bonus Earned 🎉",
    message: `${fullName} signed up using your referral code! You earned ₦${REFERRAL_BONUS} referral bonus.`,
    type: "referral",
  });

  // Reward the new user
  newUser.referralCredits = (newUser.referralCredits || 0) + REFERRAL_BONUS;
  await newUser.save();

  await Notification.create({
    user: newUser._id,
    title: "Welcome Bonus 🎁",
    message: `You joined using a referral code and earned ₦${REFERRAL_BONUS} bonus credit.`,
    type: "referral",
  });
}
